# Community Kitchen

**v1.0.0 — Production-ready**

Community Kitchen is a web application for recording daily meal distribution, ingredient consumption, stock balances, and operating status for a community kitchen. It provides a responsive dashboard, data register, searchable records, analytics, CSV export, and a data-backed conversational assistant.

## How to Run

```bash
git clone https://github.com/yeshwanthsair/SIH-26_Community_Kitchen.git
cd SIH-26_Community_Kitchen
npm install
cp .env.example .env
npm start
```

Open **http://localhost:3000** in your browser.

For development with auto-restart:

```bash
npm run dev
```

Optional — initialize and seed sample data:

```bash
npm run db:init
npm run db:seed
```

## Overview

The application is a single-page interface backed by an Express API and a SQLite database. Kitchen staff can enter one record per calendar day, while coordinators can review operational history, track consumption, detect low stock, and export records for reporting.

Key capabilities:

- Daily operational record creation, editing, and deletion
- Dashboard cards, charts, status summaries, and low-stock alerts
- Records filtering, sorting, pagination, and CSV export
- Analytics for weekly, monthly, and yearly trends
- Low-stock, stock-variance, and abnormal-usage insights
- Rule-based chatbot that answers questions from live kitchen data
- Dark mode, responsive navigation, glass-inspired UI, modals, toasts, and loading states

## Problem Statement

Community kitchens often rely on paper registers or disconnected spreadsheets. This makes it difficult to answer operational questions quickly: how many meals were served, how much food was consumed, whether stock is running low, or how a month compares with previous periods. Community Kitchen centralizes those daily records into one accessible system with reliable validation and clear reporting.

## Objectives

- Make daily kitchen data quick and safe to record.
- Preserve a searchable history of distribution and inventory information.
- Turn stored data into actionable operational insights.
- Reduce reporting effort with dashboards, analytics, and CSV export.
- Provide a simple natural-language entry point for common kitchen questions.
- Keep the experience usable on desktop and mobile devices.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript, Chart.js |
| Backend | Node.js, Express 4 |
| Database | SQLite through `sql.js` |
| Logging | Morgan and a structured request logger |
| Development | Nodemon |
| Testing | Node.js built-in HTTP tooling and browser verification |

## Folder Structure

```text
Community-Kitchen/
├── database/
│   └── schema.sql                 # DailyRecords schema and indexes
├── logs/                          # Request logs (ignored by Git)
├── public/
│   ├── css/style.css              # Design system, responsive UI, themes
│   ├── js/
│   │   ├── app.js                 # SPA routing, shell, theme, refresh
│   │   ├── dashboard.js           # Dashboard rendering and charts
│   │   ├── register.js            # Create-record form and validation
│   │   ├── records-view.js        # Search, edit, delete, pagination, CSV
│   │   ├── analytics.js           # Analytics charts and insight tables
│   │   └── chatbot.js             # Page and floating chatbot UI
│   └── index.html                 # SPA shell and modal markup
├── src/
│   ├── config/                    # Express and SQLite setup
│   ├── controllers/               # HTTP request handlers
│   ├── data/                      # Sample-data generator and seeder
│   ├── middleware/                # Logging, 404, error handling
│   ├── models/                    # SQLite queries
│   ├── routes/                    # API route declarations
│   ├── services/                  # Record, dashboard, analytics, chat logic
│   ├── utils/                     # Validation and response helpers
│   └── server.js                  # Application entry point
├── .env.example                   # Environment variable template
├── API.md                         # Endpoint reference
├── DATABASE.md                    # Schema and persistence guide
├── FINAL_REPORT.md                # Phase 12 final review and production checklist
├── TESTING.md                     # Test guide and coverage
├── TESTING_REPORT.md              # Phase 10 execution report
├── test-api.js                    # API and CRUD regression suite
├── test-chat.js                   # Chatbot intent suite
├── test-phase10.js                # Targeted Phase 10 regression suite
└── run-phase10.js                 # Isolated runner for Phase 10 tests
```

## Installation

### Prerequisites

