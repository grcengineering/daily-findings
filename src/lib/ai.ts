import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 8192;

// ---------------------------------------------------------------------------
// Citation & verification interfaces
// ---------------------------------------------------------------------------

export interface Citation {
  url: string;
  title: string;
  citedText: string;
}

export interface FlaggedClaim {
  claim: string;
  issue: string;
  suggestion: string;
  section: string;
}

export interface VerificationResult {
  confidenceScore: number;
  assessment: string;
  flaggedClaims: FlaggedClaim[];
}

// ---------------------------------------------------------------------------
// Content interfaces (with citations & verification metadata)
// ---------------------------------------------------------------------------

export interface LessonContent {
  title: string;
  estimatedReadingTime: number;
  introduction: string;
  sections: Array<{
    heading: string;
    content: string;
    keyTermCallout?: { term: string; definition: string };
  }>;
  keyTakeaways: string[];
  citations?: Citation[];
  confidenceScore?: number;
  flaggedClaims?: FlaggedClaim[];
}

export interface ScenarioContent {
  title: string;
  context: string;
  scenario: string;
  analysisQuestions: Array<{
    question: string;
    analysis: string;
  }>;
  citations?: Citation[];
  confidenceScore?: number;
  flaggedClaims?: FlaggedClaim[];
}

