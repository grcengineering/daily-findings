import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";

const TOTAL_TOPICS = 105;
const POLL_INTERVAL = 5000;

async function main() {
  const prisma = new PrismaClient();

  console.clear();
  console.log("Session Library Generation Monitor");
  console.log("=".repeat(60));

  let lastCount = -1;

  const poll = async () => {
    const sessions = await prisma.sessionContent.findMany({
      select: { topicId: true },
    });

    const total = sessions.length;

    const pct = Math.round((total / TOTAL_TOPICS) * 100);
    const barLen = 40;
    const filled = Math.round((total / TOTAL_TOPICS) * barLen);
    const bar = "\u2588".repeat(filled) + "\u2591".repeat(barLen - filled);

    if (total !== lastCount) {
      const now = new Date().toLocaleTimeString();
      console.log(
        `[${now}]  ${bar}  ${total}/${TOTAL_TOPICS} (${pct}%)`
      );
      lastCount = total;
    }

    if (total >= TOTAL_TOPICS) {
      console.log("\nAll sessions generated!");
      await prisma.$disconnect();
      process.exit(0);
    }
  };

  const interval = setInterval(poll, POLL_INTERVAL);
  poll();

  process.on("SIGINT", async () => {
    clearInterval(interval);
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch(console.error);
