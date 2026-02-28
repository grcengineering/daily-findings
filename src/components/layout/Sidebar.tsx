"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
    ),
  },
  {
    href: "/session",
    label: "Today's Session",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
    ),
  },
  {
    href: "/library",
    label: "Library",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/></svg>
    ),
  },
  {
    href: "/progress",
    label: "Progress",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
    ),
  },
  {
    href: "/news",
    label: "News",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>
    ),
  },
  {
    href: "/history",
    label: "History",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    ),
  },
  {
    href: "/about",
    label: "About",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
    ),
  },
  {
    href: "/diagnostics",
    label: "Diagnostics",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 13h2l3-7 4 14 3-7h6"/></svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  if (pathname.startsWith("/session")) return null;

  return (
    <>
      {/* Mobile overlay */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur-xl border-b border-border">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark size="sm" />
          <span className="font-semibold gradient-text">Daily Findings</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <MobileMenu pathname={pathname} />
        </div>
      </div>
      <div className="md:hidden h-14" />

      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 z-40 bg-sidebar border-r border-sidebar-border"
      >
        <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
          <BrandMark size="md" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="font-semibold text-lg gradient-text whitespace-nowrap overflow-hidden"
              >
                Daily Findings
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-lg bg-primary/10"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative z-10 shrink-0">{item.icon}</span>
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="relative z-10 whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-sidebar-border space-y-2">
          <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between px-3")}>
            {!collapsed && (
              <span className="text-xs text-muted-foreground">Theme</span>
            )}
            <ThemeToggle />
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <motion.svg
              animate={{ rotate: collapsed ? 180 : 0 }}
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m11 17-5-5 5-5" />
              <path d="m18 17-5-5 5-5" />
            </motion.svg>
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  Collapse
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* Spacer for content */}
      <motion.div
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="hidden md:block shrink-0"
      />
    </>
  );
}

function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  const markSize = size === "sm" ? "h-8 w-8" : "h-9 w-9";

  return (
    <div
      className={cn(
        "shrink-0 rounded-xl bg-[#d7d7d2] flex items-center justify-center",
        markSize
      )}
    >
      <svg
        viewBox="0 0 64 64"
        className="h-[72%] w-[72%]"
        aria-hidden="true"
      >
        <path
          d="M36 10A22 22 0 0 1 54 29.5A22 22 0 0 1 36 49.5V40A13 13 0 0 0 45 29.5A13 13 0 0 0 36 19Z"
          fill="#f5be2f"
        />
        <path
          d="M28 54A22 22 0 0 1 10 34.5A22 22 0 0 1 28 14.5V24A13 13 0 0 0 19 34.5A13 13 0 0 0 28 44Z"
          fill="#2ebed0"
        />
        <circle cx="36" cy="29.5" r="4.8" fill="#f5be2f" />
        <circle cx="28" cy="34.5" r="4.8" fill="#2ebed0" />
      </svg>
    </div>
  );
}

function MobileMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/50 transition-colors hover:bg-secondary"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {open ? (
            <>
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </>
          ) : (
            <>
              <line x1="4" x2="20" y1="12" y2="12" />
              <line x1="4" x2="20" y1="6" y2="6" />
              <line x1="4" x2="20" y1="18" y2="18" />
            </>
          )}
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 bg-background/95 backdrop-blur-xl border-b border-border p-4 space-y-1"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
