import { PrismaClient } from "@prisma/client";
import { getAllTopics } from "../src/lib/curriculum";

const prisma = new PrismaClient();

function createLesson(topic: string) {
  return {
    title: topic,
    estimatedReadingTime: 8,
    introduction: `${topic} introduces the operational context, control intent, and common implementation pitfalls.`,
    sections: [
      {
        heading: "Why this module matters",
        content:
          "This module connects governance objectives to practical workflows. Use it to align policy expectations with day-to-day execution and evidence collection.",
      },
      {
        heading: "Implementation approach",
        content:
          "Start with scope and ownership, define measurable controls, then iterate with lightweight validation checkpoints. Track assumptions and document exceptions early.",
      },
      {
        heading: "Operational signals",
        content:
          "Monitor leading indicators (coverage, timeliness, quality) and lagging indicators (findings, incidents, rework). Escalate trend deviations before audit cycles.",
      },
    ],
    keyTakeaways: [
      "Translate requirements into repeatable operational steps.",
      "Use measurable outcomes to prove control effectiveness.",
      "Document assumptions, decisions, and exceptions clearly.",
    ],
    confidenceScore: 97,
  };
}

function createScenario(topic: string) {
  return {
    title: `${topic}: applied scenario`,
    context: "A scaling SaaS organization is preparing for external assurance and regulatory scrutiny.",
    scenario:
      "Leadership needs rapid, reliable evidence that controls are operating as intended while teams continue shipping product changes.",
    analysisQuestions: [
      {
        question: "What should be prioritized first and why?",
        analysis:
          "Prioritize highest-risk control objectives with clear owners and measurable evidence requirements to reduce uncertainty quickly.",
      },
      {
        question: "How do you balance speed with quality?",
        analysis:
          "Use staged rollouts and objective pass/fail checks so delivery velocity remains high while control quality improves over time.",
      },
    ],
    confidenceScore: 97,
  };
}

function createQuiz(topic: string, includeCodeChallenge: boolean) {
  const questions: unknown[] = [
    {
      id: "q1",
      format: "multiple_choice",
      question: `Which outcome best represents success for ${topic}?`,
      options: [
        "Clear control ownership and evidence quality metrics",
        "Only policy publication",
        "Only annual audits",
        "No measurement approach",
      ],
      correctIndex: 0,
      explanation: "Sustained outcomes require ownership and measurable evidence quality.",
    },
    {
      id: "q2",
      format: "multiple_choice",
      question: "What is the most effective first step in implementation?",
      options: [
        "Define scope, risks, and accountable owners",
        "Skip planning and automate immediately",
        "Wait for an audit finding",
        "Document nothing until final review",
      ],
      correctIndex: 0,
      explanation: "Scoping and accountability are prerequisites for effective execution.",
    },
    {
      id: "q3",
      format: "multiple_choice",
      question: "Which signal is a leading indicator of control health?",
      options: [
        "Evidence timeliness and completeness trend",
        "Only final audit report date",
        "Quarterly budget totals",
        "Office attendance",
      ],
      correctIndex: 0,
      explanation: "Leading indicators help detect degradation before formal failures occur.",
    },
  ];

  if (includeCodeChallenge) {
    questions.push({
      id: "q4",
      format: "code_challenge",
      language: "hcl",
      scenario_context: "Enforce encryption at rest for evidence logs.",
      control_mapping: "SOC2 CC6.1 / ISO 27001 A.8.24",
      expected_artifact: "Terraform resource block with KMS-backed SSE.",
      starter_code: "resource \"aws_s3_bucket\" \"evidence\" {\n  bucket = \"evidence-logs\"\n}\n",
      solution_code:
        "resource \"aws_s3_bucket\" \"evidence\" {\n  bucket = \"evidence-logs\"\n}\n\nresource \"aws_s3_bucket_server_side_encryption_configuration\" \"evidence\" {\n  bucket = aws_s3_bucket.evidence.id\n  rule {\n    apply_server_side_encryption_by_default {\n      sse_algorithm = \"aws:kms\"\n      kms_master_key_id = var.kms_key_arn\n    }\n  }\n}\n",
      validation: {
        required_patterns: ["server_side_encryption_configuration", "sse_algorithm", "aws:kms"],
        forbidden_patterns: ["AES256"],
        min_occurrences: { sse_algorithm: 1 },
      },
      hints: ["Use an encryption configuration resource.", "Prefer KMS where control intent requires managed keys."],
      explanation: "KMS-backed encryption aligns stronger key-management expectations with evidence-ready IaC.",
    });
  } else {
    questions.push({
      id: "q4",
      format: "multiple_choice",
      question: "Which practice strengthens audit readiness most?",
      options: [
        "Automated evidence collection with human review checkpoints",
        "Manual screenshots only",
        "No ownership assignments",
        "Ad hoc weekly changes without documentation",
      ],
      correctIndex: 0,
      explanation: "Automation plus review improves consistency and trustworthiness.",
    });
  }

  questions.push(
    {
      id: "q5",
      format: "multiple_choice",
      question: "What should happen when a control exception is identified?",
      options: [
        "Log, triage, assign owner, and track remediation",
        "Ignore until quarter end",
        "Hide from dashboards",
        "Delete related evidence",
      ],
      correctIndex: 0,
      explanation: "Exception management requires visibility, ownership, and closure tracking.",
    },
    {
      id: "q6",
      format: "multiple_choice",
      question: "How should progress be communicated to leadership?",
      options: [
        "Risk-focused dashboard with trend and decision context",
        "Raw logs only",
        "Single static slide without metrics",
        "No reporting cadence",
      ],
      correctIndex: 0,
      explanation: "Leaders need risk context, trends, and decision-ready summaries.",
    }
  );

  return { questions, confidenceScore: 97 };
}

