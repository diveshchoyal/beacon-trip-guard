import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle2,
  ChevronRight,
  CloudSun,
  Fingerprint,
  Home,
  Languages,
  Map as MapIcon,
  MapPin,
  Radio,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import logo from "@/assets/beacon-logo.png";
import mascotImg from "@/assets/tourist-mascot.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useGeolocation, inZone } from "@/hooks/use-geolocation";

export const Route = createFileRoute("/_authenticated/app/")({
  component: TouristHome,
});

// Safety tips presets for modal
const SAFETY_TIPS = [
  {
    title: "Official Tourist Helpline",
    desc: "Dial 1363 (24x7 Multi-lingual toll-free Tourist Helpline) or 112 for all police and medical emergencies in Tamil Nadu.",
  },
  {
    title: "Verified Transport",
    desc: "Always use prepaid airport/railway taxi counters or registered ride-hailing apps for safe and monitored commutes.",
  },
  {
    title: "Digital ID Verification",
    desc: "Keep your QR Digital ID readily accessible on BEACON for swift verification at tourist checkpoints and monuments.",
  },
  {
    title: "Geofence Notifications",
    desc: "Stay alert if you receive an automated notification when entering caution or restricted zones after dusk.",
  },
];

function TouristHome() {
  const { user, profile } = useAuth();
  const { effective, coords, error: geoError, requestLocation } = useGeolocation();
  const queryClient = useQueryClient();

  // Local state
  const [sendingSos, setSendingSos] = useState(false);
  const [sosSent, setSosSent] = useState(false);
  const [safetyTipsOpen, setSafetyTipsOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [weatherData, setWeatherData] = useState<{ temp: number; text: string } | null>(null);

  // Load geofence zones from Supabase
  const { data: zones = [] } = useQuery({
    queryKey: ["zones"],
    queryFn: async () => {
      const { data, error: e } = await supabase.from("geofence_zones").select("*");
      if (e) throw e;
      return data ?? [];
    },
  });

  // Query unread alerts count
  const { data: unreadAlertsCount = 0 } = useQuery({
    queryKey: ["unread-alerts-count"],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error: e } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "active");
      if (e) return 0;
      return count ?? 0;
    },
    enabled: Boolean(user),
  });

  // Current zone calculation
  const currentZone = useMemo(
    () => zones.find((z) => inZone(effective, z)),
    [zones, effective],
  );

  const risk = currentZone?.risk_level ?? "safe";

  // Fetch real weather data from Open-Meteo
  useEffect(() => {
    let active = true;
    async function loadWeather() {
      try {
        const lat = effective.lat || 13.0827;
        const lng = effective.lng || 80.2707;
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`,
          { signal: AbortSignal.timeout(4000) },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (active && data?.current_weather) {
          const temp = Math.round(data.current_weather.temperature);
          const code = data.current_weather.weathercode;
          let text = "Clear Sky";
          if (code >= 1 && code <= 3) text = "Partly Cloudy";
          else if (code >= 45 && code <= 48) text = "Hazy / Fog";
          else if (code >= 51 && code <= 67) text = "Light Rain";
          else if (code >= 80 && code <= 99) text = "Scattered Showers";

          setWeatherData({ temp, text });
        }
      } catch {
        if (active) {
          setWeatherData({ temp: 31, text: "Few Clouds" });
        }
      }
    }
    void loadWeather();
    return () => {
      active = false;
    };
  }, [effective.lat, effective.lng]);

  // Persist location ping every 2 minutes for responders
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

  // Trigger real emergency SOS
  const triggerSos = async () => {
    if (!user) return;
    setSendingSos(true);
    const { error: e } = await supabase.from("alerts").insert({
      user_id: user.id,
      type: "sos",
      message: currentZone ? `SOS raised in ${currentZone.name}` : "Emergency SOS raised by tourist",
      lat: effective.lat,
      lng: effective.lng,
    });
    setSendingSos(false);
    if (e) {
      toast.error(e.message);
      return;
    }
    toast.success("EMERGENCY SOS SENT — Response units alerted");
    setSosSent(true);
    window.setTimeout(() => setSosSent(false), 9000);
    void queryClient.invalidateQueries({ queryKey: ["my-alerts"] });
    void queryClient.invalidateQueries({ queryKey: ["unread-alerts-count"] });
  };

  // Share live location handler
  const handleShareLocation = async () => {
    const mapsUrl = `https://www.google.com/maps?q=${effective.lat},${effective.lng}`;
    const text = `BEACON Live Safety Ping: I am currently at ${currentZone?.name ?? "Tamil Nadu, India"}. Live Map: ${mapsUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "My BEACON Live Location",
          text,
          url: mapsUrl,
        });
        toast.success("Location shared successfully");
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(mapsUrl);
      toast.success("Live GPS link copied to clipboard");
    } catch {
      toast.info(`Your GPS: ${effective.lat.toFixed(4)}, ${effective.lng.toFixed(4)}`);
    }
  };

  // Personalized dynamic name extracted from authenticated profile
  const firstName = profile?.full_name?.trim()
    ? profile.full_name.trim().split(" ")[0]
    : "Traveler";

  return (
    <div className="space-y-6 pb-28 lg:pb-12 text-[#1E1E1E]">
      {/* ========================================================================= */}
      {/* 1. TOP NAVIGATION — FLOATING CORAL/PEACH PILL BAR */}
      {/* ========================================================================= */}
      <nav className="relative z-30 flex items-center justify-between rounded-[28px] border border-[#F6B28F]/40 bg-white/85 px-4 sm:px-6 py-3 shadow-[0_8px_30px_rgba(255,111,97,0.08)] backdrop-blur-md transition-all">
        {/* Left Brand with BEACON Logo & Tagline */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF6F61] to-[#F6B28F] p-1.5 shadow-md shadow-[#FF6F61]/25">
            <img src={logo} alt="BEACON" className="h-full w-full object-contain drop-shadow-xs" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base sm:text-lg font-black tracking-wider text-[#1E1E1E]">
                BEACON
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-[#39B86B] animate-pulse" />
            </div>
            <p className="hidden sm:block text-[10px] font-semibold text-[#77716D] tracking-tight">
              Safe Travel. Smart Response.
            </p>
          </div>
        </div>

        {/* Center Navigation Links (Desktop) */}
        <div className="hidden md:flex items-center gap-1 rounded-2xl bg-[#FFF8F3] p-1 border border-[#F6B28F]/30 shadow-inner">
          {[
            { to: "/app", label: "Home", icon: Home, exact: true },
            { to: "/app/map", label: "Map", icon: MapIcon },
            { to: "/app/alerts", label: "Alerts", icon: AlertTriangle },
            { to: "/app/id", label: "Digital ID", icon: Fingerprint },
            { to: "/app/profile", label: "Profile", icon: User },
          ].map((item) => {
            const isSelected = item.to === "/app";
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`relative flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all duration-200 ${
                  isSelected
                    ? "bg-gradient-to-r from-[#FF6F61] to-[#FF8577] text-white shadow-md shadow-[#FF6F61]/30"
                    : "text-[#77716D] hover:text-[#1E1E1E] hover:bg-white/60"
                }`}
              >
                <item.icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right Section: Notification Badge + Language + Profile Avatar */}
        <div className="flex items-center gap-2.5">
          {/* Notification Icon with Badge */}
          <Link
            to="/app/alerts"
            className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF8F3] text-[#77716D] hover:text-[#1E1E1E] border border-[#F6B28F]/30 hover:bg-white transition-colors"
            title="View Alerts"
          >
            <Bell className="h-4 w-4" />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#E94B5F] px-1 text-[9px] font-black text-white shadow-xs animate-bounce">
                {unreadAlertsCount}
              </span>
            )}
          </Link>

          {/* Language Selector Dropdown */}
          <div className="relative">
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="appearance-none rounded-xl border border-[#F6B28F]/30 bg-[#FFF8F3] px-2.5 py-1.5 pr-7 text-xs font-bold text-[#1E1E1E] focus:outline-none focus:ring-2 focus:ring-[#FF6F61]/40 cursor-pointer shadow-2xs"
            >
              <option value="en">🇺🇸 EN</option>
              <option value="ta">🇮🇳 தமிழ்</option>
              <option value="hi">🇮🇳 हिन्दी</option>
              <option value="fr">🇫🇷 FR</option>
              <option value="es">🇪🇸 ES</option>
            </select>
            <Languages className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#77716D]" />
          </div>

          {/* Profile Avatar */}
          <Link
            to="/app/profile"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#F6B28F] to-[#FF6F61] text-white font-black text-xs shadow-xs border border-white hover:scale-105 transition-transform"
            title="Profile settings"
          >
            {firstName.charAt(0).toUpperCase()}
          </Link>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* 2. HERO SECTION — 3D TOURIST + CLEAN ROTATING EARTH ATMOSPHERE */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-[36px] border border-[#F6B28F]/30 bg-gradient-to-br from-white via-[#FFF8F3] to-[#FFF1EA] p-6 sm:p-8 lg:p-10 shadow-[0_16px_45px_rgba(255,111,97,0.08)]">
        {/* Soft Background Atmospheric Glow (No wireframe lines) */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-gradient-to-br from-[#FF6F61]/15 to-[#F6B28F]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-gradient-to-tr from-[#F6B28F]/15 to-[#FF6F61]/10 blur-3xl" />

        <div className="relative grid grid-cols-1 lg:grid-cols-12 items-center gap-8 lg:gap-6">
          {/* Left Column: Personalized Greeting + Dynamic Status & Current Location (5 Cols) */}
          <div className="lg:col-span-5 space-y-5 text-left">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#FF6F61]/10 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-[#FF6F61] border border-[#FF6F61]/20">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Hi, {firstName}! 👋</span>
              </div>

              <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[#1E1E1E] leading-[1.1]">
                You are safe.
                <span className="block mt-1 bg-gradient-to-r from-[#FF6F61] to-[#E94B5F] bg-clip-text text-transparent">
                  We are watching.
                </span>
              </h1>

              <p className="mt-3 text-xs sm:text-sm text-[#77716D] leading-relaxed max-w-md font-medium">
                BEACON monitors your surroundings in real-time and connects you to help, instantly.
              </p>
            </div>

            {/* Prominent Current Location Card */}
            <div className="rounded-3xl border border-[#F6B28F]/30 bg-white/90 p-4 sm:p-5 shadow-[0_8px_25px_rgba(255,111,97,0.06)] backdrop-blur-md">
              <div className="flex items-center justify-between gap-2 border-b border-black/5 pb-2.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#77716D] flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#39B86B] animate-ping" />
                  CURRENT LOCATION
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                    risk === "restricted"
                      ? "bg-[#E94B5F]/15 text-[#E94B5F]"
                      : risk === "caution"
                        ? "bg-[#F2A93B]/15 text-[#F2A93B]"
                        : "bg-[#39B86B]/15 text-[#39B86B]"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      risk === "restricted"
                        ? "bg-[#E94B5F]"
                        : risk === "caution"
                          ? "bg-[#F2A93B]"
                          : "bg-[#39B86B]"
                    }`}
                  />
                  {risk === "restricted"
                    ? "Restricted Zone"
                    : risk === "caution"
                      ? "Caution Zone"
                      : "Safe Zone"}
                </span>
              </div>

              <div className="mt-3 flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#FF6F61]/10 text-[#FF6F61]">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm sm:text-base font-black text-[#1E1E1E]">
                    {currentZone?.name ?? "Marina Beach, Chennai, Tamil Nadu"}
                  </p>
                  <p className="mt-0.5 text-xs text-[#77716D] truncate">
                    {geoError
                      ? "GPS tracking active (simulated location)"
                      : "Location tracked live via GPS satellite"}
                  </p>
                </div>
              </div>

              {/* Location fallback button if permission not granted */}
              {geoError && (
                <button
                  onClick={requestLocation}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-xl bg-[#FF6F61]/10 py-1.5 text-xs font-bold text-[#FF6F61] hover:bg-[#FF6F61]/20 transition-colors cursor-pointer"
                >
                  <Radio className="h-3.5 w-3.5 animate-pulse" />
                  <span>Enable Location</span>
                </button>
              )}
            </div>
          </div>

          {/* Center 3D Mascot Character on 3D Earth Globe (4 Cols) */}
          <div className="lg:col-span-4 relative flex flex-col items-center justify-center py-4 select-none">
            {/* Soft Ambient Atmosphere behind Globe (No wireframe lines) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="h-56 w-56 sm:h-64 sm:w-64 rounded-full bg-gradient-to-br from-[#FF6F61]/10 via-[#F6B28F]/15 to-transparent blur-2xl" />
            </div>

            {/* Synchronized Soft Ground Shadow */}
            <motion.div
              animate={{
                scale: [1, 0.94, 1],
                opacity: [0.28, 0.18, 0.28],
              }}
              transition={{
                repeat: Infinity,
                duration: 6,
                ease: "easeInOut",
              }}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 h-5 w-32 rounded-full bg-[#FF6F61]/20 blur-md pointer-events-none"
            />

            {/* Stable, Natural 3D Tourist Character on 3D Earth Globe (No shaking/bouncing) */}
            <motion.img
              src={mascotImg}
              alt="BEACON 3D Tourist on Earth Globe"
              animate={{
                y: [0, -4, 0],
              }}
              transition={{
                repeat: Infinity,
                duration: 6,
                ease: "easeInOut",
              }}
              className="relative z-10 h-60 sm:h-68 lg:h-76 w-auto object-contain drop-shadow-2xl"
            />
          </div>

          {/* Right Column: Floating Live Location & Coordinates Card (3 Cols) */}
          <div className="lg:col-span-3 flex flex-col justify-center">
            <div className="rounded-3xl border border-[#F6B28F]/30 bg-white/90 p-5 shadow-[0_10px_30px_rgba(255,111,97,0.08)] backdrop-blur-md space-y-4">
              <div className="flex items-center justify-between border-b border-black/5 pb-2.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#77716D]">
                  YOUR LOCATION
                </span>
                <span className="flex items-center gap-1 text-[10px] font-black text-[#39B86B] uppercase tracking-wider">
                  <span className="h-2 w-2 rounded-full bg-[#39B86B] animate-ping" />
                  LIVE
                </span>
              </div>

              {/* Geographic Details */}
              <div className="space-y-1 text-left">
                <p className="text-base font-black text-[#1E1E1E]">Chennai</p>
                <p className="text-xs font-bold text-[#77716D]">Tamil Nadu, India</p>
              </div>

              {/* Live Coordinates */}
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#FFF8F3] p-2.5 border border-[#F6B28F]/20 text-[11px]">
                <div>
                  <span className="text-[9px] font-black uppercase text-[#77716D] block">
                    Latitude
                  </span>
                  <span className="font-mono font-bold text-[#1E1E1E]">
                    {effective.lat ? effective.lat.toFixed(4) : "13.0827"}° N
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase text-[#77716D] block">
                    Longitude
                  </span>
                  <span className="font-mono font-bold text-[#1E1E1E]">
                    {effective.lng ? effective.lng.toFixed(4) : "80.2707"}° E
                  </span>
                </div>
              </div>

              {/* View on Map CTA Button */}
              <Link
                to="/app/map"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF6F61] to-[#F6B28F] py-2.5 text-xs font-black text-white shadow-md shadow-[#FF6F61]/25 hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
              >
                <span>View on Map</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. FOUR COMPACT SAFETY STATUS CARDS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: RISK LEVEL */}
        <div className="rounded-3xl border border-[#F6B28F]/30 bg-white/90 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#77716D]">
              RISK LEVEL
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#39B86B]/15 text-[#39B86B]">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-lg sm:text-xl font-black text-[#1E1E1E]">
            {risk === "restricted" ? "High Risk" : risk === "caution" ? "Moderate" : "Low Risk"}
          </p>
          <p className="mt-0.5 text-xs text-[#39B86B] font-bold">
            {risk === "safe" ? "Safe to travel" : "Exercise vigilance"}
          </p>
        </div>

        {/* Card 2: CROWD DENSITY */}
        <div className="rounded-3xl border border-[#F6B28F]/30 bg-white/90 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#77716D]">
              CROWD DENSITY
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FF6F61]/15 text-[#FF6F61]">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-lg sm:text-xl font-black text-[#1E1E1E]">Moderate</p>
          <p className="mt-0.5 text-xs text-[#77716D] font-bold">24% occupied · Normal</p>
        </div>

        {/* Card 3: NEARBY POLICE */}
        <div className="rounded-3xl border border-[#F6B28F]/30 bg-white/90 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#77716D]">
              NEARBY POLICE
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-lg sm:text-xl font-black text-[#1E1E1E]">1.2 km</p>
          <p className="mt-0.5 text-xs text-blue-600 font-bold">Low Risk / Open</p>
        </div>

        {/* Card 4: WEATHER */}
        <div className="rounded-3xl border border-[#F6B28F]/30 bg-white/90 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#77716D]">
              WEATHER
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
              <CloudSun className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-lg sm:text-xl font-black text-[#1E1E1E]">
            {weatherData ? `${weatherData.temp}°C` : "31°C"}
          </p>
          <p className="mt-0.5 text-xs text-[#77716D] font-bold">
            {weatherData ? weatherData.text : "Few Clouds"}
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. FOUR HIGHLIGHTED FEATURE / ACTION CARDS (REPLACING TRANSLATION SECTION) */}
      {/* ========================================================================= */}
      <div>
        <div className="flex items-center justify-between px-1 mb-3">
          <h2 className="text-base sm:text-lg font-black text-[#1E1E1E]">
            BEACON Protection Capabilities
          </h2>
          <span className="text-xs font-semibold text-[#77716D]">Smart Response Hub</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: 🚨 EMERGENCY SOS (Visually Dominant) */}
          <button
            onClick={triggerSos}
            disabled={sendingSos}
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#E94B5F] via-[#FF6F61] to-[#E94B5F] p-5 text-left text-white shadow-lg shadow-[#E94B5F]/25 hover:shadow-xl hover:scale-[1.02] active:scale-98 transition-all cursor-pointer disabled:opacity-70"
          >
            <span className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-white/20 blur-lg group-hover:scale-150 transition-transform" />

            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 text-white backdrop-blur-md">
                <ShieldAlert className="h-6 w-6 animate-pulse" />
              </span>
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-black tracking-widest uppercase">
                EMERGENCY
              </span>
            </div>

            <div className="mt-4">
              <h3 className="text-base font-black tracking-wide">EMERGENCY SOS</h3>
              <p className="mt-0.5 text-xs text-white/85">Send alert to authorities</p>
            </div>
          </button>

          {/* Card 2: 📍 SHARE LIVE LOCATION */}
          <button
            onClick={handleShareLocation}
            className="rounded-3xl border border-[#F6B28F]/30 bg-white/95 p-5 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#39B86B]/15 text-[#39B86B] group-hover:scale-110 transition-transform">
                <Share2 className="h-5 w-5" />
              </span>
              <ChevronRight className="h-4 w-4 text-[#77716D]" />
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-black text-[#1E1E1E]">SHARE LIVE LOCATION</h3>
              <p className="mt-0.5 text-xs text-[#77716D]">Share your live location</p>
            </div>
          </button>

          {/* Card 3: 💡 SAFETY TIPS */}
          <button
            onClick={() => setSafetyTipsOpen(true)}
            className="rounded-3xl border border-[#F6B28F]/30 bg-white/95 p-5 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 group-hover:scale-110 transition-transform">
                <Zap className="h-5 w-5" />
              </span>
              <ChevronRight className="h-4 w-4 text-[#77716D]" />
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-black text-[#1E1E1E]">SAFETY TIPS</h3>
              <p className="mt-0.5 text-xs text-[#77716D]">Stay informed while travelling</p>
            </div>
          </button>

          {/* Card 4: 🚩 REPORT INCIDENT */}
          <Link
            to="/app/alerts"
            className="rounded-3xl border border-[#F6B28F]/30 bg-white/95 p-5 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group block"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-600 group-hover:scale-110 transition-transform">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <ChevronRight className="h-4 w-4 text-[#77716D]" />
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-black text-[#1E1E1E]">REPORT INCIDENT</h3>
              <p className="mt-0.5 text-xs text-[#77716D]">Report a safety incident</p>
            </div>
          </Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. ALWAYS-VISIBLE PROMINENT FLOATING SOS BUTTON */}
      {/* ========================================================================= */}
      <div className="fixed bottom-20 right-4 sm:bottom-8 sm:right-8 z-40 flex flex-col items-center select-none">
        <div className="relative flex items-center justify-center">
          <span className="absolute h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-[#E94B5F]/25 animate-ping pointer-events-none" />
          <span className="absolute h-28 w-28 sm:h-32 sm:w-32 rounded-full bg-[#E94B5F]/15 animate-pulse pointer-events-none" />

          <motion.button
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            disabled={sendingSos}
            onClick={triggerSos}
            className="relative flex h-16 w-16 sm:h-20 sm:w-20 flex-col items-center justify-center rounded-full bg-gradient-to-br from-[#E94B5F] to-[#FF6F61] text-white shadow-2xl shadow-[#E94B5F]/60 cursor-pointer border-3 border-white/60 active:scale-95 disabled:opacity-75 focus:outline-none"
            title="Tap to trigger Emergency SOS"
          >
            <ShieldAlert className="h-6 w-6 sm:h-8 sm:w-8 animate-pulse" />
            <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase mt-0.5">
              SOS
            </span>
          </motion.button>
        </div>

        {/* Real SOS Sent Toast Feedback */}
        <AnimatePresence>
          {sosSent && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute bottom-22 right-0 whitespace-nowrap rounded-2xl bg-[#39B86B] text-white px-4 py-2 text-xs font-bold shadow-xl flex items-center gap-1.5 border border-white/40"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>SOS Alert Sent — emergency team notified!</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ========================================================================= */}
      {/* 6. SAFETY TIPS MODAL DIALOG */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {safetyTipsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSafetyTipsOpen(false)}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              className="fixed inset-x-4 top-[15%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 w-full max-w-lg rounded-[32px] border border-[#F6B28F]/40 bg-white p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-black/5 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
                    <Zap className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-[#1E1E1E]">Tourist Safety Tips</h3>
                    <p className="text-xs text-[#77716D]">Tamil Nadu Travel Guidelines</p>
                  </div>
                </div>
                <button
                  onClick={() => setSafetyTipsOpen(false)}
                  className="rounded-full p-1.5 text-[#77716D] hover:bg-black/5 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {SAFETY_TIPS.map((tip, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-[#F6B28F]/25 bg-[#FFF8F3] p-3.5 space-y-1 text-left"
                  >
                    <h4 className="text-xs font-black text-[#1E1E1E] flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#FF6F61]" />
                      {tip.title}
                    </h4>
                    <p className="text-xs text-[#77716D] leading-relaxed pl-3.5">{tip.desc}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setSafetyTipsOpen(false)}
                className="mt-5 w-full rounded-2xl bg-gradient-to-r from-[#FF6F61] to-[#F6B28F] py-2.5 text-xs font-black text-white shadow-md shadow-[#FF6F61]/25 hover:shadow-lg cursor-pointer"
              >
                Got It, Stay Safe
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
