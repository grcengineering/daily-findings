"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoIcon, PauseIcon, PlayIcon, SquareIcon, Volume2Icon } from "lucide-react";
import { CodeBlock } from "./CodeBlock";

interface RichTextProps {
  text: string;
  className?: string;
  showReadAloud?: boolean;
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

function buildSpeechText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^[-*•]\s+/gm, "")
    .replace(/^\d+[.)]\s+/gm, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
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
  | { type: "numbered-list"; items: string[] }
  | { type: "code"; code: string; language?: string };

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

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const trimmed = line.trim();

    const fenceMatch = trimmed.match(/^```([a-zA-Z0-9_-]+)?\s*$/);
    if (fenceMatch) {
      flushList();
      flushParagraph();
      const language = fenceMatch[1] || "text";
      const codeLines: string[] = [];
      // consume lines until next fence
      for (let i = idx + 1; i < lines.length; i++) {
        if (lines[i].trim() === "```") {
          idx = i;
          break;
        }
        codeLines.push(lines[i]);
        idx = i;
      }
      blocks.push({ type: "code", code: codeLines.join("\n"), language });
      continue;
    }

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

export function RichText({ text, className, showReadAloud = true }: RichTextProps) {
  const normalizedText = useMemo(() => normalizeRichTextInput(text), [text]);
  const blocks = useMemo(() => parseBlocks(normalizedText), [normalizedText]);
  const speechText = useMemo(() => buildSpeechText(normalizedText), [normalizedText]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState<string>("");
  const [speechRate, setSpeechRate] = useState<number>(1);

  const canReadAloud =
    showReadAloud &&
    speechText.length >= 220 &&
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance !== "undefined";
  const selectedVoice =
    voices.find((voice) => voice.voiceURI === selectedVoiceUri) ?? null;

  function loadVoices() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const available = window.speechSynthesis.getVoices();
    setVoices(available);
    if (available.length === 0) return;

    const preferredFromStorage =
      window.localStorage.getItem("dailyfindings_tts_voice_uri") ?? "";
    const preferredRate = Number(window.localStorage.getItem("dailyfindings_tts_rate") ?? "1");
    if (!Number.isNaN(preferredRate) && preferredRate >= 0.8 && preferredRate <= 1.3) {
      setSpeechRate(preferredRate);
    }

    if (preferredFromStorage) {
      const found = available.find((voice) => voice.voiceURI === preferredFromStorage);
      if (found) {
        setSelectedVoiceUri(found.voiceURI);
        return;
      }
    }

    const englishVoices = available.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
    const enhancedEnglish =
      englishVoices.find((voice) =>
        /(enhanced|premium|samantha|alex|allison|ava|nicky)/i.test(
          `${voice.name} ${voice.voiceURI}`
        )
      ) ?? englishVoices[0];
    setSelectedVoiceUri((enhancedEnglish ?? available[0]).voiceURI);
  }

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const timerId = window.setTimeout(loadVoices, 0);
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.clearTimeout(timerId);
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
      window.speechSynthesis.cancel();
    };
  }, []);

  function startReading() {
    if (!canReadAloud) return;
    window.speechSynthesis.cancel();

    const utterance = new window.SpeechSynthesisUtterance(speechText);
    utterance.rate = speechRate;
    utterance.pitch = 1;
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    }
    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
    setIsPaused(false);
  }

  function togglePause() {
    if (!canReadAloud || !isSpeaking) return;
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      return;
    }
    window.speechSynthesis.pause();
    setIsPaused(true);
  }

  function stopReading() {
    if (!canReadAloud) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setIsSpeaking(false);
    setIsPaused(false);
  }

  return (
    <div className={className}>
      {canReadAloud && (
        <TooltipProvider>
          <div className="mb-3 flex items-center gap-2 flex-wrap">
            {voices.length > 0 && (
              <select
                aria-label="Text-to-speech voice"
                value={selectedVoiceUri}
                onChange={(event) => {
                  const next = event.target.value;
                  setSelectedVoiceUri(next);
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem("dailyfindings_tts_voice_uri", next);
                  }
                }}
                className="h-9 rounded-md border border-input bg-background px-2 text-xs min-w-[180px]"
              >
                {voices
                  .filter((voice) => voice.lang.toLowerCase().startsWith("en"))
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((voice) => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
              </select>
            )}

            <select
              aria-label="Text-to-speech speed"
              value={String(speechRate)}
              onChange={(event) => {
                const next = Number(event.target.value);
                setSpeechRate(next);
                if (typeof window !== "undefined") {
                  window.localStorage.setItem("dailyfindings_tts_rate", String(next));
                }
              }}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="0.9">Speed: 0.9x</option>
              <option value="1">Speed: 1.0x</option>
              <option value="1.1">Speed: 1.1x</option>
            </select>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" aria-label="Voice setup help">
                  <InfoIcon className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[320px] leading-relaxed">
                For better voices on macOS: open System Settings, then Accessibility, then Spoken
                Content, then System Voice, then Manage Voices. Install Enhanced or Premium voices,
                then restart the app.
                Siri personal voices may not be available to browser speech APIs.
              </TooltipContent>
            </Tooltip>

          {!isSpeaking ? (
            <Button size="sm" variant="outline" onClick={startReading} className="gap-1.5">
              <Volume2Icon className="size-3.5" />
              Read aloud
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={togglePause} className="gap-1.5">
                {isPaused ? <PlayIcon className="size-3.5" /> : <PauseIcon className="size-3.5" />}
                {isPaused ? "Resume" : "Pause"}
              </Button>
              <Button size="sm" variant="outline" onClick={stopReading} className="gap-1.5">
                <SquareIcon className="size-3.5" />
                Stop
              </Button>
            </>
          )}
          </div>
        </TooltipProvider>
      )}
      {blocks.map((block, i) => {
        switch (block.type) {
          case "paragraph":
            return (
              <p
                key={i}
                className="text-[16px] leading-[1.8] text-muted-foreground mb-4 last:mb-0"
              >
                {renderInline(parseInline(block.content))}
              </p>
            );

          case "bullet-list":
            return (
              <ul key={i} className="mb-4 last:mb-0 space-y-2 ml-1">
                {block.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2.5 text-[16px] leading-[1.75] text-muted-foreground">
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
                  <li key={j} className="flex items-start gap-2.5 text-[16px] leading-[1.75] text-muted-foreground">
                    <span className="mt-[1px] text-xs font-semibold text-primary/70 min-w-[18px] shrink-0">
                      {j + 1}.
                    </span>
                    <span>{renderInline(parseInline(item))}</span>
                  </li>
                ))}
              </ol>
            );
          case "code":
            return <CodeBlock key={i} code={block.code} language={block.language} />;
        }
      })}
    </div>
  );
}
