import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Fingerprint,
  Map as MapIcon,
  ShieldAlert,
  Languages,
  AlertTriangle,
  Navigation,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import mascotImg from "@/assets/tourist-mascot.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useGeolocation, inZone } from "@/hooks/use-geolocation";
import { GlassCard, RiskBadge } from "@/components/ui/glass";

export const Route = createFileRoute("/_authenticated/app/")({
  component: TouristHome,
});

function getGreeting(fullName?: string | null) {
  const hour = new Date().getHours();
  const firstName = fullName?.trim() ? fullName.trim().split(" ")[0] : "Explorer";
  if (hour >= 5 && hour < 12) {
    return `Good morning, ${firstName}!`;
  } else if (hour >= 12 && hour < 17) {
    return `Good afternoon, ${firstName}!`;
  } else if (hour >= 17 && hour < 21) {
    return `Good evening, ${firstName}!`;
  } else {
    return `Stay safe tonight, ${firstName}!`;
  }
}

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

  // Persist location ping every 2 minutes so responders see live position
  useEffect(() => {
    if (!user || !coords) return;
    const write = () =>
      supabase
        .from("location_pings")
        .insert({ user_id: user.id, lat: coords.lat, lng: coords.lng });
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
    toast.success("Emergency alert sent — police unit notified");
    setSent(true);
    window.setTimeout(() => setSent(false), 9000);
    void queryClient.invalidateQueries({ queryKey: ["my-alerts"] });
  };

  const toneClass =
    risk === "restricted"
      ? "text-[var(--danger)]"
      : risk === "caution"
        ? "text-[var(--caution)]"
        : "text-[var(--safe)]";

  const greeting = getGreeting(profile?.full_name);
  const firstName = profile?.full_name?.trim()
    ? profile.full_name.trim().split(" ")[0]
    : "Explorer";

  return (
    <div className="space-y-5 pb-24 lg:pb-12">
      {/* 1. HERO MASCOT CARD WITH LIVE THOUGHT BUBBLE & SPEECH BUBBLE */}
      <GlassCard className="p-5 sm:p-6 overflow-visible relative border-2 border-white/60 bg-white/40">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Left Text / Greeting Column */}
          <div className="flex-1 space-y-3 text-center md:text-left">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground border border-white/80 shadow-2xs backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-[var(--sand)]" />
              <span>BEACON Trip Companion</span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                Hello, {firstName}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-md">
                {risk === "restricted"
                  ? "You are currently near a restricted zone. Stay on main routes and keep emergency contacts ready."
                  : risk === "caution"
                    ? "Moderate risk area with patchy network. Keep your digital ID handy and share live trip status."
                    : "You are in a well-monitored tourist safe zone in Tamil Nadu. Enjoy your travel!"}
              </p>
            </div>

            {/* Quick Status Pill */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
              <div className="flex items-center gap-1.5 rounded-xl bg-white/80 px-2.5 py-1 text-xs font-semibold text-foreground border border-white/80 shadow-2xs">
                <ShieldCheck className="h-4 w-4 text-[var(--safe)]" />
                <span>Trip Protection Active</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-xl bg-white/80 px-2.5 py-1 text-xs font-semibold text-foreground border border-white/80 shadow-2xs">
                <Navigation className="h-3.5 w-3.5 text-primary" />
                <span>GPS Live</span>
              </div>
            </div>
          </div>

          {/* Center/Right: Animated Mascot with Speech and Thought Bubbles */}
          <div className="relative flex flex-col items-center justify-center shrink-0 pt-4 pb-2 px-4">
            {/* Thought Bubble with LIVE Safety Score */}
            <motion.div
              animate={{ y: [0, -8, 0], scale: [1, 1.03, 1] }}
              transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut", delay: 0.2 }}
              className="absolute -top-4 right-2 sm:right-4 z-20 flex flex-col items-center justify-center rounded-3xl bg-white/95 px-3.5 py-2 shadow-xl border-2 border-white/90 backdrop-blur-md"
            >
              <div className="text-center">
                <p className={`text-2xl sm:text-3xl font-black leading-none ${toneClass}`}>
                  {score}
                </p>
                <p className="text-[8px] font-extrabold uppercase tracking-widest text-muted-foreground mt-0.5">
                  Live Score
                </p>
              </div>
              {/* Trailing cloud dots */}
              <span className="absolute -bottom-2 -left-1.5 h-3 w-3 rounded-full bg-white/95 border border-white/80 shadow-xs" />
              <span className="absolute -bottom-4 -left-3.5 h-1.5 w-1.5 rounded-full bg-white/90 border border-white/70 shadow-xs" />
            </motion.div>

            {/* Speech Bubble with Friendly Greeting */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
              transition={{
                y: { repeat: Infinity, duration: 3.2, ease: "easeInOut", delay: 0.4 },
                opacity: { duration: 0.3 },
              }}
              className="absolute -top-3 left-2 sm:-left-4 z-20 rounded-2xl bg-white/95 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-foreground shadow-xl border border-white/90 backdrop-blur-md flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>{greeting}</span>
              {/* Pointer tail */}
              <span className="absolute -bottom-1.5 left-5 h-3 w-3 rotate-45 bg-white/95 border-r border-b border-white/80" />
            </motion.div>

            {/* Dynamic Ground Shadow underneath character, pulsing with bounce */}
            <motion.div
              animate={{
                scale: [1, 0.82, 1],
                opacity: [0.35, 0.18, 0.35],
              }}
              transition={{
                repeat: Infinity,
                duration: 3,
                ease: "easeInOut",
              }}
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-5 w-28 rounded-full bg-black/25 blur-md pointer-events-none"
            />

            {/* Mascot Character with Animated Idle Bounce & Hand Waving */}
            <motion.img
              src={mascotImg}
              alt="BEACON Tourist Mascot"
              animate={{
                y: [0, -12, 0],
                rotate: [0, 2.5, -2, 1, 0],
              }}
              transition={{
                y: { repeat: Infinity, duration: 3, ease: "easeInOut" },
                rotate: { repeat: Infinity, duration: 4.5, ease: "easeInOut" },
              }}
              className="h-52 sm:h-64 w-auto object-contain select-none pointer-events-none drop-shadow-xl"
            />
          </div>
        </div>
      </GlassCard>

      {/* 2. CURRENT GEOFENCE ZONE CARD */}
      <GlassCard transition={{ delay: 0.08, duration: 0.35 }}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Current Geofence Zone
            </p>
            <p className="mt-1 truncate text-base font-bold text-foreground">
              {currentZone?.name ?? "Open area — no active geofence"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              {error ?? currentZone?.description ?? "Location actively monitored live via GPS."}
            </p>
          </div>
          <RiskBadge level={risk} />
        </div>
      </GlassCard>

      {/* 3. QUICK ACCESS FEATURE NAVIGATION CARDS */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">
          Quick Services
        </p>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <Link to="/app/map">
            <GlassCard
              className="h-full hover:bg-white/70 transition-all duration-200 cursor-pointer group"
              transition={{ delay: 0.12, duration: 0.3 }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--sand)]/20 text-[var(--sand)] group-hover:scale-105 transition-transform">
                  <MapIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                    Safety Map
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Places & safe zones</p>
                </div>
              </div>
            </GlassCard>
          </Link>

          <Link to="/app/translate">
            <GlassCard
              className="h-full hover:bg-white/70 transition-all duration-200 cursor-pointer group"
              transition={{ delay: 0.15, duration: 0.3 }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary group-hover:scale-105 transition-transform">
                  <Languages className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                    Voice Translator
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Face-to-face 2-way speech</p>
                </div>
              </div>
            </GlassCard>
          </Link>

          <Link to="/app/id">
            <GlassCard
              className="h-full hover:bg-white/70 transition-all duration-200 cursor-pointer group"
              transition={{ delay: 0.18, duration: 0.3 }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--blush)]/20 text-[var(--blush)] group-hover:scale-105 transition-transform">
                  <Fingerprint className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                    Digital ID
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Verifiable travel pass</p>
                </div>
              </div>
            </GlassCard>
          </Link>

          <Link to="/app/alerts">
            <GlassCard
              className="h-full hover:bg-white/70 transition-all duration-200 cursor-pointer group"
              transition={{ delay: 0.21, duration: 0.3 }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-600 group-hover:scale-105 transition-transform">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                    My Alerts
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Dispatched signals</p>
                </div>
              </div>
            </GlassCard>
          </Link>
        </div>
      </div>

      {/* 4. PROMINENT, ALWAYS-VISIBLE FLOATING ACTION SOS BUTTON */}
      <div className="fixed bottom-20 right-4 sm:bottom-8 sm:right-8 z-40 flex flex-col items-center select-none">
        <div className="relative flex items-center justify-center">
          {/* Continuous Soft Pulsing Glow & Ping Animations */}
          <span className="absolute h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-rose-500/25 animate-ping pointer-events-none" />
          <span className="absolute h-28 w-28 sm:h-32 sm:w-32 rounded-full bg-rose-500/15 animate-pulse pointer-events-none" />

          <motion.button
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            disabled={sending}
            onClick={triggerSos}
            className="relative flex h-18 w-18 sm:h-20 sm:w-20 flex-col items-center justify-center rounded-full bg-[var(--danger)] text-white shadow-2xl shadow-rose-600/60 transition-transform cursor-pointer border-3 border-white/50 active:scale-95 disabled:opacity-75 focus:outline-none focus:ring-4 focus:ring-rose-500/40"
            title="Tap to trigger emergency SOS with live GPS coordinates"
            aria-label="Emergency SOS"
          >
            <ShieldAlert className="h-7 w-7 sm:h-8 sm:w-8 animate-pulse" />
            <span className="text-[11px] sm:text-xs font-black tracking-widest uppercase mt-0.5">
              SOS
            </span>
          </motion.button>
        </div>

        {/* Live SOS Sent Toast Confirmation */}
        <AnimatePresence>
          {sent && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute bottom-22 right-0 whitespace-nowrap rounded-2xl bg-emerald-700 text-white px-3.5 py-2 text-xs font-bold shadow-xl flex items-center gap-1.5 border border-white/40"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>SOS Alert Sent — help is on the way!</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
