import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getNextTopic } from "@/lib/curriculum";

function safeJsonParse(json: string, fallback: unknown = null) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  try {
    const topicId = request.nextUrl.searchParams.get("topicId");
    
    let sessionContent;
    
    if (topicId) {
      sessionContent = await prisma.sessionContent.findUnique({
        where: { topicId },
      });
      
      if (!sessionContent) {
        return NextResponse.json(
          { error: "Session not found in library" },
          { status: 404 }
        );
      }
    } else {
      const allProgress = await prisma.topicProgress.findMany();
      const completedIds = allProgress.map((p) => p.topicId);
      const lastCompletion = await prisma.sessionCompletion.findFirst({
        orderBy: { completedAt: "desc" },
      });
      const lastDomain = lastCompletion
        ? (await prisma.sessionContent.findFirst({ where: { topicId: lastCompletion.topicId } }))?.domain ?? null
        : null;
      
      const topic = getNextTopic(completedIds, lastDomain);
      
      sessionContent = await prisma.sessionContent.findUnique({
        where: { topicId: topic.id },
      });
      
      if (!sessionContent) {
        return NextResponse.json(
          { error: "Recommended session has not been generated yet. Please run the library generator." },
          { status: 404 }
        );
      }
    }
    
    const today = new Date().toISOString().split("T")[0];
    const todayCompletion = await prisma.sessionCompletion.findFirst({
      where: { topicId: sessionContent.topicId, date: today },
    });
    
    return NextResponse.json({
      id: sessionContent.id,
      topicId: sessionContent.topicId,
      domain: sessionContent.domain,
      topic: sessionContent.topic,
      level: sessionContent.level,
      lesson: safeJsonParse(sessionContent.lessonContent),
      scenario: safeJsonParse(sessionContent.scenarioContent),
      quiz: safeJsonParse(sessionContent.quizContent, { questions: [] }),
      confidenceScore: sessionContent.confidenceScore,
      completed: todayCompletion != null,
      quizScore: todayCompletion?.quizScore ?? null,
      quizTotal: todayCompletion?.quizTotal ?? null,
    });
  } catch (error) {
    console.error("Failed to load session:", error);
    return NextResponse.json(
      { error: "Failed to load session" },
      { status: 500 }
    );
  }
}
