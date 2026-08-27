import { useEffect, useState, useCallback, useRef } from "react";

export type Coords = { lat: number; lng: number };

/** Chennai, India — default map centre fallback: Tondiarpet, Chennai 600081 */
export const DEFAULT_CENTER: Coords = { lat: 13.1258, lng: 80.2892 };

export const LOCATION_PRESETS: Array<{
  id: string;
  name: string;
  area: string;
  pincode: string;
  coords: Coords;
}> = [
  {
    id: "tondiarpet",
    name: "Tondiarpet (Near Murugesan St / Market)",
    area: "Tondiarpet",
    pincode: "600081",
    coords: { lat: 13.1258, lng: 80.2892 },
  },
  {
    id: "marina",
    name: "Marina Beach Promenade",
    area: "Triplicane",
    pincode: "600005",
    coords: { lat: 13.05, lng: 80.2824 },
  },
  {
    id: "central",
    name: "Chennai Central Station",
    area: "Park Town",
    pincode: "600003",
    coords: { lat: 13.0827, lng: 80.2707 },
  },
  {
    id: "mylapore",
    name: "Mylapore Heritage Zone",
    area: "Mylapore",
    pincode: "600004",
    coords: { lat: 13.0337, lng: 80.2678 },
  },
  {
    id: "besantnagar",
    name: "Besant Nagar / Elliot's Beach",
    area: "Besant Nagar",
    pincode: "600090",
    coords: { lat: 12.9988, lng: 80.2717 },
  },
];

export type GeoStatus = "locating" | "success" | "denied" | "error" | "custom";

export interface ReverseGeocodeResult {
  formattedAddress: string;
  cityArea: string;
  stateCountry: string;
}

/** Cleans administrative prefixes / suffixes from OpenStreetMap / Nominatim */
function cleanAreaName(str: string): string {
  return str
    .replace(/^Zone\s*\d+\s*/i, "")
    .replace(/\s*Corporation$/i, "")
    .replace(/\s*District$/i, "")
    .trim();
}

