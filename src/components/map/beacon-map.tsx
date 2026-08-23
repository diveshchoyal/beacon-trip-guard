import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type { Pin, Zone, TouristPlace, SafetyStatus } from "./types";

const LeafletMap = lazy(() => import("./leaflet-map"));

import { Compass } from "lucide-react";

function MapSkeleton() {
  return (
    <div className="glass relative flex h-full w-full min-h-[460px] flex-col items-center justify-center gap-3.5 p-6 text-center overflow-hidden">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/25 opacity-75" />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg backdrop-blur-md border border-white/40">
          <Compass className="h-6 w-6 animate-spin text-white" style={{ animationDuration: "3s" }} />
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-bold text-foreground">Loading Interactive Map…</p>
        <p className="text-xs text-muted-foreground max-w-[280px]">
          Synchronizing tourist places and live safety telemetry across Tamil Nadu
        </p>
      </div>
    </div>
  );
}

export function BeaconMap(props: {
  zones: Zone[];
  pins: Pin[];
  places?: TouristPlace[];
  center: [number, number];
  zoom?: number;
  currentTime?: Date;
  selectedStatus?: SafetyStatus | null;
}) {
  return (
    <ClientOnly fallback={<MapSkeleton />}>
      <Suspense fallback={<MapSkeleton />}>
        <LeafletMap {...props} />
      </Suspense>
    </ClientOnly>
  );
}
