/**
 * CrowdX (Chennai Crowd Watch) Integration Service & Type Definitions
 * Reference Implementation: https://github.com/adhivishnuM/chennai-crowd-watch
 *
 * Connects to CrowdX YOLOv8 RTSP camera detection pipeline and maps
 * real-time person count to crowd density for the BEACON Tourist Guard.
 */

// Monitored CrowdX Locations across Chennai with capacities and coordinates
export interface CrowdXLocation {
  id: string;
  name: string;
  type: "mall" | "beach" | "park" | "transit" | "harbour" | "market" | "custom";
  address: string;
  lat: number;
  lng: number;
  capacity?: number;
  cameraId?: string;
}

export const CROWDX_MONITORED_LOCATIONS: CrowdXLocation[] = [
  // North Chennai
  {
    id: "loc_tondiarpet",
    name: "Tondiarpet Commercial Hub",
    type: "market",
    address: "TH Road, Tondiarpet, Chennai",
    lat: 13.125,
    lng: 80.289,
    capacity: 6000,
    cameraId: "cam_tondiarpet_01",
  },
  {
    id: "loc_kasimedu",
    name: "Kasimedu Harbour Promenade",
    type: "harbour",
    address: "Kasimedu, Royapuram, Chennai",
    lat: 13.125,
    lng: 80.297,
    capacity: 12000,
    cameraId: "cam_kasimedu_01",
  },
  {
    id: "loc_royapuram",
    name: "Royapuram Heritage Zone",
    type: "transit",
    address: "Royapuram, Chennai",
    lat: 13.1098,
    lng: 80.2945,
    capacity: 5000,
    cameraId: "cam_royapuram_01",
  },

  // Central & Coastal Chennai
  {
    id: "loc_005",
    name: "Marina Beach",
    type: "beach",
    address: "Marina Beach Road, Triplicane, Chennai",
    lat: 13.05,
    lng: 80.2824,
    capacity: 50000,
    cameraId: "cam_marina_01",
  },
  {
    id: "loc_006",
    name: "Besant Nagar Beach",
    type: "beach",
    address: "Elliot's Beach, Besant Nagar, Chennai",
    lat: 12.9988,
    lng: 80.2717,
    capacity: 10000,
    cameraId: "cam_elliots_01",
  },
  {
    id: "loc_001",
    name: "Express Avenue Mall",
    type: "mall",
    address: "Whites Road, Royapettah, Chennai",
    lat: 13.0604,
    lng: 80.2627,
    capacity: 5000,
    cameraId: "cam_ea_01",
  },
  {
    id: "loc_002",
    name: "Phoenix MarketCity",
    type: "mall",
    address: "Velachery Main Road, Velachery, Chennai",
    lat: 12.9941,
    lng: 80.2189,
    capacity: 8000,
    cameraId: "cam_phoenix_01",
  },
  {
    id: "loc_003",
    name: "VR Chennai",
    type: "mall",
    address: "Jawaharlal Nehru Road, Anna Nagar, Chennai",
    lat: 13.0878,
    lng: 80.2069,
    capacity: 6000,
    cameraId: "cam_vr_01",
  },
  {
    id: "loc_004",
    name: "Forum Vijaya Mall",
    type: "mall",
    address: "Arcot Road, Vadapalani, Chennai",
    lat: 13.05,
    lng: 80.2121,
    capacity: 4000,
    cameraId: "cam_forum_01",
  },
  {
    id: "loc_007",
    name: "Guindy National Park",
    type: "park",
    address: "Guindy, Chennai",
    lat: 13.0067,
    lng: 80.2206,
    capacity: 3000,
    cameraId: "cam_guindy_01",
  },
  {
    id: "loc_008",
    name: "Semmozhi Poonga",
    type: "park",
    address: "Cathedral Road, Gopalapuram, Chennai",
    lat: 13.0371,
    lng: 80.2565,
    capacity: 2000,
    cameraId: "cam_semmozhi_01",
  },
  {
    id: "loc_009",
    name: "Chennai Central Station",
    type: "transit",
    address: "Kannappar Thidal, Periyamet, Chennai",
    lat: 13.0827,
    lng: 80.2755,
    capacity: 20000,
    cameraId: "cam_central_01",
  },
  {
    id: "loc_010",
    name: "CMBT Bus Terminus",
    type: "transit",
    address: "Koyambedu, Chennai",
    lat: 13.0673,
    lng: 80.2063,
    capacity: 15000,
    cameraId: "cam_cmbt_01",
  },
];

export interface CrowdXDetectionMessage {
  count: number;
  camera_id: string;
  timestamp: number;
}

export interface CrowdXCamera {
  id: string;
  name: string;
  location?: string;
  url?: string;
  type?: string;
  is_active?: boolean;
  uptime?: number;
  capacity?: number;
  lat?: number;
  lng?: number;
}

export type CrowdLevel = "Low" | "Moderate" | "Busy" | "Very Busy" | "Unknown";

export type CrowdConnectionState = "CONNECTING" | "LIVE" | "OFFLINE" | "DENIED";

export interface CrowdDensityStatus {
  level: CrowdLevel;
  colorClass: string;
  badgeBg: string;
  badgeText: string;
  detectedCount: number | null;
  densityPercentage: number | null;
  label: string;
  subLabel: string;
  matchedLocation: CrowdXLocation | null;
  distanceKm: number | null;
  isLive: boolean;
  statusText: string;
  lastUpdatedTimestamp: number | null;
  connectionState: CrowdConnectionState;
}