export interface QuizQuestion {
  id: string;
  format?: "multiple_choice";
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface CodeChallengeValidation {
  required_patterns: string[];
  forbidden_patterns: string[];
  min_occurrences?: Record<string, number>;
}

export interface CodeChallengeQuestion {
  id: string;
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

export type AssessmentQuestion = QuizQuestion | CodeChallengeQuestion;

export interface QuizContent {
  questions: AssessmentQuestion[];
  citations?: Citation[];
  confidenceScore?: number;
  flaggedClaims?: FlaggedClaim[];
}

export interface NewsByteContent {
  headline: string;
  summary: string;
  updates: Array<{
    title: string;
    content: string;
    source: string;
  }>;
  whyItMatters: string;
  citations?: Citation[];
  confidenceScore?: number;
  flaggedClaims?: FlaggedClaim[];
}

export interface FullSessionContent {
  lesson: LessonContent;
  scenario: ScenarioContent;
  quiz: QuizContent;
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

// ---------------------------------------------------------------------------
// Topic shape expected by prompt builders
// ---------------------------------------------------------------------------

export interface TopicInput {
  title: string;
  objectives: string[];
  keyTerms: string[];
  promptHints: string;
  domain: string;
  level: string;
}

// ---------------------------------------------------------------------------
// Prompt templates (hardened with web search instructions)
// ---------------------------------------------------------------------------

function lessonPrompt(topic: TopicInput): string {
  return `You are a GRC (Governance, Risk & Compliance) training expert creating content for junior GRC analysts and engineers.

IMPORTANT: Before writing, search the web to verify all facts, framework details, and regulatory references. Only state verifiable facts. Reference specific clause numbers, section IDs, or control numbers where applicable.

Use current versions of all standards and frameworks:
- NIST CSF 2.0 (not 1.1)
- ISO 27001:2022 (not 2013)
- SOC 2 (2017 Trust Services Criteria)
- PCI DSS 4.0
- COBIT 2019
- GDPR (Regulation 2016/679)
- CCPA as amended by CPRA

Generate a structured lesson on the following topic for a ${topic.level}-level audience in the ${topic.domain} domain.

Topic: ${topic.title}
Learning Objectives: ${topic.objectives.join("; ")}
Key Terms to Cover: ${topic.keyTerms.join(", ")}
Additional Guidance: ${topic.promptHints}

Requirements:
- Write approximately 1,200 words total across all sections.
- Use practical, real-world examples from corporate compliance, regulatory environments, or risk management.
- Include 3–5 content sections, each with a clear heading.
- Where appropriate, include a keyTermCallout in a section to highlight and define an important term.
- Provide 3–5 concise key takeaways at the end.
- Set estimatedReadingTime to the approximate minutes needed to read the lesson.
- If you are uncertain about any fact, note the limitation rather than stating it as fact.

Respond with ONLY valid JSON matching this schema (no markdown, no code fences):
{
  "title": "string",
  "estimatedReadingTime": number,
  "introduction": "string",
  "sections": [
    {
      "heading": "string",
      "content": "string",
      "keyTermCallout": { "term": "string", "definition": "string" }
    }
  ],
  "keyTakeaways": ["string"]
}`;
}

function scenarioPrompt(topic: TopicInput): string {
  return `You are a GRC (Governance, Risk & Compliance) training expert creating content for junior GRC analysts and engineers.

IMPORTANT: Before writing, search the web for real-world incidents, enforcement actions, or case studies relevant to this topic. Base your scenario on realistic patterns from actual cases and cite the real precedents that inspired it.

Generate a realistic case-study scenario on the following topic for a ${topic.level}-level audience in the ${topic.domain} domain.

Topic: ${topic.title}
Learning Objectives: ${topic.objectives.join("; ")}
Key Terms: ${topic.keyTerms.join(", ")}
Additional Guidance: ${topic.promptHints}

Requirements:
- Write approximately 500 words total.
- Set the scenario in a believable corporate or regulatory context inspired by real events.
- Provide 2–4 analysis questions, each with a model analysis answer that references specific best practices, frameworks, or regulatory requirements.
- The scenario should challenge the reader to apply knowledge, not just recall facts.

Respond with ONLY valid JSON matching this schema (no markdown, no code fences):
{
  "title": "string",
  "context": "string",
  "scenario": "string",
  "analysisQuestions": [
    { "question": "string", "analysis": "string" }
  ]
}`;
}

function quizPrompt(topic: TopicInput): string {
  return `You are a GRC (Governance, Risk & Compliance) training expert creating content for junior GRC analysts and engineers.

IMPORTANT: Before writing, search the web to verify each correct answer against authoritative sources. Every explanation must reference the specific standard, regulation, or framework clause that supports the answer. Do not guess -- verify.

Generate a quiz on the following topic for a ${topic.level}-level audience in the ${topic.domain} domain.

Topic: ${topic.title}
Learning Objectives: ${topic.objectives.join("; ")}
Key Terms: ${topic.keyTerms.join(", ")}
Additional Guidance: ${topic.promptHints}

Requirements:
- Generate exactly 6 assessment items.
- Default format is multiple choice with exactly 4 options (A-D), using 0-based correctIndex.
- If the topic is engineering-oriented (automation, IaC, pipelines, policy-as-code), include at least one item using format "code_challenge".
- Every item must include an explanation tied to authoritative control/framework intent.
- Mix difficulty: 2 recall, 2 application, 2 analysis-level prompts.
- Give each item a unique id like "q1", "q2", etc.

Respond with ONLY valid JSON matching this schema (no markdown, no code fences):
{
  "questions": [
    {
      "id": "string",
      "format": "multiple_choice",
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctIndex": number,
      "explanation": "string"
    },
    {
      "id": "string",
      "format": "code_challenge",
      "language": "hcl|yaml|json|python|bash",
      "scenario_context": "string",
      "control_mapping": "string",
      "expected_artifact": "string",
      "starter_code": "string",
      "solution_code": "string",
      "validation": {
        "required_patterns": ["string"],
        "forbidden_patterns": ["string"],
        "min_occurrences": { "string": 1 }
      },
      "hints": ["string"],
      "explanation": "string"
    }
  ]
}`;
}

function newsBytePrompt(topic: TopicInput): string {
  return `You are a GRC (Governance, Risk & Compliance) news analyst creating a briefing for compliance professionals.

IMPORTANT: Search the web for REAL, current news and developments related to this topic from the past 6 months. Do NOT fabricate news. Every update must reference a real article, regulation, or announcement that you found through search.

Topic: ${topic.title}
Domain: ${topic.domain}
Key Terms: ${topic.keyTerms.join(", ")}
Additional Guidance: ${topic.promptHints}

Requirements:
- Write approximately 400 words total.
- Create a compelling headline summarizing the current landscape.
- Write a 1–2 sentence summary.
- Include 2–3 updates based on REAL news you found via search. Each update must have:
  - A title summarizing the development
  - A content paragraph explaining the details
  - A "source" field with the REAL publication name (e.g., the actual outlet or agency that published it)
- End with a "Why It Matters" paragraph explaining relevance to GRC professionals and how it connects to the training topic.

Respond with ONLY valid JSON matching this schema (no markdown, no code fences):
{
  "headline": "string",
  "summary": "string",
  "updates": [
    { "title": "string", "content": "string", "source": "string" }
  ],
  "whyItMatters": "string"
}`;
}

function capstonePrompt(topic: TopicInput): string {
  return `You are a senior GRC program lead designing a capstone assignment.

Create an applied capstone for:
Topic: ${topic.title}
Domain: ${topic.domain}
Level: ${topic.level}
Objectives: ${topic.objectives.join("; ")}

Requirements:
- Provide a realistic deliverable prompt with explicit format guidance.
- Include 3 synthesis questions that require tradeoff reasoning.
- Include 3 scenario decision points with options, best option, and rationale.
- Include a 4-criterion rubric with excellent/acceptable/needs_work expectations.
- Keep outputs practical and enterprise-oriented.

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "deliverable_prompt": "string",
  "deliverable_format": "string",
  "synthesis_questions": [
    { "question": "string", "guidance": "string" }
  ],
  "scenario_decisions": [
    {
      "situation": "string",
      "options": ["string", "string", "string"],
      "best_option": "string",
      "rationale": "string"
    }
  ],
  "rubric": [
    {
      "criterion": "string",
      "excellent": "string",
      "acceptable": "string",
      "needs_work": "string"
    }
  ]
}`;
}

// ---------------------------------------------------------------------------
// Verification prompt
// ---------------------------------------------------------------------------

function scenarioVerificationPrompt(
  contentJson: string,
  citations: Citation[]
): string {
  const citationBlock =
    citations.length > 0
      ? `\nCitations provided with this content:\n${citations.map((c, i) => `${i + 1}. [${c.title}](${c.url}) — "${c.citedText}"`).join("\n")}`
      : "\nNo citations were provided with this content.";

  return `You are a GRC (Governance, Risk & Compliance) content auditor. You are reviewing an AI-generated training SCENARIO — a fictional case study that teaches GRC concepts through a realistic workplace situation.

Your task is to EXTRACT and VERIFY only the GRC knowledge claims embedded in this scenario. Ignore all fictional elements.

STEP 1: Read the scenario and extract every concrete GRC claim. A GRC claim is any reference to:
- A specific framework, standard, or regulation (e.g., "NIST CSF", "ISO 27001", "GDPR Article 33")
- A framework component, function, or control (e.g., "the Identify function of NIST CSF")
- A regulatory requirement or obligation (e.g., "72-hour breach notification requirement")
- A best practice or methodology (e.g., "risk acceptance requires documented justification")
- A technical control or process (e.g., "data classification scheme with four tiers")

STEP 2: For each extracted claim, determine if it is:
(a) CORRECT — accurately represents the framework/regulation/practice
(b) INCORRECT — contains a clear factual error (wrong function name, wrong requirement, wrong version)

Do NOT extract or evaluate:
- Fictional company names, employee names, dates, or business contexts
- Narrative elements (plot, dialogue, character decisions)
- General business statements that don't reference specific GRC concepts
- Reasonable pedagogical simplifications of complex topics

CRITICAL scoring rules:
- START at 97. This is the baseline for a scenario where all GRC claims are correct.
- Only deduct points when you find a claim that is DEFINITIVELY WRONG — not imprecise, not simplified, but actually incorrect.
- Well-known GRC concepts (NIST CSF functions, ISO 27001 clauses, SOC 2 Trust Services Criteria, GDPR requirements, HIPAA safeguards, PCI DSS requirements, COBIT principles, COSO components, risk management methodologies) are common knowledge. Do NOT flag these unless the specific claim is factually wrong.
- If you are UNCERTAIN whether a claim is wrong, score it as CORRECT. Only flag claims you can confidently identify as erroneous.
- Simplified descriptions used for teaching purposes are acceptable and should NOT be flagged.

Scenario content:
${contentJson}
${citationBlock}

STEP 3: Score from 0 to 100 based ONLY on the accuracy of extracted GRC claims:
- 97-100: All GRC claims are correct (DEFAULT — use this unless you found actual errors)
- 93-96: One GRC claim has a clear factual error
- Below 93: Multiple GRC claims have clear factual errors

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "confidenceScore": number,
  "assessment": "brief summary listing the GRC claims you extracted and your verdict on each",
  "flaggedClaims": [
    {
      "claim": "the specific GRC claim that is incorrect or misleading",
      "issue": "what is wrong with it",
      "suggestion": "the correct information",
      "section": "where in the scenario this appears"
    }
  ]
}`;
}

function standardVerificationPrompt(
  sectionType: string,
  contentJson: string,
  citations: Citation[]
): string {
  const citationBlock =
    citations.length > 0
      ? `\nCitations provided with this content:\n${citations.map((c, i) => `${i + 1}. [${c.title}](${c.url}) — "${c.citedText}"`).join("\n")}`
      : "\nNo citations were provided with this content.";

  return `You are a GRC (Governance, Risk & Compliance) content auditor verifying AI-generated ${sectionType} content for a training platform used by junior GRC analysts and engineers.

Your task: identify ONLY factual errors in the GRC claims below. Do not flag stylistic issues, pedagogical simplifications, or missing citations for well-known concepts.

Content to verify:
${contentJson}
${citationBlock}

SCORING RULES — follow precisely:
- START at 97. This is the default score for factually correct content.
- Only deduct points for claims that are DEFINITIVELY WRONG — not imprecise, not simplified, but actually incorrect.
- Well-established GRC knowledge (NIST CSF, ISO 27001, SOC 2, PCI DSS, COBIT, GDPR, HIPAA, SOX, CCPA, FedRAMP, COSO, ITIL, risk management methodologies, control frameworks, audit procedures, compliance requirements) does NOT need citations. These are common knowledge.
- If you are UNCERTAIN whether a claim is wrong, score it as correct. Only flag claims you can CONFIDENTLY identify as factually erroneous.
- Do NOT penalize for: pedagogical simplifications, missing citations, reasonable generalizations, teaching-oriented framing, or examples used for illustration.

Score from 0 to 100:
- 97-100: All claims are correct (DEFAULT — use this unless you found actual errors)
- 93-96: One claim has a clear factual error
- Below 93: Multiple claims have clear factual errors

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "confidenceScore": number,
  "assessment": "brief summary",
  "flaggedClaims": [
    {
      "claim": "the specific claim that is factually wrong",
      "issue": "what is wrong with it",
      "suggestion": "the correct information",
      "section": "which part of the content (e.g., sections[0], explanation, scenario)"
    }
  ]
}`;
}

function verificationPrompt(
  sectionType: string,
  contentJson: string,
  citations: Citation[]
): string {
  if (sectionType === "scenario") {
    return scenarioVerificationPrompt(contentJson, citations);
  }
  return standardVerificationPrompt(sectionType, contentJson, citations);
}

function regenerationPrompt(
  originalPrompt: string,
  flaggedClaims: FlaggedClaim[],
  formattingIssues: FormattingIssue[] = []
): string {
  const fixes = flaggedClaims
    .map(
      (f, i) =>
        `${i + 1}. CLAIM: "${f.claim}" — ISSUE: ${f.issue} — FIX: ${f.suggestion}`
    )
    .join("\n");

  const formattingFixes =
    formattingIssues.length > 0
      ? `\nFORMATTING FIXES REQUIRED:\n${formattingIssues
          .map(
            (f, i) =>
              `${i + 1}. PATH: ${f.path} — ISSUE: ${f.issue} — SAMPLE: "${f.sample}"`
          )
          .join("\n")}`
      : "";

  return `${originalPrompt}

CRITICAL CORRECTIONS REQUIRED — The previous version of this content had the following accuracy issues that MUST be fixed:
${fixes || "None provided."}

${formattingFixes}

Ensure all of the above issues are corrected in your response. Search the web again if needed to verify factual corrections.
Output clean prose with no HTML tags, no markdown code fences, and proper punctuation spacing.`;
}

// ---------------------------------------------------------------------------
// Claude API helpers
// ---------------------------------------------------------------------------

interface CallClaudeResult<T> {
  content: T;
  citations: Citation[];
}

async function callClaudeWithSearch<T>(
  prompt: string,
  maxSearches: number
): Promise<CallClaudeResult<T>> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: maxSearches,
      },
    ],
  });

  const citations: Citation[] = [];
  let jsonText = "";

  for (const block of message.content) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = block as any;

    if (block.type === "text") {
      jsonText += block.text;

      if (Array.isArray(raw.citations)) {
        for (const cite of raw.citations) {
          if (cite.type === "web_search_result_location" && cite.url) {
            const exists = citations.some((c) => c.url === cite.url);
            if (!exists) {
              citations.push({
                url: cite.url,
                title: cite.title ?? "",
                citedText: cite.cited_text ?? "",
              });
            }
          }
        }
      }
    }

    if (raw.type === "web_search_tool_result" && Array.isArray(raw.content)) {
      for (const result of raw.content) {
        if (result.type === "web_search_result" && result.url) {
          const exists = citations.some((c) => c.url === result.url);
          if (!exists) {
            citations.push({
              url: result.url,
              title: result.title ?? "",
              citedText: result.page_snippet ?? "",
            });
          }
        }
      }
    }
  }

  jsonText = jsonText.replace(/<\/?cite[^>]*>/g, "");
  jsonText = jsonText.trim();
  if (jsonText.startsWith("```")) {
    jsonText = jsonText
      .replace(/^```(?:json)?\s*/, "")
      .replace(/```\s*$/, "");
  }

  const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON object found in Claude response");
  }

  try {
    const content = JSON.parse(jsonMatch[0]) as T;
    return { content, citations };
  } catch (err) {
    throw new Error(
      `Failed to parse Claude response as JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

async function callClaudeBasic<T>(prompt: string): Promise<T> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response received from Claude");
  }

  let raw = textBlock.text.trim();
  if (raw.startsWith("```")) {
    raw = raw.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
  }

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON object found in Claude response");
  }

  return JSON.parse(jsonMatch[0]) as T;
}

