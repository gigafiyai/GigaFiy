// Facebook Business Page scraper — public data only.
// Fetches the venue's FB page and extracts live music signals from recent
// posts + page info. No API key needed for public pages.

const TIMEOUT_MS = 5000;
const MUSIC_KEYWORDS = [
  "live music", "acoustic", "open mic", "live entertainment",
  "tonight", "performing", "performer", "singer", "musician",
  "band", "jazz", "folk", "blues", "indie", "bluegrass", "country",
  "americana", "concert", "listening", "set", "show tonight",
];

const PRIVATE_EVENT_KEYWORDS = [
  "private event", "private party", "private dining", "buyout",
  "corporate event", "wedding", "private function", "exclusive event",
];

export type FacebookPageIntel = {
  pageFound: boolean;
  hostsLiveMusic: boolean | null;
  recentMusicMentions: number;
  privateEventsFriendly: boolean;
  pastArtistMentions: string[];
  aboutText: string | null;
  followerCount: number | null;
};

function countKeywords(text: string, keywords: string[]): number {
  const lc = text.toLowerCase();
  return keywords.filter((k) => lc.includes(k)).length;
}

function extractFollowerCount(html: string): number | null {
  // FB pages show follower counts in various formats
  const patterns = [
    /(\d[\d,]+)\s*(?:people like this|followers|likes)/i,
    /"follower_count":(\d+)/,
    /(\d[\d,]+)\s*Followers/,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return parseInt(m[1].replace(/,/g, ""), 10);
  }
  return null;
}

function extractArtistMentions(html: string): string[] {
  // Look for @mentions of performers in posts
  const mentions = html.match(/@[A-Z][a-zA-Z\s]{2,30}(?:Music|Band|Duo|Trio)?/g) ?? [];
  return [...new Set(mentions.slice(0, 5))];
}

async function fetchWithTimeout(url: string): Promise<string | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; GigifyBot/1.0) AppleWebKit/537.36",
        Accept: "text/html",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function scrapeFacebookPage(
  facebookUrl: string
): Promise<FacebookPageIntel> {
  const empty: FacebookPageIntel = {
    pageFound: false,
    hostsLiveMusic: null,
    recentMusicMentions: 0,
    privateEventsFriendly: false,
    pastArtistMentions: [],
    aboutText: null,
    followerCount: null,
  };

  // Normalize URL
  let url = facebookUrl.trim();
  if (!url.startsWith("http")) url = `https://${url}`;

  // Fetch main page
  const html = await fetchWithTimeout(url);
  if (!html || html.length < 500) return empty;

  // Strip scripts and styles for cleaner text
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

  const musicMentions = countKeywords(clean, MUSIC_KEYWORDS);
  const privateMentions = countKeywords(clean, PRIVATE_EVENT_KEYWORDS);
  const followerCount = extractFollowerCount(html);
  const artistMentions = extractArtistMentions(html);

  // Extract about text from meta description or OG tags
  const aboutMatch =
    html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]{20,300})"/i) ??
    html.match(/<meta[^>]+name="description"[^>]+content="([^"]{20,300})"/i);
  const aboutText = aboutMatch ? aboutMatch[1] : null;

  // hostsLiveMusic: true if strong music signal, false if zero signal + large page
  const hostsLiveMusic =
    musicMentions >= 3
      ? true
      : musicMentions === 0 && (followerCount ?? 0) > 200
      ? false
      : null;

  return {
    pageFound: true,
    hostsLiveMusic,
    recentMusicMentions: musicMentions,
    privateEventsFriendly: privateMentions >= 1,
    pastArtistMentions: artistMentions,
    aboutText: aboutText?.slice(0, 300) ?? null,
    followerCount,
  };
}
