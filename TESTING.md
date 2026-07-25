# Testing Guide

## Automated Suites

| Command | Focus |
|---|---|
| `node test-api.js` | Dashboard, records CRUD, validation, analytics, chat, API 404s |
| `node test-chat.js` | Chat validation, intents, punctuation normalization, fallback behavior |
| `npm run test:phase10` | Targeted validation regressions, analytics contract, SQLite integrity/indexes |

On Windows systems where PowerShell blocks `npm.ps1`, use:

```bash
npm.cmd run test:phase10
```

## Coverage

### Backend and CRUD

- Dashboard response contract
- Record list, pagination, sort, date/month/status filters
- Create success and duplicate-date conflict
- Update success, missing record, invalid body, and invalid ID
- Delete success, repeat deletion, and missing record
- API 404 handling

### Validation

- Required fields, invalid statuses, negative numeric values
- Invalid date formats and impossible calendar dates
- Invalid and partial pagination values
- Invalid and partial route IDs
- Invalid analytics month values

### Analytics and Database

- All-time and month-scoped analytics responses
- Weekly, monthly, yearly, stock, and abnormal-usage datasets
- SQLite `PRAGMA integrity_check`
- Required indexes on `DailyRecords`

### Chatbot

- Empty, missing, and over-length messages
- Supported kitchen-data intents
- Case, spacing, and punctuation normalization
- Unknown-intent fallback

### Frontend Manual/Browser Checks

- Dashboard, Records, Analytics, and Chat routes render
- Records filter, modal, refresh, and CSV export controls are reachable
- Chat quick suggestion produces a live response
- No browser-console errors after interaction
- Desktop and mobile layouts are verified during UI phases

## Latest Results

The Phase 10 run recorded:

- 43/43 API checks passed
- 105/105 chatbot checks passed
- 11/11 targeted regression and database checks passed

Read [TESTING_REPORT.md](TESTING_REPORT.md) for the detailed execution record and fixed defects.

## Adding Tests

Keep tests deterministic and clean up any records created during CRUD tests. Add new backend regressions to `test-phase10.js` when they validate a specific defect or contract. Keep broad API checks in `test-api.js` and intent/normalization checks in `test-chat.js`.
