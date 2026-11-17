# In-app feedback delivery

The desktop app sends feedback as **JSON POST** from the Electron **main process** to a public HTTPS URL (`VD_FEEDBACK_SUBMIT_URL`). No SMTP or provider API keys ship in the client.

## Client behavior

- Prompt state lives in `userData/preferences.json` under `feedback` (`stateVersion: 1`).
- One-time prompt: **≥3 days** after first launch, **≥3** app sessions, **8s** after renderer-ready (non-blocking).
- **Help → Send feedback / Request a feature…** and **Preferences → Feedback** open the same form any time.

## Server setup (Jonathan)

1. Deploy `feedback-ingest/` to Vercel on `virtualdeck.app` (or copy `api/feedback.js` into the site repo).
2. Set `FEEDBACK_TO_EMAIL`, `RESEND_API_KEY`, and `FEEDBACK_FROM_EMAIL` in Vercel env.
3. Confirm `POST https://virtualdeck.app/api/feedback` returns 200 for a test payload.

See **`feedback-ingest/README.md`** for the request schema and rate limits.

## Release builds

`prepare-build.js` writes `lib/feedback/packaged-endpoint.json` with the ingest URL. Override with `VD_FEEDBACK_SUBMIT_URL` in CI or `.env` before `prepare-build`.

Until the server route is live, submissions return a friendly error in-app; the form and menu still work.
