import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow, format } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CloudRain,
  CloudSun,
  ExternalLink,
  HelpCircle,
  Info,
  MapPin,
  Moon,
  PhoneCall,
  Radio,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useGeolocation, inZone, distanceMeters } from "@/hooks/use-geolocation";
import { useCrowdX } from "@/hooks/use-crowdx";
import {
  COMPREHENSIVE_POLICE_STATIONS,
  type PoliceStationRecord,
} from "@/lib/police-stations";

export const Route = createFileRoute("/_authenticated/app/alerts")({
  component: AlertsModule,
});

export type AlertSeverity = "INFO" | "CAUTION" | "WARNING" | "CRITICAL" | "EMERGENCY";

export interface ProactiveSafetyAlert {
  id: string;
  type: "crowd" | "geofence" | "weather" | "night" | "event";
  severity: AlertSeverity;
  title: string;
  message: string;
  whyExplanation: string;
  locationName: string;
  distanceMeters?: number;
  timestamp: number;
  recommendedAction: string;
  actionType: "map" | "guidance" | "helpline" | "route";
  actionLabel: string;
  actionUrl?: string;
}

function AlertsModule() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  // Central Authoritative Location
  const {
    effective,
    coords,
    accuracy,
    error: geoError,
    geoStatus,
    locationTitle,
    cityArea,
    stateCountry,
    requestLocation,
  } = useGeolocation();

  // CrowdX Live YOLO Vision Stream Hook
  const {
    level: crowdLevel,
    detectedCount: crowdDetectedCount,
    matchedLocation: crowdMatchedLocation,
    distanceKm: crowdDistanceKm,
    isLive: isCrowdLive,
    connectionState: crowdConnectionState,
    retry: retryCrowd,
  } = useCrowdX({
    userLat: coords?.lat ?? effective.lat,
    userLng: coords?.lng ?? effective.lng,
    hasLocationPermission: geoStatus !== "denied",
  });

  // Local UI states
  const [activeTab, setActiveTab] = useState<"all" | "active" | "sos" | "advisories">("all");
  const [expandedWhyIds, setExpandedWhyIds] = useState<Record<string, boolean>>({});
  const [guidanceModalData, setGuidanceModalData] = useState<{ title: string; desc: string } | null>(null);

  // SOS Countdown & Confirmation State
  const [sosCountdownActive, setSosCountdownActive] = useState(false);
  const [sosCountdownSeconds, setSosCountdownSeconds] = useState(3);
  const [isTriggeringSos, setIsTriggeringSos] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancellingSosId, setCancellingSosId] = useState<string | null>(null);

  // Real weather fetch from Open-Meteo
  const [weatherData, setWeatherData] = useState<{
    temp: number;
    text: string;
    weatherCode: number;
  } | null>(null);

  useEffect(() => {
    let active = true;
    async function loadWeather() {
      if (geoStatus === "denied") return;
      try {
        const targetLat = coords?.lat ?? effective.lat;
        const targetLng = coords?.lng ?? effective.lng;
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${targetLat}&longitude=${targetLng}&current_weather=true`,
          { signal: AbortSignal.timeout(5000) },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (active && data?.current_weather) {
          const temp = Math.round(data.current_weather.temperature);
          const code = data.current_weather.weathercode;
          let text = "Clear Sky";
          if (code === 1) text = "Mainly Clear";
          else if (code === 2) text = "Partly Cloudy";
          else if (code === 3) text = "Overcast";
          else if (code >= 45 && code <= 48) text = "Fog / Hazy";
          else if (code >= 51 && code <= 55) text = "Drizzle";
          else if (code >= 61 && code <= 65) text = "Rain";
          else if (code >= 71 && code <= 77) text = "Snow";
          else if (code >= 80 && code <= 82) text = "Scattered Showers";
          else if (code >= 95 && code <= 99) text = "Thunderstorm";

          setWeatherData({ temp, text, weatherCode: code });
        }
      } catch {
        // Fallback handled gracefully
      }
    }
    void loadWeather();
    return () => {
      active = false;
    };
  }, [coords?.lat, coords?.lng, effective.lat, effective.lng, geoStatus]);

  // Load user alerts from Supabase
  const { data: dbAlerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ["my-alerts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Load geofence zones from Supabase
  const { data: zones = [] } = useQuery({
    queryKey: ["zones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("geofence_zones").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Load police stations (merged with comprehensive verified dataset)
  const { data: dbPoliceStations = [] } = useQuery({
    queryKey: ["police-stations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("police_stations")
        .select("id, name, lat, lng");
      if (error) return [];
      return data ?? [];
    },
  });

  const allPoliceStations = useMemo(() => {
    if (dbPoliceStations.length === 0) return COMPREHENSIVE_POLICE_STATIONS;
    const existingIds = new Set(dbPoliceStations.map((s) => s.id));
    const merged = [...dbPoliceStations];
    for (const st of COMPREHENSIVE_POLICE_STATIONS) {
      if (!existingIds.has(st.id)) {
        merged.push(st);
      }
    }
    return merged;
  }, [dbPoliceStations]);

  // Nearest police station calculation
  const nearestPolice = useMemo(() => {
    if (geoStatus === "denied" || allPoliceStations.length === 0) return null;
    const targetLoc = coords ?? effective;
    if (!targetLoc) return null;

    let best = allPoliceStations[0]!;
    let bestDist = distanceMeters(targetLoc, { lat: best.lat, lng: best.lng });
    for (const st of allPoliceStations.slice(1)) {
      const d = distanceMeters(targetLoc, { lat: st.lat, lng: st.lng });
      if (d < bestDist) {
        best = st;
        bestDist = d;
      }
    }
    return { station: best, distanceMeters: bestDist };
  }, [allPoliceStations, coords, effective, geoStatus]);

  // Real-time Postgres subscription to alerts table
  useEffect(() => {
    const channel = supabase
      .channel("tourist-alerts-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        (payload) => {
          void queryClient.invalidateQueries({ queryKey: ["my-alerts"] });
          void queryClient.invalidateQueries({ queryKey: ["unread-alerts-count"] });

          if (payload.eventType === "UPDATE" && payload.new) {
            const updated = payload.new as { status?: string; type?: string };
            if (updated.status === "acknowledged") {
              toast.info("Control Room has acknowledged your alert");
            } else if (updated.status === "dispatched") {
              toast.success("Police emergency response unit has been dispatched to your GPS location");
            } else if (updated.status === "resolved") {
              toast.success("Incident has been marked resolved");
            }
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Active SOS Incident (latest non-resolved SOS)
  const activeSosIncident = useMemo(() => {
    return dbAlerts.find(
      (a) => a.type === "sos" && (a.status === "active" || a.status === "acknowledged" || a.status === "dispatched"),
    );
  }, [dbAlerts]);

  // Current Geofence Zone evaluation
  const currentZone = useMemo(() => {
    const loc = coords ?? effective;
    return zones.find((z) => inZone(loc, z));
  }, [zones, coords, effective]);

  const executeSosDispatch = useCallback(async () => {
    if (!user) return;
    setIsTriggeringSos(true);

    const targetLoc = coords ?? effective;
    const locName = locationTitle !== "Detecting your location..." ? locationTitle : "Live GPS Coordinate";

    const { error } = await supabase.from("alerts").insert({
      user_id: user.id,
      type: "sos",
      message: currentZone
        ? `Emergency SOS triggered in ${currentZone.name} near ${locName}`
        : `Emergency SOS triggered near ${locName}`,
      lat: targetLoc.lat,
      lng: targetLoc.lng,
      status: "active",
    });

    setIsTriggeringSos(false);

    if (error) {
      toast.error(`SOS Dispatch Failed: ${error.message}`);
      return;
    }

    toast.success("EMERGENCY SOS LOGGED — Authorities notified with live coordinates");
    void queryClient.invalidateQueries({ queryKey: ["my-alerts"] });
    void queryClient.invalidateQueries({ queryKey: ["unread-alerts-count"] });
  }, [user, coords, effective, locationTitle, currentZone, queryClient]);

  // =========================================================================
  // 3-SECOND SOS SAFELOCK COUNTDOWN ENGINE
  // =========================================================================
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (sosCountdownActive && sosCountdownSeconds > 0) {
      timer = setTimeout(() => {
        setSosCountdownSeconds((prev) => prev - 1);
      }, 1000);
    } else if (sosCountdownActive && sosCountdownSeconds === 0) {
      setSosCountdownActive(false);
      void executeSosDispatch();
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [sosCountdownActive, sosCountdownSeconds, executeSosDispatch]);

  const handleStartSosFlow = () => {
    setSosCountdownSeconds(3);
    setSosCountdownActive(true);
  };

  const handleCancelSosCountdown = () => {
    setSosCountdownActive(false);
    setSosCountdownSeconds(3);
    toast.info("SOS countdown cancelled");
  };

  // Cancel Active SOS handler
  const handleConfirmCancelSos = async () => {
    if (!cancellingSosId) return;
    const { error } = await supabase
      .from("alerts")
      .update({ status: "cancelled" })
      .eq("id", cancellingSosId);

    setCancelModalOpen(false);
    setCancellingSosId(null);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.info("SOS Incident marked cancelled");
    void queryClient.invalidateQueries({ queryKey: ["my-alerts"] });
    void queryClient.invalidateQueries({ queryKey: ["unread-alerts-count"] });
  };

  // =========================================================================
  // PROACTIVE SAFETY INTELLIGENCE ENGINE (REAL-TIME COMPUTED SIGNALS)
  // =========================================================================
  const proactiveAlerts: ProactiveSafetyAlert[] = useMemo(() => {
    const list: ProactiveSafetyAlert[] = [];
    const now = Date.now();

    // 1. CrowdX High Density & Surge Alert
    if (isCrowdLive && crowdDetectedCount !== null && crowdMatchedLocation) {
      if (crowdDetectedCount >= 60 || crowdLevel === "Very Busy") {
        list.push({
          id: `proactive-crowd-${crowdMatchedLocation.id}`,
          type: "crowd",
          severity: "CRITICAL",
          title: "Critical Crowd Density Surge",
          message: `Heavy pedestrian congestion detected at ${crowdMatchedLocation.name} (${crowdDetectedCount} people detected).`,
          whyExplanation: `Your GPS is within ${crowdDistanceKm?.toFixed(1) ?? "1.0"} km of a live CrowdX YOLO camera detecting high-density crowd volume exceeding safe capacity thresholds.`,
          locationName: crowdMatchedLocation.name,
          distanceMeters: crowdDistanceKm ? Math.round(crowdDistanceKm * 1000) : undefined,
          timestamp: now,
          recommendedAction: "Avoid entering the main gathering point; consider taking an alternate perimeter walkway.",
          actionType: "map",
          actionLabel: "View Crowd Zone on Map",
          actionUrl: "/app/map",
        });
      } else if (crowdDetectedCount >= 25 || crowdLevel === "Busy") {
        list.push({
          id: `proactive-crowd-${crowdMatchedLocation.id}`,
          type: "crowd",
          severity: "WARNING",
          title: "High Crowd Density Advisory",
          message: `High visitor volume detected near ${crowdMatchedLocation.name} (${crowdDetectedCount} people).`,
          whyExplanation: `Real-time YOLO computer vision streams show active pedestrian accumulation near your sector.`,
          locationName: crowdMatchedLocation.name,
          distanceMeters: crowdDistanceKm ? Math.round(crowdDistanceKm * 1000) : undefined,
          timestamp: now,
          recommendedAction: "Keep your personal belongings secure and stay alert in crowded lanes.",
          actionType: "map",
          actionLabel: "View Safe Route",
          actionUrl: "/app/map",
        });
      }
    }

    // 2. Geofence Zone Perimeter Alert
    if (currentZone) {
      if (currentZone.risk_level === "restricted") {
        list.push({
          id: `proactive-zone-${currentZone.id}`,
          type: "geofence",
          severity: "CRITICAL",
          title: `Monitored Restricted Zone: ${currentZone.name}`,
          message: currentZone.description || "You have entered a restricted or high-caution tourist perimeter.",
          whyExplanation: `Your live satellite coordinates are currently located inside the geofenced boundary of ${currentZone.name}.`,
          locationName: currentZone.name,
          timestamp: now,
          recommendedAction: "Follow official signage, avoid isolated areas after dusk, and maintain emergency communication.",
          actionType: "guidance",
          actionLabel: "Zone Safety Rules",
        });
      } else if (currentZone.risk_level === "caution") {
        list.push({
          id: `proactive-zone-${currentZone.id}`,
          type: "geofence",
          severity: "CAUTION",
          title: `Caution Zone: ${currentZone.name}`,
          message: currentZone.description || "Exercise elevated situational awareness in this vicinity.",
          whyExplanation: `Automated geofence detection triggered upon entry into ${currentZone.name}.`,
          locationName: currentZone.name,
          timestamp: now,
          recommendedAction: "Stay within monitored tourist paths and keep emergency contacts handy.",
          actionType: "map",
          actionLabel: "View Zone Boundary",
          actionUrl: "/app/map",
        });
      }
    }

    // 3. Severe Weather Hazard Warning
    if (weatherData) {
      if (weatherData.weatherCode >= 95 || weatherData.weatherCode === 65 || weatherData.weatherCode === 82) {
        list.push({
          id: "proactive-weather-storm",
          type: "weather",
          severity: "WARNING",
          title: `Severe Weather Warning: ${weatherData.text}`,
          message: `Active thunderstorm and heavy precipitation detected at your coordinates (${weatherData.temp}°C).`,
          whyExplanation: `Live meteorological radar reports active severe convective precipitation impacting your GPS grid.`,
          locationName: cityArea || "Current Area",
          timestamp: now,
          recommendedAction: "Seek covered shelter immediately; avoid standing beneath tall trees or near coastal breakwaters.",
          actionType: "guidance",
          actionLabel: "Storm Safety Tips",
        });
      }
    }

    // 4. Intelligent Night Safety Advisory (8:00 PM – 6:00 AM)
    const currentHour = new Date().getHours();
    const isNight = currentHour >= 20 || currentHour < 6;
    if (isNight && nearestPolice && nearestPolice.distanceMeters > 2000) {
      list.push({
        id: "proactive-night-safety",
        type: "night",
        severity: "CAUTION",
        title: "Nighttime Travel Advisory",
        message: `It is after dark with limited immediate police post coverage (${(nearestPolice.distanceMeters / 1000).toFixed(1)} km to ${nearestPolice.station.name}).`,
        whyExplanation: `Night safety heuristic computed based on local hour (${format(new Date(), "h:mm a")}) and distance to nearest verified police unit.`,
        locationName: locationTitle !== "Detecting your location..." ? locationTitle : "Current Sector",
        distanceMeters: nearestPolice.distanceMeters,
        timestamp: now,
        recommendedAction: "Use registered prepaid transport or stay along brightly lit arterial roads.",
        actionType: "helpline",
        actionLabel: "Emergency Helpline",
      });
    }

    return list;
  }, [
    isCrowdLive,
    crowdDetectedCount,
    crowdLevel,
    crowdMatchedLocation,
    crowdDistanceKm,
    currentZone,
    weatherData,
    cityArea,
    nearestPolice,
    locationTitle,
  ]);

  // Combined counts & filters
  const unreadCount = useMemo(() => {
    const activeDbCount = dbAlerts.filter((a) => a.status === "active").length;
    return activeDbCount + proactiveAlerts.length;
  }, [dbAlerts, proactiveAlerts]);

  const toggleWhy = (id: string) => {
    setExpandedWhyIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getSeverityStyle = (sev: AlertSeverity) => {
    switch (sev) {
      case "EMERGENCY":
      case "CRITICAL":
        return {
          border: "border-[#E94B5F]/40",
          bg: "bg-[#E94B5F]/5",
          badgeBg: "bg-[#E94B5F]/15",
          badgeText: "text-[#E94B5F]",
          icon: ShieldAlert,
          iconColor: "text-[#E94B5F]",
        };
      case "WARNING":
        return {
          border: "border-[#FF6F61]/40",
          bg: "bg-[#FF6F61]/5",
          badgeBg: "bg-[#FF6F61]/15",
          badgeText: "text-[#FF6F61]",
          icon: AlertTriangle,
          iconColor: "text-[#FF6F61]",
        };
      case "CAUTION":
        return {
          border: "border-[#F2A93B]/40",
          bg: "bg-[#F2A93B]/5",
          badgeBg: "bg-[#F2A93B]/15",
          badgeText: "text-[#F2A93B]",
          icon: AlertTriangle,
          iconColor: "text-[#F2A93B]",
        };
      case "INFO":
      default:
        return {
          border: "border-[#39B86B]/40",
          bg: "bg-[#39B86B]/5",
          badgeBg: "bg-[#39B86B]/15",
          badgeText: "text-[#39B86B]",
          icon: Info,
          iconColor: "text-[#39B86B]",
        };
    }
  };

  return (
    <div className="space-y-6 pb-28 lg:pb-12 text-[#1E1E1E]">
      {/* ========================================================================= */}
      {/* 1. MODULE HEADER & LIVE SENSOR STATUS BAR */}
      {/* ========================================================================= */}
      <div className="rounded-[32px] border border-[#F6B28F]/30 bg-gradient-to-br from-white via-[#FFF8F3] to-[#FFF1EA] p-6 sm:p-8 shadow-[0_12px_40px_rgba(255,111,97,0.06)]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#FF6F61]/10 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-[#FF6F61] border border-[#FF6F61]/20">
              <Sparkles className="h-3.5 w-3.5" />
              <span>BEACON Safety System</span>
            </div>

            <h1 className="mt-2.5 text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-[#1E1E1E]">
              Alerts & Incident Response
            </h1>
            <p className="mt-1 text-xs sm:text-sm font-medium text-[#77716D]">
              Real-time surrounding intelligence, automatic threat detection, and live SOS coordination.
            </p>
          </div>

          {/* Unread Alerts Badge */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="rounded-2xl border border-[#F6B28F]/30 bg-white/90 px-4 py-2.5 shadow-sm flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF6F61]/10 text-[#FF6F61]">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#77716D] block">
                  Active Alerts
                </span>
                <span className="text-base font-black text-[#1E1E1E]">
                  {unreadCount} {unreadCount === 1 ? "Threat / Notice" : "Threats / Notices"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Safety Signals Status Row */}
        <div className="mt-6 pt-4 border-t border-[#F6B28F]/20 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          {/* Signal 1: GPS */}
          <div className="flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 border border-[#F6B28F]/20">
            <span
              className={`h-2 w-2 rounded-full ${
                geoStatus === "success" ? "bg-[#39B86B] animate-ping" : "bg-[#F2A93B]"
              }`}
            />
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-black text-[#77716D] block uppercase">Live GPS</span>
              <span className="font-bold text-[#1E1E1E] truncate block" title={locationTitle}>
                {locationTitle}
              </span>
            </div>
          </div>

          {/* Signal 2: CrowdX */}
          <div className="flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 border border-[#F6B28F]/20">
            <span
              className={`h-2 w-2 rounded-full ${
                isCrowdLive ? "bg-[#39B86B] animate-ping" : "bg-[#77716D]"
              }`}
            />
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-black text-[#77716D] block uppercase">CrowdX YOLO</span>
              <span className="font-bold text-[#1E1E1E] truncate block">
                {isCrowdLive ? `${crowdDetectedCount ?? 0} Detected` : "Offline"}
              </span>
            </div>
          </div>

          {/* Signal 3: Weather Radar */}
          <div className="flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 border border-[#F6B28F]/20">
            <span
              className={`h-2 w-2 rounded-full ${
                weatherData ? "bg-[#39B86B]" : "bg-[#77716D]"
              }`}
            />
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-black text-[#77716D] block uppercase">Weather Feed</span>
              <span className="font-bold text-[#1E1E1E] truncate block">
                {weatherData ? `${weatherData.temp}°C · ${weatherData.text}` : "Unavailable"}
              </span>
            </div>
          </div>

          {/* Signal 4: Emergency Response Network */}
          <div className="flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 border border-[#F6B28F]/20">
            <span className="h-2 w-2 rounded-full bg-[#39B86B] animate-pulse" />
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-black text-[#77716D] block uppercase">Police Network</span>
              <span className="font-bold text-[#1E1E1E] truncate block">
                {nearestPolice ? nearestPolice.station.name : "Active 24/7"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ACTIVE SOS INCIDENT LIFECYCLE BANNER (WHEN SOS IS ACTIVE) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {activeSosIncident && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            className="relative overflow-hidden rounded-[32px] border-2 border-[#E94B5F] bg-gradient-to-br from-[#FFF5F5] via-white to-[#FFF1EA] p-6 sm:p-8 shadow-[0_16px_50px_rgba(233,75,95,0.18)]"
          >
            {/* Ambient Red Alert Pulse */}
            <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#E94B5F]/15 blur-3xl animate-pulse" />

            <div className="relative space-y-5">
              {/* Header Badge */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E94B5F]/20 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E94B5F] text-white shadow-md shadow-[#E94B5F]/30 animate-pulse">
                    <ShieldAlert className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base sm:text-lg font-black text-[#E94B5F] tracking-wide">
                        🚨 EMERGENCY SOS ACTIVE
                      </span>
                      <span className="rounded-full bg-[#E94B5F] px-2 py-0.5 text-[9px] font-black text-white uppercase tracking-wider">
                        LIVE CASE
                      </span>
                    </div>
                    <p className="text-xs text-[#77716D]">
                      Incident ID: #{activeSosIncident.id.slice(0, 8).toUpperCase()} · Created{" "}
                      {formatDistanceToNow(new Date(activeSosIncident.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>

                {/* Cancel SOS Button */}
                <button
                  onClick={() => {
                    setCancellingSosId(activeSosIncident.id);
                    setCancelModalOpen(true);
                  }}
                  className="rounded-xl border border-[#E94B5F]/30 bg-white px-3.5 py-1.5 text-xs font-bold text-[#E94B5F] hover:bg-[#E94B5F]/10 transition-colors cursor-pointer"
                >
                  Cancel SOS (Safe Now)
                </button>
              </div>

              {/* Real-time Incident Lifecycle Stepper */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#77716D]">
                  INCIDENT RESPONSE PROGRESSION
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {/* Step 1: SOS Sent */}
                  <div className="rounded-2xl border border-[#39B86B]/40 bg-[#39B86B]/10 p-3 text-left">
                    <div className="flex items-center gap-1.5 text-[#39B86B]">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-xs font-black uppercase">1. SOS Sent</span>
                    </div>
                    <p className="mt-1 text-[10px] text-[#77716D]">
                      GPS {activeSosIncident.lat?.toFixed(4)}, {activeSosIncident.lng?.toFixed(4)}
                    </p>
                  </div>

                  {/* Step 2: Acknowledged */}
                  <div
                    className={`rounded-2xl border p-3 text-left transition-colors ${
                      activeSosIncident.status === "acknowledged" || activeSosIncident.status === "dispatched"
                        ? "border-[#39B86B]/40 bg-[#39B86B]/10"
                        : "border-black/10 bg-black/5"
                    }`}
                  >
                    <div
                      className={`flex items-center gap-1.5 ${
                        activeSosIncident.status === "acknowledged" || activeSosIncident.status === "dispatched"
                          ? "text-[#39B86B]"
                          : "text-[#77716D]"
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-xs font-black uppercase">2. Acknowledged</span>
                    </div>
                    <p className="mt-1 text-[10px] text-[#77716D]">
                      {activeSosIncident.status === "acknowledged" || activeSosIncident.status === "dispatched"
                        ? "Control Room Verified"
                        : "Awaiting Officer"}
                    </p>
                  </div>

                  {/* Step 3: Dispatched */}
                  <div
                    className={`rounded-2xl border p-3 text-left transition-colors ${
                      activeSosIncident.status === "dispatched"
                        ? "border-[#E94B5F]/40 bg-[#E94B5F]/10 animate-pulse"
                        : "border-black/10 bg-black/5"
                    }`}
                  >
                    <div
                      className={`flex items-center gap-1.5 ${
                        activeSosIncident.status === "dispatched" ? "text-[#E94B5F]" : "text-[#77716D]"
                      }`}
                    >
                      <Radio className="h-4 w-4" />
                      <span className="text-xs font-black uppercase">3. Dispatched</span>
                    </div>
                    <p className="mt-1 text-[10px] text-[#77716D]">
                      {activeSosIncident.status === "dispatched" ? "Patrol Unit En Route" : "Pending Unit"}
                    </p>
                  </div>

                  {/* Step 4: Resolved */}
                  <div className="rounded-2xl border border-black/10 bg-black/5 p-3 text-left">
                    <div className="flex items-center gap-1.5 text-[#77716D]">
                      <ShieldCheck className="h-4 w-4" />
                      <span className="text-xs font-black uppercase">4. Resolved</span>
                    </div>
                    <p className="mt-1 text-[10px] text-[#77716D]">Pending Final Verification</p>
                  </div>
                </div>
              </div>

              {/* Status Explanation Card & Emergency Helplines */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-white/95 p-4 border border-[#E94B5F]/20">
                <div className="space-y-1 text-left">
                  <p className="text-xs font-black text-[#1E1E1E]">
                    {activeSosIncident.status === "dispatched"
                      ? "🚨 POLICE DISPATCH CONFIRMED: Units are navigating toward your coordinates."
                      : activeSosIncident.status === "acknowledged"
                        ? "⚠️ ACKNOWLEDGED: Nearest police station has received your emergency alert."
                        : "⏳ TRANSMITTED: Awaiting officer assignment at Chennai Police Control Room."}
                  </p>
                  <p className="text-[11px] text-[#77716D]">
                    Nearest Division: {nearestPolice ? nearestPolice.station.name : "Tamil Nadu Coastal Guard"} (
                    {nearestPolice ? `${(nearestPolice.distanceMeters / 1000).toFixed(1)} km away` : "Active"}
                    )
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href="tel:112"
                    className="flex items-center gap-1.5 rounded-xl bg-[#E94B5F] px-4 py-2 text-xs font-black text-white shadow-md shadow-[#E94B5F]/30 hover:bg-[#D4384C] transition-colors"
                  >
                    <PhoneCall className="h-3.5 w-3.5" />
                    <span>Call Police (112)</span>
                  </a>
                  <a
                    href="tel:1363"
                    className="flex items-center gap-1.5 rounded-xl bg-[#FFF8F3] border border-[#F6B28F]/40 px-3.5 py-2 text-xs font-bold text-[#1E1E1E] hover:bg-white transition-colors"
                  >
                    <span>Helpline (1363)</span>
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 3. PROACTIVE SAFETY ALERTS FEED (LIVE SENSORS) */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-[#1E1E1E]">
              Proactive Safety Intelligence
            </h2>
            <p className="text-xs text-[#77716D]">
              Automated alerts triggered by your current surroundings, CrowdX sensors, and weather.
            </p>
          </div>

          <span className="text-xs font-bold text-[#FF6F61] bg-[#FF6F61]/10 px-2.5 py-1 rounded-full border border-[#FF6F61]/20">
            {proactiveAlerts.length} Active Notice{proactiveAlerts.length === 1 ? "" : "s"}
          </span>
        </div>

        {/* Proactive Alerts Grid */}
        {proactiveAlerts.length > 0 ? (
          <div className="space-y-3">
            {proactiveAlerts.map((alert) => {
              const style = getSeverityStyle(alert.severity);
              const isWhyOpen = expandedWhyIds[alert.id];

              return (
                <div
                  key={alert.id}
                  className={`rounded-3xl border ${style.border} ${style.bg} p-5 shadow-sm transition-all text-left bg-white/95 backdrop-blur-xs`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${style.badgeBg} ${style.iconColor}`}
                      >
                        <style.icon className="h-5 w-5" />
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${style.badgeBg} ${style.badgeText}`}
                          >
                            {alert.severity}
                          </span>
                          <span className="text-xs font-bold text-[#77716D] flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {alert.locationName}
                            {alert.distanceMeters && (
                              <span>· {(alert.distanceMeters / 1000).toFixed(1)} km</span>
                            )}
                          </span>
                        </div>

                        <h3 className="text-base font-black text-[#1E1E1E]">{alert.title}</h3>
                        <p className="text-xs text-[#77716D] leading-relaxed max-w-2xl">
                          {alert.message}
                        </p>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="flex items-center gap-2 sm:self-start shrink-0 pt-2 sm:pt-0">
                      {alert.actionType === "map" && (
                        <Link
                          to={alert.actionUrl || "/app/map"}
                          className="flex items-center gap-1.5 rounded-xl bg-[#FF6F61] px-3.5 py-2 text-xs font-black text-white shadow-xs hover:bg-[#FF8577] transition-all cursor-pointer"
                        >
                          <span>{alert.actionLabel}</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      )}

                      {alert.actionType === "guidance" && (
                        <button
                          onClick={() =>
                            setGuidanceModalData({
                              title: alert.title,
                              desc: alert.recommendedAction,
                            })
                          }
                          className="flex items-center gap-1.5 rounded-xl bg-[#FFF8F3] border border-[#F6B28F]/40 px-3.5 py-2 text-xs font-black text-[#1E1E1E] hover:bg-white transition-all cursor-pointer"
                        >
                          <Zap className="h-3.5 w-3.5 text-[#F2A93B]" />
                          <span>{alert.actionLabel}</span>
                        </button>
                      )}

                      {alert.actionType === "helpline" && (
                        <a
                          href="tel:112"
                          className="flex items-center gap-1.5 rounded-xl bg-[#39B86B] px-3.5 py-2 text-xs font-black text-white shadow-xs hover:bg-[#32A55F] transition-all"
                        >
                          <PhoneCall className="h-3.5 w-3.5" />
                          <span>Call 112</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Recommended Safety Action Box */}
                  <div className="mt-3.5 rounded-2xl bg-[#FFF8F3] p-3 border border-[#F6B28F]/25 flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-[#FF6F61]/15 text-[#FF6F61] text-[10px] font-black">
                      ✓
                    </span>
                    <p className="text-xs font-bold text-[#1E1E1E]">
                      <span className="text-[#77716D] font-medium mr-1.5">Recommended Action:</span>
                      {alert.recommendedAction}
                    </p>
                  </div>

                  {/* "Why am I seeing this?" Expandable Accordion */}
                  <div className="mt-2.5 pt-2 border-t border-black/5">
                    <button
                      onClick={() => toggleWhy(alert.id)}
                      className="flex items-center gap-1 text-[11px] font-bold text-[#77716D] hover:text-[#1E1E1E] transition-colors cursor-pointer"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      <span>Why am I seeing this?</span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${isWhyOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    <AnimatePresence>
                      {isWhyOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <p className="mt-1.5 text-xs text-[#77716D] bg-white p-2.5 rounded-xl border border-black/5 italic">
                            {alert.whyExplanation}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Reassuring Empty State: ALL CLEAR */
          <div className="rounded-3xl border border-[#39B86B]/30 bg-gradient-to-br from-white to-[#F0FDF4] p-8 text-center shadow-sm space-y-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#39B86B]/15 text-[#39B86B]">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-black text-[#1E1E1E]">🛡️ ALL CLEAR — Surroundings Monitored</h3>
            <p className="text-xs text-[#77716D] max-w-md mx-auto">
              No active safety hazards detected around {locationTitle !== "Detecting your location..." ? locationTitle : "your current area"}. BEACON is actively guarding your trip.
            </p>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. EMERGENCY SOS TRIGGER CARD (SAFEGUARDED WITH 3-SEC COUNTDOWN) */}
      {/* ========================================================================= */}
      {!activeSosIncident && (
        <div className="rounded-3xl border border-[#F6B28F]/30 bg-gradient-to-br from-[#FFF5F5] via-white to-[#FFF8F3] p-6 sm:p-7 shadow-sm text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#E94B5F] animate-ping" />
                <h3 className="text-base sm:text-lg font-black text-[#1E1E1E]">
                  Need Immediate Emergency Help?
                </h3>
              </div>
              <p className="text-xs text-[#77716D] max-w-xl">
                Pressing Emergency SOS transmits your live satellite coordinates and Digital ID details directly to the Tamil Nadu Police command room.
              </p>
            </div>

            <button
              onClick={handleStartSosFlow}
              disabled={isTriggeringSos}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#E94B5F] to-[#FF6F61] px-6 py-3 text-sm font-black text-white shadow-lg shadow-[#E94B5F]/30 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer shrink-0 disabled:opacity-70"
            >
              <ShieldAlert className="h-5 w-5 animate-pulse" />
              <span>Trigger Emergency SOS</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. INCIDENT & ALERT LOG HISTORY (DATABASE DRIVEN) */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-[#1E1E1E]">Incident & Alert Log</h2>
            <p className="text-xs text-[#77716D]">
              Historical chronological audit of your SOS transmissions and alerts.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 rounded-2xl bg-[#FFF8F3] p-1 border border-[#F6B28F]/30 text-xs">
            {(["all", "sos", "active"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-xl px-3 py-1.5 font-bold capitalize transition-all cursor-pointer ${
                  activeTab === tab
                    ? "bg-white text-[#1E1E1E] shadow-xs"
                    : "text-[#77716D] hover:text-[#1E1E1E]"
                }`}
              >
                {tab === "all" ? "All History" : tab === "sos" ? "SOS Logs" : "Active Only"}
              </button>
            ))}
          </div>
        </div>

        {/* Database Alerts List */}
        {alertsLoading ? (
          <div className="rounded-3xl border border-[#F6B28F]/30 bg-white p-8 text-center text-xs text-[#77716D]">
            Loading alert log...
          </div>
        ) : dbAlerts.length === 0 ? (
          <div className="rounded-3xl border border-[#F6B28F]/30 bg-white/80 p-8 text-center space-y-1">
            <p className="text-sm font-bold text-[#1E1E1E]">No past incidents recorded</p>
            <p className="text-xs text-[#77716D]">
              Your account has zero recorded distress signals. Safe travels!
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {dbAlerts
              .filter((a) => {
                if (activeTab === "sos") return a.type === "sos";
                if (activeTab === "active") return a.status === "active";
                return true;
              })
              .map((alertItem) => {
                const isSos = alertItem.type === "sos";
                const isResolved = alertItem.status === "resolved" || alertItem.status === "cancelled";

                return (
                  <div
                    key={alertItem.id}
                    className={`rounded-2xl border p-4 text-left transition-all bg-white/95 shadow-2xs ${
                      isSos && !isResolved
                        ? "border-[#E94B5F]/40 bg-[#FFF5F5]/60"
                        : "border-[#F6B28F]/25 hover:border-[#F6B28F]/50"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                              isSos
                                ? "bg-[#E94B5F]/15 text-[#E94B5F]"
                                : "bg-blue-500/15 text-blue-600"
                            }`}
                          >
                            {alertItem.type.toUpperCase()}
                          </span>

                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                              alertItem.status === "dispatched"
                                ? "bg-[#E94B5F] text-white"
                                : alertItem.status === "acknowledged"
                                  ? "bg-[#39B86B]/20 text-[#39B86B]"
                                  : alertItem.status === "active"
                                    ? "bg-[#F2A93B]/20 text-[#F2A93B]"
                                    : "bg-black/10 text-[#77716D]"
                            }`}
                          >
                            {alertItem.status}
                          </span>

                          <span className="text-[11px] text-[#77716D]">
                            {formatDistanceToNow(new Date(alertItem.created_at), { addSuffix: true })}
                          </span>
                        </div>

                        <p className="text-xs sm:text-sm font-bold text-[#1E1E1E]">
                          {alertItem.message ?? "Emergency safety dispatch"}
                        </p>
                      </div>

                      {/* Coordinates & Map Link */}
                      <div className="flex items-center gap-3 self-start sm:self-center shrink-0">
                        {alertItem.lat && alertItem.lng && (
                          <a
                            href={`https://www.google.com/maps?q=${alertItem.lat},${alertItem.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[11px] font-bold text-[#FF6F61] hover:underline"
                          >
                            <MapPin className="h-3 w-3" />
                            <span>
                              {alertItem.lat.toFixed(4)}, {alertItem.lng.toFixed(4)}
                            </span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 6. SOS 3-SECOND COUNTDOWN SAFEGUARD MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {sosCountdownActive && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-x-4 top-[20%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 w-full max-w-md rounded-[36px] border-2 border-[#E94B5F] bg-white p-7 text-center shadow-2xl space-y-5"
            >
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#E94B5F]/15 text-[#E94B5F]">
                <span className="text-3xl font-black">{sosCountdownSeconds}</span>
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-black text-[#E94B5F]">Transmitting SOS in {sosCountdownSeconds}s</h3>
                <p className="text-xs text-[#77716D]">
                  Emergency alert with your live GPS location will be broadcast to Tamil Nadu Police.
                </p>
              </div>

              <div className="rounded-2xl bg-[#FFF8F3] p-3 text-xs text-left border border-[#F6B28F]/30 space-y-1">
                <p className="font-bold text-[#1E1E1E]">📍 Target GPS: {locationTitle}</p>
                <p className="text-[11px] text-[#77716D]">
                  Coordinates: {coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : `${effective.lat.toFixed(4)}, ${effective.lng.toFixed(4)}`}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleCancelSosCountdown}
                  className="w-full rounded-2xl bg-black/10 py-3 text-xs font-black text-[#1E1E1E] hover:bg-black/20 transition-colors cursor-pointer"
                >
                  Cancel Immediately
                </button>
                <button
                  onClick={() => {
                    setSosCountdownActive(false);
                    void executeSosDispatch();
                  }}
                  className="w-full rounded-2xl bg-[#E94B5F] py-3 text-xs font-black text-white shadow-lg shadow-[#E94B5F]/30 hover:bg-[#D4384C] transition-colors cursor-pointer"
                >
                  Send Right Now
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 7. CANCEL SOS CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {cancelModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCancelModalOpen(false)}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              className="fixed inset-x-4 top-[25%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 w-full max-w-md rounded-[32px] border border-[#F6B28F]/40 bg-white p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-black/5 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#39B86B]/15 text-[#39B86B]">
                    <CheckCircle2 className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-[#1E1E1E]">Confirm Safety Status</h3>
                    <p className="text-xs text-[#77716D]">Cancel Active Emergency Signal</p>
                  </div>
                </div>
                <button
                  onClick={() => setCancelModalOpen(false)}
                  className="rounded-full p-1.5 text-[#77716D] hover:bg-black/5 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-xs text-[#77716D] text-left">
                Are you sure you want to cancel this SOS incident? This will notify emergency response units that you are safe.
              </p>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setCancelModalOpen(false)}
                  className="w-full rounded-2xl bg-black/5 py-2.5 text-xs font-bold text-[#1E1E1E] hover:bg-black/10 transition-colors cursor-pointer"
                >
                  Keep Active
                </button>
                <button
                  onClick={handleConfirmCancelSos}
                  className="w-full rounded-2xl bg-[#39B86B] py-2.5 text-xs font-black text-white shadow-md shadow-[#39B86B]/25 hover:bg-[#32A55F] transition-colors cursor-pointer"
                >
                  Yes, I am Safe
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 8. GUIDANCE / SAFETY DETAILS MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {guidanceModalData && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setGuidanceModalData(null)}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              className="fixed inset-x-4 top-[20%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 w-full max-w-lg rounded-[32px] border border-[#F6B28F]/40 bg-white p-6 shadow-2xl space-y-4 text-left"
            >
              <div className="flex items-center justify-between border-b border-black/5 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
                    <Zap className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-[#1E1E1E]">Safety Guidance</h3>
                    <p className="text-xs text-[#77716D]">{guidanceModalData.title}</p>
                  </div>
                </div>
                <button
                  onClick={() => setGuidanceModalData(null)}
                  className="rounded-full p-1.5 text-[#77716D] hover:bg-black/5 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="rounded-2xl bg-[#FFF8F3] p-4 border border-[#F6B28F]/30 text-xs text-[#1E1E1E] leading-relaxed">
                {guidanceModalData.desc}
              </div>

              <button
                onClick={() => setGuidanceModalData(null)}
                className="w-full rounded-2xl bg-gradient-to-r from-[#FF6F61] to-[#F6B28F] py-2.5 text-xs font-black text-white shadow-md shadow-[#FF6F61]/25 hover:shadow-lg cursor-pointer"
              >
                Understood, Close
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
