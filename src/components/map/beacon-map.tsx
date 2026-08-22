import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type { Pin, Zone } from "./types";

const LeafletMap = lazy(() => import("./leaflet-map"));

function MapSkeleton() {
  return (
    <div className="glass grid h-full w-full place-items-center text-sm text-muted-foreground">
      Loading map…
    </div>
  );
}

export function BeaconMap(props: {
  zones: Zone[];
  pins: Pin[];
  center: [number, number];
  zoom?: number;
}) {
  return (
    <ClientOnly fallback={<MapSkeleton />}>
      <Suspense fallback={<MapSkeleton />}>
        <LeafletMap {...props} />
      </Suspense>
    </ClientOnly>
  );
}
