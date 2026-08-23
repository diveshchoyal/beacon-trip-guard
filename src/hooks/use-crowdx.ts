import { useEffect, useState, useRef, useMemo } from "react";
import {
  type CrowdDensityStatus,
  type CrowdXLocation,
  type CrowdXCamera,
  CROWDX_MONITORED_LOCATIONS,
  findNearestCrowdXLocation,
  classifyCrowdDensity,
  getCrowdXConfig,
} from "@/lib/crowdx";

interface UseCrowdXOptions {
  userLat?: number;
  userLng?: number;
  hasLocationPermission?: boolean;
}

export function useCrowdX({
  userLat,
  userLng,
  hasLocationPermission = true,
}: UseCrowdXOptions) {
  const [detectedCount, setDetectedCount] = useState<number | null>(null);
  const [lastUpdatedTimestamp, setLastUpdatedTimestamp] = useState<number | null>(null);
  const [connectionState, setConnectionState] = useState<
    "connecting" | "live" | "stale" | "disconnected" | "unavailable" | "denied"
  >("connecting");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [freshnessText, setFreshnessText] = useState<string>("Waiting for data");
  const [cameras, setCameras] = useState<CrowdXCamera[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const { apiUrl, wsUrl } = useMemo(() => getCrowdXConfig(), []);

  // Determine nearest monitored CrowdX location
  const nearestMatch = useMemo(() => {
    if (!userLat || !userLng) return null;
    return findNearestCrowdXLocation(userLat, userLng, CROWDX_MONITORED_LOCATIONS);
  }, [userLat, userLng]);

  // Fetch available camera inventory from CrowdX backend
  useEffect(() => {
    let active = true;
    async function loadCameras() {
      try {
        const res = await fetch(`${apiUrl}/api/rtsp/cameras`, {
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          const data = await res.json();
          if (active && Array.isArray(data?.cameras)) {
            setCameras(data.cameras);
          }
        }
      } catch {
        // Backend not currently reachable
      }
    }
    void loadCameras();
    return () => {
      active = false;
    };
  }, [apiUrl]);

  // Establish WebSocket connection to CrowdX YOLO stream
  useEffect(() => {
    // 1. Check location permission
    if (!hasLocationPermission) {
      setConnectionState("denied");
      setStatusMessage("Enable location to see nearby crowd conditions");
      setDetectedCount(null);
      return;
    }

    // 2. Check if nearest location is known
    if (!nearestMatch || !userLat || !userLng) {
      setConnectionState("unavailable");
      setStatusMessage("Crowd monitoring unavailable at this location");
      setDetectedCount(null);
      return;
    }

    const { location, distanceKm } = nearestMatch;

    // If tourist is too far (> 50 km) from any monitored Chennai camera
    if (distanceKm > 50) {
      setConnectionState("unavailable");
      setStatusMessage("Crowd monitoring unavailable at this location");
      setDetectedCount(null);
      return;
    }

    // Determine camera ID to subscribe to
    const targetCameraId = location.cameraId || location.id || "cam_marina_01";

    // Clean up existing WebSocket
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // Ignore
      }
      wsRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setConnectionState("connecting");
    setStatusMessage("Connecting to YOLO vision engine...");

    let isSubscribed = true;

    try {
      const streamEndpoint = `${wsUrl}/api/rtsp/ws/stream/${targetCameraId}`;
      const ws = new WebSocket(streamEndpoint);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isSubscribed) return;
        setConnectionState("live");
        setStatusMessage("Live YOLO detection connected");
      };

      ws.onmessage = (event) => {
        if (!isSubscribed) return;

        // JSON detection count data from YOLO engine
        if (typeof event.data === "string") {
          try {
            const data = JSON.parse(event.data);
            if (typeof data.count === "number") {
              setDetectedCount(data.count);
              setLastUpdatedTimestamp(Date.now());
              setConnectionState("live");
            }
          } catch {
            // Non-JSON frame event
          }
        }
      };

      ws.onerror = () => {
        if (!isSubscribed) return;
        setConnectionState("disconnected");
        setStatusMessage("Live connection lost");
      };

      ws.onclose = () => {
        if (!isSubscribed) return;
        setConnectionState("disconnected");
        setStatusMessage("Live connection lost");

        // Schedule auto-reconnect attempt
        reconnectTimeoutRef.current = window.setTimeout(() => {
          if (isSubscribed) {
            setConnectionState("connecting");
          }
        }, 12000);
      };
    } catch {
      setConnectionState("unavailable");
      setStatusMessage("Crowd monitoring unavailable at this location");
    }

    return () => {
      isSubscribed = false;
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // Ignore
        }
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [hasLocationPermission, nearestMatch, userLat, userLng, wsUrl]);

  // Dynamic freshness calculation tick
  useEffect(() => {
    const updateFreshness = () => {
      if (!lastUpdatedTimestamp) {
        if (connectionState === "connecting") {
          setFreshnessText("Connecting to YOLO engine...");
        } else if (connectionState === "denied") {
          setFreshnessText("Location required");
        } else if (connectionState === "unavailable") {
          setFreshnessText("Unavailable here");
        } else {
          setFreshnessText("Live connection lost");
        }
        return;
      }

      const diffSec = Math.floor((Date.now() - lastUpdatedTimestamp) / 1000);

      if (diffSec < 8) {
        setFreshnessText("Updated just now");
      } else if (diffSec < 30) {
        setFreshnessText(`Updated ${diffSec}s ago`);
      } else if (diffSec < 90) {
        setFreshnessText(`⚠ Data delayed · ${diffSec}s ago`);
      } else {
        setFreshnessText("⚠ Connection lost");
      }
    };

    updateFreshness();
    const timer = setInterval(updateFreshness, 2000);
    return () => clearInterval(timer);
  }, [lastUpdatedTimestamp, connectionState]);

  // Compute final crowd density status
  const crowdStatus: CrowdDensityStatus = useMemo(() => {
    const matchedLoc: CrowdXLocation | null = nearestMatch?.location ?? null;
    const distanceKm: number | null = nearestMatch?.distanceKm ?? null;

    if (connectionState === "denied") {
      return {
        level: "Unknown",
        colorClass: "text-[#77716D]",
        badgeBg: "bg-black/5",
        badgeText: "text-[#77716D]",
        detectedCount: null,
        densityPercentage: null,
        label: "Location Required",
        subLabel: "Enable location to see nearby crowd",
        matchedLocation: null,
        distanceKm: null,
        isLive: false,
        statusText: "Location required",
        lastUpdatedTimestamp: null,
        connectionState: "denied",
      };
    }

    if (connectionState === "unavailable" || !matchedLoc) {
      return {
        level: "Unknown",
        colorClass: "text-[#77716D]",
        badgeBg: "bg-black/5",
        badgeText: "text-[#77716D]",
        detectedCount: null,
        densityPercentage: null,
        label: "Unavailable",
        subLabel: "Crowd monitoring unavailable here",
        matchedLocation: matchedLoc,
        distanceKm,
        isLive: false,
        statusText: "Monitoring unavailable",
        lastUpdatedTimestamp: null,
        connectionState: "unavailable",
      };
    }

    // When we have a live detected count from YOLO
    if (detectedCount !== null) {
      const classification = classifyCrowdDensity(detectedCount, matchedLoc.capacity);
      const isStale =
        lastUpdatedTimestamp !== null && (Date.now() - lastUpdatedTimestamp) / 1000 > 45;

      return {
        level: classification.level,
        colorClass: classification.colorClass,
        badgeBg: classification.badgeBg,
        badgeText: classification.badgeText,
        detectedCount,
        densityPercentage: classification.densityPercentage,
        label: classification.level,
        subLabel: `${detectedCount} people detected`,
        matchedLocation: matchedLoc,
        distanceKm,
        isLive: connectionState === "live" && !isStale,
        statusText: isStale ? "Data delayed" : "Live YOLO detection",
        lastUpdatedTimestamp,
        connectionState: isStale ? "stale" : connectionState,
      };
    }

    // Initial connecting state
    return {
      level: "Unknown",
      colorClass: "text-[#77716D]",
      badgeBg: "bg-black/5",
      badgeText: "text-[#77716D]",
      detectedCount: null,
      densityPercentage: null,
      label: "Connecting...",
      subLabel: "Contacting camera feed",
      matchedLocation: matchedLoc,
      distanceKm,
      isLive: false,
      statusText: "Connecting to camera",
      lastUpdatedTimestamp: null,
      connectionState: "connecting",
    };
  }, [connectionState, detectedCount, lastUpdatedTimestamp, nearestMatch]);

  return {
    ...crowdStatus,
    freshnessText,
    cameras,
  };
}