/** Fetches human-readable address from live GPS coordinates via reverse geocoding */
export async function fetchReverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  // 1. Primary: High-speed Photon OpenStreetMap Reverse Geocoding
  try {
    const photonUrl = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`;
    const res = await fetch(photonUrl, { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = await res.json();
      const props = data?.features?.[0]?.properties;
      if (props) {
        const road = props.name || props.street || "";
        const district = props.district ? cleanAreaName(props.district) : "";
        const locality = props.locality ? cleanAreaName(props.locality) : "";
        const city = props.city ? cleanAreaName(props.city) : "Chennai";
        const postcode = props.postcode || "";
        const state = props.state || "Tamil Nadu";

        const neighborhood = district || locality || "";
        const cityArea = neighborhood || city;

        let formattedAddress = "";
        if (road && neighborhood) {
          formattedAddress = `${road}, ${neighborhood}${postcode ? ` - ${postcode}` : ""}`;
        } else if (neighborhood && city) {
          formattedAddress = `${neighborhood}, ${city}${postcode ? ` ${postcode}` : ""}`;
        } else if (road && city) {
          formattedAddress = `${road}, ${city}${postcode ? ` ${postcode}` : ""}`;
        } else {
          formattedAddress = `${neighborhood || city}, ${state}${postcode ? ` ${postcode}` : ""}`;
        }

        const stateCountry = postcode ? `${city} ${postcode}, ${state}` : `${city}, ${state}`;

        return { formattedAddress, cityArea, stateCountry };
      }
    }
  } catch {
    // Fallback to secondary geocoder
  }

  // 2. Secondary fallback: BigDataCloud Reverse Geocoding with deep administrative hierarchy
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const res = await fetch(bdcUrl, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      const city = data?.city ? cleanAreaName(data.city) : "Chennai";
      const state = data?.principalSubdivision || "Tamil Nadu";
      const postcode = data?.postcode || "";

      // Extract specific neighborhood/suburb from administrative list (order 10-14)
      let neighborhood = "";
      const adminList = data?.localityInfo?.administrative;
      if (Array.isArray(adminList) && adminList.length > 0) {
        for (let i = adminList.length - 1; i >= 0; i--) {
          const item = adminList[i];
          if (
            item?.name &&
            item.name.toLowerCase() !== "india" &&
            item.name.toLowerCase() !== "tamil nadu" &&
            item.name.toLowerCase() !== "chennai" &&
            item.name.toLowerCase() !== "chennai district"
          ) {
            neighborhood = cleanAreaName(item.name);
            break;
          }
        }
      }

      const cityArea = neighborhood || (data?.locality ? cleanAreaName(data.locality) : city);
      const stateCountry = postcode ? `${city} ${postcode}, ${state}` : `${city}, ${state}`;
      const formattedAddress = neighborhood
        ? `${neighborhood}, ${city}${postcode ? ` ${postcode}` : ""}`
        : `${cityArea}, ${stateCountry}`;

      return { formattedAddress, cityArea, stateCountry };
    }
  } catch {
    // Fallback to OpenStreetMap Nominatim
  }

  // 3. Tertiary fallback: OpenStreetMap Nominatim
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "en" },
      signal: AbortSignal.timeout(4500),
    });
    if (res.ok) {
      const data = await res.json();
      const addr = data?.address || {};
      const road =
        addr.road || addr.pedestrian || addr.street || addr.path || addr.footway || addr.lane;
      const suburbRaw =
        addr.suburb ||
        addr.neighbourhood ||
        addr.residential ||
        addr.city_district ||
        addr.subdistrict ||
        addr.quarter;
      const cityRaw =
        addr.city || addr.town || addr.municipality || addr.county || addr.state_district;
      const state = addr.state || "Tamil Nadu";
      const postcode = addr.postcode || "";

      const suburb = suburbRaw ? cleanAreaName(suburbRaw) : "";
      const city = cityRaw ? cleanAreaName(cityRaw) : "Chennai";

      let formattedAddress = "";
      if (road && suburb) {
        formattedAddress = `${road}, ${suburb}${postcode ? ` - ${postcode}` : ""}`;
      } else if (suburb && city) {
        formattedAddress = `${suburb}, ${city}${postcode ? ` ${postcode}` : ""}`;
      } else {
        formattedAddress = `${suburb || city}, ${state}`;
      }

      const cityArea = suburb || city || "Chennai";
      const stateCountry = postcode ? `${city} ${postcode}, ${state}` : `${city}, ${state}`;

      return { formattedAddress, cityArea, stateCountry };
    }
  } catch {
    // Fallback to raw coordinates
  }

  return {
    formattedAddress: `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`,
    cityArea: "Live Coordinates",
    stateCountry: "Tamil Nadu, India",
  };
}

const MANUAL_LOCATION_STORAGE_KEY = "beacon_manual_location_v2";

export function useGeolocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [manualOverride, setManualOverride] = useState<Coords | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem(MANUAL_LOCATION_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [timestamp, setTimestamp] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("locating");

  // Dynamic reverse-geocoded address states
  const [geocodedAddress, setGeocodedAddress] = useState<ReverseGeocodeResult | null>(null);
  const lastGeocodedCoordsRef = useRef<Coords | null>(null);
  const isGeocodingRef = useRef(false);

  const coordsRef = useRef<Coords | null>(null);

  // Manual request / refresh trigger
  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Location is not available on this device.");
      setGeoStatus("error");
      return;
    }
    setGeoStatus(manualOverride ? "custom" : "locating");
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        coordsRef.current = newCoords;
        setCoords(newCoords);
        setAccuracy(pos.coords.accuracy);
        setTimestamp(pos.timestamp);
        setError(null);
        setGeoStatus(manualOverride ? "custom" : "success");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setError("Location permission denied.");
          setGeoStatus(manualOverride ? "custom" : "denied");
        } else {
          setError("Unable to determine location.");
          setGeoStatus(manualOverride ? "custom" : "error");
        }
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }, [manualOverride]);

  // Set / Clear manual location override (e.g. for desktop testing or selecting Tondiarpet)
  const setCustomLocation = useCallback((targetCoords: Coords | null) => {
    setManualOverride(targetCoords);
    try {
      if (targetCoords) {
        localStorage.setItem(MANUAL_LOCATION_STORAGE_KEY, JSON.stringify(targetCoords));
      } else {
        localStorage.removeItem(MANUAL_LOCATION_STORAGE_KEY);
      }
    } catch {
      // Storage unavailable
    }
  }, []);

  // Continuous real-time GPS tracking watcher
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Location is not available on this device.");
      setGeoStatus(manualOverride ? "custom" : "error");
      return;
    }

    setGeoStatus(manualOverride ? "custom" : "locating");

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const newCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        coordsRef.current = newCoords;
        setCoords(newCoords);
        setAccuracy(pos.coords.accuracy);
        setTimestamp(pos.timestamp);
        setError(null);
        setGeoStatus(manualOverride ? "custom" : "success");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setError("Location permission denied.");
          setGeoStatus(manualOverride ? "custom" : "denied");
        } else {
          setError("Unable to determine location.");
          setGeoStatus(manualOverride ? "custom" : "error");
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12_000 },
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [manualOverride]);

  // Active coordinates: manual override > live GPS coords > default center (Tondiarpet)
  const effective: Coords = manualOverride ?? coords ?? DEFAULT_CENTER;

  // Trigger real-time reverse geocoding on live GPS coordinate updates
  useEffect(() => {
    if (isGeocodingRef.current) return;

    const last = lastGeocodedCoordsRef.current;
    if (last) {
      const movedMeters = distanceMeters(last, effective);
      // Don't re-query if movement is under 15 meters
      if (movedMeters < 15) return;
    }

    let active = true;
    isGeocodingRef.current = true;

    void fetchReverseGeocode(effective.lat, effective.lng).then((res) => {
      isGeocodingRef.current = false;
      if (active) {
        setGeocodedAddress(res);
        lastGeocodedCoordsRef.current = { lat: effective.lat, lng: effective.lng };
      }
    });

    return () => {
      active = false;
      isGeocodingRef.current = false;
    };
  }, [effective]);

  // Human-readable dynamic titles and sublabels matching requirements
  let locationTitle = "Detecting your location...";
  let locationSublabel = manualOverride
    ? "Location calibrated manually"
    : "Location tracked live via GPS";

  if (!manualOverride && geoStatus === "denied") {
    locationTitle = "Location permission required";
    locationSublabel = "Enable GPS in browser settings";
  } else if (!manualOverride && geoStatus === "error") {
    locationTitle = "Unable to determine location";
    locationSublabel = "GPS satellite signal lost";
  } else if (!manualOverride && geoStatus === "locating" && !coords) {
    locationTitle = "Detecting your location...";
    locationSublabel = "Searching for GPS satellite signal...";
  } else if (geocodedAddress?.formattedAddress) {
    locationTitle = geocodedAddress.formattedAddress;
    locationSublabel = manualOverride
      ? "Location calibrated manually"
      : "Location tracked live via GPS";
  } else if (effective) {
    locationTitle = `${effective.lat.toFixed(4)}° N, ${effective.lng.toFixed(4)}° E`;
    locationSublabel = manualOverride
      ? "Location calibrated manually"
      : "Location tracked live via GPS";
  }

  const cityArea = geocodedAddress?.cityArea || (effective ? "Tondiarpet" : "Detecting...");
  const stateCountry = geocodedAddress?.stateCountry || "Chennai 600081, Tamil Nadu";

  return {
    coords,
    accuracy: manualOverride ? 5 : accuracy,
    timestamp,
    error,
    geoStatus: manualOverride ? "custom" : geoStatus,
    isLocating: !manualOverride && geoStatus === "locating" && !coords,
    effective,
    isManual: Boolean(manualOverride),
    locationTitle,
    locationSublabel,
    cityArea,
    stateCountry,
    requestLocation,
    setCustomLocation,
  };
}

/** Great-circle distance in metres between two coordinates. */
export function distanceMeters(a: Coords, b: Coords): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** True when the point falls inside a circular geofence zone. */
export function inZone(
  point: Coords,
  zone: { center_lat: number; center_lng: number; radius_m: number },
): boolean {
  return distanceMeters(point, { lat: zone.center_lat, lng: zone.center_lng }) <= zone.radius_m;
}
