# Gigify — Full Council Audit & Irreplaceability Blueprint

> A repeating, multi-lens audit of the whole system. Each council member grades
> the current state, lists findings, and itemizes actions tagged:
> **🔴 MUST** (table-stakes / risk / blocker) · **🟢 FEATURE** (new value) ·
> **🟣 MOAT** (differentiation that makes us irreplaceable).
>
> Feeds `PLAN.md` (execution tracker) and `ROADMAP.md` (vision).
> North star: *be the irreplaceable operating system for any up-and-coming
> performer trying to get booked — and then for every underserved
> service-entrepreneur after them.*

---

## The Council (expanded)

**Standing:** 🎨 Design Director (ex-Linear) · 🧑‍💻 Staff Engineer · 🏛️ Principal
Architect · 📊 Founder/PM.

**Newly seated (for this audit):**
- 📈 **Growth Architect** (ex-ServiceTitan / Stripe) — vertical-SaaS GTM, network effects, becoming the system of record.
- 🧠 **Data & Decision Scientist** (ex-Palantir / Anthropic) — the ontology, the moat, operational AI with human-in-the-loop.
- ⚖️ **Trust & Compliance Counsel** — TCPA/CAN-SPAM, AI-call disclosure, recording consent, PII. *(Non-optional for an AI that dials strangers.)*
- 🎸 **Artist-in-Residence** (the customer) — what an up-and-coming performer actually feels and needs.
- 🔐 **Security & Reliability Lead** — payments, PII, uptime, secrets.

---

## 🎨 Design Director — grade: B− (clean, no point of view)
**Findings:** competent Notion-clean admin; no brand identity; no signature moment; no motion; light mode only.

| Action | Tag |
|---|---|
| Brand identity: wordmark, display+body type pairing, layered neutral system + one confident hue, semantic tokens | 🟢 |
| **Live Call Cockpit** — streaming transcript, waveform, intent meter, "Join call" | 🟣 |
| **Tour Map** — routing pins, venue-lead clusters, deposits lighting green | 🟣 |
| Motion + optimistic UI + skeletons + ⌘K palette + keyboard-first | 🟢 |
| Dark mode as default; 4px spacing rhythm; designed empty states | 🟢 |
| Mobile/PWA shell (artist lives on their phone) | 🔴 |

## 🧑‍💻 Staff Engineer — grade: B (rising fast)
**Findings:** tests ✅ + CI ✅ now exist (big jump). Still: no input validation, inconsistent error handling, dead code being purged, no central config, god components, thin docs.

| Action | Tag |
|---|---|
| `apiHandler()` wrapper: zod validation + uniform error envelope + logging across all routes | 🔴 |
| `lib/env.ts` — validate every env var once at boot | 🔴 |
| Finish dead-code purge (Nova ✅ in progress) + honest naming (`sendgrid.ts`→`lib/email/`) | 🔴 |
| Extract `lib/lead-ranking.ts` (dedupe TIER_RANK/urgency) | 🔴 |
| ESLint config → re-add `lint` to CI; add `build` to CI | 🔴 |
| Decompose 776-line outreach page | 🟢 |
| Structured logging + request IDs (pino) | 🟢 |
| Idempotency keys on money/call mutations | 🔴 |

## 🏛️ Principal Architect — grade: B (good bones, needs a spine)
**Findings:** logic in `lib/`, typed Prisma, graceful degradation — but no domain model, routes call Prisma directly, no background-job system, no event bus.

| Action | Tag |
|---|---|
| **The Gigify Ontology** (Palantir-style): first-class linked objects — Artist, Venue, Contact, Show, Lead, Outreach, Call, Booking, Market — with a typed domain layer over Prisma | 🟣 |
| Service layer: routes → services → repositories (stop calling Prisma in handlers) | 🟢 |
| Durable job queue (enrichment/calls/sends) — replace fire-and-forget with retries + dead-letter | 🔴 |
| Event log / audit trail on every object (who/what/when) — the moat substrate | 🟣 |
| Webhook signature verification (Vapi, Stripe, Resend) | 🔴 |
| Multi-tenant isolation from day one (artist_id scoping everywhere) | 🔴 |

