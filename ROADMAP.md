# Gigify Roadmap

> The AI booking agent for independent talent. Musicians today. Speakers, comedians, and every solo performer who needs gigs tomorrow.

---

## The Vision

Gigify replaces the entire booking layer for independent talent — the part of the job no artist actually wants to do.

A musician wakes up in the morning, opens Gigify, and sees: 142 venues sourced from their tour radius, 89 personalized emails already sent overnight, 12 venues warm enough that Nova called them on the phone, 4 deposits collected, 2 contracts signed, 1 cancellation auto-refunded inside the 24-hour window — and the next show in the routing already has 7 candidate venues queued for tomorrow.

By v2, the artist doesn't open Gigify daily — they just see paychecks land and confirmations show up on their calendar. The agent does the work.

By v3, this isn't just a tool for musicians. Motivational speakers fill their corporate calendar the same way. Stand-up comedians fill club Wednesdays. Magicians, drag performers, DJs, jazz trios, marching bands, harp duos for weddings — anyone who lives by gigs uses Gigify to source them.

By v4, it's a two-sided marketplace. Venues post open dates. Talent applies. Bookings happen in three taps. Gigify takes a clip on every transaction. The booking agent industry — opaque, relationship-locked, fee-bloated — gets disintermediated by a system that's faster, fairer, and actually understands what a working gigging artist needs.

This document is the path to get there.

---

## Phase 0 — Pilot Ship (Elijah Stone, June–August 2026)

**Goal:** Run one real artist through the full loop. Prove the unit economics. Build the case study.

### Ship-blocking for first real campaign

1. **Deploy the app** to Railway or Render so booking links resolve to a real URL, not `localhost:3000`. Railway preferred — keeps Playwright deep-scrape working.
2. **Custom domain** (`gigify.io` or similar) pointed at the deployed app. Update `NEXT_PUBLIC_APP_URL` in prod env.
3. **SendGrid sender authentication** — domain auth (DKIM + SPF + DMARC) on `gigify.io`. Without this, ~40% of cold emails land in spam regardless of how good the copy is.
4. **SendGrid event webhook** receiver — flips `Outreach.openedAt` / `clickedAt` automatically. Without this, the open-rate signal that powers Nova's call queue and the Insights page is dead.
5. **Stripe webhook URL** registered in the production Stripe dashboard. The `STRIPE_WEBHOOK_SECRET` currently in `.env` is for `stripe listen` (local). Without the prod webhook, real payments won't transition Pipeline → DEPOSIT.

### Important but not first-email-blocking

6. **Cron scheduler** (BullMQ + Redis). Powers:
   - 24-hour auto-refund job checking `cancellationDeadline` every minute
   - Reminder emails (1 week / 48h / day-of)
   - Survey 2 auto-send at T+24h after booking confirmation
   - Auto-outreach trigger 3-4 weeks before each show
7. **Instagram handle** + **video reel URL** on Artist profile; injected into landing page and email signature.
8. **Calendar invite (.ics)** attached to confirmation email.

### Premium / scale (post-pilot)

9. **Auth (Clerk)** — every API route is currently wide open. Anyone who finds the URL can run discovery on your data.
10. **Multi-artist support** — currently we always grab `findFirst()`. Per-artist data scoping on every query, Artist plan tier on every quota check.
11. **Twilio + Nova (real voice agent)** — Premium tier. The phone-first enrichment flow + the actual call-the-decision-maker pitch. Already scaffolded in `lib/call-scripts.ts` and the Voice page; just needs Twilio + Claude Realtime + Deepgram + ElevenLabs credentials wired.
12. **Stripe Connect** — deposits currently land in *the platform's* Stripe account. Connect lets each artist hook up their own bank, platform takes 10–12% per booking.
13. **Auto-contract PDF + e-signature** (HelloSign or DocuSign) — fires after deposit confirms.
14. **Sentry + PostHog** — errors + product analytics.

---

## Phase 1 — Gaps in the Booking Flow Itself

Stuff I missed in the original 14 but that the product needs before it's actually a complete booking tool.

### Operational completeness

