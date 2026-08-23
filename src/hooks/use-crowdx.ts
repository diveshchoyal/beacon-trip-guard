import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  type CrowdDensityStatus,
  type CrowdConnectionState,
  type CrowdXLocation,
  type CrowdXCamera,
  CROWDX_MONITORED_LOCATIONS,
  findNearestCrowdXLocation,
  classifyCrowdDensity,
  getCrowdXConfig,
  getCrowdXStreamEndpoints,
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
  const [connectionState, setConnectionState] = useState<CrowdConnectionState>("CONNECTING");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [freshnessText, setFreshnessText] = useState<string>("Connecting...");
  const [cameras, setCameras] = useState<CrowdXCamera[]>([]);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const connectionTimeoutRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);

  const { apiUrl, wsUrl } = useMemo(() => getCrowdXConfig(), []);

  // Determine nearest monitored CrowdX location
  const nearestMatch = useMemo(() => {
    if (!userLat || !userLng) return null;
    return findNearestCrowdXLocation(userLat, userLng, CROWDX_MONITORED_LOCATIONS);
  }, [userLat, userLng]);

  // Fetch available camera inventory from CrowdX backend (if live)
  useEffect(() => {
    let active = true;
    async function loadCameras() {
      try {
        const res = await fetch(`${apiUrl}/api/rtsp/cameras`, {
          signal: AbortSignal.timeout(3500),
        });
        if (res.ok) {
          const data = await res.json();
          if (active && Array.isArray(data?.cameras)) {
            setCameras(data.cameras);
          }
        }
      } catch {
        // Backend not reachable
      }
    }
    void loadCameras();
    return () => {
      active = false;
    };
  }, [apiUrl, retryTrigger]);

  // Manual retry handler
  const retry = useCallback(() => {
    retryCountRef.current = 0;
    setConnectionState("CONNECTING");
    setStatusMessage("Retrying YOLO stream connection...");
    setRetryTrigger((prev) => prev + 1);
  }, []);

  // Establish WebSocket connection to CrowdX YOLO stream
  useEffect(() => {
    // 1. Location permission check
    if (!hasLocationPermission) {
      setConnectionState("DENIED");
      setStatusMessage("Enable location to see nearby crowd conditions");
      setDetectedCount(null);
      return;
    }

    // 2. Check if nearest location is known
    if (!nearestMatch || !userLat || !userLng) {
      setConnectionState("OFFLINE");
      setStatusMessage("Crowd monitoring unavailable at this location");
      setDetectedCount(null);
      return;
    }

    const { location, distanceKm } = nearestMatch;

    // If tourist is too far (> 50 km) from any monitored camera
    if (distanceKm > 50) {
      setConnectionState("OFFLINE");
      setStatusMessage("Crowd monitoring unavailable at this location");
      setDetectedCount(null);
      return;
    }

    // Determine target camera ID (check backend cameras if available, or location default)
    let targetCameraId = location.cameraId || location.id || "cam_marina_01";
    if (cameras.length > 0) {
      const match = cameras.find(
        (c) =>
          c.id === location.cameraId ||
          c.location?.toLowerCase().includes(location.name.toLowerCase()) ||
          c.name?.toLowerCase().includes(location.name.toLowerCase()),
      );
      if (match?.id) {
        targetCameraId = match.id;
      }
    }

    // Clean up existing connections & timers
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // Ignore
      }
      wsRef.current = null;
    }

    if (connectionTimeoutRef.current) {
      window.clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setConnectionState("CONNECTING");
    setStatusMessage("Connecting to YOLO stream...");

    let isSubscribed = true;
    const candidateEndpoints = getCrowdXStreamEndpoints(wsUrl, targetCameraId);
    let currentEndpointIndex = 0;

    function attemptConnection(endpointIndex: number) {
      if (!isSubscribed) return;

      const endpoint = candidateEndpoints[endpointIndex] || candidateEndpoints[0];

      try {
        const ws = new WebSocket(endpoint);
        wsRef.current = ws;

        // 5-second connection timeout
        connectionTimeoutRef.current = window.setTimeout(() => {
          if (!isSubscribed) return;
          if (ws.readyState !== WebSocket.OPEN) {
            try {
              ws.close();
            } catch {
              // Ignore
            }
            handleFailure();
          }
        }, 5000);

        ws.onopen = () => {
          if (!isSubscribed) return;
          if (connectionTimeoutRef.current) {
            window.clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
          retryCountRef.current = 0;
          setConnectionState("LIVE");
          setStatusMessage("Live YOLO detection connected");
        };

        ws.onmessage = (event) => {
          if (!isSubscribed) return;

          // Process JSON detection data from YOLO
          if (typeof event.data === "string") {
            try {
              const data = JSON.parse(event.data);
              if (typeof data.count === "number") {
                setDetectedCount(data.count);
                setLastUpdatedTimestamp(Date.now());
                setConnectionState("LIVE");
              }
            } catch {
              // Non-JSON frame
            }
          }
        };

        ws.onerror = () => {
          if (!isSubscribed) return;
          handleFailure();
        };

        ws.onclose = () => {
          if (!isSubscribed) return;
          handleFailure();
        };
      } catch {
        handleFailure();
      }
    }

    function handleFailure() {
      if (!isSubscribed) return;

      if (connectionTimeoutRef.current) {
        window.clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }

      // Try next endpoint candidate if available
      if (currentEndpointIndex < candidateEndpoints.length - 1) {
        currentEndpointIndex += 1;
        attemptConnection(currentEndpointIndex);
        return;
      }

      // All candidate endpoints failed -> Transition to OFFLINE
      setConnectionState("OFFLINE");
      setStatusMessage("Crowd monitoring unavailable");

      // Exponential backoff reconnect: attempt up to 3 times (5s, 10s, 20s), then stay OFFLINE
      if (retryCountRef.current < 3) {
        const delay = Math.min(30000, 5000 * Math.pow(2, retryCountRef.current));
        retryCountRef.current += 1;

        reconnectTimeoutRef.current = window.setTimeout(() => {
          if (isSubscribed) {
            currentEndpointIndex = 0;
            setConnectionState("CONNECTING");
            attemptConnection(0);
          }
        }, delay);
      }
    }

    // Start initial connection attempt
    attemptConnection(0);

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
      if (connectionTimeoutRef.current) {
        window.clearTimeout(connectionTimeoutRef.current);
      }
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [hasLocationPermission, nearestMatch, userLat, userLng, wsUrl, cameras, retryTrigger]);

  // Dynamic freshness calculation tick
  useEffect(() => {
    const updateFreshness = () => {
      if (connectionState === "CONNECTING") {
        setFreshnessText("Connecting...");
        return;
      }

      if (connectionState === "DENIED") {
        setFreshnessText("Location required");
        return;
      }

      if (connectionState === "OFFLINE" || !lastUpdatedTimestamp) {
        setFreshnessText("Unavailable");
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

    if (connectionState === "DENIED") {
      return {
        level: "Unknown",
        colorClass: "text-[#77716D]",
        badgeBg: "bg-black/5",
        badgeText: "text-[#77716D]",
        detectedCount: null,
        densityPercentage: null,
        label: "Location Required",
        subLabel: "Enable location to see nearby crowd conditions",
        matchedLocation: null,
        distanceKm: null,
        isLive: false,
        statusText: "Location required",
        lastUpdatedTimestamp: null,
        connectionState: "DENIED",
      };
    }

    if (connectionState === "OFFLINE" || !matchedLoc) {
      return {
        level: "Unknown",
        colorClass: "text-[#77716D]",
        badgeBg: "bg-black/5",
        badgeText: "text-[#77716D]",
        detectedCount: null,
        densityPercentage: null,
        label: "Offline",
        subLabel: "Crowd monitoring unavailable",
        matchedLocation: matchedLoc,
        distanceKm,
        isLive: false,
        statusText: "Crowd monitoring unavailable",
        lastUpdatedTimestamp: null,
        connectionState: "OFFLINE",
      };
    }

    // LIVE detection from YOLO
    if (detectedCount !== null && connectionState === "LIVE") {
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
        isLive: !isStale,
        statusText: isStale ? "Data delayed" : "Live YOLO detection",
        lastUpdatedTimestamp,
        connectionState: isStale ? "OFFLINE" : "LIVE",
      };
    }

    // CONNECTING state
    return {
      level: "Unknown",
      colorClass: "text-[#77716D]",
      badgeBg: "bg-black/5",
      badgeText: "text-[#77716D]",
      detectedCount: null,
      densityPercentage: null,
      label: "Connecting...",
      subLabel: "Connecting to YOLO stream...",
      matchedLocation: matchedLoc,
      distanceKm,
      isLive: false,
      statusText: "Connecting to stream",
      lastUpdatedTimestamp: null,
      connectionState: "CONNECTING",
    };
  }, [connectionState, detectedCount, lastUpdatedTimestamp, nearestMatch]);

  return {
    ...crowdStatus,
    freshnessText,
    cameras,
    retry,
  };
}
