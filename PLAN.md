# Gigify — Execution Plan & Council Tracker

> The single source of truth for *what we're doing and in what order*.
> `ROADMAP.md` holds the long-term product vision; this file holds the
> prioritized, status-tracked execution. Reviewed through four lenses:
> **Design Director (ex-Linear) · Staff Engineer · Principal Architect · Founder/PM.**

**Status legend:** ✅ done · 🟡 in progress · ⬜ not started · 🔒 blocked (needs founder input)

---

## Where we are
The core money loop is **built**: discover → enrich → score → ranked+throttled
email → **Tulio AI call → close on date/time/price → auto-send pre-filled
booking link** → deposit page. Engineering foundation is mid-hardening.

---

## Phase 0 — Foundation already shipped ✅
These were 🚩 red flags in the first council read; now closed.

| Item | Status | Notes |
|---|---|---|
| Unit tests on pure logic | ✅ | 39 tests: lead-score, pricing, available-dates, agent-brief, send-throttle, vapi |
| CI pipeline | ✅ | GitHub Actions: typecheck + test on every push/PR (Node 22 / pnpm 11) |
| Daily send throttle + budget meter | ✅ | reputation-safe cold-email pacing, surfaced on Dashboard |
| Tulio call engine | ✅ | brief → Vapi dial → webhook close-loop → booking link |

---

## Phase 1 — Engineering Hardening (the "serious engineer" pass)  ← WE ARE HERE
Ordered by impact-per-hour. Mostly mechanical, each independently shippable.

| # | Item | Priority | Effort | Status | Why it matters |
|---|---|---|---|---|---|
| 1.1 | **Delete dead code** — remove Nova/`call-scripts.ts` path (Tulio supersedes it) | P0 | S | ⬜ | "Which one is real?" — ambiguity is a credibility tax |
| 1.2 | **Honest naming** — `sendgrid.ts` → `lib/email/` (provider-agnostic) | P0 | S | ⬜ | The file lies about what it does (17 Resend refs) |
| 1.3 | **De-duplicate ranking** — extract `lib/lead-ranking.ts` (TIER_RANK + urgency) | P0 | S | ⬜ | Copy-pasted across 2 routes already |
| 1.4 | **Central config** — `lib/env.ts` validates every env var once (zod) | P0 | M | ⬜ | 29 scattered raw `process.env` reads, no validation |
| 1.5 | **API wrapper** — one `apiHandler()`: zod input validation + consistent error envelope + logging; apply across all 54 routes | P0 | L | ⬜ | Only 9/54 routes have try/catch; every route trusts the client |
| 1.6 | **ESLint config** — wire `next/core-web-vitals`, fix/relax, re-add `lint` to CI | P1 | M | ⬜ | Lint is the missing CI gate |
| 1.7 | **Decompose god components** — split `outreach/page.tsx` (776 lines) | P1 | M | ⬜ | Unmaintainable as-is |
| 1.8 | **Docs** — `README.md` + one architecture doc (data-flow + boundaries) | P1 | S | ⬜ | "How do I onboard?" |

**Definition of done for Phase 1:** a senior engineer's read flips from *"scrappy MVP"* to *"ships like a pro."*

---

## Phase 2 — MVP completion gates 🔒 (need founder input/keys)
Built and waiting; not engineering work.

| Item | Status | Unblock |
|---|---|---|
| Tulio places real calls | 🔒 | Set `VAPI_API_KEY`, `VAPI_PHONE_NUMBER_ID`, `VAPI_WEBHOOK_URL` on Railway |
| Tulio sounds versed | 🔒 | Elijah's 4 facts: hometown · sounds-like · performance style · accolades |
| Real email sends | 🔒 | Resend verified sending domain + `EMAIL_FROM` |
| Billing gate on calls | ⬜ | Stripe usage metering — gate `/api/calls/dial` behind plan, charge per call |
| Live-call human takeover | ⬜ | Vapi warm-transfer + SMS/push "join call" (no native app needed) |

---

## Phase 3 — The Visual Wow (after MVP utility is locked) 🎨
The leap from *competent Tailwind admin* to *screenshot-worthy product*.

| Item | Priority | Notes |
|---|---|---|
| **Brand identity** | P0 (of phase) | Wordmark, display+body type pairing, layered neutral system + one confident hue, semantic tokens |
| **Signature moment: Live Call Cockpit** | P0 | Streaming transcript + waveform + venue brief + intent meter + glowing "Join call". The demo that ends the conversation |
| **Signature moment: Tour Map** | P1 | Dark map, Elijah's routing pins, venue-lead clusters, deposits lighting up green |
| **Polish vocabulary** | P1 | Framer Motion, optimistic UI, skeleton loaders, ⌘K palette, keyboard-first, designed empty states |
| **Dark mode as default** | P1 | Not an afterthought |
| **Density & rhythm** | P1 | 4px spacing system, tight type scale, zero wasted pixels |

Reference feel: **Linear · Vercel · Stripe · Superhuman · Arc.**

---

## Sequencing (Founder/PM ruling)
1. **Finish Phase 1 hardening** (1.1 → 1.8) — compounding ROI; every later feature is faster/safer on top of it.
2. **Close Phase 2 gates** as keys/inputs arrive (parallel, founder-driven).
3. **Phase 3 visual** once core utility is locked — the "impress" layer.

Don't do Phase 3 before Phase 1. Don't let Phase 1 block shipping a working MVP.
