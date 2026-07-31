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
```

## Required env vars

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | MongoDB connection string |
| `PAYLOAD_SECRET` | Payload CMS encryption secret |
| `SESSION_SECRET` | JWT session signing secret |
| `NEXT_PUBLIC_OWNER_NAME` | Display name for "me" in chat (optional) |
| `NEXT_PUBLIC_R2_URL` | Optional public CDN/custom domain for media. If unset, media is proxied via authenticated `/api/media` |
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