// ---------------------------------------------------------------------------
// Verification function
// ---------------------------------------------------------------------------

export async function verifyContent(
  sectionType: string,
  contentJson: string,
  citations: Citation[]
): Promise<VerificationResult> {
  try {
    const result = await callClaudeBasic<VerificationResult>(
      verificationPrompt(sectionType, contentJson, citations)
    );
    if (
      typeof result.confidenceScore !== "number" ||
      result.confidenceScore < 0 ||
      result.confidenceScore > 100
    ) {
      result.confidenceScore = 85;
    }
    if (!Array.isArray(result.flaggedClaims)) {
      result.flaggedClaims = [];
    }
    return result;
  } catch (err) {
    console.warn(`Verification failed for ${sectionType}:`, err);
    return {
      confidenceScore: 75,
      assessment: "Verification could not be completed",
      flaggedClaims: [],
    };
  }
}

// ---------------------------------------------------------------------------
// Generate-and-verify pipeline for a single section
// ---------------------------------------------------------------------------

const CONFIDENCE_THRESHOLD = 95;
const MAX_RETRIES = 10;

interface SectionConfig {
  type: string;
  promptFn: (topic: TopicInput) => string;
  maxSearches: number;
}

interface FormattingIssue {
  path: string;
  issue: "codeFence" | "htmlTagLeak" | "spaceBeforePunctuation" | "unpairedMarkdown";
  sample: string;
}

