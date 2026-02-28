"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface CheckResult {
  name: string;
  ok: boolean;
  details: string;
}

export default function DiagnosticsPage() {
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    async function runChecks() {
      const nextChecks: CheckResult[] = [];

      // Sidecar reachability check.
      try {
        const response = await fetch("/api/stats", { cache: "no-store" });
        nextChecks.push({
          name: "API reachability",
          ok: response.ok,
          details: response.ok ? "Session API reachable" : `HTTP ${response.status}`,
        });
      } catch (error) {
        nextChecks.push({
          name: "API reachability",
          ok: false,
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }

      // Database-backed endpoint check.
      try {
        const response = await fetch("/api/progress", { cache: "no-store" });
        nextChecks.push({
          name: "Database health",
          ok: response.ok,
          details: response.ok ? "Progress API returned successfully" : `HTTP ${response.status}`,
        });
      } catch (error) {
        nextChecks.push({
          name: "Database health",
          ok: false,
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }

      // Resource health check.
      try {
        const response = await fetch("/api/about", { cache: "no-store" });
        const payload = response.ok ? await response.json() : null;
        nextChecks.push({
          name: "Build metadata",
          ok: response.ok,
          details:
            response.ok && payload
              ? `Version ${payload.version}`
              : `Failed to read build metadata`,
        });
      } catch (error) {
        nextChecks.push({
          name: "Build metadata",
          ok: false,
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }

      setChecks(nextChecks);
      setRunning(false);
    }

    void runChecks();
  }, []);

  const allGood = checks.length > 0 && checks.every((check) => check.ok);

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Startup Diagnostics</h1>
      <p className="text-muted-foreground">
        Quick checks for API reachability, DB access, and packaged resources.
      </p>
      <div className="rounded-xl border border-border p-4 space-y-3">
        {running ? <p>Running checks...</p> : null}
        {checks.map((check) => (
          <div key={check.name} className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{check.name}</p>
              <p className="text-sm text-muted-foreground">{check.details}</p>
            </div>
            <Badge variant={check.ok ? "default" : "secondary"}>
              {check.ok ? "OK" : "Needs attention"}
            </Badge>
          </div>
        ))}
      </div>
      {!running && (
        <p className="text-sm text-muted-foreground">
          {allGood
            ? "Diagnostics passed."
            : "Some checks failed. Restart the app or run a clean-share rebuild."}
        </p>
      )}
    </div>
  );
}
