import curriculumData from "../../data/curriculum.json";

export interface TopicInfo {
  id: string;
  title: string;
  objectives: string[];
  keyTerms: string[];
  promptHints: string;
  domain: string;
  level: string;
}

interface CurriculumTopic {
  id: string;
  title: string;
  objectives: string[];
  keyTerms: string[];
  promptHints: string;
}

interface CurriculumLevel {
  name: string;
  topics: CurriculumTopic[];
}

interface CurriculumDomain {
  name: string;
  slug: string;
  description: string;
  levels: CurriculumLevel[];
}

interface Curriculum {
  version: string;
  domains: CurriculumDomain[];
}

const LEVEL_ORDER: Record<string, number> = {
  foundational: 0,
  intermediate: 1,
  advanced: 2,
};

function levelRank(level: string): number {
  return LEVEL_ORDER[level.toLowerCase()] ?? 99;
}

function flattenCurriculum(data: Curriculum): TopicInfo[] {
  const topics: TopicInfo[] = [];
  for (const domain of data.domains) {
    for (const lvl of domain.levels) {
      for (const t of lvl.topics) {
        topics.push({
          id: t.id,
          title: t.title,
          objectives: t.objectives,
          keyTerms: t.keyTerms,
          promptHints: t.promptHints,
          domain: domain.name,
          level: lvl.name,
        });
      }
    }
  }
  return topics;
}

let cachedTopics: TopicInfo[] | null = null;

export function getAllTopics(): TopicInfo[] {
  if (!cachedTopics) {
    cachedTopics = flattenCurriculum(curriculumData as unknown as Curriculum);
  }
  return [...cachedTopics];
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

  remaining.sort((a, b) => levelRank(a.level) - levelRank(b.level));

  if (lastDomain) {
    const differentDomain = remaining.filter(
      (t) => t.domain.toLowerCase() !== lastDomain.toLowerCase()
    );
    if (differentDomain.length > 0) {
      return differentDomain[0];
    }
  }

  return remaining[0];
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

  const curriculum = curriculumData as unknown as Curriculum;
  for (const domain of curriculum.domains) {
    const topicsInDomain = all.filter((t) => t.domain === domain.name);
    result[domain.name] = {
      total: topicsInDomain.length,
      slug: domain.slug,
    };
  }

  return result;
}
