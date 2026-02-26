"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CopyIcon, CheckIcon, ExpandIcon, XIcon } from "lucide-react";

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = "text" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const label = useMemo(() => language.toUpperCase(), [language]);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <span className="text-[11px] tracking-wide text-zinc-300">{label}</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(true)}
            className="h-7 px-2 text-zinc-300 hover:text-white hover:bg-zinc-800"
            aria-label="Enlarge code block"
          >
            <ExpandIcon className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 px-2 text-zinc-300 hover:text-white hover:bg-zinc-800"
            aria-label="Copy code"
          >
            {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
          </Button>
        </div>
      </div>
      <pre className="p-4 overflow-x-auto text-[13px] leading-6 whitespace-pre font-mono">
        <code>{code}</code>
      </pre>

      {expanded && (
        <div className="fixed inset-0 z-[70] bg-black/85 p-4 md:p-8">
          <div className="h-full rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-100 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
              <span className="text-[11px] tracking-wide text-zinc-300">{label} (expanded)</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(false)}
                className="h-7 px-2 text-zinc-300 hover:text-white hover:bg-zinc-800"
                aria-label="Close enlarged code block"
              >
                <XIcon className="size-3.5" />
              </Button>
            </div>
            <pre className="p-4 overflow-auto text-[13px] leading-6 whitespace-pre font-mono flex-1">
              <code>{code}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
