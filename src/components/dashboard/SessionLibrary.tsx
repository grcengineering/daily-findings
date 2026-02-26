"use client";

import { useState, useEffect, type MouseEvent } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getDomainColor } from "@/lib/domain-colors";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  LockIcon,
  BookOpenIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Topic {
  id: string;
  title: string;
  moduleType: "core" | "depth" | "specialization" | "capstone";
  prerequisites: string[];
  competencyIds: string[];
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
  paths?: Array<{
    path_id: string;
    title: string;
    module_ids: string[];
  }>;
}

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

function typeBadgeClass(moduleType: Topic["moduleType"]): string {
  if (moduleType === "core") return "bg-indigo-500/15 text-indigo-500 border-indigo-500/30";
  if (moduleType === "depth") return "bg-cyan-500/15 text-cyan-500 border-cyan-500/30";
  if (moduleType === "specialization") return "bg-purple-500/15 text-purple-500 border-purple-500/30";
  return "bg-amber-500/15 text-amber-600 border-amber-500/30";
}

function TopicRow({
  topic,
  completedSet,
  onGateOpen,
}: {
  topic: Topic;
  completedSet: Set<string>;
  onGateOpen: (topic: Topic, missing: string[]) => void;
}) {
  const missingPrereqs = topic.prerequisites.filter((id) => !completedSet.has(id));
  const prereqBlocked = missingPrereqs.length > 0;
  const href = `/session?topicId=${encodeURIComponent(topic.id)}${prereqBlocked ? "&overridePrereq=1" : ""}`;

  const clickHandler = (event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    if (!topic.available || !prereqBlocked) return;
    event.preventDefault();
    onGateOpen(topic, missingPrereqs);
  };

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

      <Badge variant="outline" className={cn("text-[10px] capitalize hidden sm:inline-flex", typeBadgeClass(topic.moduleType))}>
        {topic.moduleType}
      </Badge>

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

      {prereqBlocked && topic.available && <LockIcon className="size-3.5 text-amber-500 shrink-0" />}
      {!topic.available && <LockIcon className="size-3.5 text-muted-foreground shrink-0" />}
    </motion.div>
  );

  if (topic.available) {
    return (
      <Link href={href} className="block" onClick={clickHandler}>
        {inner}
      </Link>
    );
  }

  return <button className="w-full text-left" onClick={clickHandler}>{inner}</button>;
}

function LevelSection({
  level,
  topics,
  completedSet,
  onGateOpen,
}: {
  level: string;
  topics: Topic[];
  completedSet: Set<string>;
  onGateOpen: (topic: Topic, missing: string[]) => void;
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
                <TopicRow
                  key={topic.id}
                  topic={topic}
                  completedSet={completedSet}
                  onGateOpen={onGateOpen}
                />
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
  const byType = {
    core: allTopics.filter((t) => t.moduleType === "core"),
    depth: allTopics.filter((t) => t.moduleType === "depth"),
    specialization: allTopics.filter((t) => t.moduleType === "specialization"),
    capstone: allTopics.filter((t) => t.moduleType === "capstone"),
  };
  const completedSet = new Set(allTopics.filter((t) => t.completed).map((t) => t.id));
  const allTopicsById = new Map(allTopics.map((t) => [t.id, t]));
  const [gateState, setGateState] = useState<{ topic: Topic; missing: string[] } | null>(null);

  useEffect(() => {
    if (!gateState) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGateState(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gateState]);

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

      <div className="px-3 py-3 space-y-4">
        {byType.core.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-2 mb-2">Core Modules</p>
            <div className="space-y-1.5">
              {byType.core.map((topic) => (
                <TopicRow
                  key={topic.id}
                  topic={topic}
                  completedSet={completedSet}
                  onGateOpen={(t, missing) => setGateState({ topic: t, missing })}
                />
              ))}
            </div>
          </div>
        )}

        {byType.depth.length > 0 && (
          <LevelSection
            level="Go Deeper"
            topics={byType.depth}
            completedSet={completedSet}
            onGateOpen={(t, missing) => setGateState({ topic: t, missing })}
          />
        )}
        {byType.specialization.length > 0 && (
          <LevelSection
            level="Specializations"
            topics={byType.specialization}
            completedSet={completedSet}
            onGateOpen={(t, missing) => setGateState({ topic: t, missing })}
          />
        )}
        {byType.capstone.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-2">Capstone</p>
            {byType.capstone.map((topic) => (
              <div key={topic.id} className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2">
                <TopicRow
                  topic={topic}
                  completedSet={completedSet}
                  onGateOpen={(t, missing) => setGateState({ topic: t, missing })}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {gateState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/45 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-lg rounded-xl bg-background border border-border p-5 space-y-4">
              <h4 className="font-semibold">Recommended prerequisites first</h4>
              <p className="text-sm text-muted-foreground">
                {gateState.topic.title} has recommended prerequisites that are not complete yet.
              </p>
              <div className="space-y-2">
                {gateState.missing.map((id) => (
                  <div key={id} className="text-sm rounded-md bg-muted/50 px-3 py-2">
                    {allTopicsById.get(id)?.title ?? id}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" onClick={() => setGateState(null)}>
                  Cancel
                </Button>
                <Link
                  href={`/session?topicId=${encodeURIComponent(gateState.topic.id)}&overridePrereq=1`}
                  onClick={() => setGateState(null)}
                >
                  <Button>Continue Anyway</Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
        {library?.paths?.some((path) => path.path_id === "TRACK_PRACTITIONER_TO_TECHNICAL") && (
          <Badge variant="outline" className="ml-auto gap-1">
            <SparklesIcon className="size-3.5" />
            Practitioner to Technical Track
          </Badge>
        )}
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
