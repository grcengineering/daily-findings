import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAllPaths, getEffectivePathId, getPathById } from "@/lib/curriculum";

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
  });

  const selectedPathId = getEffectivePathId(stats.selectedPathId ?? null);
  return NextResponse.json({
    selectedPathId,
    selectedPathTitle: getPathById(selectedPathId)?.title ?? null,
    paths: getAllPaths(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const nextPathId = typeof body?.pathId === "string" ? body.pathId : null;
    const effectivePathId = getEffectivePathId(nextPathId);
    if (!effectivePathId) {
      return NextResponse.json({ error: "No learning paths configured" }, { status: 400 });
    }

    await prisma.userStats.upsert({
      where: { id: "user" },
      create: {
        id: "user",
        currentStreak: 0,
        longestStreak: 0,
        totalSessions: 0,
        totalXp: 0,
        currentLevel: 1,
        selectedPathId: effectivePathId,
      },
      update: {
        selectedPathId: effectivePathId,
      },
    });

    return NextResponse.json({
      selectedPathId: effectivePathId,
      selectedPathTitle: getPathById(effectivePathId)?.title ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Failed to update path" }, { status: 500 });
  }
}
