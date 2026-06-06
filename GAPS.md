# Gigify — Gaps & Natural Additions

What we're leaving out across the tabs. Tagged **[ref]** = you raised it earlier
and we parked it · **[new]** = natural addition that drives utility.
Companion to `TABS.md`.

## Per-tab gaps

### Dashboard (overview + setup)
- **System / integration status** [new] — which keys are wired (Email ✓, Vapi ✗, Stripe test…), so onboarding is self-evident.
- **Activity feed** [new] — recent sends, calls, replies, deposits in one stream.
- **"Today" action list** [new] — the 3 things to do now (reply to X, N calls queued).
- **Onboarding checklist** [new] — guides a brand-new artist to first campaign.

### Campaigns (the engine)
- **Campaign progress / detail view** [new] — *you launch a campaign but can't watch it run.* Per-item status, sent/opened, pause/cancel. Biggest gap here.
- **Campaign history** [new] — past campaigns + their results (reply/open/book rates).
- **A/B subject testing** [new] — learn what gets opens (feeds the moat).
- **Schedule-for-later** [new] — start a campaign on a chosen day.

### Tour Map
- **Click a show → drill into its venues** [new] — pins are read-only today.
- **Filter by tier / status**, radius rings around each show [new].

### Schedule
- **Google Calendar sync** [ref] — two-way; you raised Gmail/Calendar login.
- **Add/edit a show from the UI** [new] — shows are seeded today, not editable.
- **Conflict / travel-time warnings** [new].

### Pipeline (CRM)
- **Per-venue activity timeline + notes** [new] — every touch on one venue (row detail exists, not a full thread).
- **Kanban board view** [new] — drag venues between stages.
- **Bulk stage change** [new].

### Outreach (inbox)
- **Actual reply content / threads** [ref-ish] — today it shows "REPLIED" status but not the message. Needs **inbound email parsing** (Resend/SendGrid inbound) → a true unified inbox.
- **Template library** [new] — reusable openers.
- **Snooze / mark-done** [new].

### Voice
- **Call history feed with recordings + transcripts** [new] — *the data moat isn't surfaced anywhere.* This is where every call+outcome should live.
- **Warm transfer (real)** [ref] — the cockpit's "Join call" is a placeholder; wire the actual human takeover.
- **Call analytics** [new] — answer rate, tier mix, best call times.

### Payment
- **Contracts / performance agreements (e-sign)** [ref] — you raised contracts; a **DocuSign** plugin is available. Auto-generate the gig agreement.
- **Invoices / receipts + 1099 income summary** [ref] — the "becomes their business" layer; a **QuickBooks** plugin is available.
- **Gigify success-fee collection** [ref] — the monetization we specced (fee online even on cash gigs).
- **Cash-booking option** [ref] — confirm + settle in cash, fee still collected online.
- **Payout tracking** [new] — artist's Stripe Connect balance / next payout.

### Surveys
- **Custom questions** [new] · **inline results analytics** [new] (some lives in Insights).

### Insights
- **Win/loss + recommendations** [new] — "you book best Thursdays at listening rooms."
- **Predictive booking-probability** (Salesforce/Einstein) [ref] — replace heuristic scoring with a model that learns from outcomes.
- **Tulio eval harness** (Anthropic) [ref] — grade/A-B Tulio's calls on the labeled transcript data.

### Settings
- **Artist profile editor** [ref] — self-serve the 4 facts (sounds-like, audience, style, accolades) instead of pasting them to me.
- **Sending-domain manager** [new] · **gem/billing history** [new] · **notification prefs** [new].

---

## Built but NOT wired (unrealized value)
- **Hunter.io / Apollo.io** enrichment — coded, needs keys.
- **Booking-Agent.io** premium contacts — coded, unverified (needs real key + `BOOKING_AGENT_DEBUG`).
- **Facebook scraping** — coded; could surface "full power" signals you asked about.
- **Gmail / Google Calendar login** — deferred; the artist's real inbox/calendar.

---

## Cross-cutting / possible new tabs
- **Contracts** tab (DocuSign e-sign) — agreements as first-class.
- **Reputation** — collect venue testimonials → social proof for the next pitch.
- **Routing optimizer** — fill the open days between confirmed gigs efficiently.
- **Mobile / PWA** [ref] — the artist lives on their phone; warm-transfer + push.
- **⌘K command palette** [ref] — keyboard-first power-user nav.
- **Self-serve onboarding** — the path from "new artist" to first campaign (the growth flywheel).

---

## If I had to pick the top 6 (utility per effort)
1. **Campaign progress view** — you can't watch the engine work yet.
2. **Settings profile editor** — self-serve the facts; unblocks Tulio quality.
3. **Call history feed (recordings + transcripts)** — surface the data moat.
4. **Inbound reply inbox** — close the loop; replies become readable threads.
5. **Contracts + success-fee collection** — the business + monetization layer.
6. **System status panel** — makes go-live config self-evident.
