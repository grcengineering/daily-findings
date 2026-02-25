"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { fadeInUp, staggerContainer } from "@/lib/animations";
import { ArrowRightIcon, ExternalLinkIcon, NewspaperIcon } from "lucide-react";

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
}

interface NewsFeedProps {
  articles: NewsArticle[];
  sourceStatus?: FeedStatus[];
  lastUpdated?: string | null;
  lastRefreshDurationMs?: number | null;
  stale?: boolean;
}

const SOURCE_COLORS: Record<string, string> = {
  "JD Supra - Privacy": "#8b5cf6",
  "Security Boulevard": "#10b981",
  "GRC Pros Blog": "#3b82f6",
  "GRC Engineering": "#f97316",
  NIST: "#f59e0b",
};

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

export function NewsFeed({
  articles,
  sourceStatus = [],
  lastUpdated = null,
  lastRefreshDurationMs = null,
  stale = false,
}: NewsFeedProps) {
  const healthySources = sourceStatus.filter((s) => s.ok).length;
  const totalSources = sourceStatus.length;

  if (articles.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <NewspaperIcon className="size-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          No news articles available right now. Check back later.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <NewspaperIcon className="size-5 text-primary" />
        <h2 className="text-lg font-semibold">GRC News</h2>
        {totalSources > 0 && (
          <Badge variant="outline" className="text-xs ml-2">
            {healthySources}/{totalSources} sources live
          </Badge>
        )}
        {lastUpdated && (
          <Badge variant="outline" className="text-xs">
            {new Date(lastUpdated).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </Badge>
        )}
        {lastRefreshDurationMs != null && (
          <Badge variant="outline" className="text-xs">
            {(lastRefreshDurationMs / 1000).toFixed(2)}s
          </Badge>
        )}
        {stale && (
          <Badge className="text-xs bg-amber-500 hover:bg-amber-500 text-white">
            Stale
          </Badge>
        )}
        <Link
          href="/news"
          className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          View all <ArrowRightIcon className="size-3" />
        </Link>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {articles.map((article, i) => {
          const sourceColor = SOURCE_COLORS[article.source] ?? "#6366f1";

          return (
            <motion.a
              key={`${article.link}-${i}`}
              variants={fadeInUp}
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group glass-card rounded-xl overflow-hidden transition-all hover:bg-muted/10 hover:scale-[1.02] flex flex-col"
            >
              <div className="p-4 flex flex-col flex-1">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <Badge
                    className="text-xs shrink-0"
                    style={{
                      backgroundColor: `${sourceColor}20`,
                      color: sourceColor,
                    }}
                  >
                    {article.source}
                  </Badge>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {timeAgo(article.pubDate)}
                  </span>
                </div>

                <h3 className="text-sm font-medium leading-snug mb-1.5 line-clamp-2 group-hover:text-primary transition-colors">
                  {article.title}
                </h3>

                {article.summary && (
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">
                    {article.summary}
                  </p>
                )}

                <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  <ExternalLinkIcon className="size-3" />
                  Read more
                </div>
              </div>
            </motion.a>
          );
        })}
      </motion.div>
    </div>
  );
}