function createCapstone(topic: string) {
  return {
    deliverable_prompt: `Create an applied capstone artifact for ${topic} with implementation, governance, and evidence sections.`,
    deliverable_format: "Executive brief plus technical appendix",
    synthesis_questions: [
      { question: "What tradeoffs were accepted and why?", guidance: "Balance risk reduction, cost, and delivery speed." },
      { question: "Which controls provide highest leverage?", guidance: "Prioritize controls with broad risk coverage." },
      { question: "How does the plan remain auditable over time?", guidance: "Define ongoing evidence collection and review cadence." },
    ],
    scenario_decisions: [
      {
        situation: "A required control blocks a critical release window.",
        options: ["Delay release", "Document temporary exception with compensating control", "Remove control permanently"],
        best_option: "Document temporary exception with compensating control",
        rationale: "Preserves risk visibility and accountability while enabling controlled delivery.",
      },
    ],
    rubric: [
      {
        criterion: "Control alignment",
        excellent: "Control intent and implementation are tightly mapped.",
        acceptable: "Most controls map with minor ambiguity.",
        needs_work: "Control mapping is incomplete or unclear.",
      },
      {
        criterion: "Evidence quality",
        excellent: "Evidence is automated, complete, and reviewable.",
        acceptable: "Evidence exists but requires manual cleanup.",
        needs_work: "Evidence is sparse or not reproducible.",
      },
    ],
  };
}

async function main() {
  const topics = getAllTopics();
  const topicIds = new Set(topics.map((topic) => topic.id));
  const staleRows = await prisma.sessionContent.findMany({
    select: { topicId: true },
  });
  const staleTopicIds = staleRows
    .map((row) => row.topicId)
    .filter((topicId) => !topicIds.has(topicId));

  if (staleTopicIds.length > 0) {
    await prisma.sessionCompletion.deleteMany({ where: { topicId: { in: staleTopicIds } } });
    await prisma.topicProgress.deleteMany({ where: { topicId: { in: staleTopicIds } } });
    await prisma.sessionContent.deleteMany({ where: { topicId: { in: staleTopicIds } } });
  }

  let created = 0;
  let updated = 0;

  for (const topic of topics) {
    const includeCodeChallenge = topic.id.startsWith("GRCENG_");
    const payload = {
      topicId: topic.id,
      domain: topic.domain,
      topic: topic.title,
      level: topic.level,
      moduleType: topic.moduleType,
      competencyIds: JSON.stringify(topic.competencyIds),
      prerequisites: JSON.stringify(topic.prerequisites),
      lessonContent: JSON.stringify(createLesson(topic.title)),
      scenarioContent: JSON.stringify(createScenario(topic.title)),
      quizContent: JSON.stringify(createQuiz(topic.title, includeCodeChallenge)),
      capstoneContent: topic.moduleType === "capstone" ? JSON.stringify(createCapstone(topic.title)) : null,
      confidenceScore: 97,
    };

    const existing = await prisma.sessionContent.findUnique({ where: { topicId: topic.id } });
    if (existing) {
      await prisma.sessionContent.update({ where: { topicId: topic.id }, data: payload });
      updated++;
    } else {
      await prisma.sessionContent.create({ data: payload });
      created++;
    }
  }

  console.log(
    `Seed complete. Removed stale: ${staleTopicIds.length}, Created: ${created}, Updated: ${updated}, Total: ${topics.length}`
  );
}

main()
  .catch((error) => {
    console.error("Failed to seed expanded library:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