15. **Reply detection + classification.** When a venue replies to an outreach email, SendGrid Inbound Parse pipes the reply into Gigify. Claude classifies it: interested / objection / decline / spam / out-of-office. Auto-advances Pipeline stage. Surfaces in CRM as a "New reply" tag.
16. **Bounce + unsubscribe handling.** Bounced addresses get marked dead. Unsubscribes get permanently excluded from future campaigns. Required by CAN-SPAM and for sender reputation.
17. **Email pacing / IP warmup.** Don't blast 500 emails in 5 minutes — looks like spam. Throttle to ~50/hour during warmup, ramp to 200/hour after reputation builds.
18. **Hospitality rider** — green room, water, meal, parking, guest list size. Captured on artist profile, included in contract.
19. **Tech rider** — what gear the artist brings, what they need provided (PA, mic, monitors, backline). Same.
20. **Soundcheck / load-in time** — separate from set time. Coordinated with venue at contract signing.
21. **W-9 / tax form collection.** When venues pay artists >$600/year, IRS requires 1099 reporting. Auto-collect W-9 from artist on first booking; auto-generate 1099 for venue at year-end.
22. **Mileage and expense tracking.** Tour costs are tax-deductible. Auto-log mileage between shows, prompt artist to log meals/gas/lodging.
23. **Pricing intelligence.** What should this venue pay this artist? Trained on capacity × day-of-week × genre × past comps. Auto-suggests an opening ask in the email body.
24. **Tour routing optimizer.** Given the existing schedule, recommends geographically efficient venues to fill gaps. Avoids the 4-hour-drive-each-way mistake.
25. **Repeat-booking flywheel.** Venue booked Elijah once → system surfaces 3 more matching dates 3 months later → auto-drafts the follow-up email.
26. **Past performance history.** Per artist: cumulative draw numbers, total shows, set length range, set list history. Becomes the basis for the artist's verified profile.

### Intelligence layer

27. **Sentiment analysis on replies.** Claude reads the reply, scores it 1-5 on likelihood-to-close, attaches to the Pipeline row.
28. **Lead scoring per venue.** Combine: city size, venue capacity, distance from anchor show, past response rate of similar venues, decision-maker title quality. Sort the Outreach queue by score, send the highest-converting first.
29. **A/B testing infrastructure.** Properly random subject/body variants, stable tracking, Bayesian win detection. Auto-promote winning variant.
30. **Performance benchmarks.** "Your indie folk open rate is 38%; category median is 32%." Encourages improvement, gives Pro tier a tangible upgrade reason.

### Multi-channel

31. **SMS as backup channel** (Twilio). For venues where email bounces or no email exists — text the booker. Different copy, different cadence.
32. **WhatsApp Business** for international markets when Gigify expands beyond US.
33. **In-app messaging.** Once a venue replies and converts, conversation moves into Gigify's threaded inbox. Both sides see the same conversation.
34. **Document storage (S3).** Contracts, photos, riders, EPK assets, call transcripts.

---

## Phase 2 — Multi-Talent Expansion

This is where Gigify stops being "for musicians" and becomes "for everyone who books gigs."

35. **Talent type as first-class field on Artist.** `talentType: "musician" | "speaker" | "comedian" | "magician" | "dj" | "drag_performer" | "spoken_word" | "...".` Defaults change per type.
36. **Type-specific email templates and Claude prompts.** A comedian doesn't talk about "draw"; they talk about "headline vs feature vs open." A motivational speaker talks about "keynote topic" and "audience size." Replace today's venue-type-aware opener system with a (talent-type × venue-type) matrix.
37. **Type-specific decision-maker discovery.** Comedy clubs have talent buyers. Corporate keynotes go through HR/events teams. Colleges go through Activities Boards. Each pattern needs its own discovery query template.
38. **Type-specific venue taxonomies.** Musicians want bars and clubs. Comedians want comedy clubs and corporate events. Speakers want conferences, corporate retreats, universities, churches. Each gets its own Google Places category sets and external data sources.
39. **Fee structures by talent type.**
   - Musicians: 50% deposit + 50% night-of (current model)
   - Speakers: Often net-30 from corporate, 50% deposit from associations
   - Comedians: Door split + back-end, OR flat guarantee for corporate
   - Auto-detect and present the right structure.
