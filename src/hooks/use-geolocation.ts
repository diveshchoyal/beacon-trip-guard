import { useEffect, useState, useCallback, useRef } from "react";

export type Coords = { lat: number; lng: number };

/** Chennai, India — default map centre fallback when GPS is not yet acquired. */
export const DEFAULT_CENTER: Coords = { lat: 13.0827, lng: 80.2707 };

export type GeoStatus = "locating" | "success" | "denied" | "error";

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
  // 1. Try OpenStreetMap Nominatim with zoom 18 for street-level precision
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
      const country = addr.country || "India";

      const suburb = suburbRaw ? cleanAreaName(suburbRaw) : "";
      const city = cityRaw ? cleanAreaName(cityRaw) : "";

      let formattedAddress = "";
      if (road && suburb) {
        formattedAddress = `${road}, ${suburb}`;
      } else if (road && city) {
        formattedAddress = `${road}, ${city}`;
      } else if (suburb && city) {
        formattedAddress = `${suburb}, ${city}`;
      } else if (road) {
        formattedAddress = road;
      } else if (suburb) {
        formattedAddress = suburb;
      } else if (city) {
        formattedAddress = city;
      } else {
        formattedAddress = data?.name || `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
      }

      const cityArea = suburb || city || "Chennai";
      const stateCountry = city ? `${city}, ${state}` : `${state}, ${country}`;

      return { formattedAddress, cityArea, stateCountry };
    }
  } catch {
    // Fallback to secondary geocoder
  }

  // 2. Secondary fallback to BigDataCloud reverse geocode client API
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const res = await fetch(bdcUrl, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      const locality = data?.locality ? cleanAreaName(data.locality) : "";
      const city = data?.city ? cleanAreaName(data.city) : "";
      const state = data?.principalSubdivision || "Tamil Nadu";
      const country = data?.countryName || "India";

      let formattedAddress = "";
      if (locality && city && locality.toLowerCase() !== city.toLowerCase()) {
        formattedAddress = `${locality}, ${city}`;
      } else if (locality) {
        formattedAddress = locality;
      } else if (city) {
        formattedAddress = `${city}, ${state}`;
      } else {
        formattedAddress = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
      }

      const cityArea = locality || city || "Chennai";
      const stateCountry = city ? `${city}, ${state}` : `${state}, ${country}`;

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

export function useGeolocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
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
    setGeoStatus("locating");
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Accuracy filter: ignore wild cell tower jumps (> 4000m) if previous accurate fix exists
        if (coordsRef.current && pos.coords.accuracy > 4000) {
          return;
        }
        const newCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        coordsRef.current = newCoords;
        setCoords(newCoords);
        setAccuracy(pos.coords.accuracy);
        setTimestamp(pos.timestamp);
        setError(null);
        setGeoStatus("success");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setError("Location permission denied.");
          setGeoStatus("denied");
        } else {
          setError("Unable to determine location.");
          setGeoStatus("error");
        }
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, []);

  // Continuous real-time GPS tracking watcher
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Location is not available on this device.");
      setGeoStatus("error");
      return;
    }

    setGeoStatus("locating");

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        // Accuracy validation: filter out noisy jumps if previous accurate reading exists
        if (coordsRef.current && pos.coords.accuracy > 4000) {
          return;
        }

        const newCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        coordsRef.current = newCoords;
        setCoords(newCoords);
        setAccuracy(pos.coords.accuracy);
        setTimestamp(pos.timestamp);
        setError(null);
        setGeoStatus("success");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setError("Location permission denied.");
          setGeoStatus("denied");
        } else {
          setError("Unable to determine location.");
          setGeoStatus("error");
        }
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 12_000 },
    );

    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Trigger real-time reverse geocoding on live GPS coordinate updates (only if moved > 25m)
  useEffect(() => {
    if (!coords || isGeocodingRef.current) return;

    const last = lastGeocodedCoordsRef.current;
    if (last) {
      const movedMeters = distanceMeters(last, coords);
      // Don't re-query if movement is under 25 meters
      if (movedMeters < 25) return;
    }

    let active = true;
    isGeocodingRef.current = true;

    void fetchReverseGeocode(coords.lat, coords.lng).then((res) => {
      isGeocodingRef.current = false;
      if (active) {
        setGeocodedAddress(res);
        lastGeocodedCoordsRef.current = { lat: coords.lat, lng: coords.lng };
      }
    });

    return () => {
      active = false;
      isGeocodingRef.current = false;
    };
  }, [coords]);

  // Human-readable dynamic titles and sublabels matching requirements
  let locationTitle = "Detecting your location...";
  let locationSublabel = "Location tracked live via GPS";

  if (geoStatus === "denied") {
    locationTitle = "Location permission required";
    locationSublabel = "Enable GPS in browser settings";
  } else if (geoStatus === "error") {
    locationTitle = "Unable to determine location";
    locationSublabel = "GPS satellite signal lost";
  } else if (geoStatus === "locating" && !coords) {
    locationTitle = "Detecting your location...";
    locationSublabel = "Searching for GPS satellite signal...";
  } else if (geocodedAddress?.formattedAddress) {
    locationTitle = geocodedAddress.formattedAddress;
    locationSublabel = "Location tracked live via GPS";
  } else if (coords) {
    locationTitle = `${coords.lat.toFixed(4)}° N, ${coords.lng.toFixed(4)}° E`;
    locationSublabel = "Location tracked live via GPS";
  }

  const cityArea = geocodedAddress?.cityArea || (coords ? "Chennai" : "Detecting...");
  const stateCountry = geocodedAddress?.stateCountry || "Tamil Nadu, India";

  return {
    coords,
    accuracy,
    timestamp,
    error,
    geoStatus,
    isLocating: geoStatus === "locating" && !coords,
    effective: coords ?? DEFAULT_CENTER,
    locationTitle,
    locationSublabel,
    cityArea,
    stateCountry,
    requestLocation,
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
