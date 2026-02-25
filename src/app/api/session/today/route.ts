import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getNextTopic } from "@/lib/curriculum";

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET() {
  try {
    const libraryCount = await prisma.sessionContent.count();
    if (libraryCount === 0) {
      return NextResponse.json({ session: null });
    }

    const allProgress = await prisma.topicProgress.findMany();
    const completedIds = allProgress.map((p) => p.topicId);
    const lastCompletion = await prisma.sessionCompletion.findFirst({
      orderBy: { completedAt: "desc" },
    });
    const lastDomain = lastCompletion
      ? (await prisma.sessionContent.findFirst({ where: { topicId: lastCompletion.topicId } }))?.domain ?? null
      : null;

    const topic = getNextTopic(completedIds, lastDomain);

    const sessionContent = await prisma.sessionContent.findUnique({
      where: { topicId: topic.id },
    });

    if (!sessionContent) {
      return NextResponse.json({ session: null });
    }

    const today = todayDateString();
    const todayCompletion = await prisma.sessionCompletion.findFirst({
      where: { topicId: topic.id, date: today },
    });

    return NextResponse.json({
      session: {
        id: sessionContent.id,
        domain: sessionContent.domain,
        topic: sessionContent.topic,
        topicId: sessionContent.topicId,
        level: sessionContent.level,
        completed: todayCompletion != null,
        quizScore: todayCompletion?.quizScore ?? null,
        quizTotal: todayCompletion?.quizTotal ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to check today's session:", error);
    return NextResponse.json(
      { error: "Failed to check today's session" },
      { status: 500 }
    );
  }
}
