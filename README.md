# Resibo

Private Messenger archive viewer — browse imported Facebook Messenger threads with chat UI, hashtags, media galleries, and AI story summaries.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in secrets
npm run dev                  # http://localhost:3001
```

```bash
npm run typecheck
npm run lint
npm run test:e2e          # starts dev server unless PLAYWRIGHT_BASE_URL is set
```

### E2E smoke

```bash
npx playwright install chromium
npm run test:e2e
```

Optional authenticated smoke (against local or deployed). Put credentials in
`.env.local` (gitignored) so you can just run `npm run test:e2e`:

```bash
# .env.local
E2E_EMAIL=you@example.com
E2E_PASSWORD=secret
```

Or pass them inline / hit a deployed instance:

```bash
E2E_EMAIL=you@example.com E2E_PASSWORD=secret npm run test:e2e
PLAYWRIGHT_BASE_URL=https://your-app.vercel.app npm run test:e2e
```

CI runs e2e when `E2E_BASE_URL` is set. Push secrets from `.env.local` after `gh auth login`:

```bash
# optional in .env.local:
# E2E_BASE_URL=https://your-app.vercel.app
chmod +x e2e/set-ci-secrets.sh
./e2e/set-ci-secrets.sh
```

## Required env vars

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | MongoDB connection string |
| `PAYLOAD_SECRET` | Payload CMS encryption secret |
| `SESSION_SECRET` | JWT session signing secret |
| `NEXT_PUBLIC_OWNER_NAME` | Display name for "me" in chat (optional) |
| `NEXT_PUBLIC_R2_URL` | Optional custom media CDN (not `*.r2.dev`). If unset or still r2.dev, media is proxied via authenticated `/api/media` |
| `CLOUDFLARE_ACCOUNT_ID` / `R2_*` | R2 credentials for upload + media proxy |
| `ANTHROPIC_API_KEY` | Optional — Story summary generation |
| `ALLOW_SIGNUP` | Set `true` to reopen public signup after the first user |

## Auth notes

- First signup on an empty install becomes **superAdmin** and closes open signup.
- Later signups require `ALLOW_SIGNUP=true` or creation by a signed-in superAdmin.
- Import / delete / media-migrate APIs require superAdmin.
- `/upload` and `/dev` require a session (same as the main app).

## Key routes

| Path | Role |
|------|------|
| `/` | Viewer (chat, hashtags, story, settings) |
| `/upload` | Import Facebook export ZIP/folder (superAdmin APIs) |
| `/admin` | Payload CMS (superAdmin only) |
| `/auth/signin` | Password + passkey sign-in |
