"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/layout/PageTransition";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fadeInUp, staggerContainer } from "@/lib/animations";
import { AlertTriangleIcon, ExternalLinkIcon, NewspaperIcon, RefreshCwIcon, RssIcon } from "lucide-react";

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

interface NewsResponse {
  articles: NewsArticle[];
  sourceStatus: FeedStatus[];
  lastUpdated: string | null;
  lastRefreshDurationMs: number | null;
  stale: boolean;
  fromCache: boolean;
}

const SOURCE_COLORS: Record<string, string> = {
  "JD Supra - Privacy": "#8b5cf6",
  "Security Boulevard": "#10b981",
  "GRC Pros Blog": "#3b82f6",
  "GRC Engineering": "#f97316",
  NIST: "#f59e0b",
};

const SOURCE_DESCRIPTIONS: Record<string, string> = {
  "JD Supra - Privacy":
    "Data privacy law, CCPA, GDPR, and regulatory compliance updates.",
  "Security Boulevard":
    "Governance, risk, and compliance frameworks, regulatory news, and practitioner insights.",
  "GRC Pros Blog":
    "GRC practitioner content covering FedRAMP, NIST CSF, audit preparation, and tool evaluations.",
  "GRC Engineering":
    "GRC architecture, automation strategies, AI in compliance, and building modern GRC platforms.",
  NIST: "Frameworks, standards, cybersecurity workforce development, and privacy engineering.",
};

const SOURCE_ORDER = [
  "Security Boulevard",
  "GRC Pros Blog",
  "GRC Engineering",
  "JD Supra - Privacy",
  "NIST",
];

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function NewsSkeleton() {
  return (
    <div className="space-y-10">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i}>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-80 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-64 rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [sourceStatus, setSourceStatus] = useState<FeedStatus[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [lastRefreshDurationMs, setLastRefreshDurationMs] = useState<number | null>(null);
  const [stale, setStale] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadNews(forceRefresh = false) {
    const url = forceRefresh ? "/api/news?refresh=1" : "/api/news";
    const response = await fetch(url, { cache: "no-store" });
    const fallback: NewsResponse = {
      articles: [],
      sourceStatus: [],
      lastUpdated: null,
      lastRefreshDurationMs: null,
      stale: true,
      fromCache: false,
    };
    const data = (response.ok ? await response.json() : fallback) as NewsResponse;
    setArticles(data.articles ?? []);
    setSourceStatus(data.sourceStatus ?? []);
    setLastUpdated(data.lastUpdated ?? null);
    setLastRefreshDurationMs(data.lastRefreshDurationMs ?? null);
    setStale(Boolean(data.stale));
    setFromCache(Boolean(data.fromCache));
  }

  useEffect(() => {
    loadNews()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const successfulSources = sourceStatus.filter((s) => s.ok).length;
  const totalSources = sourceStatus.length;
  const failedSources = sourceStatus.filter((s) => !s.ok);

  const grouped: Record<string, NewsArticle[]> = {};
  for (const a of articles) {
    if (!grouped[a.source]) grouped[a.source] = [];
    grouped[a.source].push(a);
  }

  const orderedSources = SOURCE_ORDER.filter((s) => grouped[s]?.length);
  for (const s of Object.keys(grouped)) {
    if (!orderedSources.includes(s)) orderedSources.push(s);
  }

  return (
    <PageTransition>
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <NewspaperIcon className="size-6 text-primary" />
            <h1 className="text-2xl font-bold">GRC News</h1>
            <button
              onClick={async () => {
                setRefreshing(true);
                try {
                  await loadNews(true);
                } finally {
                  setRefreshing(false);
                }
              }}
              className="ml-auto inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <RefreshCwIcon className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
          <p className="text-muted-foreground">
            Aggregated from trusted GRC sources. Updated every 30 minutes.
          </p>
          {!loading && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Sources: {successfulSources}/{totalSources}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Last updated:{" "}
                {lastUpdated
                  ? new Date(lastUpdated).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "Unknown"}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Refresh duration:{" "}
                {lastRefreshDurationMs != null
                  ? `${(lastRefreshDurationMs / 1000).toFixed(2)}s`
                  : "Unknown"}
              </Badge>
              {stale && (
                <Badge className="text-xs bg-amber-500 hover:bg-amber-500 text-white">
                  Stale cache fallback
                </Badge>
              )}
              {fromCache && !stale && (
                <Badge variant="secondary" className="text-xs">
                  Cached
                </Badge>
              )}
            </div>
          )}
          {!loading && failedSources.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <div className="flex items-center gap-2 text-amber-600 text-xs font-medium mb-1">
                <AlertTriangleIcon className="size-3.5" />
                Feed health warning
              </div>
              <p className="text-xs text-muted-foreground">
                {failedSources.length} source{failedSources.length === 1 ? "" : "s"} failed this refresh:{" "}
                {failedSources.map((s) => s.source).join(", ")}.
              </p>
            </div>
          )}
        </div>

        {loading ? (
          <NewsSkeleton />
        ) : articles.length === 0 ? (
          <div className="glass-card rounded-xl p-12 text-center">
            <NewspaperIcon className="size-10 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No news articles available right now. Check back later.
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {orderedSources.map((source) => {
              const sourceArticles = grouped[source];
              const color = SOURCE_COLORS[source] ?? "#6366f1";
              const description = SOURCE_DESCRIPTIONS[source] ?? "";

              return (
                <section key={source}>
                  <div className="flex items-center gap-3 mb-1">
                    <RssIcon className="size-4" style={{ color }} />
                    <h2 className="text-lg font-semibold">{source}</h2>
                    <Badge
                      variant="outline"
                      className="text-xs"
                      style={{ borderColor: `${color}40`, color }}
                    >
                      {sourceArticles.length}{" "}
                      {sourceArticles.length === 1 ? "article" : "articles"}
                    </Badge>
                  </div>
                  {description && (
                    <p className="text-sm text-muted-foreground mb-4 ml-7">
                      {description}
                    </p>
                  )}

                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                  >
                    {sourceArticles.map((article, i) => (
                      <motion.a
                        key={`${article.link}-${i}`}
                        variants={fadeInUp}
                        href={article.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group glass-card rounded-xl overflow-hidden transition-all hover:bg-muted/10 hover:scale-[1.01] flex flex-col"
                      >
                        {article.image ? (
                          <div className="relative h-40 w-full overflow-hidden bg-muted/20">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={article.image}
                              alt=""
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <div
                            className="h-20 w-full flex items-center justify-center"
                            style={{
                              background: `linear-gradient(135deg, ${color}15, ${color}05)`,
                            }}
                          >
                            <NewspaperIcon
                              className="size-6"
                              style={{ color: `${color}40` }}
                            />
                          </div>
                        )}

                        <div className="p-4 flex flex-col flex-1">
                          <span className="text-xs text-muted-foreground mb-2">
                            {timeAgo(article.pubDate)}
                          </span>

                          <h3 className="text-sm font-medium leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                            {article.title}
                          </h3>

                          {article.summary && (
                            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 flex-1">
                              {article.summary}
                            </p>
                          )}

                          <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                            <ExternalLinkIcon className="size-3" />
                            Read article
                          </div>
                        </div>
                      </motion.a>
                    ))}
                  </motion.div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
