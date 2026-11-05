# Test plan

## Fast automated checks

```bash
python -m unittest discover -s tests -v
node --check frontend/scripts/01-state-and-helpers.js
node --check frontend/scripts/07-enhanced-interactions.js
```

## Manual browser checks

1. Open localhost site at desktop width and ~390px mobile width; confirm all pages reachable without horizontal overflow.
2. Dashboard: Needs Attention appears above Open Promises, not side-by-side.
3. Smart Email: sender name and company name readable on white or selected-row backgrounds.
4. Contact: star/unstar and manually enable detailed reporting; verify relationship snapshot and combined timeline.
5. Automation Lab: approved contacts lead to activity; unknown sender is sorted but NOT tracked.
6. Call demo: 120 seconds does not count; 121 seconds can count when connected.
7. Calendar demo: ended client lunch is inferred, can be rejected/confirmed without stale reminders.
8. Open Promise: verify edit, complete, dismiss, and source explanation in demonstrations.
9. Manager View: private data must not appear in work dashboards, directly or through metrics.
10. Reset/export: confirm localStorage changes persist in browser and can be cleared.

## API smoke checks

```bash
curl -i http://127.0.0.1:8000/api/health
curl -i http://127.0.0.1:8000/api/v1/contacts
curl -i http://127.0.0.1:8000/api/v1/manager/summary
```

The manager API intentionally returns 501 until proper authentication and authorization are implemented.
