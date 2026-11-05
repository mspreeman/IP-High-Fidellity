# LuMaCo — developer handoff

**Status: interactive prototype + separate local backend scaffold, NOT a production app.**

This repository packages the latest LuMaCo Navy & Champagne Gold prototype into maintainable frontend files while preserving its existing user experience, including the LMC logo, Smart Email, Needs Attention, Open Promises, Contacts, Companies, Projects, automation lab, meeting briefings and Manager View. It includes the prior company-name and sender-name contrast fixes.

The existing UI is functional **with simulated information** and persists demo edits in `localStorage` (`lumaco_prototype_v3`). The separate Python/SQLite API is a starting point for future work; **the browser UI is not yet connected to this API**. None of the phone, SMS, Gmail, Outlook, Calendar, AI, transcription, OAuth, or secure multiuser features are live.

## Run locally (Python 3.10+, no packages to install)

1. Extract the ZIP and open a terminal in this folder.
2. Run:

   ```bash
   python -m backend.server
   ```

   On Windows, you can also double-click `START-WINDOWS.bat` once Python is installed.

3. Visit **http://127.0.0.1:8000/**.
4. For developer API status, visit **http://127.0.0.1:8000/api/health**.
5. Stop with `Ctrl+C`.

The server binds only to localhost. It creates `data/lumaco-demo.sqlite3` on first run. Use **fictional data only** because this demo server does not implement authentication or authorization.

### Test

```bash
python -m unittest discover -s tests -v
```

If Node.js is available, check syntax of the extracted frontend scripts:

```bash
node tests/frontend-smoke.cjs
```

To edit the UI, change files under `frontend/` and refresh the browser. No build system is required. The startup server serves static files and a small API.

## Directory map

```text
lumaco-developer-project/
├── frontend/
│   ├── index.html                         # Entry point; loads CSS & scripts in order
│   ├── styles/
│   │   ├── base.css                       # Original prototype style
│   │   └── enhancements.css               # Navy/gold enhancements and responsive layouts
│   └── scripts/
│       ├── 01-state-and-helpers.js         # Seed data, helpers, localStorage, basic navigation
│       ├── 02-original-screens.js         # Existing page render functions
│       ├── 03-original-interactions.js    # Existing user actions & modal forms
│       ├── 04-automation-engine.js        # Outreach/engagement, identity matching, promises
│       ├── 05-enhanced-screens.js         # Dashboard, contacts, manager view, accessibility
│       ├── 06-automation-demonstrations.js# Email, call, text and calendar demo scenarios
│       └── 07-enhanced-interactions.js    # Enhanced handlers and final initialization
├── backend/
│   ├── server.py                          # Local HTTP server + small JSON API
│   ├── store.py                           # SQLite connection and initialization
│   └── logic.py                           # Demonstration rules, suitable for unit tests
├── database/
│   └── schema.sql                         # Initial normalized developer schema
├── docs/
│   ├── ARCHITECTURE.md
│   ├── PRODUCT_RULES.md
│   ├── PRODUCTION_ROADMAP.md
│   └── TEST_PLAN.md
├── tests/
│   ├── test_logic.py                    # Nine backend/data-model unit tests
│   └── frontend-smoke.cjs               # Node render smoke test (not a visual browser test)
├── reference-prototypes/              # The five original supplied HTML concepts
├── SECURITY.md                        # Explicit demonstration-only warning
├── CONTRIBUTING.md                    # Developer conventions
├── START-WINDOWS.bat                   # Double-click start on Windows
└── legacy-reference.html                  # Byte-for-byte latest single-file predecessor
```

**Script order matters.** The current application was built incrementally. `05-enhanced-screens.js` overrides earlier render functions, so scripts must load in the order shown. This is a **safe extraction of the existing code**, not yet a complete rewrite into ES modules or React components. Developers should progressively replace overrides with named modules and automated tests.

## Available demonstration API

The separate backend can store fictional company/contact/activity/promise records. It is **not wired to the frontend** yet.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | Runtime capabilities and limitations |
| GET/POST | `/api/v1/companies` | SQLite development records |
| GET/POST | `/api/v1/contacts` | Approved demo contacts; no personal real data |
| GET/POST | `/api/v1/interactions` | Independent outreach and engagement classification |
| GET/POST | `/api/v1/promises` | Manually supplied promise examples |
| GET | `/api/v1/integrations` | Reports **not connected** |
| GET | `/api/v1/manager/summary` | Returns **501** pending secure role-based access |

Example (after first creating a company, or with `company_id` omitted):

```bash
curl -X POST http://127.0.0.1:8000/api/v1/contacts \
  -H 'Content-Type: application/json' \
  -d '{"name":"Sample Customer","priority":"High"}'
```

Do not attempt to deploy this service unchanged or share it over a public network.

## What to do next

Read [docs/PRODUCTION_ROADMAP.md](docs/PRODUCTION_ROADMAP.md) first. The next milestone should be authentic user/workspace authorization, a secure shared data store, consistent ownership rules, contact identity matching, and one live OAuth email/calendar integration. Do **not** assume ordinary SMS or phone history can be automatically retrieved from every device.

## Verification

Python unit tests and the Node script-render smoke test pass in this development environment; the local API was also exercised with fictional records. A full graphical browser navigation test was blocked by sandbox browser policy, so manually test the UI in Chrome/Edge before using this as a handoff milestone.