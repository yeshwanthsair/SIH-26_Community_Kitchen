'use strict';
/**
 * chatbot.js — Phase 8: AI Assistant
 *
 * Powers two surfaces:
 *  1. Floating bubble widget  (#floatChatWidget)  — always visible
 *  2. Full chat page          (#page-chat)        — navigated via sidebar
 *
 * Both share the same conversation history, normalisation logic, and
 * POST /api/chat backend.  Sending from one surface mirrors to the other.
 *
 * Input normalisation (client-side, mirroring backend):
 *  1. Trim whitespace
 *  2. Lowercase
 *  3. Remove punctuation
 *  4. Collapse multiple spaces
 */

/* ─── Conversation history ───────────────────────────────────────── */
// Each entry: { role: 'user'|'bot', text, intent, time }
const _history = [];
let _floatOpen     = false;
let _floatUnread   = 0;
let _pageChatReady = false;
let _busy          = false;

/* ─── DOM refs ───────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

/* ═══════════════════════════════════════════════════════════════════
   BOOTSTRAP
   ═══════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  _initFloat();
  // Page chat is initialised lazily on first navigation (see initChatPage)
});

/* ═══════════════════════════════════════════════════════════════════
   INPUT NORMALISATION  (mirrors backend normalizeMessage)
   ═══════════════════════════════════════════════════════════════════ */

function normalise(raw) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // remove punctuation
    .replace(/\s+/g, ' ')      // collapse spaces
    .trim();
}

/* ═══════════════════════════════════════════════════════════════════
   API CALL
   ═══════════════════════════════════════════════════════════════════ */

async function _sendToApi(rawMessage) {
  const res  = await fetch('/api/chat', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ message: rawMessage }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || `Server error ${res.status}`);
  }
  return json.data; // { intent, answer, data }
}

/* ═══════════════════════════════════════════════════════════════════
   SEND MESSAGE  (shared core)
   ═══════════════════════════════════════════════════════════════════ */

async function _send(rawMessage) {
  const text = rawMessage.trim();
  if (!text || _busy) return;

  _busy = true;
  const now = _timeStr();

  // 1. Record user turn
  _history.push({ role: 'user', text, time: now });
  _renderMessage('user', text, null, now);

  // 2. Show typing
  _setTyping(true);

  try {
    // 3. Call API (backend also normalises — we send raw for display)
    const result = await _sendToApi(text);
    const answer = result.answer || "I don't know that yet.";
    const intent = result.intent || 'unknown';

    _setTyping(false);

    // 4. Record bot turn
    const botTime = _timeStr();
    _history.push({ role: 'bot', text: answer, intent, time: botTime });
    _renderMessage('bot', answer, intent, botTime);

    // 5. If float is closed, bump badge
    if (!_floatOpen) {
      _floatUnread++;
      _updateBadge();
    }

  } catch (err) {
    _setTyping(false);
    const errMsg = 'Sorry, I could not reach the server. Please try again.';
    const errTime = _timeStr();
    _history.push({ role: 'bot', text: errMsg, intent: 'error', time: errTime });
    _renderMessage('bot', errMsg, 'error', errTime);
  } finally {
    _busy = false;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   RENDER HELPERS  (write to BOTH surfaces simultaneously)
   ═══════════════════════════════════════════════════════════════════ */

function _renderMessage(role, text, intent, time) {
  const isUser = role === 'user';
  const html   = _buildBubble(role, text, intent, time);

  // Float panel
  const floatLog = $('floatMessages');
  if (floatLog) {
    _removeWelcome(floatLog);
    floatLog.insertAdjacentHTML('beforeend', html);
    floatLog.scrollTop = floatLog.scrollHeight;
  }

  // Full page
  const pageLog = $('chatWindow');
  if (pageLog && _pageChatReady) {
    _removeWelcome(pageLog);
    pageLog.insertAdjacentHTML('beforeend', html);
    pageLog.scrollTop = pageLog.scrollHeight;
  }

  // Hide quick chips after first user message
  if (isUser) {
    $('floatQuickChips')?.classList.add('hidden');
  }
}

function _buildBubble(role, text, intent, time) {
  const isUser  = role === 'user';
  const avatar  = isUser ? '👤' : '👨‍🍳';
  const rowCls  = isUser ? 'msg-row--user' : 'msg-row--bot';
  const isUnknown = intent === 'unknown' || intent === 'error';

  const intentTag = (!isUser && intent && intent !== 'unknown' && intent !== 'error')
    ? `<span class="msg-intent-tag">${_intentLabel(intent)}</span><br>`
    : '';

  return `
    <div class="msg-row ${rowCls}" role="article" aria-label="${isUser ? 'You' : 'Assistant'}">
      <div class="msg-avatar" aria-hidden="true">${avatar}</div>
      <div class="msg-bubble${isUnknown && !isUser ? ' msg-bubble--unknown' : ''}">
        ${intentTag}${_escHtml(text)}
        <span class="msg-time" aria-label="Sent at ${time}">${time}</span>
      </div>
    </div>`;
}

function _intentLabel(intent) {
  const MAP = {
    meals_today:    '🍽️ Today',
    rice_stock:     '📦 Stock',
    average_meals:  '📊 Average',
    highest_meals:  '🏆 Peak',
    rice_usage:     '🌾 Rice',
    cost:           '₹ Cost',
    low_stock:      '⚠️ Low Stock',
    monthly_meals:  '📅 This Month',
    total_meals:    '🔢 Total',
    summary:        '🗂️ Summary',
    status_info:    '📆 Status',
    weekly_meals:   '📅 Weekly',
  };
  return MAP[intent] || intent;
}

function _removeWelcome(container) {
  container.querySelector('.chat-welcome')?.remove();
  container.querySelector('.float-welcome')?.remove();
}

function _setTyping(active) {
  // Float typing
  const ft = $('floatTyping');
  if (ft) ft.classList.toggle('hidden', !active);

  // Page typing
  const pt = $('chatTyping');
  if (pt) pt.classList.toggle('hidden', !active);

  // Disable inputs
  [$('floatChatInput'), $('chatPageInput')].forEach(el => {
    if (el) el.disabled = active;
  });
  [$('floatChatForm')?.querySelector('button[type=submit]'),
   $('chatPageForm')?.querySelector('button[type=submit]')].forEach(btn => {
    if (btn) btn.disabled = active;
  });
}

/* ═══════════════════════════════════════════════════════════════════
   FLOATING BUBBLE
   ═══════════════════════════════════════════════════════════════════ */

function _initFloat() {
  const toggle   = $('floatChatToggle');
  const closeBtn = $('floatChatClose');
  const form     = $('floatChatForm');
  const input    = $('floatChatInput');
  const chips    = document.querySelectorAll('.quick-chip');

  toggle?.addEventListener('click', _toggleFloat);
  closeBtn?.addEventListener('click', _closeFloat);

  form?.addEventListener('submit', e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    _send(text);
  });

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const msg = chip.dataset.msg;
      if (msg) _send(msg);
    });
  });

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _floatOpen) _closeFloat();
  });
}

