# Sabel Migr8Now Qualifier

Internal AE-facing qualifier form for Intercom migration deals. Captures 16 questions, computes a live Automated vs Bespoke verdict, persists submissions to Upstash, and emails a branded summary via Resend.

## Architecture

```
┌─────────────────────────────┐
│ GitHub Pages                │
│ sabel-intercom.github.io/   │
│ migr8now-qualifier/         │  ← index.html (form + live verdict)
└──────────────┬──────────────┘
               │ POST JSON
               ▼
┌─────────────────────────────┐
│ Vercel                      │
│ sabel-qualifier.vercel.app  │  ← api/submit.js
└──────────┬──────────┬───────┘
           │          │
           ▼          ▼
      ┌────────┐  ┌─────────┐
      │Upstash │  │ Resend  │
      │ Redis  │  │ (email) │
      └────────┘  └─────────┘
```

## Deployment

### 1. Repo setup

Two options:
- **Monorepo**: one Vercel project, GitHub Pages serves `index.html` from same repo
- **Split**: API in a Vercel repo, static form in `sabel-intercom.github.io` repo

Recommend monorepo for simplicity. Push the whole `migr8now-qualifier/` folder to its own GitHub repo, then deploy as a Vercel project.

### 2. GitHub Pages (static form)

Push to `sabel-intercom/migr8now-qualifier` or add as subdirectory in `sabel-intercom/Intake-forms`.

Enable GitHub Pages on `main` branch, root directory. Form will be served at:

```
https://sabel-intercom.github.io/migr8now-qualifier/
```

### 3. Vercel (API)

1. Import the GitHub repo into Vercel
2. Set **Root Directory** to the repo root (so `api/submit.js` is detected)
3. Set environment variables:

| Variable | Value |
|----------|-------|
| `UPSTASH_REDIS_REST_URL` | (from your existing Upstash instance) |
| `UPSTASH_REDIS_REST_TOKEN` | (from your existing Upstash instance) |
| `RESEND_API_KEY` | (from Resend dashboard) |
| `FROM_EMAIL` | `Sabel Qualifier <noreply@sabelcustomersuccess.com>` (must be a verified sender in Resend) |

4. Deploy. Default domain will be `sabel-qualifier.vercel.app`. Copy this URL.

### 4. Wire the form to the API

In `index.html`, update the `API_ENDPOINT` constant to match your Vercel URL:

```js
const API_ENDPOINT = 'https://sabel-qualifier.vercel.app/api/submit';
```

Commit and push. GitHub Pages will redeploy within a minute.

### 5. Resend sender verification

If `noreply@sabelcustomersuccess.com` isn't yet verified in Resend:
1. Log into Resend
2. Add `sabelcustomersuccess.com` as a domain
3. Add the DNS records shown (SPF, DKIM, DMARC) to the Sabel DNS provider
4. Wait for verification (usually under 10 minutes)

Until verified, emails will fail silently (logged to Vercel function logs but no delivery).

## Data persistence

Each submission is saved to Upstash with key pattern:

```
migr8now-lead-{company-slug}-{SHORTID}
```

Example: `migr8now-lead-acme-corp-K7M2QW`

To list all submissions, use the Upstash CLI or REST API:

```bash
curl -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
  "$UPSTASH_REDIS_REST_URL/keys/migr8now-lead-*"
```

## Verdict logic

**Automated Migr8Now** (default when no bespoke trigger hits):
- Source: Zendesk / Freshdesk / Help Scout / Intercom
- Migrate as: Tickets or Conversations
- Any inbox structure, status, attribute setting
- Regulatory: None or GDPR only
- Attachments: Standard
- No custom logic flagged

**Bespoke** (any one of these flips the verdict):
- Source: Zoho / LiveChat / Salesforce Service Cloud / Other
- Regulatory: HIPAA / APRA / Data residency / Other
- Attachments: Non-standard retention or volume
- Custom logic or non-standard mapping flagged (Q16)

**Informational only** (shown but does not flip verdict):
- Ticket volume 500k+ → surfaces infrastructure planning note
- Agent count 50+ → surfaces extended setup time note

## Recipients

Every submission emails:
- `richard@sabelcustomersuccess.com` (always)
- `akbur.ghafoor@intercom.io` (always)
- AE email (if provided on the form)

## Local development

```bash
# Install Vercel CLI if not already
npm i -g vercel

# Run locally with environment variables from .env.local
vercel dev
```

Create `.env.local`:
```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
RESEND_API_KEY=...
FROM_EMAIL=Sabel Qualifier <noreply@sabelcustomersuccess.com>
```

Then open `index.html` locally (or via a simple server) and temporarily point `API_ENDPOINT` to `http://localhost:3000/api/submit`.

## File structure

```
migr8now-qualifier/
├── index.html         ← the form (served by GitHub Pages)
├── api/
│   └── submit.js      ← Vercel serverless function
├── vercel.json        ← Vercel config
├── package.json
└── README.md          ← this file
```

## Future extensions

- **Admin dashboard** (`/admin.html`) — list all past submissions, filter by verdict
- **Slack posting** — drop submissions into `#migr8now-leads` channel
- **CRM push** — write qualified leads directly into HubSpot or Salesforce
- **PDF export** — generate a branded PDF of each submission (reuses sabel-pdf-builder)