40. **Topic and specialty tags** for speakers. "Leadership" / "DEI" / "AI futurism" / "sales motivation" / "well-being." Becomes the matching signal for venue (conference) discovery.
41. **Multi-format demo reels.** Musicians upload one 60-second performance reel. Speakers need a sizzle reel, a full-talk video, AND audience-reaction shots. Type-specific upload UX.
42. **Travel + per-diem handling.** Speakers regularly fly. Comedians do tour swings. Capture flight booking preferences, per-diem rates, ground transport.
43. **Block-out time around gigs.** A speaker doing a 9 AM keynote in Denver from NYC needs a travel day before and after. Auto-block on the artist calendar.

---

## Phase 3 — Two-Sided Marketplace

When the supply side (talent) is dense enough and the demand side (venues) starts coming inbound.

44. **Venue portal.** Venues sign up, post open dates, search talent by genre / fee range / draw / availability.
45. **Booking marketplace search.** Filterable feed of talent. Verified badges. Past show count. Average review.
46. **Reviews / ratings (both directions).** Artists rate venues (load-in process, payment timeliness, hospitality). Venues rate artists (draw vs. promised, professionalism, sound quality).
47. **Public artist directory** at `/directory` — SEO play. Each artist gets a profile page that ranks for "[city] indie folk artist for hire" type queries.
48. **Public venue directory** when supply is mature. Same SEO logic, reversed.
49. **Tour pack offers.** Book 3 nearby venues as a package — venues get 10% off, artist gets 3 dates locked.
50. **Group bookings / festivals.** Festival programmer books a package of 5 acts in one transaction.
51. **Embed widgets.** "Book this artist" button artist can embed on their own website. Drives traffic to Gigify, closes deals through Gigify.

---

## Phase 4 — Platform Operations & Trust

Required for scale; mostly invisible to end users until something breaks.

52. **Email deliverability scoring** — flag emails that bounce, deactivate consistently-dead domains, monitor sender reputation.
53. **Anti-fraud.** Stripe Radar + custom rules. Fake venues using the platform to harvest artist info; fake artists soliciting deposits and disappearing.
54. **Refund dispute resolution.** What if venue says they didn't get the show? What if artist says venue stiffed them? In-platform mediation flow.
55. **Cancellation fees beyond 24h.** Currently we promise free cancel for 24h. Beyond that, cancellation fees scale (50% / 25% / 0% by days-out). Auto-apply.
56. **Force majeure clauses.** Hurricane, pandemic, venue fire — non-fault cancellation. Defined in contract template.
57. **Liability insurance partnership.** Offer per-show insurance via partner (e.g., Thimble) at booking.
58. **GDPR / CCPA compliance.** Opt-out tracking, data deletion endpoints, regional data residency. Mandatory before expanding internationally.
59. **CAN-SPAM compliance.** Physical address in every email footer, working unsubscribe, identify ourselves as a sender. Currently missing.
60. **State-level cold email rules.** California in particular has stricter rules. Compliance review per state.
61. **Music licensing data integration.** SoundExchange / BMI / ASCAP / SESAC for artists doing covers. Required for many venue types.
62. **Tax 1099 auto-generation** for any artist paid >$600/year through the platform.

---

## Phase 5 — Distribution and Growth

63. **Referral program.** Artist refers another artist → 1 month free. Venue refers another venue → discount on next deposit fee.
64. **White-label / Agency tier.** Manager runs Gigify on behalf of 10 artists, fully branded as their booking agency. Top end of the pricing ladder ($499+/mo).
65. **Subscription tiers UI** with proper feature gates: Starter ($99), Pro ($199), Agency ($499), per the build guide.
66. **Onboarding flow.** New artist sign-up walkthrough: profile → schedule import → first discovery → first emails. Should take <10 min from signup to first sent.
67. **Mobile app (iOS / Android).** Approve emails, review call summaries, mark "booked!" on the go. Push notifications for replies and deposits.
68. **Press kit generator.** Auto-build EPK PDF from artist profile data. Free tier feature; drives signups.
69. **Public testimonials.** Once Elijah books 10 shows through Gigify, his story becomes the case study. Repeat for next 50 artists.

---

## Open Questions to Resolve

