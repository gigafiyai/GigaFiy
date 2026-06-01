// Free-tier venue enrichment: scrape the venue's website for booking emails.
// No paid API. Most independent venues publish booking@ or events@ on their site.

const USER_AGENT =
  "Mozilla/5.0 (compatible; GigifyBot/1.0; +https://gigify.io/bot)";
const TIMEOUT_MS = 4000;
const CANDIDATE_PATHS = [
  "/",
  "/contact",
  "/contact-us",
  "/booking",
  "/bookings",
  "/book",
  "/about",
  "/events",
  "/private-events",
  "/private-parties",
  "/private-dining",
  "/weddings",
  "/functions",
  "/press",
  "/info",
];

const EMAIL_REGEX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

// Junk patterns to exclude — vendors, transactional addresses, and the
// placeholder addresses CMS templates ship with (SquareSpace, Wix, WordPress).
const EMAIL_BLOCKLIST = [
  // Vendor / platform footers
  /@example\./i,
  /@sentry\./i,
  /@wixpress\./i,
  /@squarespace\./i,
  /@godaddy\./i,
  /@1and1\./i,
  /@sentry-next\./i,
  /@wordpress\./i,

  // Common template placeholder domains
  /@email\.com$/i,
  /@domain\.com$/i,
  /@yourdomain\./i,
  /@yoursite\./i,
  /@yourwebsite\./i,
  /@mysite\./i,
  /@website\.com$/i,
  /@site\.com$/i,
  /@company\.com$/i,
  /@business\.com$/i,
  /@gmail\.con$/i, // common typo
  /@yourcompany\./i,

  // Common placeholder local parts (paired with any domain — strong signal)
  /^user@/i,
  /^name@/i,
  /^your_?email@/i,
  /^youremail@/i,
  /^example@/i,
  /^test@/i,
  /^placeholder@/i,
  /^sample@/i,
  /^email@example/i,

  // Transactional / role addresses we don't want to cold-email
  /^webmaster@/i,
  /^postmaster@/i,
  /^abuse@/i,
  /^noreply@/i,
  /^no-reply@/i,
  /^donotreply@/i,
  /^privacy@/i,
  /^legal@/i,
  /^accounting@/i,
  /^billing@/i,
  /^careers@/i,
  /^jobs@/i,
  /^hr@/i,
  /^press@/i,
  /^media@/i,
  /^marketing@/i,

  // Image filenames the scraper sometimes mistakes for emails
  /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i,
];

export function isJunkEmail(email: string): boolean {
  const lc = email.toLowerCase().trim();
  return EMAIL_BLOCKLIST.some((re) => re.test(lc));
}

export type ScrapedContact = {
  email: string | null;
  source: "homepage" | "contact_page" | "booking_page" | "about_page" | null;
  candidates: string[]; // ranked, top-3 surfaced for debugging
  narrativeText: string | null; // raw text from about/story pages (truncated)
  instagramHandle: string | null;
  facebookUrl: string | null;
};

// Extracts readable body text from raw HTML — strips scripts/styles/tags,
// collapses whitespace, caps at maxChars to keep Claude prompts reasonable.
function extractBodyText(html: string, maxChars = 4000): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars);
}

// Find Instagram + Facebook handles from anchor hrefs.
function extractSocials(html: string): { instagramHandle: string | null; facebookUrl: string | null } {
  let instagramHandle: string | null = null;
  let facebookUrl: string | null = null;

  const igMatch = html.match(/instagram\.com\/([a-z0-9._]+)/i);
  if (igMatch && igMatch[1] && !["p", "explore", "reel", "stories"].includes(igMatch[1].toLowerCase())) {
    instagramHandle = `@${igMatch[1].replace(/\/$/, "")}`;
  }
  const fbMatch = html.match(/(facebook\.com\/[a-z0-9._\-/]+)/i);
  if (fbMatch && fbMatch[1] && !fbMatch[1].includes("/sharer") && !fbMatch[1].includes("/dialog")) {
    facebookUrl = `https://${fbMatch[1].replace(/\/$/, "")}`;
  }
  return { instagramHandle, facebookUrl };
}

function rankEmail(email: string, venueDomain: string | null): number {
  const lc = email.toLowerCase();
  const local = lc.split("@")[0];
  const domain = lc.split("@")[1];

  // Off-domain emails are almost always wrong (vendor footers, dev contacts).
  const onDomain = venueDomain && domain && (domain === venueDomain || domain.endsWith(`.${venueDomain}`));

  let score = onDomain ? 100 : 30;
  if (/^booking/.test(local)) score += 60;
  else if (/^talent/.test(local)) score += 55;
  else if (/^events?$/.test(local) || /^events?@/.test(lc)) score += 50;
  else if (/^events?$/.test(local) || /^event/.test(local)) score += 48;
  else if (/^hello/.test(local) || /^hi$/.test(local)) score += 25;
  else if (/^info/.test(local) || /^contact/.test(local)) score += 20;
  else if (/^manager/.test(local) || /^gm$/.test(local)) score += 35;
  else if (/^office/.test(local)) score += 10;
  return score;
}

