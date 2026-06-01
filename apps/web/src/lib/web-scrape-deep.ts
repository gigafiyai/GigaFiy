// Tier 1.5 enrichment: headless-browser scrape. Used only when the fast
// tier-1 fetch scraper returns no email — most pages don't need this.
// Executes JavaScript so we can extract mailto: links that are injected
// client-side (common on SquareSpace / Wix restaurant templates).
//
// Trade-offs:
// - ~2-5s per venue (vs ~0.5-2s for tier 1)
// - Adds ~250MB of Chromium binary, doesn't fit Vercel's lambda size limit
// - For prod, run on Railway/Render OR swap to BrowserBase / Browserless.

import { chromium, type Browser } from "playwright";
import { isJunkEmail } from "@/lib/web-scrape";

const DEEP_PATHS = ["/", "/contact", "/booking", "/private-events"];
const PAGE_TIMEOUT_MS = 8000;

const EMAIL_REGEX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

export type DeepScrapedContact = {
  email: string | null;
  source: "deep_scrape" | null;
  candidates: string[];
};

let _browserPromise: Promise<Browser> | null = null;
async function getBrowser(): Promise<Browser> {
  if (!_browserPromise) {
    _browserPromise = chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return _browserPromise;
}

export async function closeBrowser() {
  if (_browserPromise) {
    const b = await _browserPromise;
    await b.close().catch(() => {});
    _browserPromise = null;
  }
}

function rankEmail(email: string, venueDomain: string | null): number {
  const lc = email.toLowerCase();
  const local = lc.split("@")[0];
  const domain = lc.split("@")[1];
  const onDomain = venueDomain && domain && (domain === venueDomain || domain.endsWith(`.${venueDomain}`));
  let score = onDomain ? 100 : 30;
  if (/^booking/.test(local)) score += 60;
  else if (/^talent/.test(local)) score += 55;
  else if (/^event/.test(local)) score += 48;
  else if (/^manager/.test(local) || /^gm$/.test(local)) score += 35;
  else if (/^hello/.test(local) || /^hi$/.test(local)) score += 25;
  else if (/^info/.test(local) || /^contact/.test(local)) score += 20;
  return score;
}

function domainOf(host: string): string {
  const h = host.toLowerCase().replace(/^www\./, "");
  const parts = h.split(".");
  return parts.length >= 2 ? parts.slice(-2).join(".") : h;
}

export async function scrapeVenueContactDeep(websiteUrl: string): Promise<DeepScrapedContact> {
  // Graceful fallback if Chromium isn't available (e.g. during dev without install)
  try {
    await getBrowser(); // will throw if binary missing
  } catch {
    return { email: null, source: null, candidates: [] };
  }
  let base: URL;
  try {
    base = new URL(websiteUrl);
  } catch {
    return { email: null, source: null, candidates: [] };
  }
  const venueDomain = domainOf(base.hostname);

  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    javaScriptEnabled: true,
  });
  // Block heavy resources we don't need — speeds up the scrape significantly.
  await context.route("**/*", (route) => {
    const t = route.request().resourceType();
    if (t === "image" || t === "media" || t === "font" || t === "stylesheet") {
      return route.abort();
    }
    return route.continue();
  });

  const all = new Map<string, number>();
  try {
    for (const path of DEEP_PATHS) {
      const target = new URL(path, base).toString();
      const page = await context.newPage();
      try {
        await page.goto(target, {
          timeout: PAGE_TIMEOUT_MS,
          waitUntil: "domcontentloaded",
        });
        // Let JS hydrate any mailto: links.
        await page.waitForTimeout(500);

        // Extract from mailto: anchors first — strongest signal.
        const mailtoEmails = await page.$$eval('a[href^="mailto:"]', (els) =>
          els.map((e) => {
            const href = e.getAttribute("href") ?? "";
            return href.replace(/^mailto:/i, "").split("?")[0].trim();
          })
        );
        for (const email of mailtoEmails) {
          const lc = email.toLowerCase();
          if (!lc.includes("@") || isJunkEmail(lc)) continue;
          const score = rankEmail(lc, venueDomain) + 60; // explicit-link bonus
          const prev = all.get(lc) ?? 0;
          if (score > prev) all.set(lc, score);
        }

        // Fallback: rendered text body — catches obfuscated emails revealed by JS.
        const bodyText = await page.evaluate(() => document.body.innerText);
        const textMatches = (bodyText.match(EMAIL_REGEX) ?? []).map((s) => s.toLowerCase());
        for (const lc of textMatches) {
          if (isJunkEmail(lc)) continue;
          const score = rankEmail(lc, venueDomain);
          const prev = all.get(lc) ?? 0;
          if (score > prev) all.set(lc, score);
        }

        // Bail early if we found something strong.
        const top = Math.max(0, ...[...all.values()]);
        if (top >= 140) break;
      } catch {
        // Per-page failure (timeout, navigation error) — try next path.
      } finally {
        await page.close().catch(() => {});
      }
    }
  } finally {
    await context.close().catch(() => {});
  }

  if (all.size === 0) return { email: null, source: null, candidates: [] };
  const ranked = [...all.entries()].sort((a, b) => b[1] - a[1]);
  return {
    email: ranked[0][0],
    source: "deep_scrape",
    candidates: ranked.slice(0, 3).map(([e]) => e),
  };
}