- **Multi-artist single-user vs. multi-user.** A manager handling 10 artists is one Gigify account with 10 artists. But are they a different SKU from a solo artist who has one account with one artist? The pricing guide says yes (Agency tier). The data model says no (it's all artists under a user). Reconcile.
- **Branding.** Right now every outbound email is signed by the artist personally, never mentions Gigify. Should we add a tiny "Sent via Gigify" footer in starter tier (for cold-spread awareness), removable on Pro?
- **Direct-pay vs. platform-pay.** Today, money flows Venue → Gigify Stripe → (later, via Connect) Artist. Alternative: Venue → Artist Stripe Connect direct, Gigify takes a fee. Lower platform risk, but means we don't hold deposits and the 24h refund guarantee is harder to enforce.
- **Where does Booking-Agent.io's data come from, and what's the per-lookup cost at scale?** Need a contract conversation before we make Premium enrichment a core selling point.
- **Voice agent training.** Nova's script is templated. At scale, we want Claude Realtime conversing freely with venues. What guardrails prevent it from over-promising or under-pricing?

---

## Additional Priorities Added After v1 Pilot Touch

These came up during real usage of the pilot and matter at every phase from Phase 1 onward.

70. **Venue intelligence scraping** — during the email-enrichment scrape, also pull venue *narrative* (about page, food type, vibe, neighborhood, decade founded, "we feature live music every Thursday" patterns). Stored as `venue.narrative` / `venue.tags`. Claude uses it to write *truly* personalized openers: *"Caught your menu on the way in — the burrata + Wednesday acoustic combo is exactly the room I'm trying to play in."* Multi-orders-of-magnitude lift over current per-venue-type templates.
71. **Multi-source venue discovery beyond Google Places — phased rollout.**

    **Wave 1 (immediate, biggest lift):**
    - **Setlist.fm API** — free, non-commercial. Returns every venue that's hosted a show in a city in the last N months. **Highest possible booking-fit signal** — venues already proven to host live music. Single best discovery upgrade we can make.
    - **OpenStreetMap Overpass API** — completely free, no key, no rate limit. Pulls every tagged venue in a radius (`amenity=bar`, `amenity=music_venue`, `amenity=restaurant`). Broad safety net that catches small/new venues missing from Google Places.

    **Wave 2 (after Wave 1 settles in):**
    - **Foursquare Places API** — 5K free calls/day. Better category taxonomy than Google ("wine bar" vs "sports bar"). Directly improves Claude's vibe-matching in emails.
    - **Hunter.io** — free tier 25 searches/month, cheap upgrade. Plugs in as Tier-2.5 enrichment between deep scrape and Booking-Agent.io. Finds emails by company domain.

    **Wave 3 (polish + long tail):**
    - **Wikipedia category scraping** — curated structured pages ("Music venues in Massachusetts"). Catches legendary venues nothing else captures.
    - **Eventbrite Public API** — free tier. Lists venues hosting events. Signal that venue programs activity.
    - **Last.fm API** — free with attribution. Backup live-music signal.
    - **Bandsintown + Songkick scraping** — venue pages are public. APIs were restricted ~2019; scraping the public venue pages still works for moderate volume.

    **Wave 4 (custom + ongoing):**
    - **Resident Advisor** scraping — only worth doing when Gigify expands to electronic talent.
    - **Alt-weekly local concert listings** (Boston Globe, Time Out, Pitchfork, regional papers) — high effort per publication, but catches market-specific venues nothing else does.
    - **Pollstar / industry directories** — partner agreement, expensive.

    **Deprioritized / paid-only:**
    - **Yelp Fusion** — deprecated for new developers in 2023. Requires partner application. Premium tier consideration only.
    - **Apollo.io** — paid; potential alternative to Booking-Agent.io for premium tier.
    - **Ticketmaster Discovery API** — mostly large venues; not a fit for indie folk targeting.

    **Deduplication is non-negotiable.** Every source returns overlapping venues. Dedup key: lat/lng rounded to 0.0005° (~50m) + fuzzy name match (Levenshtein < 3 after normalization). Without this, the venue list inflates with duplicates and the email engine sends the same artist to the same venue three times.
72. **Artist availability calendar** beyond just "confirmed gigs." Today the system knows when Elijah is *booked*; it doesn't know when he's *blocked* (family event, recording session, exhaustion day, religious holiday, day jobs, personal travel). Add a dedicated availability/blackout calendar. The available-dates engine excludes blackout days from suggestions. Elevate Schedule tab to be the artist's full canonical calendar — confirmed shows + blackout windows + tentative holds + tour-radius preferences.
73. **Artist voicemail recording feature.** Artist records a 20-second voicemail through the CRM ("Hi, this is Elijah Stone, calling about adding a date to your room — please email elijah@…"). When Nova hits voicemail or the venue has no findable email, an alternative tier (between deep-scrape and Booking-Agent.io paid) plays the artist's *own voice* via Twilio. Higher response rate than a synthetic Nova voice. Cheap to deliver. Premium feature. *This is also a wedge — artists love the idea of their own voice doing outreach work for them.*
74. **In-CRM call-yourself-then-log-the-email flow.** Sometimes the artist *wants* to call themselves — they're already on the road, they have a personal connection, the venue is a stretch. Gigify provides: a one-tap call button in the row that opens their phone dialer with the venue's number, then prompts them post-call: *"Did you get an email?"* with a tiny form to capture name + email + notes. Pipeline auto-advances to INTERESTED. Voicemail-Nova doesn't get triggered for that venue.

---

## The Vision — In The Founder's Own Words

> "An extremely high level automated outreach engine and CRM packed into an invaluable service for first up-and-coming artists and talent looking to book gigs — but then can continue the model into endless underserved entrepreneur and similar small business communities. Like a better version of Salesforce could ever be, because it's customizable and irreplicable to the user."

That's it. That's the whole pitch. Everything else in this document is just execution detail.

---

## The Overarching Product Vision

**Today:** the world's best automated lead-gen + booking-CRM engine for up-and-coming musical artists.

**Six months:** the same engine, rebranded per vertical, for stand-up comedians, motivational speakers, magicians, drag performers, wedding officiants, DJs, mobile barbers, mobile dental hygienists, personal trainers, photographers, videographers, dog trainers, fitness instructors, voice actors, and every other independent service provider whose biggest blocker is reaching the right decision-maker at scale.

**Twelve months:** the underlying engine — discovery + enrichment + AI personalization + multi-channel outbound + voice agent + offer-with-reversible-commitment + deposit-escrow + survey loop — exposed as a configurable platform for **any underserved entrepreneur or small-business operator who needs to source local accounts**. Commercial cleaners. Catering companies. Independent trades. Freelance professionals. Mobile services. Corporate wellness practitioners.

**Where this lands:** a better version of Salesforce — not because we copied Salesforce, but because we built the opposite of Salesforce. Salesforce is generic, configurable, expensive, and assumes you have a sales team to operate it. Gigify is *vertical-specific by default*, *AI-automated end-to-end*, *priced for solo operators*, and *each tenant's setup is irreplicable* — the specific combination of their schedule, their voice clip, their reel, their venue-network history, and their AI-tuned offer is unique to them. Competitors can't copy what they can't see.

We win because Salesforce will never lower itself to serve the long tail of solo operators, and because the existing tools that serve them (Mailchimp, HubSpot Starter, Mixmax, Apollo, Lemlist) are generic email blasters with a CRM bolted on. We're the inverse: a vertical-native operating system that happens to send email.

This is what we're really building.

---

## What This Becomes

At Phase 0 done: Elijah Stone books 5-10 shows through Gigify. One artist, one case study.

At Phase 1 done: 25 musicians using Gigify. $5K-15K MRR. Pilot has become a real SaaS.

At Phase 2 done: Speakers, comedians, magicians, and DJs on the platform. 100+ talent. $50K-100K MRR. Gigify is the answer to "how do I find more gigs" for any independent performer.

At Phase 3 done: Two-sided marketplace humming. Venues actively post open dates and Gigify auto-matches them. 1000+ talent. $500K+ MRR. The booking agent industry is officially being disintermediated.

At Phase 4-5 done: Default booking infrastructure for independent talent globally. $2M-5M ARR. Acquisition targets: Spotify, Live Nation, CAA, Endeavor, private equity in the live events space.

This is what we're building.
