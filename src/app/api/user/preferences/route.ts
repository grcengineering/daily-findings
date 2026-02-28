import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function sanitizeRate(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(1.3, Math.max(0.8, n));
}

export async function GET() {
  const stats = await prisma.userStats.upsert({
    where: { id: "user" },
    create: {
      id: "user",
      currentStreak: 0,
      longestStreak: 0,
      totalSessions: 0,
      totalXp: 0,
      currentLevel: 1,
    },
    update: {},
    select: {
      ttsVoiceUri: true,
      ttsRate: true,
      selectedPathId: true,
    },
  });
  return NextResponse.json(stats);
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const ttsVoiceUri = typeof body?.ttsVoiceUri === "string" ? body.ttsVoiceUri : null;
    const ttsRate = sanitizeRate(body?.ttsRate);
    const selectedPathId =
      typeof body?.selectedPathId === "string" ? body.selectedPathId : undefined;

    const updated = await prisma.userStats.upsert({
      where: { id: "user" },
      create: {
        id: "user",
        currentStreak: 0,
        longestStreak: 0,
        totalSessions: 0,
        totalXp: 0,
        currentLevel: 1,
        ttsVoiceUri,
        ttsRate,
        selectedPathId,
      },
      update: {
        ttsVoiceUri,
        ttsRate,
        ...(selectedPathId !== undefined ? { selectedPathId } : {}),
      },
      select: {
        ttsVoiceUri: true,
        ttsRate: true,
        selectedPathId: true,
      },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }
}
