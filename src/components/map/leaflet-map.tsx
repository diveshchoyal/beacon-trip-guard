import { useMemo } from "react";
import { MapContainer, TileLayer, Polygon, Marker, Popup, Tooltip } from "react-leaflet";
import L from "leaflet";

import type { Pin, Zone } from "./types";

const riskColor: Record<string, string> = {
  high: "#C0483C",
  medium: "#C9A574",
  low: "#5E9E7E",
};

const pinColor: Record<Pin["tone"], string> = {
  self: "#C9A574",
  tourist: "#E8B4B8",
  alert: "#C0483C",
};

function makeIcon(tone: Pin["tone"]) {
  const size = tone === "alert" ? 20 : 16;
  return L.divIcon({
    className: "",
    html: `<div class="beacon-pin" style="width:${size}px;height:${size}px;background:${pinColor[tone]}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function toLatLngs(polygon: unknown): [number, number][] {
  if (!Array.isArray(polygon)) return [];
  return polygon
    .filter((p): p is [number, number] => Array.isArray(p) && p.length === 2)
    .map((p) => [Number(p[0]), Number(p[1])] as [number, number]);
}

export default function LeafletMap({
  zones,
  pins,
  center,
  zoom = 11,
}: {
  zones: Zone[];
  pins: Pin[];
  center: [number, number];
  zoom?: number;
}) {
  const icons = useMemo(
    () => ({ self: makeIcon("self"), tourist: makeIcon("tourist"), alert: makeIcon("alert") }),
    [],
  );

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom
      className="h-full w-full"
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      {zones.map((zone) => {
        const positions = toLatLngs(zone.polygon);
        if (positions.length < 3) return null;
        const color = riskColor[zone.risk_level] ?? riskColor["low"]!;
        return (
          <Polygon
            key={zone.id}
            positions={positions}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.22, weight: 1.5 }}
          >
            <Tooltip sticky>
              <span className="font-medium">{zone.name}</span> — {zone.risk_level} risk
            </Tooltip>
          </Polygon>
        );
      })}
      {pins.map((pin) => (
        <Marker key={pin.id} position={[pin.lat, pin.lng]} icon={icons[pin.tone]}>
          <Popup>
            <strong>{pin.label}</strong>
            {pin.sublabel ? <div>{pin.sublabel}</div> : null}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
