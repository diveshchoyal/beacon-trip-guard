import { useEffect, useState } from "react";

export type Coords = { lat: number; lng: number };

export const DEFAULT_CENTER: Coords = { lat: 25.5788, lng: 91.8933 };

export function useGeolocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Location is not available on this device.");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setError(null);
      },
      () => setError("Location permission denied — using last known area."),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  return { coords, error, effective: coords ?? DEFAULT_CENTER };
}

/** Ray-casting point-in-polygon for [lat,lng] rings. */
export function pointInPolygon(point: Coords, polygon: unknown): boolean {
  if (!Array.isArray(polygon)) return false;
  const ring = polygon.filter((p): p is [number, number] => Array.isArray(p) && p.length === 2);
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = Number(ring[i]![0]);
    const xi = Number(ring[i]![1]);
    const yj = Number(ring[j]![0]);
    const xj = Number(ring[j]![1]);
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
