# Gigify — Go-Live Runbook

Everything on the engineering side is done. Going live is now **configuration only**.
Two paths: the **5-minute "operate today"** path (manual, no cron), and the
**full automation** path (cron + all keys).

---

## Path A — Operate TODAY (fastest, manual)

You can run real outreach today with just email + (optionally) calls. No cron needed.

### 1. Email (so sends are real, not logged)
On **Railway → Variables**, add:
```
EMAIL_FROM=booking@mail.<yourdomain>.com
RESEND_API_KEY=re_...            # you already added this
```
In **Resend → Domains**, verify `mail.<yourdomain>.com` (add the DNS records they show).
Until the domain verifies you can test with `EMAIL_FROM=onboarding@resend.dev`.

### 2. (Optional) Calls + the Live Cockpit
On Railway add:
```
VAPI_API_KEY=...
VAPI_PHONE_NUMBER_ID=...
VAPI_WEBHOOK_URL=https://web-production-421cc.up.railway.app/api/calls/vapi-webhook
```
Provision a number in Vapi first; copy its phone-number ID.

### 3. Run it
1. Open **/campaigns**. You have 1,000 starter gems.
2. **Launch a campaign** — pick Email or Tulio calls, slide to the number of best
   leads, **Run** (it schedules them for today).
3. Click **"Run engine now"** (top right) → it sends/calls everything due *right now*.
4. For calls, watch the **Live Call Cockpit** light up.

> Leave `CRON_SECRET` **unset** for this path so "Run engine now" works.

---

## Path B — Full automation (set once)

### Hourly cron → the engine runs itself
Set on Railway:
```
CRON_SECRET=<any-long-random-string>
```
Add a **Railway Cron** service (or any scheduler) that runs hourly:
```
curl -X POST https://web-production-421cc.up.railway.app/api/campaigns/tick \
  -H "x-cron-secret: $CRON_SECRET"
```
Hourly (not daily) so the autopilot daily budget paces across the day.

> With `CRON_SECRET` set, the in-app "Run engine now" button is disabled by the
> gate — use either the button (no secret) **or** cron (secret), not both.

### Real gem purchases (Stripe)
```
STRIPE_SECRET_KEY=sk_test_...        # your sandbox key works
STRIPE_WEBHOOK_SECRET=whsec_...      # from the webhook you register
```
Register a Stripe webhook → `https://.../api/stripe/webhook`, event
`checkout.session.completed`. Test card `4242 4242 4242 4242`.

---

## What only YOU can provide (the whole list)

| # | Item | Unlocks | Required for launch? |
|---|---|---|---|
| 1 | `EMAIL_FROM` + Resend domain verified | real emails | **Yes** (else sends only log) |
| 2 | `VAPI_API_KEY` + `VAPI_PHONE_NUMBER_ID` + `VAPI_WEBHOOK_URL` | Tulio calls + cockpit | Yes for calls |
| 3 | Elijah's 4 facts: hometown · sounds-like · performance style · accolades | Tulio/email specifics | Recommended |
| 4 | `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | real gem purchases | Only when charging |
| 5 | `CRON_SECRET` + Railway cron | hands-off automation | Optional (Path B) |

---

## Verify it's working
- `GET /api/version` → matches the latest commit.
- `/campaigns` → "Run engine now" returns `sent`/`calls`/`playbooks` counts.
- `GET /api/income` → dashboard money numbers.
- Test email: `/api/outreach/test-send?to=you@email.com` → `delivered: true`.
