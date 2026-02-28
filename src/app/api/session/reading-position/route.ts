import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const topicId = request.nextUrl.searchParams.get("topicId");
  const section = request.nextUrl.searchParams.get("section");
  if (!topicId || !section) {
    return NextResponse.json({ error: "topicId and section are required" }, { status: 400 });
  }

  const row = await prisma.readingPosition.findUnique({
    where: { topicId_section: { topicId, section } },
  });
  return NextResponse.json({ scrollY: row?.scrollY ?? 0 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const topicId = typeof body?.topicId === "string" ? body.topicId : "";
    const section = typeof body?.section === "string" ? body.section : "";
    const scrollY = Number(body?.scrollY ?? 0);
    if (!topicId || !section || !Number.isFinite(scrollY) || scrollY < 0) {
      return NextResponse.json({ error: "Invalid reading position payload" }, { status: 400 });
    }

    await prisma.readingPosition.upsert({
      where: { topicId_section: { topicId, section } },
      create: {
        topicId,
        section,
        scrollY: Math.round(scrollY),
      },
      update: {
        scrollY: Math.round(scrollY),
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to save reading position" }, { status: 500 });
  }
}
