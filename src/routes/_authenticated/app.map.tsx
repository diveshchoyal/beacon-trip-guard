import { useState, useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Clock,
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
  Sun,
  Sunset,
  Moon,
  Radio,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { useGeolocation } from "@/hooks/use-geolocation";
import { BeaconMap } from "@/components/map/beacon-map";
import { GlassCard } from "@/components/ui/glass";
import {
  TAMIL_NADU_TOURIST_PLACES,
  evaluatePlaceSafety,
  type SafetyStatus,
} from "@/components/map/places-data";

/** Tamil Nadu geographical centre for optimal statewide overview on load */
const TAMIL_NADU_CENTER: [number, number] = [10.85, 78.7];
const TAMIL_NADU_INITIAL_ZOOM = 7;

export const Route = createFileRoute("/_authenticated/app/map")({
  component: TouristMap,
});

type TimePreviewMode = "live" | "morning" | "evening" | "night";

const previewOptions: Array<{
  mode: TimePreviewMode;
  label: string;
  hour?: number;
  timeDisplay: string;
  icon: typeof Sun;
}> = [
  { mode: "live", label: "Live", timeDisplay: "Live GPS Time", icon: Radio },
  { mode: "morning", label: "Morning", hour: 9, timeDisplay: "9:00 AM", icon: Sun },
  { mode: "evening", label: "Evening", hour: 19, timeDisplay: "7:00 PM", icon: Sunset },
  { mode: "night", label: "Night", hour: 23, timeDisplay: "11:00 PM", icon: Moon },
];

const filterOptions: Array<{
  status: SafetyStatus;
  label: string;
  color: string;
  activeBg: string;
  icon: typeof ShieldCheck;
}> = [
  {
    status: "safe",
    label: "Safe",
    color: "#3F9E6E",
    activeBg: "bg-[rgba(63,158,110,0.18)] border-[rgba(63,158,110,0.45)] text-[#1f6e43]",
    icon: ShieldCheck,
  },
  {
    status: "caution",
    label: "Caution",
    color: "#D7A93F",
    activeBg: "bg-[rgba(215,169,63,0.22)] border-[rgba(215,169,63,0.5)] text-[#8c6206]",
    icon: AlertTriangle,
  },
  {
    status: "restricted",
    label: "Restricted",
    color: "#C0483C",
    activeBg: "bg-[rgba(192,72,60,0.2)] border-[rgba(192,72,60,0.5)] text-[#9e2a1f]",
    icon: ShieldAlert,
  },
];

function TouristMap() {
  const { effective, error } = useGeolocation();
  const [selectedFilter, setSelectedFilter] = useState<SafetyStatus | null>(null);
  const [previewMode, setPreviewMode] = useState<TimePreviewMode>("live");
  const [liveTime, setLiveTime] = useState(() => new Date());

  // Periodically refresh the real clock every 30 seconds for live mode
  useEffect(() => {
    if (previewMode !== "live") return;
    const timer = setInterval(() => {
      setLiveTime(new Date());
    }, 30_000);
    return () => clearInterval(timer);
  }, [previewMode]);

  // Compute effective time used for evaluation (real time vs simulated demo time)
  const effectiveTime = useMemo(() => {
    if (previewMode === "live") return liveTime;
    const date = new Date(liveTime);
    const config = previewOptions.find((p) => p.mode === previewMode);
    if (config?.hour !== undefined) {
      date.setHours(config.hour, 0, 0, 0);
    }
    return date;
  }, [previewMode, liveTime]);

  // Calculate dynamic safety counts for filter buttons
  const statusCounts = useMemo(() => {
    const counts: Record<SafetyStatus, number> = { safe: 0, caution: 0, restricted: 0 };
    for (const place of TAMIL_NADU_TOURIST_PLACES) {
      const ev = evaluatePlaceSafety(place, effectiveTime);
      counts[ev.status]++;
    }
    return counts;
  }, [effectiveTime]);

  const handleFilterClick = (status: SafetyStatus) => {
    // Single-select toggle: tapping same color clears filter and shows all
    setSelectedFilter((prev) => (prev === status ? null : status));
  };

  const handlePreviewSelect = (mode: TimePreviewMode) => {
    setPreviewMode(mode);
    if (mode === "live") {
      setLiveTime(new Date());
    }
  };

  const formattedTime = effectiveTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const activePreviewConfig = previewOptions.find((p) => p.mode === previewMode)!;

  return (
    <div className="relative">
      <GlassCard className="overflow-hidden p-0">
        <div className="relative h-[75vh] min-h-[480px] w-full">
          <BeaconMap
            zones={[]} // Old static geofence zone circles removed in favor of dynamic landmark safety pins
            places={TAMIL_NADU_TOURIST_PLACES}
            center={TAMIL_NADU_CENTER}
            zoom={TAMIL_NADU_INITIAL_ZOOM}
            currentTime={effectiveTime}
            selectedStatus={selectedFilter}
            pins={[
              {
                id: "me",
                lat: effective.lat,
                lng: effective.lng,
                label: "You are here",
                sublabel: "Live GPS Location",
                tone: "self",
              },
            ]}
          />

          {/* Floating Top Bar (Filter on Left + Time Preview on Right) */}
          <div className="pointer-events-none absolute top-4 inset-x-4 z-[400] flex flex-wrap items-start justify-between gap-3">
            {/* Status Filter Panel (Top-Left) */}
            <div className="pointer-events-auto glass flex flex-wrap items-center gap-1.5 p-1.5 shadow-lg backdrop-blur-xl">
              <div className="hidden md:flex items-center gap-1 px-2 text-[11px] font-semibold text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{formattedTime}</span>
                <span className="mx-1 opacity-40">|</span>
                <span>Filter:</span>
              </div>

              {filterOptions.map(({ status, label, color, activeBg }) => {
                const isActive = selectedFilter === status;
                const count = statusCounts[status];

                return (
                  <button
                    key={status}
                    onClick={() => handleFilterClick(status)}
                    className={`group flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                      isActive
                        ? `${activeBg} shadow-sm scale-105`
                        : "border-transparent bg-white/40 hover:bg-white/75 text-foreground/80"
                    }`}
                    title={
                      isActive
                        ? `Showing ${label} places only. Click to clear filter.`
                        : `Filter by ${label} (${count} places)`
                    }
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full shrink-0 transition-transform ${
                        isActive ? "scale-110" : ""
                      }`}
                      style={{ backgroundColor: color }}
                    />
                    <span>{label}</span>
                    <span
                      className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                        isActive ? "bg-black/10 text-inherit" : "bg-black/5 text-muted-foreground"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}

              {selectedFilter && (
                <button
                  onClick={() => setSelectedFilter(null)}
                  className="rounded-xl px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer hover:bg-white/50 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Time Preview Control (Top-Right) */}
            <div className="pointer-events-auto glass flex flex-col items-end gap-1 p-1.5 shadow-lg backdrop-blur-xl">
              <div className="flex items-center gap-1">
                {previewOptions.map(({ mode, label, icon: Icon, timeDisplay }) => {
                  const isActive = previewMode === mode;

                  return (
                    <button
                      key={mode}
                      onClick={() => handlePreviewSelect(mode)}
                      className={`flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                        isActive
                          ? "border-primary/40 bg-primary text-primary-foreground shadow-sm scale-105"
                          : "border-transparent bg-white/40 hover:bg-white/75 text-foreground/80"
                      }`}
                      title={
                        mode === "live"
                          ? "Use real-time clock (auto refreshes)"
                          : `Simulate ${label} time (${timeDisplay})`
                      }
                    >
                      <Icon className="h-3 w-3" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Active Mode Indicator Label */}
              <div className="flex items-center gap-1.5 px-1.5 pt-0.5 text-[10px] font-medium text-muted-foreground">
                {previewMode === "live" ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    </span>
                    Live Mode ({formattedTime})
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600 font-semibold">
                    <span>
                      Previewing: {activePreviewConfig.label} ({activePreviewConfig.timeDisplay})
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Location Permission Fallback Banner */}
            {error && (
              <div className="pointer-events-auto mt-1 w-full glass flex items-center justify-between gap-3 px-3.5 py-2 text-xs shadow-md border-amber-500/30 bg-amber-500/10 backdrop-blur-xl rounded-xl">
                <div className="flex items-center gap-2 text-foreground/90">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="text-[11px] sm:text-xs">
                    GPS unavailable ({error}). Map is centered on default area (Chennai).
                  </span>
                </div>
                <button
                  onClick={() => {
                    if (typeof navigator !== "undefined" && navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        () => window.location.reload(),
                        () =>
                          toast.error("Please enable location permissions in browser settings."),
                      );
                    }
                  }}
                  className="shrink-0 rounded-lg bg-white/80 hover:bg-white px-2.5 py-1 font-semibold text-foreground text-[10px] shadow-sm transition-colors cursor-pointer border border-white/60"
                >
                  Enable GPS
                </button>
              </div>
            )}
          </div>

          {/* Floating Legend (Bottom-Left) */}
          <div className="pointer-events-none absolute bottom-4 left-4 z-[400] hidden sm:block">
            <div className="glass p-3 shadow-lg backdrop-blur-xl">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Live Status Legend
              </p>
              <ul className="mt-2 space-y-1.5">
                <li className="flex items-center gap-2 text-xs text-foreground">
                  <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#2563EB]" />
                  </span>
                  <span>Your Location</span>
                </li>
                <li className="flex items-center gap-2 text-xs text-foreground">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: "#3F9E6E" }}
                  />
                  <span>Safe</span>
                </li>
                <li className="flex items-center gap-2 text-xs text-foreground">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: "#D7A93F" }}
                  />
                  <span>Caution</span>
                </li>
                <li className="flex items-center gap-2 text-xs text-foreground">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: "#C0483C" }}
                  />
                  <span>Restricted</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
