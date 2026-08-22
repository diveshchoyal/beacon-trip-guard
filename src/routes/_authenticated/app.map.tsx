import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useGeolocation } from "@/hooks/use-geolocation";
import { BeaconMap } from "@/components/map/beacon-map";
import { GlassCard } from "@/components/ui/glass";

export const Route = createFileRoute("/_authenticated/app/map")({
  component: TouristMap,
});

const legend = [
  { label: "Low risk", color: "#5E9E7E" },
  { label: "Medium risk", color: "#C9A574" },
  { label: "High risk", color: "#C0483C" },
];

function TouristMap() {
  const { effective } = useGeolocation();
  const { data: zones = [] } = useQuery({
    queryKey: ["zones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("geofence_zones").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="relative">
      <GlassCard className="overflow-hidden p-0">
        <div className="h-[70vh] min-h-[420px] w-full">
          <BeaconMap
            zones={zones}
            center={[effective.lat, effective.lng]}
            zoom={12}
            pins={[
              {
                id: "me",
                lat: effective.lat,
                lng: effective.lng,
                label: "You are here",
                tone: "self",
              },
            ]}
          />
        </div>
      </GlassCard>

      <div className="glass pointer-events-none absolute bottom-5 left-5 z-[400] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Zone legend
        </p>
        <ul className="mt-2 space-y-1.5">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-2 text-xs text-foreground">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: l.color }}
              />
              {l.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
