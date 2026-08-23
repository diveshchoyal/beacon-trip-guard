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

// Interactive SVG Circular Score Gauge
function CircularScoreGauge({ score, risk }: { score: number; risk: string }) {
  const radius = 38;
  const strokeWidth = 7;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (score / 100) * circumference;

  const strokeColor =
    risk === "restricted"
      ? "#ef4444"
      : risk === "caution"
        ? "#f59e0b"
        : "#10b981";

  const textColor =
    risk === "restricted"
      ? "text-rose-600"
      : risk === "caution"
        ? "text-amber-600"
        : "text-emerald-700";

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div className="relative h-24 w-24 sm:h-28 sm:w-28 flex items-center justify-center">
        <svg
          className="h-full w-full -rotate-90 transform drop-shadow-sm"
          viewBox="0 0 96 96"
        >
          {/* Background Track Ring */}
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            className="text-black/10"
          />
          {/* Active Animated Score Progress Ring */}
          <motion.circle
            cx="48"
            cy="48"
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="transparent"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: progressOffset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>

        {/* Center Score Number & Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
          <span className={`text-2xl sm:text-3xl font-black leading-none ${textColor}`}>
            {score}
          </span>
          <span className="mt-0.5 text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-muted-foreground">
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

  const greeting = getGreeting(profile?.full_name);
  const firstName = profile?.full_name?.trim()
    ? profile.full_name.trim().split(" ")[0]
    : "Explorer";

  const statusSentence =
    risk === "restricted"
      ? "You are inside a restricted zone. Stay alert and keep emergency contacts ready."
      : risk === "caution"
        ? "Moderate risk area with patchy network. Keep your digital ID handy and share live trip status."
        : "You are in a well-monitored tourist safe zone in Tamil Nadu. Enjoy your travel.";

  return (
    <div className="space-y-5 pb-24 lg:pb-12">
      {/* 1. HERO CARD MATCHING THE REFERENCE COMPOSITION */}
      <GlassCard className="p-5 sm:p-6 relative border-2 border-white/60 bg-white/45 shadow-lg overflow-hidden">
        {/* Top Header Label */}
        <div className="flex items-center justify-between gap-2 border-b border-black/5 pb-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border border-white/90 shadow-2xs backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-[var(--sand)]" />
            <span>BEACON TRIP COMPANION</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-foreground rounded-full bg-white/70 px-2.5 py-0.5 border border-white/80">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--safe)]" />
              <span>Protection Active</span>
            </span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-foreground rounded-full bg-white/70 px-2.5 py-0.5 border border-white/80">
              <Navigation className="h-3 w-3 text-primary" />
              <span>GPS Live</span>
            </span>
          </div>
        </div>

        {/* Main Hero Body: Left Greeting & Status, Center Animated Mascot, Right Circular Gauge */}
        <div className="pt-4 pb-2 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] items-center gap-6">
          {/* Left Column: Heading & Live Status */}
          <div className="space-y-2.5 text-left">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                HELLO, {firstName.toUpperCase()}
              </p>
              <h1 className="mt-0.5 text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                Safety score
              </h1>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-md">
              {statusSentence}
            </p>
          </div>

          {/* Center Column: Animated Mascot with Breathing & Hand-Wave Animation */}
          <div className="relative flex flex-col items-center justify-center px-4 py-2 shrink-0">
            {/* Dynamic Speech Bubble greeting near character */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1, y: [0, -5, 0] }}
              transition={{
                y: { repeat: Infinity, duration: 3.2, ease: "easeInOut", delay: 0.3 },
                opacity: { duration: 0.3 },
              }}
              className="absolute -top-3 left-0 sm:-left-3 z-20 rounded-2xl bg-white/95 px-3 py-1 text-[11px] sm:text-xs font-bold text-foreground shadow-md border border-white/90 backdrop-blur-md flex items-center gap-1 whitespace-nowrap"
            >
              <span>{greeting}</span>
              {/* Pointer tail */}
              <span className="absolute -bottom-1 left-4 h-2 w-2 rotate-45 bg-white/95 border-r border-b border-white/80" />
            </motion.div>

            {/* Dynamic Ground Shadow pulsing in sync with bounce */}
            <motion.div
              animate={{
                scale: [1, 0.84, 1],
                opacity: [0.35, 0.18, 0.35],
              }}
              transition={{
                repeat: Infinity,
                duration: 3.2,
                ease: "easeInOut",
              }}
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-4 w-28 rounded-full bg-black/20 blur-md pointer-events-none"
            />

            {/* Mascot Character Illustration */}
            <motion.img
              src={mascotImg}
              alt="BEACON Tourist Mascot"
              animate={{
                y: [0, -10, 0],
                rotate: [0, 2, -1.8, 1, 0],
              }}
              transition={{
                y: { repeat: Infinity, duration: 3.2, ease: "easeInOut" },
                rotate: { repeat: Infinity, duration: 4.8, ease: "easeInOut" },
              }}
              className="h-44 sm:h-52 w-auto object-contain select-none pointer-events-none drop-shadow-lg"
            />
          </div>

          {/* Right Column: Real Circular Progress Score Gauge */}
          <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/60 border border-white/80 shadow-2xs backdrop-blur-sm shrink-0">
            <CircularScoreGauge score={score} risk={risk} />
            <span className="mt-1 text-[10px] font-bold text-foreground uppercase tracking-wider">
              {risk === "restricted"
                ? "Restricted"
                : risk === "caution"
                  ? "Caution"
                  : "Safe Area"}
            </span>
          </div>
        </div>

        {/* Bottom Partition: CURRENT ZONE SHELF (Matching reference layout) */}
        <div className="mt-4 pt-3.5 border-t border-black/5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              CURRENT ZONE
            </p>
            <p className="mt-0.5 truncate text-sm sm:text-base font-bold text-foreground">
              {currentZone?.name ?? "Open area — no active geofence"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              {error ?? currentZone?.description ?? "Location tracked live."}
            </p>
          </div>
          <RiskBadge level={risk} />
        </div>
      </GlassCard>

      {/* 2. QUICK ACCESS FEATURE NAVIGATION CARDS */}
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

      {/* 3. PROMINENT, ALWAYS-VISIBLE FLOATING ACTION SOS BUTTON */}
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
