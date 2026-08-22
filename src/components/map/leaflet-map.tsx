import { useMemo } from "react";
import { MapContainer, TileLayer, Circle, Marker, Popup, Tooltip } from "react-leaflet";
import L from "leaflet";

import type { Pin, Zone } from "./types";

export const riskColor: Record<string, string> = {
  restricted: "#C0483C",
  caution: "#D7A93F",
  safe: "#3F9E6E",
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

export default function LeafletMap({
  zones,
  pins,
  center,
  zoom = 12,
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
        const color = riskColor[zone.risk_level] ?? riskColor["safe"]!;
        return (
          <Circle
            key={zone.id}
            center={[zone.center_lat, zone.center_lng]}
            radius={zone.radius_m}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.22, weight: 1.5 }}
          >
            <Tooltip sticky>
              <span className="font-medium">{zone.name}</span> — {zone.risk_level}
              {zone.description ? <div>{zone.description}</div> : null}
            </Tooltip>
          </Circle>
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