- Node.js 18 or later
- npm

### Setup

```bash
git clone https://github.com/yeshwanthsair/SIH-26_Community_Kitchen.git
cd SIH-26_Community_Kitchen
npm install
```

Copy the environment template and adjust values if needed:

```bash
cp .env.example .env
```

Default variables:

```env
PORT=3000
NODE_ENV=development
DB_PATH=./database/kitchen.db
APP_NAME=Community Kitchen
```

The database schema is applied automatically on first `npm start` if `kitchen.db` does not yet exist. You can also initialize and seed manually:

```bash
npm run db:init
npm run db:seed
```

Start the application:

```bash
# Development server with automatic restart
npm run dev

# Standard server
npm start
```

Open `http://localhost:3000` in a browser.

If the port is already in use, set a different `PORT` in `.env` or stop the process using that port.

## Usage

1. Use **Register** to create a daily record. One record is allowed per date.
2. Use **Records** to filter by date, month, or status; edit/delete a record; or export matching records as CSV.
3. Use **Dashboard** for the latest operational view and trends.
4. Use **Analytics** for period breakdowns, low-stock analysis, and abnormal-usage flags.
5. Use **Chat** or the floating assistant for questions such as “meals today”, “rice stock”, or “cost per meal”.

## API Documentation

All API responses use JSON and are available under `/api`.

| Resource | Endpoint | Description |
|---|---|---|
| Dashboard | `GET /api/dashboard` | Latest record, KPI summaries, trends, and top days |
| Records | `GET /api/records` | Filtered, sorted, paginated records |
| Records | `POST /api/records` | Create a daily record |
| Records | `PUT /api/records/:id` | Update a record |
| Records | `DELETE /api/records/:id` | Delete a record |
| Analytics | `GET /api/analytics` | Aggregations and operational insights |
| Chat | `POST /api/chat` | Answer a supported kitchen-data question |

See [API.md](API.md) for parameters, request bodies, response examples, and validation behavior.

## Database

The persistent store is SQLite. The `DailyRecords` table contains one row for each kitchen day and has a unique date constraint, status constraint, and query indexes for date, status, and month aggregation.

See [DATABASE.md](DATABASE.md) for the schema, field definitions, indexes, persistence behavior, and backup guidance.

## Testing

```bash
npm run test:all       # API + chat suites (148 tests)
npm run test:phase10   # Isolated validation regression (11 tests)
```

Or run individually:

```bash
node test-api.js
node test-chat.js
```

**Latest result:** 159 / 159 tests passed (Phase 12 final review).

The Phase 10 runner starts an isolated temporary HTTP server, so it does not need or interrupt a running instance. See [TESTING.md](TESTING.md) for the test plan, [TESTING_REPORT.md](TESTING_REPORT.md) for Phase 10 results, and [FINAL_REPORT.md](FINAL_REPORT.md) for the full production readiness review.

## Production Readiness

Community Kitchen v1.0.0 is ready for single-tenant deployment on a trusted network (local LAN, internal tool, VPN).

| Ready | Before public internet exposure |
|---|---|
| Full API and UI feature set | Authentication and role-based access |
| Client and server validation | HTTPS via reverse proxy |
| Security headers (CSP, etc.) | Scheduled database backups |
| 159 automated tests passing | Rate limiting |

See [FINAL_REPORT.md](FINAL_REPORT.md) for the complete checklist, architecture review, and known limitations.

## Future Improvements

- Authentication and role-based access for operators and administrators
- Multi-kitchen or multi-location support
- Scheduled backups and import/export management
- Server-side CSV/PDF reporting and scheduled email reports
- Configurable inventory items and low-stock thresholds
- Audit trail for edits and deletions
- More advanced forecasting and anomaly detection
- Translated UI content

## License

This project is licensed under the [ISC License](https://opensource.org/license/isc-license-txt/). See the `license` field in [package.json](package.json).

## Contributors

Maintained by the Community Kitchen project contributors.

Contributions are welcome. Please open an issue or submit a pull request with a concise description, relevant tests, and documentation updates where appropriate.
