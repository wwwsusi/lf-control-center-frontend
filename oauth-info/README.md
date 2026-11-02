# Public OAuth information — DRAFT, not deployed

Owner approved a draft PR only on21-10-2026. These three static pages describe LF File Map / LF CRM Backup for Google OAuth configuration. The contact email michal.susko@gmail.com is owner-authorized for this public draft. Privacy and terms remain proposals until owner review.

The retired public Pages reporting application stays retired. This is a narrow proposed exception for OAuth information, not a restored dashboard/reporting deployment. No application code, API, auth, backend immutable frontend pin, business payload, database or credentials change.

`scripts/build-oauth-info.py` copies only index.html, privacy.html and terms.html into a separate output directory. It never invokes npm build or publishes the repository root, dist, web, inventory or event files. Additional source files are not copied. Existing output and symlinked pages are refused. The artifact contains no JavaScript, forms, analytics, login flow or private data.

Validation: `python3 -B scripts/test-oauth-info.py`; isolated artifact build with `python3 -B scripts/build-oauth-info.py --output /tmp/fresh-oauth-info-output`.

Workflow validates on pull requests. Deployment is manual-only, main-only and blocked unless LF_OAUTH_INFO_PAGES_ENABLED=true. No schedule or push deployment. GitHub Pages source is already GitHub Actions; this draft does not change that setting. Only deployment job receives pages:write and id-token:write. Official actions pinned to verified commit SHAs.

A Pages deployment replaces that repository's current Pages site. Settings inspected21-10-2026 showed no deployed site. Recheck immediately before approving/deploying so another concurrent Pages owner isn't overwritten. GitHub Pages should serve only this information artifact; Vercel/private Control Center remains separate and unchanged.

Before merge/publication: owner approves exact page content and deployment SHA, verify domain ownership requirements and current Pages state, then authorize manual deploy. Verify actual published URLs and all three pages before writing Google Branding. Do not assume prospective URLs are live. Changing Google project's audience/published branding affects both existing OAuth clients and needs its own reviewed owner action. No Google configuration change is part of this PR.
