import privacy from "../../data/curricula/privacy.json";
import frameworks from "../../data/curricula/frameworks.json";
import risk from "../../data/curricula/risk.json";
import compliance from "../../data/curricula/compliance.json";
import audit from "../../data/curricula/audit.json";
import policy from "../../data/curricula/policy.json";
import incident from "../../data/curricula/incident.json";
import tprm from "../../data/curricula/tprm.json";
import controls from "../../data/curricula/controls.json";
import dataGovernance from "../../data/curricula/data-governance.json";
import grcEngineering from "../../data/curricula/grc-engineering.json";
import aiGovernance from "../../data/curricula/ai-governance.json";
import pathsData from "../../data/curricula/paths.json";

export interface TopicInfo {
  id: string;
  title: string;
  objectives: string[];
  keyTerms: string[];
  promptHints: string;
  domain: string;
  level: string;
  moduleType: "core" | "depth" | "specialization" | "capstone";
  competencyIds: string[];
  prerequisites: string[];
}

interface CurriculumModule {
  id: string;
  title: string;
  tier: "foundational" | "intermediate" | "advanced";
  module_type: TopicInfo["moduleType"];
  competency_ids: string[];
  prerequisites: Array<{ module_id: string }>;
}

interface CurriculumDomainFile {
  domain_id: string;
  name: string;
  slug: string;
  description: string;
  color: string;
  gradient: string;
  icon: string;
  modules: CurriculumModule[];
}

const DOMAIN_FILES: CurriculumDomainFile[] = [
  privacy as CurriculumDomainFile,
  frameworks as CurriculumDomainFile,
  risk as CurriculumDomainFile,
  compliance as CurriculumDomainFile,
  audit as CurriculumDomainFile,
  policy as CurriculumDomainFile,
  incident as CurriculumDomainFile,
  tprm as CurriculumDomainFile,
  controls as CurriculumDomainFile,
  dataGovernance as CurriculumDomainFile,
  grcEngineering as CurriculumDomainFile,
  aiGovernance as CurriculumDomainFile,
];

const LEVEL_ORDER: Record<string, number> = {
  foundational: 0,
  intermediate: 1,
  advanced: 2,
};

function levelRank(level: string): number {
  return LEVEL_ORDER[level.toLowerCase()] ?? 99;
}

const MODULE_TYPE_ORDER: Record<TopicInfo["moduleType"], number> = {
  core: 0,
  depth: 1,
  specialization: 2,
  capstone: 3,
};

const VALID_MODULE_TYPES: TopicInfo["moduleType"][] = [
  "core",
  "depth",
  "specialization",
  "capstone",
];

