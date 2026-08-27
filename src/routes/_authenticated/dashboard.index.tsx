import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { BeaconMap } from "@/components/map/beacon-map";
import { GlassCard } from "@/components/ui/glass";
import type { Pin } from "@/components/map/types";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: LiveMap,
});

function LiveMap() {
  const { data: zones = [] } = useQuery({
    queryKey: ["zones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("geofence_zones").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pings = [] } = useQuery({
    queryKey: ["all-pings"],
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("location_pings")
        .select("id, user_id, lat, lng, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["open-alerts"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .neq("status", "resolved")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const seen = new Set<string>();
  const touristPins: Pin[] = [];
  for (const p of pings) {
    if (seen.has(p.user_id)) continue;
    seen.add(p.user_id);
    touristPins.push({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      label: "Tourist",
      sublabel: new Date(p.created_at).toLocaleString(),
      tone: "tourist",
    });
  }

  const alertPins: Pin[] = alerts
    .filter((a) => a.lat != null && a.lng != null)
    .map((a) => ({
      id: a.id,
      lat: a.lat as number,
      lng: a.lng as number,
      label: `${a.type.toUpperCase()} · ${a.status}`,
      ...(a.message ? { sublabel: a.message } : {}),
      tone: "alert" as const,
    }));

  const first = alertPins[0] || touristPins[0];
  const center: [number, number] = first
    ? [first.lat, first.lng]
    : zones[0]
      ? [zones[0].center_lat, zones[0].center_lng]
      : [13.0827, 80.2707];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Active alerts" value={alerts.length} tone="text-[var(--danger)]" />
        <Stat label="Tourists tracked" value={touristPins.length} tone="text-[var(--sand)]" />
        <Stat label="Geofence zones" value={zones.length} tone="text-[var(--blush)]" />
      </div>

      <GlassCard className="overflow-hidden p-0">
        <div className="h-[65vh] min-h-[420px] w-full">
          <BeaconMap
            zones={zones}
            pins={[...touristPins, ...alertPins]}
            center={center}
            zoom={12}
          />
        </div>
      </GlassCard>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <GlassCard>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${tone}`}>{value}</p>
    </GlassCard>
  );
}
