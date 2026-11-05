# Security status: DEMONSTRATION ONLY

This source package does **not** implement login, identity verification, workspace authentication, production authorization, encryption at rest, secure secret storage, OAuth, network hardening or retention policies. Do not run its server on a public host or enter actual customer/private messages into it.

The existing browser UI persists synthetic demo data in localStorage. LocalStorage is not secure personal/company isolation. The localhost JSON API writes to a separate SQLite database, without permissions and **without frontend synchronization**. Its manager endpoint returns 501 until role-based authorization is designed and tested.

For production, enforce individual account and workspace ownership at every backend query and at every aggregation boundary. A private note must not appear in manager summaries, generated AI reports, timeline counts, or team metrics. Redact source content based on permission scope before invoking any summarization model. Audit cross-tenant and personal-to-company data leakage.

The project's intended integrations (Microsoft, Google, phone, texts, meeting audio) are not implemented. Phone/SMS data availability varies by OS, account, device and consent. Meeting capture requires permission and appropriate participant consent.
