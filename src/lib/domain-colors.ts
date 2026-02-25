export const DOMAINS = [
  "Frameworks & Standards",
  "Risk Management",
  "Compliance & Regulatory",
  "Audit & Assurance",
  "Policy & Governance",
  "Incident Response & BCM",
  "Third-Party Risk",
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
  "Incident Response & BCM": {
    color: "#ef4444",
    gradient: "from-red-500 to-rose-700",
    bg: "bg-red-500/10",
    icon: "Siren",
    slug: "incident",
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
