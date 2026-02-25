"use client";

import React from "react";

interface RichTextProps {
  text: string;
  className?: string;
}

function normalizeRichTextInput(text: string): string {
  // Guardrails for model output: remove leaked HTML tags and fix spacing around punctuation.
  const withoutTags = text.replace(/<\/?[a-z][^>]*>/gi, " ");
  return withoutTags
    .split("\n")
    .map((line) =>
      line
        .replace(/\s+([,.;:!?])/g, "$1")
        .replace(/\s{2,}/g, " ")
        .trimEnd()
    )
    .join("\n");
}

type InlineSegment =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "code"; value: string };

function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      segments.push({ type: "bold", value: match[2] });
    } else if (match[3]) {
      segments.push({ type: "italic", value: match[4] });
    } else if (match[5]) {
      segments.push({ type: "code", value: match[6] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments;
}

function renderInline(segments: InlineSegment[]): React.ReactNode[] {
  return segments.map((seg, i) => {
    switch (seg.type) {
      case "bold":
        return (
          <strong key={i} className="font-semibold text-foreground">
            {seg.value}
          </strong>
        );
      case "italic":
        return (
          <em key={i} className="italic">
            {seg.value}
          </em>
        );
      case "code":
        return (
          <code
            key={i}
            className="rounded bg-muted px-1.5 py-0.5 text-[13px] font-mono text-primary"
          >
            {seg.value}
          </code>
        );
      default:
        return <React.Fragment key={i}>{seg.value}</React.Fragment>;
    }
  });
}

type Block =
  | { type: "paragraph"; content: string }
  | { type: "bullet-list"; items: string[] }
  | { type: "numbered-list"; items: string[] };

function splitLongParagraph(content: string): string[] {
  const normalized = content.trim().replace(/\s+/g, " ");
  if (!normalized) return [];

  // Keep short paragraphs intact; chunk only dense walls of text.
  if (normalized.length <= 320) return [normalized];

  const sentences =
    normalized.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g)?.map((s) => s.trim()) ?? [];

  if (sentences.length <= 1) {
    // Fallback: split by approximate length when punctuation is sparse.
    const chunks: string[] = [];
    let rest = normalized;
    while (rest.length > 320) {
      const idx = rest.lastIndexOf(" ", 320);
      if (idx <= 0) break;
      chunks.push(rest.slice(0, idx).trim());
      rest = rest.slice(idx + 1).trim();
    }
    if (rest) chunks.push(rest);
    return chunks.length > 0 ? chunks : [normalized];
  }

  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (!current) {
      current = sentence;
      continue;
    }
    if ((current + " " + sentence).length <= 320) {
      current += " " + sentence;
    } else {
      chunks.push(current);
      current = sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function parseBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let currentList: { type: "bullet" | "numbered"; items: string[] } | null =
    null;
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      const content = paragraphBuffer.join("\n").trim();
      if (content) {
        for (const chunk of splitLongParagraph(content)) {
          blocks.push({ type: "paragraph", content: chunk });
        }
      }
      paragraphBuffer = [];
    }
  };

  const flushList = () => {
    if (currentList) {
      blocks.push({
        type: currentList.type === "bullet" ? "bullet-list" : "numbered-list",
        items: currentList.items,
      });
      currentList = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    const bulletMatch = trimmed.match(/^[-•*]\s+(.+)/);
    if (bulletMatch) {
      flushParagraph();
      if (currentList?.type !== "bullet") {
        flushList();
        currentList = { type: "bullet", items: [] };
      }
      currentList!.items.push(bulletMatch[1]);
      continue;
    }

    const numberedMatch = trimmed.match(/^\d+[.)]\s+(.+)/);
    if (numberedMatch) {
      flushParagraph();
      if (currentList?.type !== "numbered") {
        flushList();
        currentList = { type: "numbered", items: [] };
      }
      currentList!.items.push(numberedMatch[1]);
      continue;
    }

    if (trimmed === "") {
      flushParagraph();
      continue;
    }

    flushList();
    paragraphBuffer.push(trimmed);
  }

  flushList();
  flushParagraph();

  return blocks;
}

export function RichText({ text, className }: RichTextProps) {
  const blocks = parseBlocks(normalizeRichTextInput(text));

  return (
    <div className={className}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "paragraph":
            return (
              <p
                key={i}
                className="text-[15.5px] leading-[1.75] text-muted-foreground mb-4 last:mb-0"
              >
                {renderInline(parseInline(block.content))}
              </p>
            );

          case "bullet-list":
            return (
              <ul key={i} className="mb-4 last:mb-0 space-y-2 ml-1">
                {block.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2.5 text-[15px] leading-[1.7] text-muted-foreground">
                    <span className="mt-[9px] size-1.5 rounded-full bg-primary/60 shrink-0" />
                    <span>{renderInline(parseInline(item))}</span>
                  </li>
                ))}
              </ul>
            );

          case "numbered-list":
            return (
              <ol key={i} className="mb-4 last:mb-0 space-y-2 ml-1">
                {block.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2.5 text-[15px] leading-[1.7] text-muted-foreground">
                    <span className="mt-[1px] text-xs font-semibold text-primary/70 min-w-[18px] shrink-0">
                      {j + 1}.
                    </span>
                    <span>{renderInline(parseInline(item))}</span>
                  </li>
                ))}
              </ol>
            );
        }
      })}
    </div>
  );
}
