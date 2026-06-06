# Gigify — Tab / Feature Map

Source of truth for what each tab owns, so features don't sprawl or duplicate.

## Feature chart

| Tab | Purpose | Features & tools | APIs |
|---|---|---|---|
| **Dashboard** `/` | Home / setup + overview | Income & forecast card · Daily send-budget meter ("send next N") · **Venue discovery** (per-show + all, radius) · **Enrichment** (tiered modal + roadmap + status/cancel) · per-show outreach rows (inline email/call) | artist, shows, pipeline, discovery/run, enrichment/status+cancel |
| **Campaigns** `/campaigns` | The outbound **engine** | Gem wallet + buy packs (Stripe) · Campaign builder (best-N, email/call, gem quote, run) · **Autopilot** (daily gem budget) · **Playbooks** (follow-up cadence enroll) · Run engine now | gems(+checkout), campaigns/create+run-now, autopilot, playbook |
| **Tour Map** `/map` | Visualization | Interactive dark US map: shows, routing lines, lead dots by tier, green = won, hover, zoom | tour-map |
| **Schedule** `/schedule` | Availability | Tour calendar · click a day to block (BLOCKED/TRAVEL/PREFERRED_OFF) | schedule, availability |
| **Pipeline** `/pipeline` | CRM (source of truth) | Venue CRM table by stage · filters · deposits view · rebooking · export · *(bulk send button)* | pipeline, pipeline/rebooking, outreach/send-all-queued |
| **Outreach** `/outreach` | Email craft + responses | Response center (needs-attention, replied/opened) · craft/generate single email · send · *(bulk drain)* · *(follow-up)* · *(enrich-all)* · *(voicemail script)* | outreach/venues+generate+send+send-all-queued+follow-up, venues/enrich-all, voice/voicemail-script |
| **Voice** `/voice` | Calls | **Tulio** tab (ranked queue, brief preview, Call now → Live Cockpit, batch dial) · **Manual** tab (phone-only venues, voicemail script, log call, capture email) | voice/phone-queue+voicemail-script, calls/list+brief+dial |
| **Payment** `/payment` | Money | Stripe deposits · booking flow · deposit links · mark-deposit-paid · cancel/refund (24h) · totals | payment |
| **Surveys** `/surveys` | Feedback | Survey 1 (in-app on deposit, pre-confirmation) · Survey 2 · rows + modal | surveys |
| **Insights** `/insights` | AI analysis | Claude analyzes pipeline + survey data · Survey 1 breakdown · generate | insights(+generate) |
| **Settings** `/settings` | Config | API keys · artist profile · preferences | artist, settings/keys |

---

## ⚠️ Redundancies to resolve

| Function | Duplicated across | Should live in |
|---|---|---|
| **Bulk email send** (`send-all-queued`) | Dashboard (budget) · Outreach (drain) · Pipeline (button) | **Campaigns** only |
| **Follow-up** | Outreach (`/follow-up`) **and** Campaigns (Playbooks cadence) | **Campaigns / Playbooks** (delete the old one) |
| **Enrichment** | Dashboard (modal) · Outreach (enrich-all) | **Dashboard** (or a "Leads" home) only |
| **Single email generate/send** | Outreach · Dashboard per-show rows | **Outreach** only |
| **Voicemail script** | Outreach · Voice | **Voice** only |
| **Venue lists** | Pipeline (CRM) · Outreach (venues) · Dashboard (per-show) | each for its own purpose — OK, but don't add a 4th |
| **Calls** | Voice (manual + Tulio single) · Campaigns (call campaigns + autopilot) | complementary: Voice = 1-by-1, Campaigns = bulk/budgeted |

---

## Recommended clean ownership (one job per tab)

- **Campaigns** → the *only* place outbound *bulk* sending/calling is started (email + call, one-shot + autopilot + playbook cadences). Remove bulk-send + follow-up from Outreach & Pipeline.
- **Outreach** → becomes the **Response Inbox**: handle replies / needs-attention only. (Single craft-and-send can stay for one-offs.)
- **Pipeline** → the **CRM** of record (stages, filters, export). No send button.
- **Dashboard** → **overview + data setup** (income, status, discovery, enrichment). No bulk send.
- **Voice** → **calls** (manual 1-by-1 + Tulio single + Live Cockpit). Bulk/budgeted calls live in Campaigns.
- **Tour Map / Schedule / Payment / Surveys / Insights / Settings** → already single-purpose, clean.

Net: **one engine (Campaigns), one CRM (Pipeline), one inbox (Outreach), one overview (Dashboard), one call surface (Voice).**
