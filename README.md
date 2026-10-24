# Lamariva

CV, cover letter, jobs, and application workspace for a Node.js VPS. No Docker.

**Panduan instalasi lengkap Bahasa Indonesia:** [INSTALL-VPS-ID.md](INSTALL-VPS-ID.md).
Upload the ZIP into `/opt/lamariva` as `ubuntu`; its contents have no extra wrapper folder.

## Optional writing assistant

The standard cover-letter generator does not need a paid AI API. To enable optional
rewriting, configure `AI_PROVIDER=openai-compatible`, `AI_API_KEY`, `AI_MODEL`,
and an HTTPS `AI_BASE_URL` ending at the API base (for example `/v1/`). Enable AI
in Admin settings and restart the application after changing environment values.
Check the chosen provider's API compatibility and data-retention policy first.
Each request requires explicit user consent and a review before applying text.
Requests are limited to five per account per hour. AI output can still be wrong;
the user must check every claim. No live paid AI request was made during QA.

## Stack

Next.js App Router, React, strict TypeScript, Better Auth, PostgreSQL with Prisma,
React PDF, DOCX, SMTP, Nginx and PM2. Node 22.16+ or Node 24 is required.

The lockfile pins the exact versions tested. Use `npm ci`, not an unreviewed
dependency upgrade. Production uses PostgreSQL. PGlite and the local mailbox are
only test fixtures and are not used by the deployed app.

## Install on Ubuntu VPS

Use a regular application owner, not root, to run Node and PM2. Upload and unzip
this project into `/opt/lamariva`. Keep the folder's files together.

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib nginx certbot python3-certbot-nginx age unzip
sudo mkdir -p /opt/lamariva
sudo chown "$USER":"$USER" /opt/lamariva
cd /opt/lamariva
npm ci
cp .env.example .env
chmod 600 .env
openssl rand -hex 32
```

Put the generated value into `AUTH_SECRET` and edit the other settings using
`nano .env`. Set `APP_URL` to your real HTTPS domain without a trailing slash.
The default app port is **3035**. Do not change any existing website's configuration.

Create a database and non-superuser application owner:

```bash
sudo -u postgres createuser --pwprompt lamariva
sudo -u postgres createdb --owner=lamariva lamariva
```

Set `DATABASE_URL` with that password. URL-encode reserved characters in the URL
password. PostgreSQL should listen locally; do not expose port 5432 to the internet.

```bash
cd /opt/lamariva
npx prisma generate
npm run db:migrate
npm run db:seed
npm run build
read -r -p 'Admin email: ' ADMIN_EMAIL
read -r -p 'Admin name: ' ADMIN_NAME
read -r -s -p 'Admin password (16+ characters): ' ADMIN_PASSWORD
export ADMIN_EMAIL ADMIN_NAME ADMIN_PASSWORD
npm run admin:create
unset ADMIN_EMAIL ADMIN_NAME ADMIN_PASSWORD
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Run the sudo startup command printed by PM2. There is no default admin password.
The bootstrap command refuses to overwrite an existing account. The owner can
delegate ADMIN permissions from the Users page. The final active Super Admin
cannot be demoted, suspended, or deleted.

## Domain and HTTPS

Point the selected domain's A record at the VPS. Copy the Nginx example to a new
configuration, change **only** `cv.example.com` to your real domain, and keep the
proxy port synchronized with `.env` and PM2:

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/conf.d/lamariva.conf
sudo nano /etc/nginx/conf.d/lamariva.conf
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d YOUR_DOMAIN
curl -fsS http://127.0.0.1:3035/api/health
pm2 logs lamariva --lines 50
```

After changing `.env`, run `pm2 restart ecosystem.config.cjs --update-env`.
Do not publish the source directory through an Nginx `root` directive.
Nginx overwrites `X-Real-IP`; the application trusts only that header for rate
limiting and must remain bound to 127.0.0.1.

## Google login

Create a Google OAuth web application for your real domain. Configure the
authorized JavaScript origin as `https://YOUR_DOMAIN` and redirect URI as:

```text
https://YOUR_DOMAIN/api/auth/callback/google
```

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on the server, restart PM2,
then test with a Google account. Without these values the Google button is hidden.
Passwords, provider secrets, and tokens are never returned by admin APIs.

