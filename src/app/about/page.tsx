"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface AboutPayload {
  appName: string;
  version: string;
  signed: boolean;
  notarized: boolean;
  builtAt: string | null;
  commit: string | null;
}

export default function AboutPage() {
  const [about, setAbout] = useState<AboutPayload | null>(null);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/about");
      if (!response.ok) return;
      setAbout(await response.json());
    }
    void load();
  }, []);

  if (!about) {
    return <div className="p-6">Loading about information...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-8 space-y-4">
      <h1 className="text-2xl font-semibold">{about.appName}</h1>
      <p className="text-muted-foreground">Desktop build trust and runtime information.</p>
      <div className="rounded-xl border border-border p-4 space-y-2">
        <p>
          <span className="font-medium">Version:</span> {about.version}
        </p>
        <p>
          <span className="font-medium">Build trust:</span>{" "}
          {about.signed ? (
            <Badge>Signed build</Badge>
          ) : (
            <Badge variant="secondary">Unsigned build</Badge>
          )}{" "}
          {about.notarized ? <Badge>Notarized</Badge> : null}
        </p>
        <p>
          <span className="font-medium">Built at:</span>{" "}
          {about.builtAt ? new Date(about.builtAt).toLocaleString() : "Unknown"}
        </p>
        <p>
          <span className="font-medium">Commit:</span> {about.commit ?? "Unknown"}
        </p>
      </div>
      {!about.signed ? (
        <p className="text-sm text-muted-foreground">
          This installer is unsigned, so macOS/Windows may show trust prompts on first launch.
        </p>
      ) : null}
    </div>
  );
}
