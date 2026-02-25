"use client";

import { PageTransition } from "@/components/layout/PageTransition";
import { SessionLibrary } from "@/components/dashboard/SessionLibrary";

export default function LibraryPage() {
  return (
    <PageTransition>
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <p className="text-sm text-muted-foreground mb-1">Training Modules</p>
          <h1 className="text-3xl font-bold tracking-tight">Session Library</h1>
          <p className="text-muted-foreground mt-2">
            Browse all available training sessions organized by domain and
            difficulty level. Click any topic to start learning.
          </p>
        </div>
        <SessionLibrary />
      </div>
    </PageTransition>
  );
}
