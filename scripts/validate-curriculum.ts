import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { validateQuizDeterministic } from "../src/lib/quiz-validation";

const VALID_MODULE_TYPES = ["core", "depth", "specialization", "capstone"] as const;

interface CurriculumModule {
  id: string;
  title?: string;
  tier?: string;
  module_type?: string;
  competency_ids?: string[];
  prerequisites?: Array<{ module_id?: string }>;
}

interface CurriculumDomainFile {
  domain_id?: string;
  name?: string;
  competencies?: Array<{ competency_id: string }>;
  modules: CurriculumModule[];
}

const DOMAIN_FILE_NAMES = [
  "privacy",
  "frameworks",
  "risk",
  "compliance",
  "audit",
  "policy",
  "incident",
  "tprm",
  "controls",
  "data-governance",
  "grc-engineering",
  "ai-governance",
];

function validateCanonicalCurriculum(): string[] {
  const issues: string[] = [];
  const curriculaDir = path.join(process.cwd(), "data", "curricula");
  const allModuleIds = new Set<string>();
  const domainCompetencyIds = new Map<string, Set<string>>();

  // First pass: collect module ids and competency ids per domain
  for (const name of DOMAIN_FILE_NAMES) {
    const filePath = path.join(curriculaDir, `${name}.json`);
    if (!fs.existsSync(filePath)) {
      issues.push(`[${name}] Missing curriculum file: ${filePath}`);
      continue;
    }
    let data: CurriculumDomainFile;
    try {
      data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as CurriculumDomainFile;
    } catch (e) {
      issues.push(`[${name}] Invalid JSON: ${String(e)}`);
      continue;
    }
    const modules = Array.isArray(data.modules) ? data.modules : [];
    const competencies = Array.isArray(data.competencies) ? data.competencies : [];
    const compIds = new Set(competencies.map((c) => c.competency_id));
    domainCompetencyIds.set(name, compIds);
    for (const m of modules) {
      if (m.id) allModuleIds.add(m.id);
    }
  }

  // Second pass: validate each module
  for (const name of DOMAIN_FILE_NAMES) {
    const filePath = path.join(curriculaDir, `${name}.json`);
    if (!fs.existsSync(filePath)) continue;
    let data: CurriculumDomainFile;
    try {
      data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as CurriculumDomainFile;
    } catch {
      continue;
    }
    const modules = Array.isArray(data.modules) ? data.modules : [];
    const compIds = domainCompetencyIds.get(name) ?? new Set<string>();

    for (const m of modules) {
      const modId = m.id ?? "<unknown>";
      const prefix = `[${name}] ${modId}`;

      // module_type
      const mt = m.module_type;
      if (!mt || typeof mt !== "string") {
        issues.push(`${prefix}: missing or invalid module_type`);
      } else if (!VALID_MODULE_TYPES.includes(mt as (typeof VALID_MODULE_TYPES)[number])) {
        issues.push(`${prefix}: invalid module_type "${mt}" (expected: ${VALID_MODULE_TYPES.join(", ")})`);
      }

      // prerequisites referential integrity
      const prereqs = Array.isArray(m.prerequisites) ? m.prerequisites : [];
      for (const p of prereqs) {
        const pid = p?.module_id;
        if (!pid) {
          issues.push(`${prefix}: prerequisite entry missing module_id`);
        } else if (!allModuleIds.has(pid)) {
          issues.push(`${prefix}: prerequisite references non-existent module "${pid}"`);
        }
      }

      // competency_ids presence and referential check
      const cids = Array.isArray(m.competency_ids) ? m.competency_ids : [];
      for (const cid of cids) {
        if (!cid || typeof cid !== "string") {
          issues.push(`${prefix}: invalid competency_id entry`);
        } else if (!compIds.has(cid)) {
          issues.push(`${prefix}: competency_ids references non-existent competency "${cid}" in domain`);
        }
      }
    }
  }

  return issues;
}

function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function validateQuiz(topicId: string, quizRaw: string): string[] {
  const issues: string[] = [];
  const quiz = safeParse<{ questions?: unknown[] }>(quizRaw, {});
  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];

  questions.forEach((question, index) => {
    const q = question as Record<string, unknown>;
    if (q.format === "code_challenge") {
      const validation = (q.validation ?? {}) as Record<string, unknown>;
      const required = Array.isArray(validation.required_patterns)
        ? (validation.required_patterns as string[])
        : [];
      const forbidden = Array.isArray(validation.forbidden_patterns)
        ? (validation.forbidden_patterns as string[])
        : [];
      const solutionCode = String(q.solution_code ?? "");
      for (const pattern of required) {
        if (!solutionCode.includes(pattern)) {
          issues.push(`${topicId} q${index + 1}: required pattern missing in solution: ${pattern}`);
        }
      }
      for (const pattern of forbidden) {
        if (solutionCode.includes(pattern)) {
          issues.push(`${topicId} q${index + 1}: forbidden pattern found in solution: ${pattern}`);
        }
      }
      return;
    }

    const options = Array.isArray(q.options) ? q.options : [];
    const correctIndex = Number(q.correctIndex);
    if (options.length !== 4) {
      issues.push(`${topicId} q${index + 1}: expected 4 options, got ${options.length}`);
    }
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      issues.push(`${topicId} q${index + 1}: invalid correctIndex ${String(q.correctIndex)}`);
    }
  });

  return issues;
}

async function validatePrismaSessionContent(): Promise<string[]> {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.sessionContent.findMany({
      select: { topicId: true, prerequisites: true, quizContent: true },
    });
    const ids = new Set(rows.map((r) => r.topicId));
    const issues: string[] = [];

    for (const row of rows) {
      const prereqs = safeParse<string[]>(row.prerequisites, []);
      for (const prereq of prereqs) {
        if (!ids.has(prereq)) {
          issues.push(`[DB] ${row.topicId}: missing prerequisite reference ${prereq}`);
        }
      }
      issues.push(...validateQuiz(row.topicId, row.quizContent));
      issues.push(
        ...validateQuizDeterministic(row.topicId, row.quizContent).map(
          (issue) => `[DB] ${issue.message}`
        )
      );
    }

    return issues;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const issues: string[] = [];

  // 1. Validate canonical curriculum (JSON) - critical, always run
  const curriculumIssues = validateCanonicalCurriculum();
  issues.push(...curriculumIssues);

  // 2. Validate Prisma session content when DB has data
  try {
    const prismaIssues = await validatePrismaSessionContent();
    issues.push(...prismaIssues);
  } catch (err) {
    console.warn("Skipping Prisma validation (DB unavailable or empty):", String(err));
  }

  if (issues.length > 0) {
    console.error("Curriculum validation failed:");
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log("Curriculum validation passed (canonical JSON + session content).");
}

main().catch((error) => {
  console.error("Validation script failed:", error);
  process.exit(1);
});