/**
 * Calculates Great-Circle Haversine distance in kilometers between two GPS points
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Finds the nearest monitored CrowdX location to the tourist GPS
 */
export function findNearestCrowdXLocation(
  userLat: number,
  userLng: number,
  locations: CrowdXLocation[] = CROWDX_MONITORED_LOCATIONS,
): { location: CrowdXLocation; distanceKm: number } | null {
  if (!userLat || !userLng || locations.length === 0) return null;

  let closest: CrowdXLocation | null = null;
  let minDistance = Infinity;

  for (const loc of locations) {
    const dist = calculateDistanceKm(userLat, userLng, loc.lat, loc.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closest = loc;
    }
  }

  return closest ? { location: closest, distanceKm: minDistance } : null;
}

/**
 * Classifies raw YOLO person count or capacity into a standardized crowd density
 */
export function classifyCrowdDensity(
  detectedCount: number,
  capacity?: number,
): {
  level: CrowdLevel;
  densityPercentage: number | null;
  colorClass: string;
  badgeBg: string;
  badgeText: string;
  subLabel: string;
} {
  const countLabel = `${detectedCount} ${detectedCount === 1 ? "person" : "people"} detected`;

  if (capacity && capacity > 0) {
    const pct = Math.min(100, Math.max(0, Math.round((detectedCount / capacity) * 100)));

    if (pct <= 30) {
      return {
        level: "Low",
        densityPercentage: pct,
        colorClass: "text-[#39B86B]",
        badgeBg: "bg-[#39B86B]/15",
        badgeText: "text-[#39B86B]",
        subLabel: `${countLabel} · ${pct}% capacity`,
      };
    } else if (pct <= 65) {
      return {
        level: "Moderate",
        densityPercentage: pct,
        colorClass: "text-[#F2A93B]",
        badgeBg: "bg-[#F2A93B]/15",
        badgeText: "text-[#F2A93B]",
        subLabel: `${countLabel} · ${pct}% capacity`,
      };
    } else if (pct <= 85) {
      return {
        level: "Busy",
        densityPercentage: pct,
        colorClass: "text-[#FF6F61]",
        badgeBg: "bg-[#FF6F61]/15",
        badgeText: "text-[#FF6F61]",
        subLabel: `${countLabel} · ${pct}% capacity`,
      };
    } else {
      return {
        level: "Very Busy",
        densityPercentage: pct,
        colorClass: "text-[#E94B5F]",
        badgeBg: "bg-[#E94B5F]/15",
        badgeText: "text-[#E94B5F]",
        subLabel: `${countLabel} · High density`,
      };
    }
  }

  // Raw count classification when exact area capacity is uncalibrated
  if (detectedCount <= 15) {
    return {
      level: "Low",
      densityPercentage: null,
      colorClass: "text-[#39B86B]",
      badgeBg: "bg-[#39B86B]/15",
      badgeText: "text-[#39B86B]",
      subLabel: `${countLabel} · Normal flow`,
    };
  } else if (detectedCount <= 50) {
    return {
      level: "Moderate",
      densityPercentage: null,
      colorClass: "text-[#F2A93B]",
      badgeBg: "bg-[#F2A93B]/15",
      badgeText: "text-[#F2A93B]",
      subLabel: `${countLabel} · Active flow`,
    };
  } else if (detectedCount <= 100) {
    return {
      level: "Busy",
      densityPercentage: null,
      colorClass: "text-[#FF6F61]",
      badgeBg: "bg-[#FF6F61]/15",
      badgeText: "text-[#FF6F61]",
      subLabel: `${countLabel} · High volume`,
    };
  } else {
    return {
      level: "Very Busy",
      densityPercentage: null,
      colorClass: "text-[#E94B5F]",
      badgeBg: "bg-[#E94B5F]/15",
      badgeText: "text-[#E94B5F]",
      subLabel: `${countLabel} · Overcrowded`,
    };
  }
}

/**
 * CrowdX Environment Configuration
 * Supports VITE_CROWDX_WS_URL and VITE_CROWDX_API_URL
 */
export function getCrowdXConfig() {
  const envObj = (import.meta as { env?: Record<string, string> }).env || {};

  const rawApiUrl = envObj.VITE_CROWDX_API_URL || envObj.VITE_API_URL || "http://localhost:8000";

  const cleanApiUrl = rawApiUrl.replace(/\/$/, "");

  const rawWsUrl = envObj.VITE_CROWDX_WS_URL || cleanApiUrl.replace(/^http/, "ws");

  const cleanWsUrl = rawWsUrl.replace(/\/$/, "");

  return {
    apiUrl: cleanApiUrl,
    wsUrl: cleanWsUrl,
  };
}

/**
 * Generates priority WebSocket endpoints for a given camera ID
 */
export function getCrowdXStreamEndpoints(wsUrl: string, cameraId: string): string[] {
  const clean = wsUrl.replace(/\/$/, "");
  return [
    `${clean}/ws/stream/${cameraId}`,
    `${clean}/api/rtsp/ws/stream/${cameraId}`,
    `${clean}/ws/camera/live`,
  ];
}
