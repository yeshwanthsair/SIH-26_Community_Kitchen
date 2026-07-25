'use strict';
/**
 * app.js — Community Kitchen frontend entry point.
 *
 * Responsibilities:
 *  - Sidebar open/close + overlay (mobile)
 *  - Page routing (hash-based)
 *  - Dark / light mode toggle + persistence
 *  - Live clock / date in topbar
 *  - Refresh button
 *  - Wires together all feature modules
 */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Elements ───────────────────────────────────────────────── */
  const sidebar        = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const sidebarClose   = document.getElementById('sidebarClose');
  const menuToggle     = document.getElementById('menuToggle');
  const themeToggle    = document.getElementById('themeToggle');
  const themeIcon      = themeToggle?.querySelector('.theme-icon');
  const refreshBtn     = document.getElementById('refreshBtn');
  const topbarDate     = document.getElementById('topbarDate');
  const pageTitle      = document.getElementById('pageTitle');
  const breadcrumbIcon = document.getElementById('breadcrumbIcon');
  const alertDismiss   = document.getElementById('alertDismiss');
  const navLinks       = document.querySelectorAll('.nav-link[data-page]');
  const appToastRegion = document.getElementById('appToastRegion');
  const appLoading     = document.getElementById('appLoading');
  let appToastTimer    = null;

  /* ── Dark mode ──────────────────────────────────────────────── */
  const savedTheme = localStorage.getItem('ck-theme') ||
    (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(savedTheme);

  themeToggle?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next    = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('ck-theme', next);
    showAppToast(`${next === 'dark' ? 'Dark' : 'Light'} theme enabled`);
    // Redraw charts for new theme colours
    if (window.Dashboard) window.Dashboard.renderCharts && _currentPage === 'dashboard' && window.Dashboard.init();
  });

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (themeIcon) themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    themeToggle?.setAttribute('aria-pressed', String(theme === 'dark'));
    themeToggle?.setAttribute('title', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
  }

  function showAppToast(message) {
    if (!appToastRegion) return;
    appToastRegion.textContent = message;
    appToastRegion.classList.add('is-visible');
    clearTimeout(appToastTimer);
    appToastTimer = setTimeout(() => appToastRegion.classList.remove('is-visible'), 3200);
  }

  /* ── Sidebar ────────────────────────────────────────────────── */
  function openSidebar() {
    sidebar?.classList.add('open');
    sidebarOverlay?.classList.add('active');
    sidebarOverlay?.removeAttribute('aria-hidden');
    menuToggle?.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden'; // prevent background scroll
  }

  function closeSidebar() {
    sidebar?.classList.remove('open');
    sidebarOverlay?.classList.remove('active');
    sidebarOverlay?.setAttribute('aria-hidden', 'true');
    menuToggle?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  menuToggle?.addEventListener('click', () => {
    sidebar?.classList.contains('open') ? closeSidebar() : openSidebar();
  });
  sidebarClose?.addEventListener('click', closeSidebar);
  sidebarOverlay?.addEventListener('click', closeSidebar);

  // Close sidebar on Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sidebar?.classList.contains('open')) closeSidebar();
  });

  // Close sidebar when a nav link is clicked on mobile
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });

  /* ── Live Date / Time ───────────────────────────────────────── */
  function updateClock() {
    if (!topbarDate) return;
    const now = new Date();
    const opts = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    topbarDate.textContent = now.toLocaleDateString('en-IN', opts);
  }
  updateClock();
  setInterval(updateClock, 60_000);

  /* ── Alert dismiss ──────────────────────────────────────────── */
  alertDismiss?.addEventListener('click', () => {
    document.getElementById('lowStockAlert')?.classList.add('hidden');
  });

  /* ── Page routing ───────────────────────────────────────────── */
  const PAGE_META = {
    dashboard:    { title: 'Dashboard',    icon: '📊' },
    records:      { title: 'Register',     icon: '📋' },
    'records-view': { title: 'Records',    icon: '🗂️' },
    analytics:    { title: 'Analytics',    icon: '📈' },
    chat:         { title: 'Chat',         icon: '💬' },
  };

  let _currentPage = '';

  function navigateTo(page) {
    if (!PAGE_META[page]) page = 'dashboard';
    if (_currentPage === page) return;
    _currentPage = page;

    // Update nav links
    navLinks.forEach(l => {
      const active = l.dataset.page === page;
      l.classList.toggle('active', active);
      l.setAttribute('aria-current', active ? 'page' : 'false');
    });

    // Show/hide pages
    document.querySelectorAll('.page').forEach(p => {
      const isCurrent = p.id === `page-${page}`;
      p.classList.toggle('hidden', !isCurrent);
      if (isCurrent) {
        p.classList.remove('page--enter');
        void p.offsetWidth;
        p.classList.add('page--enter');
      }
    });

    // Update topbar
    const meta = PAGE_META[page];
    if (pageTitle)      pageTitle.textContent      = meta.title;
    if (breadcrumbIcon) breadcrumbIcon.textContent = meta.icon;
    document.title = `${meta.title} — Community Kitchen`;

    // Load page data
    if (page === 'dashboard' && window.Dashboard) {
      window.Dashboard.init();
    }
    if (page === 'records' && window.Register) {
      window.Register.init();
    }
    if (page === 'records-view' && window.RecordsView) {
      window.RecordsView.init();
    }
    if (page === 'analytics' && window.Analytics) {
      window.Analytics.init();
    }
    if (page === 'chat' && window.Chatbot) {
      window.Chatbot.init();
    }
  }

  // Hash-based routing
  function handleRoute() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    navigateTo(hash);
  }

  navLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const page = link.dataset.page;
      window.location.hash = page;
    });
  });

  window.addEventListener('hashchange', handleRoute);

  /* ── Refresh button ─────────────────────────────────────────── */
  refreshBtn?.addEventListener('click', async () => {
    refreshBtn.classList.add('spinning');
    refreshBtn.disabled = true;
    appLoading?.classList.remove('hidden');
    try {
      if (_currentPage === 'dashboard' && window.Dashboard) {
        await window.Dashboard.init();
      }
      if (_currentPage === 'records' && window.Register) {
        await window.Register.reload();
      }
      if (_currentPage === 'records-view' && window.RecordsView) {
        await window.RecordsView.reload();
      }
      if (_currentPage === 'analytics' && window.Analytics) {
        await window.Analytics.reload();
      }
    } finally {
      refreshBtn.classList.remove('spinning');
      refreshBtn.disabled = false;
      appLoading?.classList.add('hidden');
      showAppToast('Latest data is ready');
    }
  });

  /* ── Boot ───────────────────────────────────────────────────── */
  handleRoute();

  console.log('[App] Community Kitchen v1.0.0 loaded.');
});
