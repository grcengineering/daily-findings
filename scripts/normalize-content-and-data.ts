import { PrismaClient } from "@prisma/client";
import { getAllTopics } from "../src/lib/curriculum";

const prisma = new PrismaClient();

function sentenceSplit(text: string): string[] {
  return text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g)?.map((part) => part.trim()) ?? [text];
}

function normalizeText(text: string): string {
  const compact = text
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  if (compact.length <= 520 || compact.includes("\n\n")) {
    return compact;
  }

  const sentences = sentenceSplit(compact);
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (!current) {
      current = sentence;
      continue;
    }
    if ((current + " " + sentence).length <= 360) {
      current += ` ${sentence}`;
    } else {
      chunks.push(current);
      current = sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks.join("\n\n");
}

function normalizeUnknown(value: unknown): unknown {
  if (typeof value === "string") return normalizeText(value);
  if (Array.isArray(value)) return value.map((item) => normalizeUnknown(item));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = normalizeUnknown(child);
    }
    return out;
  }
  return value;
}

function safeParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function computeStreaks(dates: string[]): { currentStreak: number; longestStreak: number } {
  if (dates.length === 0) return { currentStreak: 0, longestStreak: 0 };
  const uniqueSorted = Array.from(new Set(dates)).sort();

  let longest = 1;
  let rolling = 1;
  for (let i = 1; i < uniqueSorted.length; i++) {
    const prev = new Date(uniqueSorted[i - 1]);
    const current = new Date(uniqueSorted[i]);
    const deltaDays = Math.round((current.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000));
    if (deltaDays === 1) {
      rolling += 1;
      if (rolling > longest) longest = rolling;
    } else {
      rolling = 1;
    }
  }

  let currentStreak = 1;
  for (let i = uniqueSorted.length - 1; i > 0; i--) {
    const prev = new Date(uniqueSorted[i - 1]);
    const current = new Date(uniqueSorted[i]);
    const deltaDays = Math.round((current.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000));
    if (deltaDays === 1) currentStreak += 1;
    else break;
  }

  return { currentStreak, longestStreak: longest };
}

async function main() {
  const topics = getAllTopics();
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const validIds = new Set(topics.map((topic) => topic.id));
  const validIdList = Array.from(validIds);

  const staleSessionContent = await prisma.sessionContent.findMany({
    where: { topicId: { notIn: validIdList } },
    select: { topicId: true },
  });
  const staleTopicIds = staleSessionContent.map((row) => row.topicId);

  if (staleTopicIds.length > 0) {
    await prisma.sessionCompletion.deleteMany({ where: { topicId: { in: staleTopicIds } } });
    await prisma.topicProgress.deleteMany({ where: { topicId: { in: staleTopicIds } } });
    await prisma.sessionContent.deleteMany({ where: { topicId: { in: staleTopicIds } } });
  }

  const rows = await prisma.sessionContent.findMany();
  for (const row of rows) {
    if (!validIds.has(row.topicId)) continue;
    const topic = topicById.get(row.topicId)!;
    const lesson = normalizeUnknown(safeParse(row.lessonContent, {}));
    const scenario = normalizeUnknown(safeParse(row.scenarioContent, {}));
    const quiz = normalizeUnknown(safeParse(row.quizContent, {}));
    const capstone = row.capstoneContent
      ? normalizeUnknown(safeParse(row.capstoneContent, {}))
      : null;

    await prisma.sessionContent.update({
      where: { topicId: row.topicId },
      data: {
        domain: topic.domain,
        topic: topic.title,
        level: topic.level,
        moduleType: topic.moduleType,
        competencyIds: JSON.stringify(topic.competencyIds),
        prerequisites: JSON.stringify(topic.prerequisites),
        lessonContent: JSON.stringify(lesson),
        scenarioContent: JSON.stringify(scenario),
        quizContent: JSON.stringify(quiz),
        capstoneContent: capstone ? JSON.stringify(capstone) : null,
      },
    });
  }

  const completions = await prisma.sessionCompletion.findMany({
    where: { topicId: { in: validIdList } },
    orderBy: { completedAt: "asc" },
  });
  const dates = completions.map((completion) => completion.date);
  const totalXp = completions.reduce((sum, completion) => {
    const total = completion.quizTotal ?? 0;
    const score = completion.quizScore ?? 0;
    const earned = 100 + Math.round((score / Math.max(total, 1)) * 50);
    return sum + earned;
  }, 0);
  const { currentStreak, longestStreak } = computeStreaks(dates);
  const currentLevel = Math.max(1, Math.floor(totalXp / 500) + 1);
  const lastSessionDate = dates.length > 0 ? dates[dates.length - 1] : null;

  await prisma.userStats.upsert({
    where: { id: "user" },
    create: {
      id: "user",
      currentStreak,
      longestStreak,
      totalSessions: completions.length,
      totalXp,
      currentLevel,
      lastSessionDate,
    },
    update: {
      currentStreak,
      longestStreak,
      totalSessions: completions.length,
      totalXp,
      currentLevel,
      lastSessionDate,
    },
  });

  console.log(
    `Normalization complete. Removed stale topics: ${staleTopicIds.length}, normalized modules: ${rows.length}, valid sessions: ${completions.length}.`
  );
}

main()
  .catch((error) => {
    console.error("Normalization failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
