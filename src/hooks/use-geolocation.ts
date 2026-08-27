import { useEffect, useState, useCallback, useRef } from "react";

export type Coords = { lat: number; lng: number };

export const DEFAULT_CENTER: Coords = { lat: 13.0827, lng: 80.2707 };

export type GeoStatus = "locating" | "success" | "denied" | "error";

export interface ReverseGeocodeResult {
  formattedAddress: string;
  cityArea: string;
  stateCountry: string;
}

/** Cleans administrative prefixes / suffixes from OpenStreetMap / Nominatim */
function cleanAreaName(str: string): string {
  if (!str) return "";
  return str
    .replace(/^Zone\s*\d+\s*/i, "")
    .replace(/\s*Corporation$/i, "")
    .replace(/\s*City Corporation$/i, "")
    .replace(/\s*District$/i, "")
    .trim();
}

/** Fetches human-readable address from live GPS coordinates via reverse geocoding */
export async function fetchReverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  // 1. Primary: High-speed Photon OpenStreetMap Reverse Geocoding
  try {
    const photonUrl = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`;
    const res = await fetch(photonUrl, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      const props = data?.features?.[0]?.properties;
      if (props) {
        const road = props.name || props.street || "";
        const district = props.district ? cleanAreaName(props.district) : "";
        const locality = props.locality ? cleanAreaName(props.locality) : "";
        const city = cleanAreaName(props.city || props.town || props.village || props.county || "");
        const postcode = props.postcode || "";
        const state = props.state || "";
        const country = props.country || "";

        const neighborhood = locality || district || "";
        const cityArea = neighborhood || city || road || `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;

        let formattedAddress = "";
        if (road && neighborhood) {
          formattedAddress = `${road}, ${neighborhood}${postcode ? ` - ${postcode}` : ""}`;
        } else if (neighborhood && city) {
          formattedAddress = `${neighborhood}, ${city}${postcode ? ` ${postcode}` : ""}`;
        } else if (road && city) {
          formattedAddress = `${road}, ${city}${postcode ? ` ${postcode}` : ""}`;
        } else if (cityArea) {
          formattedAddress = `${cityArea}${state ? `, ${state}` : ""}${postcode ? ` ${postcode}` : ""}`;
        } else {
          formattedAddress = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
        }

        let stateCountry = "";
        if (city && state) {
          stateCountry = postcode ? `${city} ${postcode}, ${state}` : `${city}, ${state}`;
        } else if (state && country) {
          stateCountry = `${state}, ${country}`;
        } else if (city || state || country) {
          stateCountry = [city, state, country].filter(Boolean).join(", ");
        } else {
          stateCountry = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
        }

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
      const city = cleanAreaName(data?.city || data?.locality || "");
      const state = data?.principalSubdivision || "";
      const country = data?.countryName || "";
      const postcode = data?.postcode || "";

      let neighborhood = "";
      const adminList = data?.localityInfo?.administrative;
      if (Array.isArray(adminList) && adminList.length > 0) {
        for (let i = adminList.length - 1; i >= 0; i--) {
          const item = adminList[i];
          if (
            item?.name &&
            item.name.toLowerCase() !== country.toLowerCase() &&
            item.name.toLowerCase() !== state.toLowerCase() &&
            item.name.toLowerCase() !== city.toLowerCase()
          ) {
            neighborhood = cleanAreaName(item.name);
            break;
          }
        }
      }

      const cityArea =
        neighborhood ||
        (data?.locality ? cleanAreaName(data.locality) : city) ||
        `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
      const stateCountry =
        city && state
          ? `${city}${postcode ? ` ${postcode}` : ""}, ${state}`
          : [state, country].filter(Boolean).join(", ");
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
        addr.road || addr.pedestrian || addr.street || addr.path || addr.footway || addr.lane || "";
      const suburbRaw =
        addr.suburb ||
        addr.neighbourhood ||
        addr.residential ||
        addr.city_district ||
        addr.subdistrict ||
        addr.quarter ||
        "";
      const cityRaw =
        addr.city || addr.town || addr.municipality || addr.county || addr.state_district || "";
      const state = addr.state || "";
      const country = addr.country || "";
      const postcode = addr.postcode || "";

      const suburb = suburbRaw ? cleanAreaName(suburbRaw) : "";
      const city = cityRaw ? cleanAreaName(cityRaw) : "";

      let formattedAddress = "";
      if (road && suburb) {
        formattedAddress = `${road}, ${suburb}${postcode ? ` - ${postcode}` : ""}`;
      } else if (suburb && city) {
        formattedAddress = `${suburb}, ${city}${postcode ? ` ${postcode}` : ""}`;
      } else if (road && city) {
        formattedAddress = `${road}, ${city}${postcode ? ` ${postcode}` : ""}`;
      } else {
        formattedAddress = [suburb || city, state, country].filter(Boolean).join(", ");
      }

      const cityArea = suburb || city || road || `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
      const stateCountry =
        city && state
          ? `${city}${postcode ? ` ${postcode}` : ""}, ${state}`
          : [state, country].filter(Boolean).join(", ");

      return { formattedAddress, cityArea, stateCountry };
    }
  } catch {
    // Fallback to raw coordinates
  }

  return {
    formattedAddress: `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`,
    cityArea: `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`,
    stateCountry: "Live Coordinates Detected",
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

  // Manual request / refresh trigger for live GPS
  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Location services are not supported on this browser.");
      setGeoStatus("error");
      return;
    }

    setGeoStatus("locating");
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
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
          setError("Location permission denied. Please allow GPS access in your browser.");
          setGeoStatus("denied");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError(
            "GPS satellite position unavailable. Please check your device location settings.",
          );
          setGeoStatus("error");
        } else if (err.code === err.TIMEOUT) {
          setError("GPS location request timed out. Tap retry to acquire signal again.");
          setGeoStatus("error");
        } else {
          setError("Unable to determine live location.");
          setGeoStatus("error");
        }
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  }, []);

  // Automatic GPS detection on mount & continuous live watching
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Location services are not supported on this browser.");
      setGeoStatus("error");
      return;
    }

    setGeoStatus("locating");

    // 1. Initial immediate position query
    navigator.geolocation.getCurrentPosition(
      (pos) => {
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
          setError("Location permission denied. Please allow GPS access in your browser.");
          setGeoStatus("denied");
        } else {
          setError("Unable to determine live location.");
          setGeoStatus("error");
        }
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );

    // 2. Continuous position watcher
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
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
          setError("Location permission denied. Please allow GPS access in your browser.");
          setGeoStatus("denied");
        } else if (!coordsRef.current) {
          setError("Unable to determine live location.");
          setGeoStatus("error");
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Trigger real-time reverse geocoding on live GPS coordinate updates
  useEffect(() => {
    if (!coords || isGeocodingRef.current) return;

    const last = lastGeocodedCoordsRef.current;
    if (last) {
      const movedMeters = distanceMeters(last, coords);
      // Don't re-query if movement is under 20 meters
      if (movedMeters < 20) return;
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

  // Dynamic status text, titles, and sublabels
  let locationTitle = "Detecting your location...";
  let locationSublabel = "Acquiring live GPS satellite signal...";

  if (geoStatus === "denied") {
    locationTitle = "Location permission required";
    locationSublabel = "Please enable GPS access in browser settings";
  } else if (geoStatus === "error") {
    locationTitle = "Unable to determine location";
    locationSublabel = error || "GPS satellite signal lost. Tap retry to reconnect.";
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

  const cityArea =
    geocodedAddress?.cityArea ||
    (coords
      ? `${coords.lat.toFixed(4)}° N, ${coords.lng.toFixed(4)}° E`
      : geoStatus === "denied"
        ? "Permission Denied"
        : geoStatus === "error"
          ? "Location Unavailable"
          : "Detecting...");

  const stateCountry =
    geocodedAddress?.stateCountry ||
    (coords
      ? "Live GPS Coordinates"
      : geoStatus === "denied"
        ? "GPS disabled in browser"
        : geoStatus === "error"
          ? "GPS signal lost"
          : "Acquiring GPS fix...");

  return {
    coords,
    accuracy,
    timestamp,
    error,
    geoStatus,
    isLocating: geoStatus === "locating" && !coords,
    effective: coords,
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
