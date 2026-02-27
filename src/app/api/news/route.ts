import { NextRequest, NextResponse } from "next/server";
import Parser from "rss-parser";

interface NewsArticle {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  summary: string;
  image?: string;
}

interface FeedStatus {
  source: string;
  ok: boolean;
  count: number;
  error?: string;
}

interface NewsPayload {
  articles: NewsArticle[];
  sourceStatus: FeedStatus[];
  lastUpdated: string | null;
  lastRefreshDurationMs: number | null;
  stale: boolean;
  fromCache: boolean;
}

const RSS_FEEDS = [
  { url: "https://jdsupra.com/resources/syndication/docsRSSfeed.aspx?ftype=Privacy&premium=1", source: "JD Supra - Privacy" },
  { url: "https://securityboulevard.com/category/blogs/governance-risk-compliance/feed/", source: "Security Boulevard" },
  { url: "https://grcprosblog.substack.com/feed", source: "GRC Pros Blog" },
  { url: "https://blog.grc.engineering/feed", source: "GRC Engineering" },
  { url: "https://www.nist.gov/blogs/cybersecurity-insights/rss.xml", source: "NIST" },
];

const CACHE_TTL_MS = 30 * 60 * 1000;

let cachedArticles: NewsArticle[] | null = null;
let cacheTimestamp = 0;
let cachedSourceStatus: FeedStatus[] = [];
let cachedRefreshDurationMs: number | null = null;

const parser = new Parser({
  timeout: 8000,
  headers: {
    "User-Agent": "DailyFindings/1.0 (GRC Learning Platform)",
  },
  customFields: {
    item: [["enclosure", { keepArray: false }]],
  },
});

function isSafeRssUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return host !== "localhost" && host !== "127.0.0.1" && !host.endsWith(".local");
  } catch {
    return false;
  }
}

function extractImage(item: Record<string, unknown>): string | undefined {
  const enc = item.enclosure as Record<string, string> | undefined;
  if (enc?.url && enc.url.length > 0) return enc.url;

  const content = (item.content || item["content:encoded"] || "") as string;
  const match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match?.[1]) return match[1];

  const desc = (item.description || "") as string;
  const descMatch = desc.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (descMatch?.[1]) return descMatch[1];

  return undefined;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).replace(/\s+\S*$/, "") + "...";
}

async function fetchFeed(
  url: string,
  source: string
): Promise<{ source: string; ok: boolean; articles: NewsArticle[]; error?: string }> {
  try {
    if (!isSafeRssUrl(url)) {
      return {
        source,
        ok: false,
        articles: [],
        error: "Blocked unsafe RSS URL",
      };
    }

    const feed = await parser.parseURL(url);
    const articles = (feed.items ?? []).slice(0, 10).map((item) => {
      const rawSummary =
        item.contentSnippet || item.content || item.summary || "";
      const image = extractImage(item as unknown as Record<string, unknown>);
      return {
        title: item.title ?? "Untitled",
        link: item.link ?? "",
        source,
        pubDate: item.pubDate ?? item.isoDate ?? new Date().toISOString(),
        summary: truncate(stripHtml(rawSummary), 200),
        ...(image && { image }),
      };
    });
    return { source, ok: true, articles };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`Failed to fetch RSS feed from ${source}:`, message);
    return { source, ok: false, articles: [], error: message };
  }
}

async function fetchAllFeeds(): Promise<{ articles: NewsArticle[]; sourceStatus: FeedStatus[] }> {
  const results = await Promise.all(
    RSS_FEEDS.map((feed) => fetchFeed(feed.url, feed.source))
  );

  const articles: NewsArticle[] = [];
  const sourceStatus: FeedStatus[] = results.map((r) => ({
    source: r.source,
    ok: r.ok,
    count: r.articles.length,
    ...(r.error ? { error: r.error } : {}),
  }));
  results.forEach((r) => articles.push(...r.articles));

  const seen = new Set<string>();
  const unique = articles.filter((a) => {
    if (seen.has(a.link)) return false;
    seen.add(a.link);
    return true;
  });

  unique.sort(
    (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  );

  const MIN_PER_SOURCE = 3;
  const MAX_TOTAL = 25;
  const sourceCounts: Record<string, number> = {};
  const guaranteed: NewsArticle[] = [];
  const overflow: NewsArticle[] = [];

  for (const a of unique) {
    const count = sourceCounts[a.source] ?? 0;
    if (count < MIN_PER_SOURCE) {
      guaranteed.push(a);
      sourceCounts[a.source] = count + 1;
    } else {
      overflow.push(a);
    }
  }

  overflow.sort(
    (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  );
  const fill = overflow.slice(0, MAX_TOTAL - guaranteed.length);

  return {
    articles: [...guaranteed, ...fill].sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    ),
    sourceStatus,
  };
}

export async function GET(request: NextRequest) {
  try {
    const now = Date.now();
    const refreshRequested = request.nextUrl.searchParams.get("refresh") === "1";

    if (!refreshRequested && cachedArticles && now - cacheTimestamp < CACHE_TTL_MS) {
      const payload: NewsPayload = {
        articles: cachedArticles,
        sourceStatus: cachedSourceStatus,
        lastUpdated: new Date(cacheTimestamp).toISOString(),
        lastRefreshDurationMs: cachedRefreshDurationMs,
        stale: false,
        fromCache: true,
      };
      return NextResponse.json(payload, {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      });
    }

    const refreshStartedAt = Date.now();
    const { articles, sourceStatus } = await fetchAllFeeds();
    const refreshDurationMs = Date.now() - refreshStartedAt;
    if (articles.length === 0 && cachedArticles) {
      const payload: NewsPayload = {
        articles: cachedArticles,
        sourceStatus: cachedSourceStatus.length > 0 ? cachedSourceStatus : sourceStatus,
        lastUpdated: new Date(cacheTimestamp).toISOString(),
        lastRefreshDurationMs: cachedRefreshDurationMs,
        stale: true,
        fromCache: true,
      };
      return NextResponse.json(payload, {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      });
    }

    cachedArticles = articles;
    cachedSourceStatus = sourceStatus;
    cacheTimestamp = now;
    cachedRefreshDurationMs = refreshDurationMs;

    const payload: NewsPayload = {
      articles,
      sourceStatus,
      lastUpdated: new Date(cacheTimestamp).toISOString(),
      lastRefreshDurationMs: refreshDurationMs,
      stale: false,
      fromCache: false,
    };
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    console.error("Failed to fetch news:", error);
    if (cachedArticles) {
      const payload: NewsPayload = {
        articles: cachedArticles,
        sourceStatus: cachedSourceStatus,
        lastUpdated: new Date(cacheTimestamp).toISOString(),
        lastRefreshDurationMs: cachedRefreshDurationMs,
        stale: true,
        fromCache: true,
      };
      return NextResponse.json(payload, {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      });
    }
    return NextResponse.json(
      {
        articles: [],
        sourceStatus: [],
        lastUpdated: null,
        lastRefreshDurationMs: null,
        stale: true,
        fromCache: false,
      } satisfies NewsPayload,
      {
        status: 500,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      }
    );
  }
}
