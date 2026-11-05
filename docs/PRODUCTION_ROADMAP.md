# From prototype to launch: prioritized roadmap

This is a proposed engineering roadmap, not an estimate or claim that these stages are complete.

## Phase 1 — Stabilize the existing demo

- Add Playwright regression tests for all navigation pages, laptop/mobile, main flows, contrast, and state persistence.
- Replace overlapping renderer overrides with explicit modules and a single state model. Keep behavior the same.
- Add tests for two-minute call threshold, independent outreach/engagement, attendance inference and undo.
- Fix timezone/date assumptions, especially calendar-month follow-up cadence and historical demo dates.
- Add event-source attribution and reliable error/empty/loading states.

## Phase 2 — Secure backend + storage

- Implement real authentication, tenant boundaries, user roles and workspace authorization.
- Choose a production-grade hosted database, migrations, encrypted secrets and audit log.
- Design personal-only versus company-owned information policies; define what managers can access.
- Implement API-to-UI data synchronization, conflict resolution and local demo migration/export.
- Add private-data exclusion tests for all team statistics and generated summaries.

## Phase 3 — Prove an actual integration

- Choose a pilot provider (Microsoft 365 or Google Workspace) with permission-scoped OAuth.
- Implement event sync and reliable identity matching only for approved contacts.
- Detect meaningful outreach and received replies; classify and link messages to company/contact/project.
- Log source coverage and last successful sync. Label missing data rather than assuming inactivity.
- Confirm provider terms, scopes, privacy/consent, webhooks and deployment constraints.
- Test with small consenting pilot users and synthetic or explicitly approved records.

## Phase 4 — Automation reliability

- Add sourced, explainable promise extraction with confidence and duplicates avoided.
- Support automatic follow-up updates and correctness audits, with undo.
- Add calendar inferred attendance plus confirmation/rejection and briefing generation.
- Make notification ranking, snooze, digest and Focus Mode actually operational.

## Phase 5 — Team/manager platform

- Add account ownership, assignments, roles, company account continuity.
- Serve manager progress using only authorized work data; never use personal notes in aggregates.
- Distinguish known activity from unavailable phone/SMS/calendar coverage.
- Validate with manager-led customer discovery before broadening into sales forecasting or a full CRM.

## Critical open technical risks

- Phone-call duration and normal SMS/iMessage access vary greatly by OS, carrier and business systems; do not promise universal coverage.
- Inferred attendance and language-model interpretations can be wrong.
- Workspace data ownership and personal-data protection require rigorous security and legal review.
- Automatic promises and reminders need idempotency, source attribution and reversible corrections.
