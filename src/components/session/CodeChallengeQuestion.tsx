"use client";

import { useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "./CodeBlock";
import { ExpandIcon, XIcon } from "lucide-react";

interface CodeChallengeValidation {
  required_patterns: string[];
  forbidden_patterns: string[];
  min_occurrences?: Record<string, number>;
}

export interface CodeChallengeItem {
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

interface CodeChallengeQuestionProps {
  item: CodeChallengeItem;
  onComplete: (passed: boolean) => void;
}

export function CodeChallengeQuestion({ item, onComplete }: CodeChallengeQuestionProps) {
  const [code, setCode] = useState(item.starter_code);
  const [hintIndex, setHintIndex] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [expandedEditor, setExpandedEditor] = useState(false);
  const [result, setResult] = useState<{ passed: boolean; messages: string[] } | null>(null);

  const monacoLanguage = useMemo(() => {
    const lang = item.language.toLowerCase();
    if (lang === "hcl" || lang === "terraform") return "hcl";
    if (lang === "bash" || lang === "shell") return "shell";
    return lang;
  }, [item.language]);

  function runCheck() {
    const messages: string[] = [];
    const { required_patterns, forbidden_patterns, min_occurrences } = item.validation;

    for (const pattern of required_patterns) {
      if (!code.includes(pattern)) {
        messages.push(`Missing required pattern: ${pattern}`);
      }
    }

    for (const pattern of forbidden_patterns) {
      if (code.includes(pattern)) {
        messages.push(`Found forbidden pattern: ${pattern}`);
      }
    }

    if (min_occurrences) {
      for (const [pattern, count] of Object.entries(min_occurrences)) {
        const matches = code.split(pattern).length - 1;
        if (matches < count) {
          messages.push(`Pattern "${pattern}" appears ${matches}x; required ${count}x.`);
        }
      }
    }

    const passed = messages.length === 0;
    setResult({ passed, messages: passed ? ["Validation passed."] : messages });
    onComplete(passed);
  }

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">{item.language.toUpperCase()}</Badge>
          <Badge variant="outline">{item.control_mapping}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{item.scenario_context}</p>
        <p className="text-sm">
          <span className="font-semibold">Expected artifact:</span> {item.expected_artifact}
        </p>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-end border-b border-border bg-muted/30 px-2 py-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpandedEditor(true)}
            aria-label="Enlarge code editor"
            className="gap-1"
          >
            <ExpandIcon className="size-3.5" />
            Enlarge
          </Button>
        </div>
        <Editor
          value={code}
          onChange={(value) => setCode(value ?? "")}
          language={monacoLanguage}
          height="300px"
          theme="vs-dark"
          options={{ minimap: { enabled: false }, wordWrap: "off", fontSize: 13 }}
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={runCheck}>Run Check</Button>
        <Button variant="outline" onClick={() => setCode(item.starter_code)}>
          Reset
        </Button>
        <Button
          variant="outline"
          onClick={() => setHintIndex((idx) => Math.min(idx + 1, item.hints.length))}
          disabled={hintIndex >= item.hints.length}
        >
          Show Hint
        </Button>
        <Button variant="outline" onClick={() => setShowSolution((v) => !v)}>
          {showSolution ? "Hide Solution" : "Show Solution"}
        </Button>
      </div>

      {hintIndex > 0 && (
        <div className="glass-card rounded-xl p-4 space-y-2">
          {item.hints.slice(0, hintIndex).map((hint, idx) => (
            <p key={idx} className="text-sm text-muted-foreground">
              Hint {idx + 1}: {hint}
            </p>
          ))}
        </div>
      )}

      {result && (
        <div className={`rounded-xl p-4 ${result.passed ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
          {result.messages.map((message, idx) => (
            <p key={idx} className="text-sm">
              {message}
            </p>
          ))}
        </div>
      )}

      {showSolution && (
        <div className="space-y-3">
          <CodeBlock code={item.solution_code} language={item.language} />
          <p className="text-sm text-muted-foreground">{item.explanation}</p>
        </div>
      )}

      {expandedEditor && (
        <div className="fixed inset-0 z-[70] bg-black/85 p-4 md:p-8">
          <div className="h-full rounded-xl border border-zinc-700 bg-zinc-950 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
              <span className="text-xs text-zinc-300">{item.language.toUpperCase()} editor (expanded)</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-zinc-300 hover:text-white hover:bg-zinc-800"
                onClick={() => setExpandedEditor(false)}
                aria-label="Close enlarged editor"
              >
                <XIcon className="size-3.5" />
              </Button>
            </div>
            <Editor
              value={code}
              onChange={(value) => setCode(value ?? "")}
              language={monacoLanguage}
              height="100%"
              theme="vs-dark"
              options={{ minimap: { enabled: false }, wordWrap: "off", fontSize: 14 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