const LEVEL_LABEL: Record<CurriculumModule["tier"], string> = {
  foundational: "Foundational",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

function toKeyTerms(title: string): string[] {
  return title
    .split(/[&,:()/-]/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 2)
    .slice(0, 4);
}

function defaultObjectives(title: string, domain: string): string[] {
  return [
    `Explain the core concepts in ${title}.`,
    `Apply ${title} techniques to practical ${domain} decisions.`,
    `Evaluate tradeoffs and communicate recommendations using ${title}.`,
  ];
}

function guardrailWarn(msg: string): void {
  if (typeof console !== "undefined" && console.warn) {
    console.warn(`[curriculum] ${msg}`);
  }
}

function flattenCurriculum(data: CurriculumDomainFile[]): TopicInfo[] {
  const allModuleIds = new Set<string>();
  for (const domain of data) {
    for (const m of domain.modules ?? []) {
      if (m.id) allModuleIds.add(m.id);
    }
  }

  const topics: TopicInfo[] = [];
  for (const domain of data) {
    for (const domainModule of domain.modules ?? []) {
      const rawType = domainModule.module_type;
      const moduleType: TopicInfo["moduleType"] =
        rawType && VALID_MODULE_TYPES.includes(rawType as TopicInfo["moduleType"])
          ? (rawType as TopicInfo["moduleType"])
          : "core";
      if (rawType && !VALID_MODULE_TYPES.includes(rawType as TopicInfo["moduleType"])) {
        guardrailWarn(
          `Module ${domainModule.id}: invalid module_type "${rawType}", normalized to "core"`
        );
      }

      const rawPrereqs = (domainModule.prerequisites ?? []).map((p) => p?.module_id).filter(Boolean) as string[];
      const prerequisites = rawPrereqs.filter((id) => {
        const valid = allModuleIds.has(id);
        if (!valid) {
          guardrailWarn(`Module ${domainModule.id}: prerequisite "${id}" not found, skipping`);
        }
        return valid;
      });

      topics.push({
        id: domainModule.id,
        title: domainModule.title,
        objectives: defaultObjectives(domainModule.title, domain.name),
        keyTerms: toKeyTerms(domainModule.title),
        promptHints:
          moduleType === "capstone"
            ? "Include deliverable quality criteria and applied scenario decisions."
            : "Focus on practical implementation with one realistic enterprise example.",
        domain: domain.name,
        level: LEVEL_LABEL[domainModule.tier ?? "foundational"] ?? "Foundational",
        moduleType,
        competencyIds: domainModule.competency_ids ?? [],
        prerequisites,
      });
    }
  }
  return topics;
}

let cachedTopics: TopicInfo[] | null = null;

export function getAllTopics(): TopicInfo[] {
  if (!cachedTopics) {
    cachedTopics = flattenCurriculum(DOMAIN_FILES);
  }
  return [...cachedTopics];
}

export function getBridgeTrack() {
  return (pathsData as { paths: unknown[] }).paths;
}

/**
 * Pick the next topic based on completion history.
 *
 * 1. Filter out completed topics.
 * 2. Prefer a different domain than lastDomain.
 * 3. Prefer lower-level topics first (foundational -> advanced).
 * 4. If all completed, wrap around for review.
 */
export function getNextTopic(
  completedTopicIds: string[],
  lastDomain: string | null
): TopicInfo {
  const all = getAllTopics();
  const completed = new Set(completedTopicIds);

  let remaining = all.filter((t) => !completed.has(t.id));

  if (remaining.length === 0) {
    remaining = all;
  }

  if (remaining.length === 0) {
    throw new Error("No topics available in curriculum");
  }

  const meetsPrereqs = (topic: TopicInfo) =>
    topic.prerequisites.every((prereqId) => completed.has(prereqId));

  const eligible = remaining.filter(meetsPrereqs);
  const pool = eligible.length > 0 ? eligible : remaining;

  pool.sort((a, b) => {
    const levelDiff = levelRank(a.level) - levelRank(b.level);
    if (levelDiff !== 0) return levelDiff;
    const moduleDiff = MODULE_TYPE_ORDER[a.moduleType] - MODULE_TYPE_ORDER[b.moduleType];
    if (moduleDiff !== 0) return moduleDiff;
    return a.title.localeCompare(b.title);
  });

  if (lastDomain) {
    const differentDomain = pool.filter(
      (t) => t.domain.toLowerCase() !== lastDomain.toLowerCase()
    );
    if (differentDomain.length > 0) {
      return differentDomain[0];
    }
  }

  return pool[0];
}

/**
 * Spaced-repetition review picker (SM-2 inspired).
 * Topics studied >7 days ago with quiz score <80% are prioritized.
 */
export function getReviewTopic(
  topicProgressData: Array<{
    topicId: string;
    lastStudied: string;
    quizScore: number;
  }>
): TopicInfo | null {
  const now = Date.now();
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const SCORE_THRESHOLD = 80;

  const candidates = topicProgressData
    .filter((p) => {
      const age = now - new Date(p.lastStudied).getTime();
      return age >= SEVEN_DAYS && p.quizScore < SCORE_THRESHOLD;
    })
    .sort((a, b) => {
      const ageDiff =
        new Date(a.lastStudied).getTime() - new Date(b.lastStudied).getTime();
      if (ageDiff !== 0) return ageDiff;
      return a.quizScore - b.quizScore;
    });

  if (candidates.length === 0) return null;

  return getTopicById(candidates[0].topicId) ?? null;
}

export function getTopicById(id: string): TopicInfo | undefined {
  return getAllTopics().find((t) => t.id === id);
}

export function getDomainProgress(): Record<string, { total: number; slug: string }> {
  const all = getAllTopics();
  const result: Record<string, { total: number; slug: string }> = {};

  for (const domain of DOMAIN_FILES) {
    const topicsInDomain = all.filter((t) => t.domain === domain.name);
    result[domain.name] = {
      total: topicsInDomain.length,
      slug: domain.slug,
    };
  }

  return result;
}

export function getMissingPrerequisites(
  topicId: string,
  completedTopicIds: string[]
): string[] {
  const topic = getTopicById(topicId);
  if (!topic) return [];
  const completed = new Set(completedTopicIds);
  return topic.prerequisites.filter((id) => !completed.has(id));
}