## 📈 Growth Architect — grade: C+ (great product, no flywheel yet)
**Findings:** single-artist pilot; no onboarding, no virality, no network effect captured even though we're building the asset that creates one.

| Action | Tag |
|---|---|
| **Shared Venue Graph** (the ServiceTitan move): every artist's enrichment + every call outcome enriches one canonical venue/contact database all artists draw from. The 1,000th artist joins to a pre-warmed map of who books what. | 🟣 |
| Self-serve onboarding: paste your tour dates / Bandsintown / Songkick import → instant lead list | 🔴 |
| "Booked with Gigify" → auto-generate a polished EPK/landing page (already partially built) → artist shares it → inbound venues → top of funnel | 🟢 |
| Referral loop: artists invite tourmates/openers (the scene is tightly networked) | 🟢 |
| Genre/region templates so a new artist is productive in 10 minutes | 🟢 |
| Public "venues that book live music near X" SEO surface → demand capture | 🟢 |

## 🧠 Data & Decision Scientist — grade: B+ (the moat is real, under-exploited)
**Findings:** every call/outcome is a labeled example — this is the irreplaceable asset. We score leads but don't yet *predict, learn, or close the loop.*

| Action | Tag |
|---|---|
| **Booking-probability model** per (venue, artist, date, price) — learns from real outcomes (Palantir AIP / Salesforce Einstein) | 🟣 |
| **Eval harness** on call transcripts → outcome (Anthropic-style): grade Tulio, A/B prompts, improve over time | 🟣 |
| Price-optimization model from real accepted/rejected fees | 🟣 |
| "Best time/day to reach this venue" learned from answer rates | 🟢 |
| Feedback loop: booked/declined/ghosted → retrain scoring weekly | 🟣 |
| Market intelligence: per-region demand, genre fit, saturation | 🟢 |

## ⚖️ Trust & Compliance Counsel — grade: D (real exposure, unaddressed)
**Findings:** an AI that auto-dials businesses and sends cold email touches **TCPA, CAN-SPAM, state AI-disclosure laws, and 2-party call-recording consent.** This is a launch blocker, not a nicety.

