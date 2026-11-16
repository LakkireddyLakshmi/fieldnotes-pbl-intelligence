# Fieldnotes — PBL Program Intelligence

A full-stack review and reporting workspace built for the synthetic Mantra4Change assessment data. The application connects school-level PBL responses to deterministic program insights, meeting preparation, and traceable grant-report drafts.

> **Synthetic data only.** All schools, grant labels, donors, geographies, finance units, media records, and image assets are anonymized/synthetic assessment materials. They are not real program evidence.

## Technology

| Technology | Use |
| --- | --- |
| React + TypeScript | Filterable review, grant reporting, and meeting-brief interface |
| Tailwind CSS | Responsive design system with the selected gold-on-charcoal theme |
| Express.js on Node.js | Same-origin JSON API and production static hosting |
| PostgreSQL | Relational storage for school responses, grants, finance, performance, and media metadata |
| PapaParse | Header-aware CSV parsing and validation in the repeatable seed importer |
| Recharts | Month movement and district/block comparison charts |
| JavaScript/TypeScript templates | Grounded report narrative and review summaries; runtime AI is optional and currently disabled |
| 21st.dev approach | Component-led React/Tailwind composition. The components are local and editable; no paid or remote 21st.dev template code is required at runtime. |

The UI interprets “21dev” as [21st.dev](https://21st.dev). It uses the catalog's React/Tailwind component approach and a purpose-built gold/charcoal theme rather than loading an external theme script.

## Run locally

### Requirements

- Node.js 22.12 or later and npm
- PostgreSQL 17 or later, either installed locally or provided by Docker Desktop

### Start PostgreSQL with Docker

From this directory:

```powershell
docker compose up -d postgres
Copy-Item .env.example .env
```

The Compose file starts a **local development-only** database named `fieldnotes` on port `5432`. Its example credentials are for local synthetic data only. Do not reuse them outside a developer machine.

If PostgreSQL is already running elsewhere, copy `.env.example` to `.env` and set `DATABASE_URL` to that database. Keep `.env` private; it is ignored by Git.

### Install, import, and run

```powershell
npm.cmd install
npm.cmd run db:setup
npm.cmd run dev
```

Open the Vite URL printed in the terminal (normally `http://127.0.0.1:5173`). `db:setup` creates the schema and loads the included synthetic CSVs. The seed uses upserts and checks expected row counts and evidence files; it does not truncate existing tables.

On systems where PowerShell allows the npm shim, `npm` works in place of `npm.cmd`.

To validate the supplied CSV records and linked evidence files without a running database:

```powershell
npm.cmd run db:validate
```

### Production-style build

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd start
```

The Express process serves the built React client and `/api` from the same origin. Set `PORT` and `DATABASE_URL` in the hosting environment. Run `npm.cmd run db:migrate` and `npm.cmd run db:seed` as controlled release steps; do not run the seed against real program data.

### Deploy to Render

The included `render.yaml` defines a Node web service and PostgreSQL 17 database in Singapore. Push this project to a private GitHub repository, then create a Render Blueprint from that repository. Render supplies `DATABASE_URL`; the start command applies the schema and idempotently seeds only the included synthetic assessment data before starting the API.

This Blueprint uses Render's free plans at no charge. Free web services can sleep when idle, and free PostgreSQL databases expire 30 days after creation; export or upgrade the database before expiry if the demo must remain available. The app contains no authentication and is intended for synthetic assessment data only.

## Architecture

```text
data/raw/*.csv
     │
     └── PapaParse + server/seed.ts ── validated, idempotent upserts ──┐
                                                                       ▼
React + Tailwind + Recharts ── /api/* ── Express ── deterministic services ── PostgreSQL
                                               │
                                               └── JavaScript report templates

public/evidence/* ◄── media index references returned by the grant API
```

- `src/` contains the typed React interface, reusable UI components, API client, and theme.
- `server/schema.sql` defines relational tables, uniqueness constraints, indexes, and non-negative data checks.
- `server/seed.ts` uses PapaParse to transform the original CSVs into typed row sets and writes them inside a transaction.
- `server/program-service.ts` computes filtered dashboard metrics, comparisons, risks, review summaries, and draft actions.
- `server/grant-service.ts` assembles finance, performance, milestones, and indexed evidence into a traceable narrative.
- `server/program-metrics.ts` is the pure deterministic calculation layer and can be tested without PostgreSQL.
- Vite proxies `/api` to Express during development. In production, Express serves both the frontend build and API.

## Data model

- **`pbl_responses`** — one row per synthetic school and reporting month. Primary key: `(month, school_code)`. Class-level enrollment and subject attendance are three-element arrays for Classes 6–8; classes and subjects are separately indexed.
- **`grants`** — one profile per grant label.
- **`grant_finance`** — one row per grant, month, and budget line.
- **`grant_performance`** — one grant-level performance/report row per month.
- **`grant_media`** — evidence/media index records linked by grant and month; file paths resolve only to included synthetic assets.

Grant-report metrics remain in their separate reporting scope. The app does not join them to the school-level sample.

## Workflows

### Program review

Filter by reporting month, district, block, grade, and subject. The API returns school count, participation, evidence submission, enrollment, session attendance, attendance rate, previous-month comparisons, geography ranks, risk explanations, and draft follow-up actions. Clicking a geography drills into that district or block.

### Review preparation

The meeting brief shows achievements, month-over-month movement, priority geography, risks, and discussion prompts. Suggested actions include an owner, priority, due date, draft status, and linked metric. They are prompts for human confirmation, not assigned work.

### Grant reporting

Choose a grant and month to see source-reported outcomes, computed indicator risk, monthly/cumulative finance utilization, report status, milestones, and linked media. The preview cites its facts and media IDs and can be copied or downloaded.

## Metric definitions and risk logic

- **Schools:** distinct school codes in the filtered month and geography/grade/subject slice.
- **Participation:** PBL-completed schools divided by filtered schools. With a grade selected, completion counts only if that grade is listed among the classes where PBL was conducted.
- **Evidence:** evidence-submitted completed schools divided by completed PBL schools. No eligible denominator is shown as “No data,” not zero risk.
- **Enrollment:** sum the selected grade enrollment once per filtered school, not once per subject.
- **Attendance:** sum reported attendance across the selected PBL class/subject sessions. A student attending both Math and Science can appear in both session totals.
- **Session attendance rate:** attendance divided by enrolled places in those same completed PBL class/subject sessions. It is not a unique-pupil rate.
- **Grant utilization:** cumulative finance units divided by approved budget units for the selected grant and month; monthly spend is shown separately.
- **Grant attendance:** attendance, enrollment, and attendance rate are separate source-reported fields. Because they do not reconcile in the supplied grant records, the app displays them separately and does not recalculate the rate; grant risk uses the source-reported rate.
- **Risk thresholds:** On Track `>=75%`; Behind `>=60% and <75%`; At Risk `>=35% and <60%`; Critical `<35%`. Overall geography and grant signals use the worst available participation/completion, evidence, and attendance indicator. Finance utilization does not use this progress threshold.
- **Month movement:** selected month versus the immediately preceding month present in the database; differences are percentage points.

## AI and reporting guardrails

No runtime AI API is called. Metrics, priorities, and risk classifications are computed in TypeScript. Narratives are deterministic templates that receive structured, selected facts; they do not receive raw CSVs and do not invent achievements, locations, milestones, or evidence. Missing media is described as a data gap, not proof that activity did not occur. This meets the assignment's AI-disabled fallback requirement without an API key or external service.

If an LLM is added later, it should only phrase a validated structured-insight object. Numeric facts, thresholds, traceability, and the deterministic fallback must remain in code.

## Validation and tests

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run db:validate
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-data.ps1
```

The focused unit tests cover risk-boundary behavior, missing rates, enrollment not being double-counted by subject, and session-based attendance capacity. The data check independently verifies the supplied input record counts, uniqueness, evidence paths, and month-level reference calculations.

## Assumptions and limitations

- All supplied records are synthetic assessment data, not a basis for real program or student decisions.
- Grant performance rates come from the supplied grant-performance file and may not reconcile to the separate school dashboard sample.
- The database is local/demo data; this app has no user authentication, role management, or real-data access controls.
- Suggested actions are generated prompts and require human review.
- Data imports should be run against the intended database only. A production deployment should add authenticated access, controlled CSV upload, import audit records, migrations/versioning, backup/retention policies, monitoring, and reviewed report exports.
