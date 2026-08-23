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
} from "lucide-react";
import { toast } from "sonner";

import mascotImg from "@/assets/tourist-mascot.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useGeolocation, inZone } from "@/hooks/use-geolocation";
import { GlassCard } from "@/components/ui/glass";

export const Route = createFileRoute("/_authenticated/app/")({
  component: TouristHome,
});

// Copper / Metallic Circular Ring Gauge Component matching reference design
function CopperRingScoreGauge({ score, risk }: { score: number; risk: string }) {
  const radius = 34;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (score / 100) * circumference;

  // Center score number color matching reference green tone
  const scoreNumColor =
    risk === "restricted"
      ? "text-rose-700"
      : risk === "caution"
        ? "text-amber-700"
        : "text-[#3d7057]";

  return (
    <div className="relative flex flex-col items-center justify-center select-none shrink-0">
      <div className="relative h-24 w-24 sm:h-28 sm:w-28 flex items-center justify-center">
        {/* Soft Inset Clay Circle Backdrop */}
        <div className="absolute inset-1.5 rounded-full bg-[#f2eae0] shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]" />

        <svg
          className="h-full w-full -rotate-90 transform drop-shadow-xs relative z-10"
          viewBox="0 0 88 88"
        >
          <defs>
            {/* Metallic Copper / Terracotta Gradient for the Ring */}
            <linearGradient id="copperRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#dca284" />
              <stop offset="50%" stopColor="#b87253" />
              <stop offset="100%" stopColor="#96563a" />
            </linearGradient>
          </defs>

          {/* Background Groove */}
          <circle
            cx="44"
            cy="44"
            r={radius}
            stroke="#e6d9cb"
            strokeWidth={strokeWidth}
            fill="transparent"
          />

          {/* Active Metallic Copper Progress Ring */}
          <motion.circle
            cx="44"
            cy="44"
            r={radius}
            stroke="url(#copperRingGrad)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="transparent"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: progressOffset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>

        {/* Center Score Number & SCORE Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-20">
          <span className={`text-2xl sm:text-3xl font-black leading-none ${scoreNumColor}`}>
            {score}
          </span>
          <span className="mt-0.5 text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-[#8c7a6b]">
            SCORE
          </span>
        </div>
      </div>
    </div>
  );
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

  const firstName = profile?.full_name?.trim()
    ? profile.full_name.trim().split(" ")[0]
    : "Divesh";

  const statusSentence =
    risk === "restricted"
      ? "You are inside a restricted zone. Stay alert and keep to marked paths."
      : risk === "caution"
        ? "Moderate risk area — patchy coverage. Share your plan with someone."
        : "You are in a well-monitored area. Enjoy your trip.";

  return (
    <div className="space-y-6 pb-24 lg:pb-12">
      {/* ========================================================================= */}
      {/* 1. EXACT HERO CARD LAYOUT MATCHING REFERENCE DESIGN (CLAY AESTHETIC) */}
      {/* ========================================================================= */}
      <div className="relative rounded-[32px] border-[3px] border-[#ece4d8] bg-[#faf7f2]/95 p-5 sm:p-7 shadow-[inset_0_2px_4px_rgba(255,255,255,0.9),0_12px_28px_-6px_rgba(150,120,90,0.15)] transition-all">
        {/* TOP SECTION: HELLO/STATUS (LEFT) + MASCOT & THOUGHT BUBBLE (CENTER) + COPPER RING GAUGE (RIGHT) */}
        <div className="grid grid-cols-1 md:grid-cols-[1.1fr_auto_1.1fr] items-center gap-6 pb-6">
          {/* Left Column: Hello tourist name + bold "Safety score" + live status sentence */}
          <div className="space-y-1.5 text-left">
            <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-[#8c7866]">
              HELLO, {firstName.toUpperCase()}
            </p>
            <h2 className="text-xl sm:text-2xl font-black text-[#26201b] tracking-tight">
              Safety score
            </h2>
            <p className="text-xs sm:text-sm text-[#736354] leading-relaxed max-w-xs pt-0.5">
              {statusSentence}
            </p>
          </div>

          {/* Center Column: Animated Mascot with Noticeable Wave, "– HI" tag & Scalloped Thought Bubble */}
          <div className="relative flex flex-col items-center justify-center px-4 py-2 shrink-0">
            {/* Scalloped Cloud-Shaped Thought Bubble displaying LIVE score */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
              className="absolute -top-7 right-0 sm:right-2 z-20 flex items-center justify-center select-none"
            >
              <div className="relative flex items-center justify-center rounded-[28px] bg-white/95 px-4 py-2 shadow-[0_4px_16px_rgba(170,130,100,0.22),inset_0_2px_4px_rgba(255,255,255,1)] border border-[#e8ded0]">
                {/* Score Number in bold copper/brown */}
                <span className="text-2xl sm:text-3xl font-black tracking-tight text-[#a06649]">
                  {score}
                </span>

                {/* Cloud Bubble Scallop bumps */}
                <span className="absolute -top-1.5 left-2 h-4 w-4 rounded-full bg-white/95 border-t border-l border-[#e8ded0]" />
                <span className="absolute -top-2.5 right-3 h-5 w-5 rounded-full bg-white/95 border-t border-[#e8ded0]" />
                <span className="absolute -bottom-1.5 right-2 h-4 w-4 rounded-full bg-white/95 border-b border-r border-[#e8ded0]" />

                {/* Trailing dots connecting thought bubble to character's head */}
                <span className="absolute -bottom-2 -left-1.5 h-3 w-3 rounded-full bg-white/95 border border-[#e8ded0] shadow-2xs" />
                <span className="absolute -bottom-4 -left-3.5 h-1.5 w-1.5 rounded-full bg-white/90 border border-[#e8ded0] shadow-2xs" />
              </div>
            </motion.div>

            {/* "– HI" text tag near the raised waving hand, pulsing with the wave */}
            <motion.div
              animate={{
                opacity: [0.65, 1, 0.65],
                scale: [0.95, 1.06, 0.95],
              }}
              transition={{
                repeat: Infinity,
                duration: 3.2,
                ease: "easeInOut",
              }}
              className="absolute top-11 sm:top-12 right-0 sm:right-1 z-20 text-xs sm:text-sm font-black tracking-wider text-[#26201b] select-none pointer-events-none"
            >
              – HI
            </motion.div>

            {/* Soft Ground Shadow pulsing beneath the globe */}
            <motion.div
              animate={{
                scale: [1, 0.85, 1],
                opacity: [0.32, 0.16, 0.32],
              }}
              transition={{
                repeat: Infinity,
                duration: 3.2,
                ease: "easeInOut",
              }}
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-4 w-28 rounded-full bg-[#7a6452]/25 blur-md pointer-events-none"
            />

            {/* Mascot Character with Noticeable Hand Wave & Breathing Animation */}
            <motion.img
              src={mascotImg}
              alt="BEACON Tourist Mascot"
              animate={{
                y: [0, -10, 0],
                rotate: [0, 5.5, -3.5, 4, 0],
              }}
              transition={{
                y: { repeat: Infinity, duration: 3.2, ease: "easeInOut" },
                rotate: { repeat: Infinity, duration: 3.8, ease: "easeInOut" },
              }}
              className="h-44 sm:h-52 w-auto object-contain select-none pointer-events-none drop-shadow-md"
            />
          </div>

          {/* Right Column: Circular Copper Ring Gauge (with matching "Safety score" text on desktop) */}
          <div className="flex flex-col items-center md:items-end justify-center">
            <div className="flex items-center gap-4">
              <div className="text-left hidden sm:block md:hidden lg:block">
                <h3 className="text-base font-black text-[#26201b]">Safety score</h3>
                <p className="text-xs text-[#736354] max-w-[155px] leading-snug">
                  {statusSentence}
                </p>
              </div>
              <CopperRingScoreGauge score={score} risk={risk} />
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: DIVIDER LINE + CURRENT ZONE (LEFT) + RISK BADGE (RIGHT) */}
        <div className="border-t-2 border-[#ede4d8] pt-4.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-[#8c7866]">
              CURRENT ZONE
            </p>
            <p className="mt-0.5 truncate text-base sm:text-lg font-black text-[#26201b]">
              {currentZone?.name ?? "Open area — no active geofence"}
            </p>
            <p className="mt-0.5 text-xs text-[#736354] truncate">
              {error ?? currentZone?.description ?? "Location tracked live."}
            </p>
          </div>

          {/* Pill-shaped live risk status badge ("SAFE" / "CAUTION" / "RESTRICTED") */}
          <div className="shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-black uppercase tracking-wider shadow-2xs border ${
                risk === "restricted"
                  ? "bg-rose-500/15 text-rose-700 border-rose-500/30"
                  : risk === "caution"
                    ? "bg-amber-500/15 text-amber-800 border-amber-500/30"
                    : "bg-emerald-600/15 text-emerald-800 border-emerald-600/30"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  risk === "restricted"
                    ? "bg-rose-600 animate-ping"
                    : risk === "caution"
                      ? "bg-amber-600"
                      : "bg-emerald-600"
                }`}
              />
              {risk === "restricted" ? "RESTRICTED" : risk === "caution" ? "CAUTION" : "SAFE"}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. QUICK ACCESS FEATURE NAVIGATION CARDS */}
      {/* ========================================================================= */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">
          Quick Services
        </p>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <Link to="/app/map">
            <GlassCard
              className="h-full hover:bg-white/70 transition-all duration-200 cursor-pointer group"
              transition={{ delay: 0.1, duration: 0.3 }}
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
              transition={{ delay: 0.14, duration: 0.3 }}
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
              transition={{ delay: 0.22, duration: 0.3 }}
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

      {/* ========================================================================= */}
      {/* 3. PROMINENT, ALWAYS-VISIBLE FLOATING ACTION SOS BUTTON */}
      {/* ========================================================================= */}
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
