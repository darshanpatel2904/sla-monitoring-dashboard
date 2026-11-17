import React, { Suspense } from "react";
import { SlaDashboard } from "@/components/sla-dashboard";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F5F2ED] text-xs text-zinc-500 font-mono">
          Loading SLA Monitoring Dashboard...
        </div>
      }
    >
      <SlaDashboard />
    </Suspense>
  );
}
