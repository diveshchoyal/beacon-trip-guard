import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow, format } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  CloudRain,
  CloudSun,
  ExternalLink,
  Eye,
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
  Trash2,
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
  useNearbyPolice,
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
  isSimulated?: boolean;
}

const READ_ALERTS_KEY = "beacon_read_alert_ids_v1";
const CLEARED_PROACTIVE_KEY = "beacon_cleared_proactive_ids_v1";

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
    userLat: coords?.lat,
    userLng: coords?.lng,
    hasLocationPermission: geoStatus !== "denied",
  });

  // Dynamic real-time OSM Overpass/Places nearest police discovery
  const { nearestPolice } = useNearbyPolice(coords?.lat, coords?.lng);

  // Local UI states
  const [activeTab, setActiveTab] = useState<"all" | "active" | "sos" | "advisories">("all");
  const [expandedWhyIds, setExpandedWhyIds] = useState<Record<string, boolean>>({});
  const [guidanceModalData, setGuidanceModalData] = useState<{
    title: string;
    desc: string;
  } | null>(null);

  // Read / Unread State in localStorage
  const [readAlertIds, setReadAlertIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(READ_ALERTS_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Cleared Proactive Alerts in localStorage
  const [clearedProactiveIds, setClearedProactiveIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(CLEARED_PROACTIVE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Developer Test / Simulation Mode for Weather & Crowd
  const [simulateWeatherHazard, setSimulateWeatherHazard] = useState(false);
  const [simulateCrowdSurge, setSimulateCrowdSurge] = useState(false);

  // Clear Alerts Confirmation Modal
  const [clearConfirmModalOpen, setClearConfirmModalOpen] = useState(false);
  const [isClearingAlerts, setIsClearingAlerts] = useState(false);

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
    windSpeed?: number;
  } | null>(null);

  useEffect(() => {
    let active = true;
    async function loadWeather() {
      if (!coords || geoStatus === "denied" || geoStatus === "error") return;
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current_weather=true`,
          { signal: AbortSignal.timeout(5000) },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (active && data?.current_weather) {
          const temp = Math.round(data.current_weather.temperature);
          const code = data.current_weather.weathercode;
          const windSpeed = data.current_weather.windspeed;
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

          setWeatherData({ temp, text, weatherCode: code, windSpeed });
        }
      } catch {
        // Handled gracefully without throwing
      }
    }
    void loadWeather();
    return () => {
      active = false;
    };
  }, [coords, geoStatus]);

  // Load user alerts from Supabase
  const { data: dbAlerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ["my-alerts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("alerts")
          .select("*")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false });
        if (error) return [];
        return data ?? [];
      } catch {
        return [];
      }
    },
  });

  // Load geofence zones from Supabase
  const { data: zones = [] } = useQuery({
    queryKey: ["zones"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from("geofence_zones").select("*");
        if (error) return [];
        return data ?? [];
      } catch {
        return [];
      }
    },
  });

  // Real-time Postgres subscription to alerts table
  useEffect(() => {
    try {
      const channel = supabase
        .channel("tourist-alerts-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, (payload) => {
          void queryClient.invalidateQueries({ queryKey: ["my-alerts"] });
          void queryClient.invalidateQueries({ queryKey: ["unread-alerts-count"] });

          if (payload.eventType === "UPDATE" && payload.new) {
            const updated = payload.new as { status?: string; type?: string };
            if (updated.status === "acknowledged") {
              toast.info("Control Room has acknowledged your alert");
            } else if (updated.status === "dispatched") {
              toast.success(
                "Police emergency response unit has been dispatched to your live coordinates",
              );
            } else if (updated.status === "resolved") {
              toast.success("Incident has been marked resolved");
            }
          }
        })
        .subscribe();

      return () => {
        void supabase.removeChannel(channel);
      };
    } catch {
      // Ignore channel errors gracefully
    }
  }, [queryClient]);

  // Active SOS Incident (latest non-resolved SOS)
  const activeSosIncident = useMemo(() => {
    if (!dbAlerts) return null;
    return dbAlerts.find(
      (a) =>
        a.type === "sos" &&
        (a.status === "active" || a.status === "acknowledged" || a.status === "dispatched"),
    );
  }, [dbAlerts]);

  // Current Geofence Zone evaluation
  const currentZone = useMemo(() => {
    if (!coords) return undefined;
    return zones.find((z) => inZone(coords, z));
  }, [zones, coords]);

  // =========================================================================
  // READ / UNREAD LOGIC
  // =========================================================================
  const markAlertAsRead = useCallback((alertId: string) => {
    setReadAlertIds((prev) => {
      if (prev.has(alertId)) return prev;
      const next = new Set(prev);
      next.add(alertId);
      try {
        localStorage.setItem(READ_ALERTS_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // localStorage fallback
      }
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setReadAlertIds((prev) => {
      const next = new Set(prev);
      dbAlerts.forEach((a) => next.add(a.id));
      try {
        localStorage.setItem(READ_ALERTS_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // localStorage fallback
      }
      return next;
    });
    toast.success("All alerts marked as read");
  }, [dbAlerts]);

  // =========================================================================
  // CLEAR ALERTS HANDLER (PRESERVES ACTIVE SOS)
  // =========================================================================
  const handleConfirmClearAlerts = async () => {
    if (!user) {
      setClearConfirmModalOpen(false);
      return;
    }
    setIsClearingAlerts(true);

    try {
      // 1. Delete all non-SOS alerts for this user from database
      const { error: delError } = await supabase
        .from("alerts")
        .delete()
        .eq("user_id", user.id)
        .neq("type", "sos");

      // 2. Also delete resolved or cancelled SOS alerts (keeping ONLY active/dispatched SOS)
      await supabase
        .from("alerts")
        .delete()
        .eq("user_id", user.id)
        .eq("type", "sos")
        .in("status", ["resolved", "cancelled"]);

      // 3. Clear proactive alerts in local state
      setClearedProactiveIds((prev) => {
        const next = new Set(prev);
        // add current proactive ids
        try {
          localStorage.setItem(CLEARED_PROACTIVE_KEY, JSON.stringify(Array.from(next)));
        } catch {
          // localStorage fallback
        }
        return next;
      });

      if (delError) {
        toast.error(`Clear failed: ${delError.message}`);
      } else {
        toast.success("Safety alert history cleared");
      }

      void queryClient.invalidateQueries({ queryKey: ["my-alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["unread-alerts-count"] });
    } catch {
      toast.error("Failed to clear alerts");
    } finally {
      setIsClearingAlerts(false);
      setClearConfirmModalOpen(false);
    }
  };

  // =========================================================================
  // SOS DISPATCH & COUNTDOWN HANDLER
  // =========================================================================
  const executeSosDispatch = useCallback(async () => {
    if (!user) return;
    setIsTriggeringSos(true);

    const locName =
      locationTitle !== "Detecting your location..." ? locationTitle : "Live GPS Coordinate";

    // Query if tourist has an active Digital ID to attach verified status
    const { data: digIdRow } = await supabase
      .from("digital_ids")
      .select("digital_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const idTag = digIdRow?.digital_id ? ` [Verified Digital ID: ${digIdRow.digital_id} ✓]` : "";

    const { error } = await supabase.from("alerts").insert({
      user_id: user.id,
      type: "sos",
      message: currentZone
        ? `Emergency SOS triggered in ${currentZone.name} near ${locName}${idTag}`
        : `Emergency SOS triggered near ${locName}${idTag}`,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
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
  }, [user, coords, locationTitle, currentZone, queryClient]);

  // 3-Second Countdown Effect
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
    if (simulateCrowdSurge) {
      list.push({
        id: "simulated-crowd-surge",
        type: "crowd",
        severity: "CRITICAL",
        title: "🚨 Crowd Surge Detected (Test Simulator)",
        message:
          "Rapid increase in pedestrian congestion detected near your sector (142 people detected).",
        whyExplanation:
          "Developer simulation: CrowdX YOLO vision camera reported sudden 300% influx over standard capacity baseline.",
        locationName: crowdMatchedLocation?.name || "Marina Coastal Sector",
        distanceMeters: 450,
        timestamp: now,
        recommendedAction: "Avoid entering the main gathering hub; take alternate open avenues.",
        actionType: "map",
        actionLabel: "View Safer Route",
        actionUrl: "/app/map",
        isSimulated: true,
      });
    } else if (isCrowdLive && crowdDetectedCount !== null && crowdMatchedLocation) {
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
          recommendedAction:
            "Avoid entering the main gathering point; consider taking an alternate perimeter walkway.",
          actionType: "map",
          actionLabel: "View Crowd Zone on Map",
          actionUrl: "/app/map",
        });
      } else if (crowdDetectedCount >= 20 || crowdLevel === "Busy") {
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
          recommendedAction:
            "Keep your personal belongings secure and stay alert in crowded lanes.",
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
          message:
            currentZone.description ||
            "You have entered a restricted or high-caution tourist perimeter.",
          whyExplanation: `Your live satellite coordinates are currently located inside the geofenced boundary of ${currentZone.name}.`,
          locationName: currentZone.name,
          timestamp: now,
          recommendedAction:
            "Follow official signage, avoid isolated areas after dusk, and maintain emergency communication.",
          actionType: "guidance",
          actionLabel: "Zone Safety Rules",
        });
      } else if (currentZone.risk_level === "caution") {
        list.push({
          id: `proactive-zone-${currentZone.id}`,
          type: "geofence",
          severity: "CAUTION",
          title: `Caution Zone: ${currentZone.name}`,
          message:
            currentZone.description || "Exercise elevated situational awareness in this vicinity.",
          whyExplanation: `Automated geofence detection triggered upon entry into ${currentZone.name}.`,
          locationName: currentZone.name,
          timestamp: now,
          recommendedAction:
            "Stay within monitored tourist paths and keep emergency contacts handy.",
          actionType: "map",
          actionLabel: "View Zone Boundary",
          actionUrl: "/app/map",
        });
      }
    }

    // 3. Severe Weather Hazard Warning (Thunderstorm, Rain, Heat, or Simulator)
    if (simulateWeatherHazard) {
      list.push({
        id: "simulated-weather-hazard",
        type: "weather",
        severity: "WARNING",
        title: "🌧️ Heavy Rain & Flash Storm Alert (Test Simulator)",
        message:
          "Severe convective storm with heavy rainfall (42 mm/h) and localized waterlogging detected in your GPS grid.",
        whyExplanation:
          "Developer simulation: Open-Meteo test threshold triggered for severe convective precipitation.",
        locationName: cityArea || "Chennai North / Coastal Sector",
        timestamp: now,
        recommendedAction:
          "Seek covered shelter; avoid waterlogged underpasses and coastal breakwaters.",
        actionType: "guidance",
        actionLabel: "Storm Safety Tips",
        isSimulated: true,
      });
    } else if (weatherData) {
      if (weatherData.weatherCode >= 95) {
        list.push({
          id: "proactive-weather-storm",
          type: "weather",
          severity: "CRITICAL",
          title: `⛈️ Severe Thunderstorm Warning: ${weatherData.text}`,
          message: `Active thunderstorm and lightning activity detected in your area (${weatherData.temp}°C).`,
          whyExplanation: `Live Open-Meteo meteorological radar reports thunderstorm conditions (Code ${weatherData.weatherCode}) impacting your GPS grid.`,
          locationName: cityArea || "Current Area",
          timestamp: now,
          recommendedAction:
            "Seek indoor shelter immediately; stay away from open waters, metal structures, and tall trees.",
          actionType: "guidance",
          actionLabel: "Storm Precautions",
        });
      } else if (
        weatherData.weatherCode === 65 ||
        weatherData.weatherCode === 82 ||
        weatherData.weatherCode === 63 ||
        weatherData.weatherCode === 81
      ) {
        list.push({
          id: "proactive-weather-rain",
          type: "weather",
          severity: "WARNING",
          title: `🌧️ Heavy Rain & Wet Road Warning: ${weatherData.text}`,
          message: `Heavy rainfall affecting your area (${weatherData.temp}°C). Road visibility and traction reduced.`,
          whyExplanation: `Live meteorological station reports continuous heavy rainfall at your coordinates.`,
          locationName: cityArea || "Current Area",
          timestamp: now,
          recommendedAction: "Exercise caution while driving or walking near waterlogged zones.",
          actionType: "map",
          actionLabel: "View Weather Map",
          actionUrl: "/app/map",
        });
      } else if (weatherData.temp >= 36) {
        list.push({
          id: "proactive-weather-heat",
          type: "weather",
          severity: "CAUTION",
          title: `☀️ High Heat Advisory: ${weatherData.temp}°C`,
          message: `High ambient temperature recorded in your area. Elevated risk of dehydration.`,
          whyExplanation: `Live sensor reports temperature exceeding 36°C in your current locality.`,
          locationName: cityArea || "Current Area",
          timestamp: now,
          recommendedAction:
            "Stay well-hydrated, wear sun protection, and avoid prolonged midday sun exposure.",
          actionType: "guidance",
          actionLabel: "Heat Safety Tips",
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
        title: "🌙 Nighttime Travel Advisory",
        message: `It is after dark with limited immediate police post coverage (${(nearestPolice.distanceMeters / 1000).toFixed(1)} km to ${nearestPolice.station.name}).`,
        whyExplanation: `Night safety heuristic computed based on local hour (${format(new Date(), "h:mm a")}) and distance to nearest verified police station.`,
        locationName:
          locationTitle !== "Detecting your location..." ? locationTitle : "Current Sector",
        distanceMeters: nearestPolice.distanceMeters,
        timestamp: now,
        recommendedAction:
          "Use registered prepaid transport or stay along brightly lit arterial roads.",
        actionType: "helpline",
        actionLabel: "Emergency Helpline",
      });
    }

    return list;
  }, [
    simulateCrowdSurge,
    simulateWeatherHazard,
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
    let count = 0;
    // Count unread proactive alerts
    proactiveAlerts.forEach((a) => {
      if (!readAlertIds.has(a.id)) count++;
    });
    // Count unread active DB alerts
    dbAlerts.forEach((a) => {
      if (a.status === "active" && !readAlertIds.has(a.id)) count++;
    });
    return count;
  }, [proactiveAlerts, dbAlerts, readAlertIds]);

  const toggleWhy = (id: string) => {
    markAlertAsRead(id);
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
              Real-time surrounding intelligence, automatic threat detection, and live SOS
              coordination.
            </p>
          </div>

          {/* Action Header: Unread Count + Mark All Read + Clear Alerts */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Unread Alerts Badge */}
            <div className="rounded-2xl border border-[#F6B28F]/30 bg-white/90 px-4 py-2.5 shadow-sm flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF6F61]/10 text-[#FF6F61]">
                <Bell className="h-5 w-5" />
              </div>
              <div className="text-left">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#77716D] block">
                  Unread Alerts
                </span>
                <span className="text-base font-black text-[#1E1E1E]">
                  {unreadCount} {unreadCount === 1 ? "Notice" : "Notices"}
                </span>
              </div>
            </div>

            {/* Mark All Read Button */}
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1.5 rounded-2xl bg-white border border-[#F6B28F]/40 px-3.5 py-2.5 text-xs font-bold text-[#1E1E1E] hover:bg-[#FFF8F3] transition-colors cursor-pointer shadow-xs"
                title="Mark all as read"
              >
                <CheckCheck className="h-4 w-4 text-[#39B86B]" />
                <span className="hidden sm:inline">Mark All Read</span>
              </button>
            )}

            {/* Clear Alerts Button */}
            <button
              onClick={() => setClearConfirmModalOpen(true)}
              className="flex items-center gap-1.5 rounded-2xl bg-[#FFF5F5] border border-[#E94B5F]/30 px-3.5 py-2.5 text-xs font-bold text-[#E94B5F] hover:bg-[#FFEAEB] transition-colors cursor-pointer shadow-xs"
              title="Clear alerts history"
            >
              <Trash2 className="h-4 w-4" />
              <span>Clear Alerts</span>
            </button>
          </div>
        </div>

        {/* Live Safety Signals Status Row */}
        <div className="mt-6 pt-4 border-t border-[#F6B28F]/20 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          {/* Signal 1: GPS */}
          <div className="flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 border border-[#F6B28F]/20 text-left">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
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
          <div className="flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 border border-[#F6B28F]/20 text-left">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                isCrowdLive ? "bg-[#39B86B] animate-ping" : "bg-[#77716D]"
              }`}
            />
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-black text-[#77716D] block uppercase">
                CrowdX YOLO
              </span>
              <span className="font-bold text-[#1E1E1E] truncate block">
                {isCrowdLive ? `${crowdDetectedCount ?? 0} Detected` : "Offline"}
              </span>
            </div>
          </div>

          {/* Signal 3: Weather Radar */}
          <div className="flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 border border-[#F6B28F]/20 text-left">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                weatherData ? "bg-[#39B86B]" : "bg-[#77716D]"
              }`}
            />
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-black text-[#77716D] block uppercase">
                Weather Feed
              </span>
              <span className="font-bold text-[#1E1E1E] truncate block">
                {weatherData
                  ? `${weatherData.temp}°C · ${weatherData.text}`
                  : "Weather data unavailable"}
              </span>
            </div>
          </div>

          {/* Signal 4: Emergency Response Network */}
          <div className="flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 border border-[#F6B28F]/20 text-left">
            <span className="h-2 w-2 rounded-full bg-[#39B86B] animate-pulse shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-black text-[#77716D] block uppercase">
                Police Network
              </span>
              <span className="font-bold text-[#1E1E1E] truncate block">
                {nearestPolice ? nearestPolice.station.name : "Active 24/7"}
              </span>
            </div>
          </div>
        </div>

        {/* Developer Test Tools (Toggles to test Weather & Crowd alerts) */}
        <div className="mt-3 pt-3 border-t border-dashed border-[#F6B28F]/30 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="text-[#77716D] font-bold flex items-center gap-1">
            <Zap className="h-3.5 w-3.5 text-[#F2A93B]" />
            <span>Developer Alert Simulators:</span>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSimulateWeatherHazard((prev) => !prev);
                toast.info(
                  simulateWeatherHazard
                    ? "Weather simulation turned off"
                    : "Simulated Heavy Rain alert generated",
                );
              }}
              className={`rounded-xl px-2.5 py-1 font-bold border transition-colors cursor-pointer ${
                simulateWeatherHazard
                  ? "bg-[#FF6F61] text-white border-[#FF6F61]"
                  : "bg-white text-[#77716D] border-black/10 hover:bg-[#FFF8F3]"
              }`}
            >
              {simulateWeatherHazard ? "✓ Rain Alert Active" : "🌧️ Test Rain Alert"}
            </button>

            <button
              onClick={() => {
                setSimulateCrowdSurge((prev) => !prev);
                toast.info(
                  simulateCrowdSurge
                    ? "Crowd simulation turned off"
                    : "Simulated Crowd Surge alert generated",
                );
              }}
              className={`rounded-xl px-2.5 py-1 font-bold border transition-colors cursor-pointer ${
                simulateCrowdSurge
                  ? "bg-[#FF6F61] text-white border-[#FF6F61]"
                  : "bg-white text-[#77716D] border-black/10 hover:bg-[#FFF8F3]"
              }`}
            >
              {simulateCrowdSurge ? "✓ Surge Alert Active" : "👥 Test Crowd Surge"}
            </button>
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
                  <div className="text-left">
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
                      {formatDistanceToNow(new Date(activeSosIncident.created_at), {
                        addSuffix: true,
                      })}
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
              <div className="space-y-2 text-left">
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
                      activeSosIncident.status === "acknowledged" ||
                      activeSosIncident.status === "dispatched"
                        ? "border-[#39B86B]/40 bg-[#39B86B]/10"
                        : "border-black/10 bg-black/5"
                    }`}
                  >
                    <div
                      className={`flex items-center gap-1.5 ${
                        activeSosIncident.status === "acknowledged" ||
                        activeSosIncident.status === "dispatched"
                          ? "text-[#39B86B]"
                          : "text-[#77716D]"
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-xs font-black uppercase">2. Acknowledged</span>
                    </div>
                    <p className="mt-1 text-[10px] text-[#77716D]">
                      {activeSosIncident.status === "acknowledged" ||
                      activeSosIncident.status === "dispatched"
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
                        activeSosIncident.status === "dispatched"
                          ? "text-[#E94B5F]"
                          : "text-[#77716D]"
                      }`}
                    >
                      <Radio className="h-4 w-4" />
                      <span className="text-xs font-black uppercase">3. Dispatched</span>
                    </div>
                    <p className="mt-1 text-[10px] text-[#77716D]">
                      {activeSosIncident.status === "dispatched"
                        ? "Patrol Unit En Route"
                        : "Pending Unit"}
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
                    Nearest Division:{" "}
                    {nearestPolice ? nearestPolice.station.name : "Tamil Nadu Coastal Guard"} (
                    {nearestPolice
                      ? `${(nearestPolice.distanceMeters / 1000).toFixed(1)} km away`
                      : "Active"}
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
          <div className="text-left">
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
              const isRead = readAlertIds.has(alert.id);

              return (
                <div
                  key={alert.id}
                  onClick={() => markAlertAsRead(alert.id)}
                  className={`rounded-3xl border ${style.border} ${style.bg} p-5 shadow-sm transition-all text-left bg-white/95 backdrop-blur-xs ${
                    isRead ? "opacity-85" : "ring-1 ring-[#FF6F61]/30 shadow-md"
                  }`}
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

                          {!isRead && (
                            <span className="rounded-full bg-[#FF6F61] px-1.5 py-0.2 text-[8px] font-black text-white uppercase tracking-wider">
                              NEW
                            </span>
                          )}

                          {alert.isSimulated && (
                            <span className="rounded-full bg-amber-500/20 text-amber-700 px-1.5 py-0.2 text-[8px] font-black uppercase tracking-wider">
                              TEST MODE
                            </span>
                          )}

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
                          onClick={() => markAlertAsRead(alert.id)}
                          className="flex items-center gap-1.5 rounded-xl bg-[#FF6F61] px-3.5 py-2 text-xs font-black text-white shadow-xs hover:bg-[#FF8577] transition-all cursor-pointer"
                        >
                          <span>{alert.actionLabel}</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      )}

                      {alert.actionType === "guidance" && (
                        <button
                          onClick={() => {
                            markAlertAsRead(alert.id);
                            setGuidanceModalData({
                              title: alert.title,
                              desc: alert.recommendedAction,
                            });
                          }}
                          className="flex items-center gap-1.5 rounded-xl bg-[#FFF8F3] border border-[#F6B28F]/40 px-3.5 py-2 text-xs font-black text-[#1E1E1E] hover:bg-white transition-all cursor-pointer"
                        >
                          <Zap className="h-3.5 w-3.5 text-[#F2A93B]" />
                          <span>{alert.actionLabel}</span>
                        </button>
                      )}

                      {alert.actionType === "helpline" && (
                        <a
                          href="tel:112"
                          onClick={() => markAlertAsRead(alert.id)}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWhy(alert.id);
                      }}
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
            <h3 className="text-lg font-black text-[#1E1E1E]">
              🛡️ ALL CLEAR — Surroundings Monitored
            </h3>
            <p className="text-xs text-[#77716D] max-w-md mx-auto">
              No active safety hazards detected around{" "}
              {locationTitle !== "Detecting your location..." ? locationTitle : "your current area"}
              . BEACON is actively guarding your trip.
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
                Pressing Emergency SOS transmits your live satellite coordinates and Digital ID
                details directly to the Tamil Nadu Police command room.
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
          <div className="text-left">
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
                const isResolved =
                  alertItem.status === "resolved" || alertItem.status === "cancelled";
                const isRead = readAlertIds.has(alertItem.id);

                return (
                  <div
                    key={alertItem.id}
                    onClick={() => markAlertAsRead(alertItem.id)}
                    className={`rounded-2xl border p-4 text-left transition-all bg-white/95 shadow-2xs cursor-pointer ${
                      isSos && !isResolved
                        ? "border-[#E94B5F]/40 bg-[#FFF5F5]/60"
                        : isRead
                          ? "border-[#F6B28F]/20 opacity-80"
                          : "border-[#F6B28F]/40 shadow-xs"
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

                          {!isRead && alertItem.status === "active" && (
                            <span className="h-2 w-2 rounded-full bg-[#FF6F61]" />
                          )}

                          <span className="text-[11px] text-[#77716D]">
                            {formatDistanceToNow(new Date(alertItem.created_at), {
                              addSuffix: true,
                            })}
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
                            onClick={(e) => {
                              e.stopPropagation();
                              markAlertAsRead(alertItem.id);
                            }}
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
      {/* 6. CLEAR ALERTS CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {clearConfirmModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setClearConfirmModalOpen(false)}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              className="fixed inset-x-4 top-[25%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 w-full max-w-md rounded-[32px] border border-[#F6B28F]/40 bg-white p-6 shadow-2xl space-y-4 text-left"
            >
              <div className="flex items-center justify-between border-b border-black/5 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E94B5F]/15 text-[#E94B5F]">
                    <Trash2 className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-[#1E1E1E]">Clear Alert History</h3>
                    <p className="text-xs text-[#77716D]">Archive Non-Critical Alerts</p>
                  </div>
                </div>
                <button
                  onClick={() => setClearConfirmModalOpen(false)}
                  className="rounded-full p-1.5 text-[#77716D] hover:bg-black/5 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-xs text-[#77716D] leading-relaxed">
                Are you sure you want to clear your safety alerts? This will clear historical
                notices and resolved incidents.
                <span className="block mt-1 font-bold text-[#E94B5F]">
                  * Active Emergency SOS incidents will NOT be deleted.
                </span>
              </p>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setClearConfirmModalOpen(false)}
                  className="w-full rounded-2xl bg-black/5 py-2.5 text-xs font-bold text-[#1E1E1E] hover:bg-black/10 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={isClearingAlerts}
                  onClick={handleConfirmClearAlerts}
                  className="w-full rounded-2xl bg-[#E94B5F] py-2.5 text-xs font-black text-white shadow-md shadow-[#E94B5F]/25 hover:bg-[#D4384C] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isClearingAlerts ? "Clearing..." : "Yes, Clear Alerts"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 7. SOS 3-SECOND COUNTDOWN SAFEGUARD MODAL */}
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
                <h3 className="text-xl font-black text-[#E94B5F]">
                  Transmitting SOS in {sosCountdownSeconds}s
                </h3>
                <p className="text-xs text-[#77716D]">
                  Emergency alert with your live GPS location will be broadcast to Tamil Nadu
                  Police.
                </p>
              </div>

              <div className="rounded-2xl bg-[#FFF8F3] p-3 text-xs text-left border border-[#F6B28F]/30 space-y-1">
                <p className="font-bold text-[#1E1E1E]">📍 Target GPS: {locationTitle}</p>
                <p className="text-[11px] text-[#77716D]">
                  Coordinates:{" "}
                  {coords
                    ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
                    : "Acquiring GPS fix..."}
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
      {/* 8. CANCEL SOS CONFIRMATION MODAL */}
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
              className="fixed inset-x-4 top-[25%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 w-full max-w-md rounded-[32px] border border-[#F6B28F]/40 bg-white p-6 shadow-2xl space-y-4 text-left"
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
                Are you sure you want to cancel this SOS incident? This will notify emergency
                response units that you are safe.
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
      {/* 9. GUIDANCE / SAFETY DETAILS MODAL */}
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