| Action | Tag |
|---|---|
| **AI disclosure** in Tulio's opener ("I'm an AI assistant calling on behalf of…") where required by law | 🔴 |
| **Call-recording consent** handling (2-party-consent states) before recording | 🔴 |
| Calling-hours guardrails (no calls before 8am / after 9pm local), DNC list honor | 🔴 |
| CAN-SPAM ✅ footer exists — add suppression list + bounce/complaint handling | 🔴 |
| Per-venue contact-frequency caps (don't harass) | 🔴 |
| Consent/audit ledger: prove what we did, when, with what disclosure | 🟣 |

## 🔐 Security & Reliability — grade: C
| Action | Tag |
|---|---|
| Secrets in a manager (not raw env sprawl), rotate keys | 🔴 |
| Webhook signature verification + replay protection | 🔴 |
| PII encryption at rest for contacts; access logging | 🟢 |
| Rate limiting on public/booking endpoints | 🔴 |
| Uptime monitoring + error tracking (Sentry) + status page | 🟢 |

## 🎸 Artist-in-Residence — grade: B (solves real pain, missing the "business")
**The pains we already hit:** "I don't know who to contact," cold outreach is soul-crushing, I undercharge, I get ghosted. **What's still missing for me:**

| Action | Tag |
|---|---|
| **Get paid + contracts:** deposits ✅, but add simple performance agreements, invoices, 1099/income summary | 🔴 |
| **Income forecasting:** "you have $X booked, $Y in pipeline this quarter" | 🟢 |
| **Relationship memory:** "you played here before, the owner is Sarah, she liked X" — repeat bookings are the real business | 🟣 |
| **Routing optimizer:** fill the gaps between confirmed shows efficiently | 🟢 |
| **Reputation:** collect venue reviews/testimonials → social proof for next pitch | 🟢 |
| **One inbox:** all venue replies (email + call follow-ups) in one place | 🟢 |
| **Mobile:** I'm in a van, not at a desk | 🔴 |

---

## "Steal this" — feature transplants from the six giants

| Company | The thing they nailed | Gigify transplant |
|---|---|---|
| **ServiceTitan** | The operating system for a fragmented trade — dispatch, scheduling, CRM, payments, financing in one place. Turned tradespeople into businesses. | Become the **operating system for the working musician**: booking + calendar + CRM + payments + income, mobile-first. This is our closest model. |
| **ServiceNow** | Workflow engine — a *system of action*, not just record; AI agents executing multi-step flows; SLAs. | **Playbooks**: codified outreach→call→follow-up→close cadences with SLA timers; Tulio as the agent that *executes* the flow, not just talks. |
| **Palantir** | The **Ontology** — model the world as linked objects; operational AI (AIP) with human-in-the-loop decisions. | The **Gigify Ontology** (Artist/Venue/Contact/Show/Lead/Booking/Market) + decision intelligence: which venue, when, what price, predicted to book. |
| **Google** | Discovery, Maps, ranking quality, Gmail/Calendar, radical simplicity. | Multi-source venue discovery ✅ + **Tour Map** + **Gmail/Calendar sync** + clean search + ranking we already do. |
| **Salesforce** | CRM as system of record, pipeline, reports/dashboards, automation (Flow), ecosystem (AppExchange), Einstein predictions. | Pipeline ✅ + dashboards + **predictive scoring** + later an **integrations marketplace** (Spotify, Bandsintown, DSPs, QuickBooks). |
| **Anthropic** | Frontier agents, tool use, safety/guardrails, evals, MCP. | **Tulio** ✅ + call-analysis ✅ + safety/disclosure + an **eval harness** that turns every call into training/eval data. |

---

## Consolidated backlog

### 🔴 MUSTS (table-stakes / risk — do before scaling)
1. Compliance pack: AI disclosure, recording consent, calling-hours, DNC, suppression/bounce handling, frequency caps.
2. `apiHandler()` + zod validation + uniform errors; `lib/env.ts`; finish dead-code purge & honest naming; extract `lead-ranking`.
3. Webhook signature verification (Vapi/Stripe/Resend) + idempotency on money/call mutations.
4. Durable job queue with retries (enrichment, calls, sends).
5. Multi-tenant isolation (artist scoping) + rate limiting + secrets management.
6. ESLint→CI, add build to CI.
7. Mobile/PWA shell + live-call human takeover (warm transfer).

### 🟢 HIGH-VALUE FEATURES (new utility for artists)
- Self-serve onboarding (Bandsintown/Songkick/CSV tour import).
- Unified inbox (email + call follow-ups).
- Contracts + invoices + income summary; income forecasting.
- Routing optimizer for tour gaps.
- Auto-EPK/landing page + reputation/testimonials capture.
- Genre/region quick-start templates; dashboards/reports.

### 🟣 MOAT (irreplaceability)
- **Shared Venue Graph** — canonical, ever-enriching contact DB across all artists.
- **Gigify Ontology** + event/audit log substrate.
- **Booking-probability + price-optimization models** that learn from real outcomes.
- **Tulio eval harness** — proprietary call→outcome dataset compounding forever.
- **Relationship memory** — repeat-booking intelligence per venue/contact.

---

## The irreplaceability thesis
We become impossible to leave when four forces compound:
1. **Data moat** — every call, email, and outcome is a labeled example no competitor can buy.
2. **Network effect** — each artist's enrichment warms the venue graph for the next; value grows with users.
3. **Workflow lock-in** — we're the artist's business OS (calendar, CRM, payments, income), not a tool.
4. **Switching cost** — their entire history, relationships, and reputation live here.

ServiceTitan did this for plumbers. Salesforce did it for sales. We do it for the
1M+ independent performers no incumbent serves — then expand to every underserved
service-entrepreneur, exactly as the roadmap envisions.