function _toggleFloat() {
  _floatOpen ? _closeFloat() : _openFloat();
}

function _openFloat() {
  _floatOpen = true;
  _floatUnread = 0;
  _updateBadge();

  const panel    = $('floatChatPanel');
  const toggle   = $('floatChatToggle');
  const openIcon = toggle?.querySelector('.float-chat-icon');
  const closeIcon= toggle?.querySelector('.float-chat-close-icon');

  panel?.classList.remove('hidden');
  toggle?.setAttribute('aria-expanded', 'true');
  openIcon?.classList.add('hidden');
  closeIcon?.classList.remove('hidden');

  // Scroll to bottom
  const log = $('floatMessages');
  if (log) setTimeout(() => { log.scrollTop = log.scrollHeight; }, 50);

  $('floatChatInput')?.focus();
}

function _closeFloat() {
  _floatOpen = false;

  const panel    = $('floatChatPanel');
  const toggle   = $('floatChatToggle');
  const openIcon = toggle?.querySelector('.float-chat-icon');
  const closeIcon= toggle?.querySelector('.float-chat-close-icon');

  panel?.classList.add('hidden');
  toggle?.setAttribute('aria-expanded', 'false');
  openIcon?.classList.remove('hidden');
  closeIcon?.classList.add('hidden');
}

function _updateBadge() {
  const badge = $('floatBadge');
  if (!badge) return;
  if (_floatUnread > 0) {
    badge.textContent = _floatUnread > 9 ? '9+' : String(_floatUnread);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

/* ═══════════════════════════════════════════════════════════════════
   FULL CHAT PAGE
   ═══════════════════════════════════════════════════════════════════ */

function initChatPage() {
  if (_pageChatReady) {
    // Already set up — just replay history into the page window
    _replayToPage();
    return;
  }
  _pageChatReady = true;

  const form     = $('chatPageForm');
  const input    = $('chatPageInput');
  const clearBtn = $('clearChatBtn');

  form?.addEventListener('submit', e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    _send(text);
  });

  clearBtn?.addEventListener('click', () => {
    _clearHistory();
  });

  // Suggestion buttons on the page sidebar
  document.querySelectorAll('.chat-suggestion').forEach(btn => {
    btn.addEventListener('click', () => {
      const msg = btn.dataset.msg;
      if (msg) {
        if (input) input.value = '';
        _send(msg);
      }
    });
  });

  // Replay existing history (from float) into page
  _replayToPage();
}

function _replayToPage() {
  const log = $('chatWindow');
  if (!log) return;

  // Clear and rebuild
  log.innerHTML = '';

  if (_history.length === 0) {
    log.innerHTML = `
      <div class="chat-welcome" id="chatWelcome">
        <span class="chat-welcome-icon" aria-hidden="true">👨‍🍳</span>
        <h3>Hello! I'm your Kitchen Assistant.</h3>
        <p>Ask me anything about meals, stock, costs, or usage patterns.</p>
      </div>`;
    return;
  }

  _history.forEach(({ role, text, intent, time }) => {
    log.insertAdjacentHTML('beforeend', _buildBubble(role, text, intent, time));
  });

  setTimeout(() => { log.scrollTop = log.scrollHeight; }, 50);
}

function _clearHistory() {
  _history.length = 0;

  // Reset page
  const log = $('chatWindow');
  if (log) {
    log.innerHTML = `
      <div class="chat-welcome" id="chatWelcome">
        <span class="chat-welcome-icon" aria-hidden="true">👨‍🍳</span>
        <h3>Hello! I'm your Kitchen Assistant.</h3>
        <p>Ask me anything about meals, stock, costs, or usage patterns.</p>
      </div>`;
  }

  // Reset float
  const floatLog = $('floatMessages');
  if (floatLog) {
    floatLog.innerHTML = `<div class="float-welcome"><p>Hi! Ask me about meals, stock, or costs 👋</p></div>`;
  }

  // Show quick chips again
  $('floatQuickChips')?.classList.remove('hidden');

  _floatUnread = 0;
  _updateBadge();
}

/* ═══════════════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════════════ */

function _timeStr() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ═══════════════════════════════════════════════════════════════════
   EXPORT
   ═══════════════════════════════════════════════════════════════════ */
window.Chatbot = { init: initChatPage, send: _send, normalise };
