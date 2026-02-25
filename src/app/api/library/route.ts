import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAllTopics } from "@/lib/curriculum";

export async function GET() {
  try {
    const allTopics = getAllTopics();
    
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
        available: generatedSet.has(topic.id),
        completed: completion?.completed ?? false,
        bestScore: completion?.bestScore ?? 0,
        attempts: completion?.attempts ?? 0,
      });
    }
    
    return NextResponse.json({ domains });
  } catch (error) {
    console.error("Failed to load library:", error);
    return NextResponse.json({ error: "Failed to load library" }, { status: 500 });
  }
}
