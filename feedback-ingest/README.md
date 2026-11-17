# VirtualDeck feedback ingest (server)

The desktop app POSTs JSON to a **public** HTTPS URL (`VD_FEEDBACK_SUBMIT_URL`, default `https://virtualdeck.app/api/feedback`). Secrets stay on the server only.

## Deploy on Vercel (recommended)

1. Create a Vercel project and point it at this `feedback-ingest` folder (or copy `api/feedback.js` into your existing `virtualdeck.app` site repo).
2. Set environment variables in the Vercel dashboard:

| Variable | Required | Description |
|----------|----------|-------------|
| `FEEDBACK_TO_EMAIL` | Yes | Inbox for submissions (e.g. `virtualdeckapp@gmail.com`) |
| `RESEND_API_KEY` | Yes* | Resend API key for outbound email |
| `FEEDBACK_FROM_EMAIL` | Yes* | Verified sender in Resend (e.g. `VirtualDeck <feedback@mail.virtualdeck.app>`) |

\* Or replace the Resend block in `api/feedback.js` with another provider (Postmark, SendGrid, etc.).

3. Deploy. Confirm `POST https://virtualdeck.app/api/feedback` returns `200` with a test body (see below).

## Request / response

**POST** `application/json`

```json
{
  "rating": "good",
  "ratingComment": "Works well for soundboard!",
  "featureIdeas": ["macros", "twitch"],
  "featureText": "Would love better clip posting.",
  "email": "streamer@example.com",
  "source": "prompt",
  "appVersion": "1.2.2",
  "platform": "win32",
  "submittedAt": "2026-11-11T12:00:00.000Z",
  "honeypot": ""
}
```

**200** `{ "ok": true }`  
**400** validation error · **429** rate limit · **500** delivery failure

Honeypot field `honeypot` must be empty (bots often fill hidden fields).

Rate limit: 8 requests / 15 minutes / IP (in-memory; use KV/Redis for multi-instance).

## Windows release builds

Release CI can bake the URL via `VD_FEEDBACK_SUBMIT_URL` in `prepare-build.js` (writes `lib/feedback/packaged-endpoint.json`). Local dev can set the same variable in `.env`.

No API keys belong in the Electron app.