## SMTP

For a Hostinger mailbox, use the host/port supplied in its email settings. The
example uses `smtp.hostinger.com`, port `587`, `SMTP_SECURE=false` (STARTTLS).
Set the full mailbox address as `SMTP_USER`, its password as `SMTP_PASS`, and a
matching authorized sender in `SMTP_FROM`.

SMTP can be hosted separately from the VPS and domain registrar. Configure the
mail provider's required SPF/DKIM records. Use Admin > Operasional > email test,
then verify registration and recovery from the public HTTPS domain. Review the
real inbox and spam folder. Successful local SMTP tests do not prove inbox delivery.

## Jobs

Admin > Sumber lowongan accepts a Greenhouse board token, Lever site slug, or
`remotive` for Remotive. Providers begin disabled. Check the provider's current
terms and your rights to republish a company's listings before enabling it.
Listings are public and always carry source attribution and the external URL.
No Google Jobs, LinkedIn, or JobStreet scraping is implemented.

The PM2 sync task checks enabled sources hourly at minute 17. Each source's
configured interval controls actual requests; Remotive is limited to at most one
request per six hours. A failed fetch preserves cached data and records an event.
Successful full refreshes deactivate withdrawn jobs. Manual listings can expire.

## Backups and rollback

Generate an age key on a secure workstation and keep its private key away from
the VPS. Put only its **public recipient** in `BACKUP_RECIPIENT`. Configure a
restricted `BACKUP_DIR`; copy encrypted archives to a separate storage destination.

```bash
chmod +x deploy/backup.sh deploy/restore.sh
sudo mkdir -p /var/backups/lamariva
sudo chown "$USER":"$USER" /var/backups/lamariva
bash deploy/backup.sh
```

Run with cron under the application owner, for example:

```cron
30 2 * * * cd /opt/lamariva && /bin/bash deploy/backup.sh >> /opt/lamariva-backup.log 2>&1
```

Set `BACKUP_NOTIFY_EMAIL` for failure notifications. If SMTP or the database is
also unavailable, inspect the cron log; do not rely only on email notifications.
Restrict the log's file permissions and rotate it. Enable PM2 log rotation:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

Restore into a **new empty database**, never directly over the live one:

```bash
bash deploy/restore.sh /path/backup.tar.age /secure/path/age-key.txt 'postgresql://USER:PASSWORD@127.0.0.1:5432/lamariva_restore'
```

Point an isolated app instance at the restored database. Compare record counts,
sign in, open saved documents, and export PDF/DOCX before considering the backup
verified. This restore exercise must be run on your server setup.

Before an upgrade, retain the previous source/lockfile/build and an encrypted
backup. Apply migrations, build, and restart only after success. For a code-only
failure, restore the previous release and restart PM2. For incompatible schema
changes, restore the backup to a separate database and switch the app to that
database; do not blindly reverse migrations or drop production tables.

## Testing

```bash
npm run typecheck
npm test
npm run build
npm run test:acceptance
```

The acceptance runner starts an isolated in-memory PostgreSQL-compatible database,
SMTP mailbox, production Next server, API tests, and Chromium browser tests in
one process tree. It does not use production records or real email recipients.
It requires free local ports 3035, 2525 and 55435. Test credentials exist only in
the test fixtures and are never seeded by `db:seed`.

See `docs/QA.md` for the actual tested scope, integration requirements and remaining
limitations, and `docs/ANTI_SLOP.md` for the design verification record.

## Source control

The uploaded PRD is the implementation reference. No repository URL was supplied,
so this package is not automatically pushed to an unrelated GitHub repository.
Create or select the intended repository, then use normal Git push from this folder.
`.env`, runtime databases, mail fixtures, private uploads, and build output are ignored.

## Data and operating limits

Documents are private, owned snapshots. Profile changes never overwrite them
without an explicit sync. Each save retains up to 30 previous versions; concurrent
edits use a revision check. Each account may keep up to 500 documents. PDF requests
are limited and only one renderer runs at a time in the single PM2 app instance.
Back up PostgreSQL: it contains the canonical profiles, documents and versions.

Profile entries are stored as validated structured JSON rather than separate
tables for every category. This supports all repeatable sections and reordering
without losing user-defined fields. Administrative accounts cannot read private
CV content through admin APIs.
