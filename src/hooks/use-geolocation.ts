import { useEffect, useState, useCallback } from "react";

export type Coords = { lat: number; lng: number };

/** Chennai, India — default map centre. */
export const DEFAULT_CENTER: Coords = { lat: 13.0827, lng: 80.2707 };

export function useGeolocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [timestamp, setTimestamp] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Location is not available on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAccuracy(pos.coords.accuracy);
        setTimestamp(pos.timestamp);
        setError(null);
      },
      () => setError("Location permission denied — using last known area."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Location is not available on this device.");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAccuracy(pos.coords.accuracy);
        setTimestamp(pos.timestamp);
        setError(null);
      },
      () => setError("Location permission denied — using last known area."),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  return {
    coords,
    accuracy,
    timestamp,
    error,
    effective: coords ?? DEFAULT_CENTER,
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