interface QualityValidationResult {
  issues: FormattingIssue[];
}

function collectStringLeaves(
  value: unknown,
  path: string,
  out: Array<{ path: string; text: string }>
): void {
  if (typeof value === "string") {
    out.push({ path, text: value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, idx) => collectStringLeaves(item, `${path}[${idx}]`, out));
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      collectStringLeaves(v, path ? `${path}.${k}` : k, out);
    }
  }
}

function validateGeneratedFormatting(content: unknown): QualityValidationResult {
  const leaves: Array<{ path: string; text: string }> = [];
  collectStringLeaves(content, "", leaves);

  const issues: FormattingIssue[] = [];
  for (const leaf of leaves) {
    const text = leaf.text;
    const add = (issue: FormattingIssue["issue"], sample: string) =>
      issues.push({ path: leaf.path, issue, sample: sample.slice(0, 140) });

    if (/```/.test(text)) add("codeFence", text);
    if (/<\/?[a-z][^>]*>/i.test(text)) add("htmlTagLeak", text);
    if (/\s+([,.;:!?])/.test(text)) add("spaceBeforePunctuation", text);
    if ((text.match(/\*\*/g) ?? []).length % 2 === 1) add("unpairedMarkdown", text);
  }

  const deduped = issues.filter(
    (issue, idx, arr) =>
      arr.findIndex((i) => i.path === issue.path && i.issue === issue.issue) === idx
  );
  return { issues: deduped };
}

async function generateAndVerifySection<T>(
  config: SectionConfig,
  topic: TopicInput
): Promise<CallClaudeResult<T> & { verification: VerificationResult }> {
  const prompt = config.promptFn(topic);
  let result = await callClaudeWithSearch<T>(prompt, config.maxSearches);
  let contentJson = JSON.stringify(result.content);
  let verification = await verifyContent(
    config.type,
    contentJson,
    result.citations
  );
  let quality = validateGeneratedFormatting(result.content);

  let retries = 0;
  while (
    (verification.confidenceScore < CONFIDENCE_THRESHOLD ||
      quality.issues.length > 0) &&
    retries < MAX_RETRIES
  ) {
    retries++;
    console.log(
      `[${config.type}] Score ${verification.confidenceScore}/100, formatting issues: ${quality.issues.length} — retry ${retries}/${MAX_RETRIES}`
    );

    const fixPrompt = regenerationPrompt(
      config.promptFn(topic),
      verification.flaggedClaims,
      quality.issues
    );
    result = await callClaudeWithSearch<T>(fixPrompt, config.maxSearches);
    contentJson = JSON.stringify(result.content);
    verification = await verifyContent(
      config.type,
      contentJson,
      result.citations
    );
    quality = validateGeneratedFormatting(result.content);
  }

  if (verification.confidenceScore < CONFIDENCE_THRESHOLD || quality.issues.length > 0) {
    console.warn(
      `[${config.type}] Final score ${verification.confidenceScore}/100, formatting issues: ${quality.issues.length} after ${MAX_RETRIES} retries — serving with warnings`
    );
  } else {
    console.log(
      `[${config.type}] Verified at ${verification.confidenceScore}/100 with clean formatting`
    );
  }

  return { ...result, verification };
}

// ---------------------------------------------------------------------------
// Public generation functions
// ---------------------------------------------------------------------------

export async function generateLesson(
  topic: TopicInput,
  domain: string,
  level: string
): Promise<LessonContent> {
  const input: TopicInput = { ...topic, domain, level };
  const { content, citations, verification } =
    await generateAndVerifySection<LessonContent>(
      { type: "lesson", promptFn: lessonPrompt, maxSearches: 10 },
      input
    );
  return {
    ...content,
    citations,
    confidenceScore: verification.confidenceScore,
    ...(verification.confidenceScore < CONFIDENCE_THRESHOLD && {
      flaggedClaims: verification.flaggedClaims,
    }),
  };
}

export async function generateScenario(
  topic: TopicInput,
  domain: string,
  level: string
): Promise<ScenarioContent> {
  const input: TopicInput = { ...topic, domain, level };
  const { content, citations, verification } =
    await generateAndVerifySection<ScenarioContent>(
      { type: "scenario", promptFn: scenarioPrompt, maxSearches: 8 },
      input
    );
  return {
    ...content,
    citations,
    confidenceScore: verification.confidenceScore,
    ...(verification.confidenceScore < CONFIDENCE_THRESHOLD && {
      flaggedClaims: verification.flaggedClaims,
    }),
  };
}

export async function generateQuiz(
  topic: TopicInput,
  domain: string,
  level: string
): Promise<QuizContent> {
  const input: TopicInput = { ...topic, domain, level };
  const { content, citations, verification } =
    await generateAndVerifySection<QuizContent>(
      { type: "quiz", promptFn: quizPrompt, maxSearches: 8 },
      input
    );
  return {
    ...content,
    citations,
    confidenceScore: verification.confidenceScore,
    ...(verification.confidenceScore < CONFIDENCE_THRESHOLD && {
      flaggedClaims: verification.flaggedClaims,
    }),
  };
}

export async function generateNewsByte(
  topic: TopicInput,
  domain: string
): Promise<NewsByteContent> {
  const input: TopicInput = { ...topic, domain };
  const { content, citations, verification } =
    await generateAndVerifySection<NewsByteContent>(
      { type: "newsByte", promptFn: newsBytePrompt, maxSearches: 10 },
      input
    );
  return {
    ...content,
    citations,
    confidenceScore: verification.confidenceScore,
    ...(verification.confidenceScore < CONFIDENCE_THRESHOLD && {
      flaggedClaims: verification.flaggedClaims,
    }),
  };
}

export async function generateFullSession(
  topic: TopicInput,
  domain: string,
  level: string
): Promise<FullSessionContent> {
  const input: TopicInput = { ...topic, domain, level };

  const [lesson, scenario, quiz] = await Promise.all([
    generateLesson(input, domain, level),
    generateScenario(input, domain, level),
    generateQuiz(input, domain, level),
  ]);

  return { lesson, scenario, quiz };
}

export async function generateCapstone(
  topic: TopicInput,
  domain: string,
  level: string
): Promise<CapstoneContent> {
  const input: TopicInput = { ...topic, domain, level };
  const { content } = await callClaudeWithSearch<CapstoneContent>(
    capstonePrompt(input),
    6
  );
  return content;
}
