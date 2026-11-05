# Contributing to LuMaCo

This repository is a development handoff for an interactive prototype, not a public deployed product.

1. Start it locally with `python -m backend.server`; use fictional data only.
2. Run `python -m unittest discover -s tests -v` and `node tests/frontend-smoke.cjs` after changes.
3. Respect `frontend/index.html` script order until functions are migrated into explicit imports.
4. Keep **Needs Attention** above **Open Promises**, preserve approved-contact-only tracking, and avoid reintroducing low-contrast name text.
5. When modifying automation, add a test for 2-minute call threshold, independent outreach/engagement, source tracking, and privacy outcomes.
6. Do not add real OAuth keys, contact lists, user emails, or phone logs to the repository.
7. Do not expose `/api` publicly: authentication and role authorization are not built.
8. Distinguish a real integration from a simulated source in UI and documentation.

The original five screen concepts are available under `reference-prototypes/` for design comparison.
