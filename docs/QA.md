# Verification and release scope

Release: Lamariva v1.0, 12 October 2026.

## Implemented

- Email registration and verification, password recovery with hashed expiring,
  single-use tokens, session revocation, Google OAuth configuration and account
  connection controls. No default admin password.
- Structured master profile, repeatable/reorderable sections, document snapshots,
  eight configured CV styles, default template preference, A4/Letter, ID/EN,
  autosave with optimistic concurrency, duplication, 30-version history and restore.
- Editable standard cover letters and optional consent-based AI rewriting adapter.
- Selectable PDF with embedded fonts and editable DOCX export, authenticated ownership.
- Greenhouse/Lever/Remotive adapters, caching, expiry, manual listings, saved jobs.
- Application tracker with table/kanban, document links, notes and follow-up dates.
- Admin roles/permissions, suspension, session revocation, reset email, deletion
  requests, last Super Admin protection, audit, template configuration/versioning,
  CMS text, email subjects/footer, feature flags, provider controls and health.
- Light/dark/system themes, mobile navigation drawer, keyboard focus and editor tabs.
- PostgreSQL migrations, seed, PM2, Nginx, encrypted backup and separate-database restore scripts.

## Verification environment

Production Next.js build and TypeScript compilation. API tests run against the
production server with PGlite's PostgreSQL protocol adapter and an isolated SMTP
mailbox. This is not a substitute for the real PostgreSQL deployment smoke test.
Chromium browser flows use Playwright. Test fixtures are isolated and never
installed by the production seed. Node runtime used here: 24.19.

The desktop/mobile browser journey passed login, CV title/profile autosave,
actual PDF preview, PDF download, tracker creation/kanban, theme switching,
mobile drawer Escape/focus restoration and overflow checks at four viewport widths.
The same final browser run also opened nine public pages and every admin section,
saved a template configuration with password confirmation, and recorded no page
JavaScript errors. Final result: 7 model/API tests and 1 combined browser journey
passed. Production build and TypeScript compilation passed after the last code edit.

The seven model/API tests cover document ownership and unauthorized access,
roles and last-owner protection, registration/verification, password recovery,
revision conflicts/restoration, duplication/deletion, exports, tracker writes,
rule-based suggestions, provider normalization and unsafe URL rejection.

PDF export was rasterized and inspected after embedding fonts to correct spacing;
the test includes a multipage document and selectable text. DOCX is checked for
structured text output; Microsoft Word desktop rendering has not been inspected.

The production dependency audit reported zero known vulnerabilities at the time
of verification. This is time-bound, not a guarantee of security.

## Production checks requiring your server/domain

Real PostgreSQL migration, Google consent/callback/account linking, Hostinger SMTP
delivery and SPF/DKIM, provider live synchronization/terms, AI provider response,
TLS renewal, PM2 reboot recovery, backup encryption/restore and traffic/load tests.
No deployment or real inbox delivery is claimed by the local test results.

## Remaining PRD scope and operating limits

This release provides the core working application, not every optional/admin
enhancement in the PRD. Professional photo upload, logo/favicon upload, template
preview-image upload and creation of new renderer layouts are not implemented.
The eight built-in templates share a text-first renderer with styling differences.
Admin edits existing template settings rather than executing arbitrary template code.
Public CMS is plain text, not a rich-text editor; SEO title defaults and branding
palette remain source-controlled. Email management edits subjects/footer, not a full
HTML template builder. User administration has search/pagination but not every PRD
filter/export/chart. Tracker currently returns the latest 100 matching records.
Locations use one combined field, not separate city/province/country fields.
Follow-up reminders appear inside the application, not push/email scheduling.
Google-only self-service account deletion goes through a support request and
admin verification. SMTP secrets stay in environment variables.

Documents are capped at 500 per account; retained history at 30 previous versions.
PDF rendering is serialized in one PM2 process, so scale/load should be assessed
before a public launch. In-memory rate limits assume that single-instance setup.

Before launch, the operator must complete contact, privacy, retention and terms
copy with their actual practices. Default legal text is a draft, not legal advice.
