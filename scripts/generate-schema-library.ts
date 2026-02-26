import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ModuleType = "core" | "depth" | "specialization" | "capstone";
type Tier = "foundational" | "intermediate" | "advanced";

interface DomainModule {
  id: string;
  title: string;
  tier: Tier;
  module_type: ModuleType;
  competency_ids: string[];
  prerequisites: Array<{ module_id: string }>;
}

interface DomainFile {
  domain_id: string;
  name: string;
  slug: string;
  description: string;
  color: string;
  gradient: string;
  icon: string;
  modules: DomainModule[];
}

interface CurriculumOutput {
  version: string;
  generatedAt: string;
  domains: Array<{
    domainId: string;
    name: string;
    slug: string;
    description: string;
    color: string;
    gradient: string;
    icon: string;
    levels: Array<{
      name: string;
      topics: Array<{
        id: string;
        title: string;
        tier: Tier;
        moduleType: ModuleType;
        competencyIds: string[];
        prerequisites: string[];
      }>;
    }>;
  }>;
}

const ROOT = process.cwd();
const CURRICULA_DIR = path.join(ROOT, "data", "curricula");
const DOMAIN_FILES = [
  "privacy.json",
  "frameworks.json",
  "risk.json",
  "compliance.json",
  "audit.json",
  "policy.json",
  "incident.json",
  "tprm.json",
  "controls.json",
  "data-governance.json",
  "grc-engineering.json",
  "ai-governance.json",
];

const tierLabel: Record<Tier, string> = {
  foundational: "Foundational",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

async function readDomainFile(fileName: string): Promise<DomainFile> {
  const raw = await readFile(path.join(CURRICULA_DIR, fileName), "utf-8");
  return JSON.parse(raw) as DomainFile;
}

async function main() {
  const domains = await Promise.all(DOMAIN_FILES.map(readDomainFile));

  const output: CurriculumOutput = {
    version: "2.0.0",
    generatedAt: new Date().toISOString(),
    domains: domains.map((domain) => {
      const levels = (["foundational", "intermediate", "advanced"] as Tier[]).map((tier) => ({
        name: tierLabel[tier],
        topics: domain.modules
          .filter((module) => module.tier === tier)
          .map((module) => ({
            id: module.id,
            title: module.title,
            tier: module.tier,
            moduleType: module.module_type,
            competencyIds: module.competency_ids ?? [],
            prerequisites: (module.prerequisites ?? []).map((p) => p.module_id),
          })),
      }));

      return {
        domainId: domain.domain_id,
        name: domain.name,
        slug: domain.slug,
        description: domain.description,
        color: domain.color,
        gradient: domain.gradient,
        icon: domain.icon,
        levels,
      };
    }),
  };

  const target = path.join(ROOT, "data", "curriculum.json");
  await writeFile(target, `${JSON.stringify(output, null, 2)}\n`, "utf-8");
  console.log(`Generated ${target} with ${output.domains.length} domains.`);
}

main().catch((error) => {
  console.error("Failed to generate schema library:", error);
  process.exit(1);
});
