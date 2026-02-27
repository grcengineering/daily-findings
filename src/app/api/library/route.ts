import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAllTopics, getBridgeTrack } from "@/lib/curriculum";

export async function GET() {
  try {
    const allTopics = getAllTopics();
    const allIds = new Set(allTopics.map((topic) => topic.id));
    
    const generatedSessions = await prisma.sessionContent.findMany({
      select: { topicId: true },
    });
    const generatedSet = new Set(generatedSessions.map((s) => s.topicId));
    
    const completions = await prisma.sessionCompletion.findMany();
    
    const completionMap = new Map<string, { completed: boolean; bestScore: number; attempts: number }>();
    for (const c of completions) {
      const existing = completionMap.get(c.topicId);
      const scorePercent = c.quizTotal && c.quizTotal > 0 ? Math.round((c.quizScore ?? 0) / c.quizTotal * 100) : 0;
      if (!existing) {
        completionMap.set(c.topicId, { completed: true, bestScore: scorePercent, attempts: 1 });
      } else {
        existing.attempts++;
        existing.bestScore = Math.max(existing.bestScore, scorePercent);
      }
    }
    
    const domains: Record<string, {
      domain: string;
      levels: Record<string, Array<{
        id: string;
        title: string;
        moduleType: "core" | "depth" | "specialization" | "capstone";
        prerequisites: string[];
        competencyIds: string[];
        available: boolean;
        completed: boolean;
        bestScore: number;
        attempts: number;
      }>>;
    }> = {};
    
    for (const topic of allTopics) {
      if (!domains[topic.domain]) {
        domains[topic.domain] = { domain: topic.domain, levels: {} };
      }
      if (!domains[topic.domain].levels[topic.level]) {
        domains[topic.domain].levels[topic.level] = [];
      }
      
      const completion = completionMap.get(topic.id);
      domains[topic.domain].levels[topic.level].push({
        id: topic.id,
        title: topic.title,
        moduleType: topic.moduleType,
        prerequisites: topic.prerequisites.filter((id) => allIds.has(id)),
        competencyIds: topic.competencyIds,
        available: generatedSet.has(topic.id),
        completed: completion?.completed ?? false,
        bestScore: completion?.bestScore ?? 0,
        attempts: completion?.attempts ?? 0,
      });
    }

    const moduleOrder = { core: 0, depth: 1, specialization: 2, capstone: 3 } as const;
    for (const domain of Object.values(domains)) {
      for (const levelTopics of Object.values(domain.levels)) {
        levelTopics.sort((a, b) => {
          const typeDiff = moduleOrder[a.moduleType] - moduleOrder[b.moduleType];
          if (typeDiff !== 0) return typeDiff;
          return a.title.localeCompare(b.title);
        });
      }
    }
    
    return NextResponse.json(
      { domains, paths: getBridgeTrack() },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (error) {
    console.error("Failed to load library:", error);
    return NextResponse.json({ error: "Failed to load library" }, { status: 500 });
  }
}