type ExtractedEmail = { email: string; explicit: boolean };

function extractEmails(html: string): ExtractedEmail[] {
  const seen = new Map<string, ExtractedEmail>();

  // Explicit mailto: links — deliberately published, always score higher.
  const mailtoRegex = /(?:href|data-href|data-link)\s*=\s*["']\s*mailto:\s*([^"'?#]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = mailtoRegex.exec(html)) !== null) {
    const email = match[1].toLowerCase().trim();
    if (!email.includes("@")) continue;
    if (isJunkEmail(email)) continue;
    if (!seen.has(email)) seen.set(email, { email, explicit: true });
  }

  // Plain-text emails (after stripping tags + decoding entities).
  const text = html.replace(/<[^>]+>/g, " ").replace(/&#?\w+;/g, " ");
  const plainMatches = text.match(EMAIL_REGEX) ?? [];
  for (const raw of plainMatches) {
    const email = raw.toLowerCase().trim();
    if (isJunkEmail(email)) continue;
    if (!seen.has(email)) seen.set(email, { email, explicit: false });
  }

  return [...seen.values()];
}

async function fetchWithTimeout(url: string): Promise<string | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("text/plain")) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function rootUrl(input: string): URL | null {
  try {
    const u = new URL(input);
    u.search = "";
    u.hash = "";
    return u;
  } catch {
    return null;
  }
}

function domainOf(url: URL): string {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = host.split(".");
  if (parts.length >= 2) return parts.slice(-2).join(".");
  return host;
}

export async function scrapeVenueContact(websiteUrl: string): Promise<ScrapedContact> {
  const base = rootUrl(websiteUrl);
  if (!base) {
    return { email: null, source: null, candidates: [], narrativeText: null, instagramHandle: null, facebookUrl: null };
  }
  const venueDomain = domainOf(base);

  const all = new Map<string, { score: number; source: ScrapedContact["source"] }>();
  const narrativeChunks: { source: string; text: string }[] = [];
  let socialIg: string | null = null;
  let socialFb: string | null = null;

  for (const path of CANDIDATE_PATHS) {
    const target = new URL(path, base).toString();
    const html = await fetchWithTimeout(target);
    if (!html) continue;
    const extracted = extractEmails(html);

    // Pull narrative text from About / Story / homepage pages — Claude turns
    // these into the structured venue intelligence the email engine uses.
    if (path === "/" || /about|story|info/i.test(path)) {
      const text = extractBodyText(html, 2500);
      if (text.length > 200) narrativeChunks.push({ source: path, text });
    }

    // Social handles can appear anywhere — keep the first hit per network.
    if (!socialIg || !socialFb) {
      const { instagramHandle, facebookUrl } = extractSocials(html);
      if (!socialIg && instagramHandle) socialIg = instagramHandle;
      if (!socialFb && facebookUrl) socialFb = facebookUrl;
    }
    const source: ScrapedContact["source"] =
      path === "/"
        ? "homepage"
        : /contact/.test(path)
          ? "contact_page"
          : /book/.test(path)
            ? "booking_page"
            : "about_page";
    let batchTop = 0;
    for (const { email, explicit } of extracted) {
      // Boost explicit mailto: matches by 40 — they're deliberately published.
      const score = rankEmail(email, venueDomain) + (explicit ? 40 : 0);
      if (score > batchTop) batchTop = score;
      const prev = all.get(email);
      if (!prev || score > prev.score) all.set(email, { score, source });
    }
    // Early exit on ANY page when we find a strong match. Most venues with
    // a deliberate mailto: link on their homepage will exit here on path #1.
    if (batchTop >= 140) break;
    // Also exit if we found any reasonable email on a dedicated contact page.
    if (batchTop >= 90 && (source === "contact_page" || source === "booking_page")) break;
  }

  // Combine narrative chunks (about + homepage), prefer about-page first.
  narrativeChunks.sort((a, b) => {
    const aIsAbout = /about|story/i.test(a.source) ? 0 : 1;
    const bIsAbout = /about|story/i.test(b.source) ? 0 : 1;
    return aIsAbout - bIsAbout;
  });
  const narrativeText = narrativeChunks.length > 0
    ? narrativeChunks.map((c) => c.text).join("\n\n").slice(0, 5000)
    : null;

  if (all.size === 0) {
    return {
      email: null,
      source: null,
      candidates: [],
      narrativeText,
      instagramHandle: socialIg,
      facebookUrl: socialFb,
    };
  }

  const ranked = [...all.entries()].sort((a, b) => b[1].score - a[1].score);
  const [bestEmail, { source }] = ranked[0];
  return {
    email: bestEmail,
    source,
    candidates: ranked.slice(0, 3).map(([e]) => e),
    narrativeText,
    instagramHandle: socialIg,
    facebookUrl: socialFb,
  };
}
