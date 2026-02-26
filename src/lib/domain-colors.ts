export const DOMAINS = [
  "Frameworks & Standards",
  "Risk Management",
  "Compliance & Regulatory",
  "Audit & Assurance",
  "Policy & Governance",
  "Incident Response & Resilience",
  "Third-Party Risk",
  "Security Controls & Architecture",
  "Data Governance & Information Mgmt",
  "GRC Engineering & Automation",
  "AI Governance & Emerging Tech Risk",
  "Privacy",
] as const;

export type Domain = (typeof DOMAINS)[number];

export const DOMAIN_CONFIG: Record<
  Domain,
  { color: string; gradient: string; bg: string; icon: string; slug: string }
> = {
  "Frameworks & Standards": {
    color: "#6366f1",
    gradient: "from-indigo-500 to-indigo-700",
    bg: "bg-indigo-500/10",
    icon: "Layers",
    slug: "frameworks",
  },
  "Risk Management": {
    color: "#f59e0b",
    gradient: "from-amber-500 to-orange-600",
    bg: "bg-amber-500/10",
    icon: "ShieldAlert",
    slug: "risk",
  },
  "Compliance & Regulatory": {
    color: "#10b981",
    gradient: "from-emerald-500 to-teal-600",
    bg: "bg-emerald-500/10",
    icon: "Scale",
    slug: "compliance",
  },
  "Audit & Assurance": {
    color: "#8b5cf6",
    gradient: "from-violet-500 to-purple-700",
    bg: "bg-violet-500/10",
    icon: "ClipboardCheck",
    slug: "audit",
  },
  "Policy & Governance": {
    color: "#3b82f6",
    gradient: "from-blue-500 to-blue-700",
    bg: "bg-blue-500/10",
    icon: "FileText",
    slug: "policy",
  },
  "Incident Response & Resilience": {
    color: "#ef4444",
    gradient: "from-red-500 to-rose-700",
    bg: "bg-red-500/10",
    icon: "Siren",
    slug: "incident",
  },
  "Security Controls & Architecture": {
    color: "#14b8a6",
    gradient: "from-teal-500 to-cyan-600",
    bg: "bg-teal-500/10",
    icon: "ShieldCheck",
    slug: "controls",
  },
  "Data Governance & Information Mgmt": {
    color: "#0ea5e9",
    gradient: "from-sky-500 to-blue-600",
    bg: "bg-sky-500/10",
    icon: "Database",
    slug: "data-gov",
  },
  "GRC Engineering & Automation": {
    color: "#7c3aed",
    gradient: "from-violet-500 to-indigo-700",
    bg: "bg-violet-500/10",
    icon: "Code",
    slug: "grc-engineering",
  },
  "AI Governance & Emerging Tech Risk": {
    color: "#f97316",
    gradient: "from-orange-500 to-amber-600",
    bg: "bg-orange-500/10",
    icon: "Bot",
    slug: "ai-governance",
  },
  "Third-Party Risk": {
    color: "#06b6d4",
    gradient: "from-cyan-500 to-teal-600",
    bg: "bg-cyan-500/10",
    icon: "Building2",
    slug: "thirdparty",
  },
  "Privacy": {
    color: "#ec4899",
    gradient: "from-pink-500 to-rose-600",
    bg: "bg-pink-500/10",
    icon: "Lock",
    slug: "privacy",
  },
};

export function getDomainColor(domain: string): string {
  return (
    DOMAIN_CONFIG[domain as Domain]?.color ?? "#6366f1"
  );
}

export function getDomainGradient(domain: string): string {
  return (
    DOMAIN_CONFIG[domain as Domain]?.gradient ?? "from-indigo-500 to-indigo-700"
  );
}
