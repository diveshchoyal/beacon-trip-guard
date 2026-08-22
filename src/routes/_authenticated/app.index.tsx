import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, Fingerprint, Map as MapIcon, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useGeolocation, inZone } from "@/hooks/use-geolocation";
import { GlassCard, RiskBadge } from "@/components/ui/glass";

export const Route = createFileRoute("/_authenticated/app/")({
  component: TouristHome,
});

function TouristHome() {
  const { user, profile } = useAuth();
  const { effective, coords, error } = useGeolocation();
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const { data: zones = [] } = useQuery({
    queryKey: ["zones"],
    queryFn: async () => {
      const { data, error: e } = await supabase.from("geofence_zones").select("*");
      if (e) throw e;
      return data ?? [];
    },
  });

  const currentZone = useMemo(
    () => zones.find((z) => inZone(effective, z)),
    [zones, effective],
  );

  const risk = currentZone?.risk_level ?? "safe";
  const score = Math.max(
    35,
    (profile?.safety_score ?? 85) - (risk === "restricted" ? 30 : risk === "caution" ? 12 : 0),
  );

  // Persist a location ping every 2 minutes so responders see live position.
  useEffect(() => {
    if (!user || !coords) return;
    const write = () =>
      supabase.from("location_pings").insert({ user_id: user.id, lat: coords.lat, lng: coords.lng });
    void write();
    const id = window.setInterval(write, 120_000);
    return () => window.clearInterval(id);
  }, [user, coords]);

  const triggerSos = async () => {
    if (!user) return;
    setSending(true);
    const { error: e } = await supabase.from("alerts").insert({
      user_id: user.id,
      type: "sos",
      message: currentZone ? `SOS raised in ${currentZone.name}` : "SOS raised",
      lat: effective.lat,
      lng: effective.lng,
    });
    setSending(false);
    if (e) {
      toast.error(e.message);
      return;
    }
    toast.success("Alert sent — help is on the way");
    setSent(true);
    window.setTimeout(() => setSent(false), 8000);
    void queryClient.invalidateQueries({ queryKey: ["my-alerts"] });
  };

  const toneClass =
    risk === "restricted"
      ? "text-[var(--danger)]"
      : risk === "caution"
        ? "text-[var(--caution)]"
        : "text-[var(--safe)]";

  return (
    <div className="space-y-5">
      <GlassCard>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Hello{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
        </p>
        <div className="mt-4 flex items-center gap-5">
          <div className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full bg-secondary/30">
            <div className="text-center">
              <p className={`text-3xl font-bold ${toneClass}`}>{score}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">score</p>
            </div>
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">Safety score</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {risk === "restricted"
                ? "You are inside a restricted zone. Stay alert and keep to marked paths."
                : risk === "caution"
                  ? "Moderate risk area — patchy coverage. Share your plan with someone."
                  : "You are in a well-monitored area. Enjoy your trip."}
            </p>
          </div>
        </div>
      </GlassCard>

      <GlassCard transition={{ delay: 0.05, duration: 0.35 }}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Current zone
            </p>
            <p className="mt-1 truncate text-base font-semibold text-foreground">
              {currentZone?.name ?? "Open area — no active geofence"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {error ?? currentZone?.description ?? "Location tracked live."}
            </p>
          </div>
          <RiskBadge level={risk} />
        </div>
      </GlassCard>

      <GlassCard className="flex flex-col items-center py-10" transition={{ delay: 0.1, duration: 0.35 }}>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Emergency
        </p>
        <motion.button
          whileTap={{ scale: 0.92 }}
          disabled={sending}
          onClick={triggerSos}
          className="animate-sos mt-6 grid h-40 w-40 place-items-center rounded-full bg-[var(--danger)] text-center text-primary-foreground disabled:opacity-70"
        >
          <span>
            <ShieldAlert className="mx-auto h-8 w-8" />
            <span className="mt-1 block text-2xl font-bold tracking-widest">SOS</span>
          </span>
        </motion.button>
        {sent ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 flex items-center gap-2 rounded-2xl bg-[var(--safe)]/15 px-4 py-3 text-sm font-semibold text-[var(--safe)]"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Alert sent — help is on the way
          </motion.div>
        ) : (
          <p className="mt-6 max-w-xs text-center text-xs text-muted-foreground">
            {sending ? "Sending…" : "Hold your phone steady and tap once. Your live location is attached."}
          </p>
        )}
      </GlassCard>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/app/map">
          <GlassCard className="h-full" transition={{ delay: 0.15, duration: 0.35 }}>
            <MapIcon className="h-5 w-5 text-[var(--sand)]" />
            <h3 className="mt-3 text-sm font-semibold text-foreground">Safety map</h3>
            <p className="mt-1 text-sm text-muted-foreground">See risk zones around you.</p>
          </GlassCard>
        </Link>
        <Link to="/app/id">
          <GlassCard className="h-full" transition={{ delay: 0.2, duration: 0.35 }}>
            <Fingerprint className="h-5 w-5 text-[var(--blush)]" />
            <h3 className="mt-3 text-sm font-semibold text-foreground">Digital ID</h3>
            <p className="mt-1 text-sm text-muted-foreground">Your verifiable travel identity.</p>
          </GlassCard>
        </Link>
      </div>
    </div>
  );
}
