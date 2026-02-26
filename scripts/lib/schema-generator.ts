export type ModuleType = "core" | "depth" | "specialization" | "capstone";

export interface CodeChallengeValidation {
  required_patterns: string[];
  forbidden_patterns: string[];
  min_occurrences?: Record<string, number>;
}

export interface CodeChallengeItem {
  format: "code_challenge";
  language: string;
  scenario_context: string;
  control_mapping: string;
  expected_artifact: string;
  starter_code: string;
  solution_code: string;
  validation: CodeChallengeValidation;
  hints: string[];
  explanation: string;
}

export interface CapstoneContent {
  deliverable_prompt: string;
  deliverable_format: string;
  synthesis_questions: Array<{ question: string; guidance: string }>;
  scenario_decisions: Array<{
    situation: string;
    options: string[];
    best_option: string;
    rationale: string;
  }>;
  rubric: Array<{
    criterion: string;
    excellent: string;
    acceptable: string;
    needs_work: string;
  }>;
}

export function shouldUseCodeChallenge(moduleId: string, domain: string): boolean {
  return moduleId.startsWith("GRCENG_") || /engineering|automation/i.test(domain);
}

export function buildCodeChallengeTemplate(moduleTitle: string): CodeChallengeItem {
  return {
    format: "code_challenge",
    language: "hcl",
    scenario_context: `${moduleTitle}: implement a control-aligned infrastructure artifact.`,
    control_mapping: "SOC2 CC6.1 / ISO 27001 A.8.24",
    expected_artifact: "A Terraform resource with encryption and auditability.",
    starter_code: "resource \"aws_s3_bucket\" \"example\" {\n  bucket = \"replace-me\"\n}\n",
    solution_code:
      "resource \"aws_s3_bucket\" \"example\" {\n  bucket = \"replace-me\"\n}\n\nresource \"aws_s3_bucket_server_side_encryption_configuration\" \"example\" {\n  bucket = aws_s3_bucket.example.id\n  rule {\n    apply_server_side_encryption_by_default {\n      sse_algorithm     = \"aws:kms\"\n      kms_master_key_id = var.kms_key_arn\n    }\n  }\n}\n",
    validation: {
      required_patterns: ["server_side_encryption_configuration", "sse_algorithm", "aws:kms"],
      forbidden_patterns: ["AES256"],
      min_occurrences: { sse_algorithm: 1 },
    },
    hints: [
      "Start with an encryption configuration resource tied to the bucket.",
      "Use KMS when the control objective calls for stronger key governance.",
    ],
    explanation: "Maps implementation details directly to control evidence requirements.",
  };
}
