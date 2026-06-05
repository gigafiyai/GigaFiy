# Gigify — Monetization Council Deliberation

> Triggered by: "should we let venues confirm + pay cash?" — which can't be
> answered without deciding how Gigify earns. The council weighs three models
> through five lenses, then recommends.

## The central tension
Three facts pull in different directions:
1. **Our customers are broke.** Up-and-coming artists earn $80–600/gig and have little cash. An upfront cost before they've booked anything is a hard sell.
2. **Repeat-relationship leakage.** Once an artist books a venue through us, next time they can just call the venue directly — they own the relationship now. This kills pure transaction marketplaces over time (disintermediation).
3. **The vision is an OS, not a tool.** "Irreplaceable" (ServiceTitan/Salesforce) means recurring, sticky infrastructure — which points at subscription.

No single model satisfies all three. The art is staging them.

---

## Model 1 — Subscription + per-call (SaaS + usage)

| Lens | Pro | Con |
|---|---|---|
| 💰 Monetization | Predictable MRR; highest valuation multiple | Charging a broke artist *before* a booking = brutal acquisition + churn |
| 📈 Growth | Clean pitch; "OS" positioning | "Pay $X/mo to *maybe* get gigs" converts poorly cold |
| 🎸 Artist | Knows the cost; no surprises | Pays whether or not they book; per-call cost may make them *avoid* the feature that helps them |
| 🧠 Data | Stable base to fund the moat | No upside capture — book a $5k festival, still get $29 |
| 🏛️ Architect | Simple to build/meter | — |

**Verdict:** great *retention* model, weak *acquisition* model for this audience.

---

## Model 2 — Take-rate on bookings (success fee)

| Lens | Pro | Con |
|---|---|---|
| 💰 Monetization | Perfectly aligned: we earn only when they earn; captures upside | Lumpy, less predictable; lower SaaS multiple |
| 📈 Growth | **Killer pitch: "free until you book — we take a cut only when you get paid."** Removes the broke-artist barrier entirely | Disintermediation — artists take repeat venues off-platform |
| 🎸 Artist | Easy yes, zero upfront risk | A cut of a small gig still stings |
| 🧠 Data | Every booking flows through us = clean data | Only if money flows through the rail — **cash gigs bypass it** |
| 🏛️ Architect | Stripe Connect already scaffolded | Payment friction at the close; collection/enforcement is hard |

**Verdict:** best *acquisition* model, but leaks on cash and on repeat relationships.

---

## Model 3 — Hybrid, staged (free → success fee → subscription)

| Lens | Pro | Con |
|---|---|---|
| 💰 Monetization | Captures the customer's whole lifecycle: land free, monetize the win, retain on subscription | More mechanics to build + explain |
| 📈 Growth | Free entry (land broke artists) + aligned success fee + Pro upsell as they grow | Risk of "nickel-and-dime" feel if clumsy |
| 🎸 Artist | Pays nothing until they win; grows into paying for the OS as it becomes their business | — |
| 🧠 Data | Bookings + ongoing management both on-platform | Take-rate portion still needs the cash-leakage fix |
| 🏛️ Architect | Each layer ships independently | Most surface area |

**Verdict:** matches how the artist's relationship to money *evolves* — broke and skeptical → real small business.

---

## The insight that decides it (Monetization Strategist)
This is the **Toast / ServiceTitan playbook**: land a cash-poor, fragmented profession cheap-or-free, become the infrastructure they run their business on, and monetize through a *blend* — payments take-rate early, software subscription as they professionalize. Neither pure-SaaS nor pure-marketplace wins here; the **staged hybrid** does, because:
- The **success fee** solves acquisition (no barrier, aligned).
- The **subscription/OS** solves retention + disintermediation (leaving costs more than staying — your calendar, CRM, relationship memory, re-booking intelligence all live here).
- **Per-call usage** monetizes the expensive AI (Tulio) without gating the cheap stuff.

---

## Recommendation: staged hybrid

1. **Free to start** — discovery, scoring, a few sends. Land the broke artist; get them a gig. No barrier, no card.
2. **Success fee on bookings made through Gigify** — small flat fee or %, charged **online at confirmation**, *regardless of how the gig itself is settled.* This is the aligned "we win when you win" hook.
3. **Per-call usage** for Tulio (pay-per-call or bundled into Pro) — the premium action.
4. **Pro subscription** as they grow into a touring business — CRM depth, unlimited sends, calendar, analytics, the OS. The retention + anti-leakage layer.

---

## …which answers the cash question
**Yes, build cash-confirm** — and it's safe *because* of the staged model:
- The **gig fee** can settle however the venue wants (cash on the night, check, deposit online).
- The **Gigify booking fee** is collected **online at the moment of confirmation**, so cash gigs never bypass our revenue.
- Both paths generate a real **booking agreement** (date/time/fee/cancellation terms) and advance the pipeline to BOOKED — preserving commitment, record, and data.

So the booking flow becomes: **Confirm → [Pay deposit now ▸ recommended]  ·  [Settle in cash on the night] → small Gigify fee online → agreement generated.**

> Open founder calls: the success-fee number (flat $ vs %), and whether per-call
> is usage or bundled. Everything else above is a safe default.
