"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getDomainColor } from "@/lib/domain-colors";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  LockIcon,
  BookOpenIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Topic {
  id: string;
  title: string;
  available: boolean;
  completed: boolean;
  bestScore: number;
  attempts: number;
}

interface DomainData {
  domain: string;
  levels: Record<string, Topic[]>;
}

interface LibraryResponse {
  domains: Record<string, DomainData>;
}

const LEVEL_ORDER = ["Foundational", "Intermediate", "Advanced"];

function LibrarySkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="glass-card rounded-xl p-5">
          <Skeleton className="h-6 w-48 mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-10 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function scoreBadgeClass(pct: number): string {
  if (pct >= 80) return "bg-emerald-500/15 text-emerald-500 border-emerald-500/30";
  if (pct >= 60) return "bg-amber-500/15 text-amber-500 border-amber-500/30";
  return "bg-red-500/15 text-red-500 border-red-500/30";
}

function TopicRow({ topic, domainColor }: { topic: Topic; domainColor: string }) {
  const inner = (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
      className={cn(
        "flex items-center gap-3 rounded-lg px-4 py-3 transition-all",
        "bg-muted/40 border border-border",
        topic.available
          ? "hover:bg-muted/60 hover:border-primary/20 cursor-pointer"
          : "opacity-50 cursor-default"
      )}
    >
      <span
        className={cn("size-2 rounded-full shrink-0")}
        style={{ backgroundColor: topic.available ? "#22c55e" : "#71717a" }}
      />

      <span className="flex-1 min-w-0 text-sm font-medium truncate">
        {topic.title}
      </span>

      {topic.completed && (
        <>
          <Badge
            variant="outline"
            className={cn("text-xs shrink-0", scoreBadgeClass(topic.bestScore))}
          >
            {topic.bestScore}%
          </Badge>
          <CheckCircleIcon className="size-4 text-emerald-500 shrink-0" />
        </>
      )}

      {!topic.available && <LockIcon className="size-3.5 text-muted-foreground shrink-0" />}
    </motion.div>
  );

  if (topic.available) {
    return (
      <Link href={`/session?topicId=${encodeURIComponent(topic.id)}`} className="block">
        {inner}
      </Link>
    );
  }

  return inner;
}

function LevelSection({
  level,
  topics,
  domainColor,
}: {
  level: string;
  topics: Topic[];
  domainColor: string;
}) {
  const [open, setOpen] = useState(false);
  const completed = topics.filter((t) => t.completed).length;

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium",
          "hover:bg-accent transition-colors text-left"
        )}
      >
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
        >
          <ChevronDownIcon className="size-4 text-muted-foreground" />
        </motion.span>
        <span>{level}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {completed}/{topics.length}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <motion.div
              initial="hidden"
              animate="visible"
              transition={{ staggerChildren: 0.04, delayChildren: 0.05 }}
              className="space-y-1.5 pl-6 pr-1 pb-2 pt-1"
            >
              {topics.map((topic) => (
                <TopicRow key={topic.id} topic={topic} domainColor={domainColor} />
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DomainSection({ data }: { data: DomainData }) {
  const color = getDomainColor(data.domain);
  const allTopics = Object.values(data.levels).flat();
  const completedCount = allTopics.filter((t) => t.completed).length;

  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
      className="glass-card rounded-xl overflow-hidden"
    >
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <span
          className="size-3 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <h3 className="text-base font-semibold flex-1">{data.domain}</h3>
        <span className="text-xs text-muted-foreground">
          {completedCount} of {allTopics.length} completed
        </span>
      </div>

      <div className="px-3 py-2 space-y-1">
        {LEVEL_ORDER.map((level) => {
          const topics = data.levels[level] ?? [];
          if (topics.length === 0) return null;
          return (
            <LevelSection
              key={level}
              level={level}
              topics={topics}
              domainColor={color}
            />
          );
        })}
      </div>
    </motion.div>
  );
}

export function SessionLibrary() {
  const [library, setLibrary] = useState<LibraryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/library")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setLibrary(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <BookOpenIcon className="size-5 text-primary" />
        <h2 className="text-xl font-semibold">Session Library</h2>
      </div>

      {loading ? (
        <LibrarySkeleton />
      ) : !library || Object.keys(library.domains).length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <ShieldCheckIcon className="size-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No sessions available yet. Check back after the library is populated.
          </p>
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          transition={{ staggerChildren: 0.08, delayChildren: 0.1 }}
          className="space-y-5"
        >
          {Object.values(library.domains).map((domainData) => (
            <DomainSection key={domainData.domain} data={domainData} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
