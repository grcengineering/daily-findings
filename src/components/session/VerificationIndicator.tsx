"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheckIcon,
  ShieldAlertIcon,
  ExternalLinkIcon,
  AlertTriangleIcon,
} from "lucide-react";

interface Citation {
  url: string;
  title: string;
  citedText: string;
}

interface FlaggedClaim {
  claim: string;
  issue: string;
  suggestion: string;
  section: string;
}

interface VerificationIndicatorProps {
  citations?: Citation[];
  confidenceScore?: number;
  flaggedClaims?: FlaggedClaim[];
}

export function VerificationBadge({
  confidenceScore,
}: {
  confidenceScore?: number;
}) {
  if (confidenceScore == null) return null;

  const isVerified = confidenceScore >= 90;

  return (
    <Badge
      variant="outline"
      className="gap-1.5 text-[10px]"
      style={{
        borderColor: isVerified ? "#10b98140" : "#f59e0b40",
        color: isVerified ? "#10b981" : "#f59e0b",
      }}
    >
      {isVerified ? (
        <ShieldCheckIcon className="size-3" />
      ) : (
        <ShieldAlertIcon className="size-3" />
      )}
      {isVerified ? "Verified" : "Partially Verified"} ({confidenceScore}%)
    </Badge>
  );
}

export function FlaggedClaimsWarning({
  flaggedClaims,
}: {
  flaggedClaims?: FlaggedClaim[];
}) {
  if (!flaggedClaims || flaggedClaims.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 mb-6"
    >
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangleIcon className="size-4 text-amber-500" />
        <span className="text-sm font-medium text-amber-500">
          Some content could not be fully verified
        </span>
      </div>
      <div className="space-y-2">
        {flaggedClaims.map((fc, i) => (
          <div
            key={i}
            className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3"
          >
            <p className="font-medium mb-1">&ldquo;{fc.claim}&rdquo;</p>
            <p className="text-amber-600 dark:text-amber-400">{fc.issue}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function SourcesFooter({ citations }: { citations?: Citation[] }) {
  if (!citations || citations.length === 0) return null;

  const unique = citations.filter(
    (c, i, arr) => arr.findIndex((x) => x.url === c.url) === i
  );

  return (
    <div className="mt-6 pt-4 border-t border-border">
      <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
        Sources
      </p>
      <div className="space-y-1.5">
        {unique.slice(0, 8).map((c, i) => (
          <a
            key={i}
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 text-xs text-muted-foreground hover:text-primary transition-colors group"
          >
            <ExternalLinkIcon className="size-3 mt-0.5 shrink-0 opacity-50 group-hover:opacity-100" />
            <span className="line-clamp-1">{c.title || c.url}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export function VerificationIndicator({
  citations,
  confidenceScore,
  flaggedClaims,
}: VerificationIndicatorProps) {
  return (
    <>
      <FlaggedClaimsWarning flaggedClaims={flaggedClaims} />
      <SourcesFooter citations={citations} />
    </>
  );
}
