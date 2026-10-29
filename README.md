# Lady Fitness Control Center V2 — frontend source

This repository owns the V2 frontend source. The private backend serves a checksum-verified, immutable source revision on the same HTTPS origin as /api/*.

## Source consolidation — prepared, not merged or deployed

This branch is based on main `b91b002bc4eb0314b2281fbf61a5ae2d3dbbc510` and restores the frontend implementation from the backend's observed immutable source pin `805a00aef1b3057e9bda4ef79d738d88ed24021a`. The older `codex/control-center-supabase-v2` branch is not the production baseline.

The backend `service/frontend-pin.json` remains unchanged. Merging this frontend consolidation does not change the backend's deployed shell. Future releases need a separately reviewed pin update and explicit deployment authorization.

## Runtime and data boundaries

- Current operational facts come from the authenticated `/api/dashboard` Supabase projection.
- Browser → same-origin backend → Supabase. No privileged database credentials belong in the frontend.
- Existing login, server session restore, logout, dashboard refresh, validation and freshness/error behavior are retained from the immutable source pin.
- Explicit imports are historical SNAPSHOT data; DEMO uses synthetic data. They never become canonical current state.
- Public builds contain an empty graph, allowlisted code and licensed fonts. Do not commit private business payloads or QA fixtures.
- Business status/lifecycle/category semantics belong to the backend DTO and registry. Source code is not a business master.

## Google Drive File Map selection — prepared, not activated

The map's Drive input is explicitly selection-based. `control-center.html` can open Google Picker only after the public `googlePicker.clientId`, `googlePicker.apiKey`, and `googlePicker.appId` values are configured. These are public browser identifiers, never OAuth client secrets. The browser requests only `drive.file`, keeps the short-lived access token in memory, and offers a JSON download containing the selected IDs. It does not scan a Drive root, save tokens, upload the manifest, or start a refresh. Verify that the user selected `lady.fitness.he@gmail.com`; this page does not assert the account identity.

The downloaded `drive-picker-selection.json` is only a selection artifact. The existing backend refresh is still gated until an authorized private manifest persistence path is implemented and verified. Do not add the manifest to public assets or run the refresh workflow as part of this frontend change. Picker credentials, OAuth scopes, secrets, workflow configuration, Drive content, backend pin and deployment remain unchanged.

## Retired paths remain retired

The Pages publication workflow and current-state Markdown CLI entrypoints `scripts/refresh-now.mjs` / `scripts/enrich-campaign-briefs.mjs` remain removed. Do not restore `/api/report`, Markdown/Sheets current-state runtime or GitHub Pages reporting. Shared historical parser libraries/tests remain offline-only.

The previous owner action to unpublish any existing Pages site is not re-verified here. No Pages setting, backend pin, deployment, schema or auth model is changed by this branch. Earlier documentation remains available in Git history and dated audit evidence.

## Validation

Node.js 22+: `npm run check`, `npm run build`.
Optional synthetic browser QA: `python scripts/qa-session-restore.py` and `python scripts/qa-supabase-browser.py`; inspect their required arguments before running.

Consolidation readback and source hash checks are documented in [migration evidence](Audit%20Results/2026-10-09-v2-main-source-consolidation.md). Runtime tests and browser QA must pass before this draft is made ready; the preparation environment was unavailable.

## Follow-up

LF-TASK-024 UX NOW implementation is deferred until the baseline conflict is resolved. This consolidation includes no UX redesign, CRM, API/schema expansion, merge or deployment and creates no second task register.


## LF-TASK-034 entry page

`/` is a static branded introduction with the canonical Lady Fitness logo and local Oswald/Inter fonts. Its `Log in` link opens `/control-center.html`, which retains the existing protected Control Center and session flow. The landing does not authenticate a user or read private data; no username/password fields are added there.

Builds include the entry page and dashboard separately. Synthetic landing QA: `node scripts/qa-home.mjs` after `npm run build` (Playwright Chromium required). Existing dashboard browser fixtures target `/control-center.html`.
