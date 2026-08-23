import { useMemo, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Circle,
  Marker,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { MapPin, Navigation, LocateFixed } from "lucide-react";

import type { Pin, Zone, TouristPlace, SafetyStatus } from "./types";
import { evaluatePlaceSafety, getPlaceImageUrl, riskColor } from "./places-data";

const pinColor: Record<Pin["tone"], string> = {
  self: "#2563EB",
  tourist: "#E8B4B8",
  alert: "#C0483C",
  place: "#3F9E6E",
};

/** Live tourist user location marker (pulsing blue dot) */
function makeUserLocationIcon() {
  return L.divIcon({
    className: "beacon-user-location-div-icon",
    html: `
      <div class="user-location-marker">
        <div class="user-location-pulse"></div>
        <div class="user-location-core"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

/** Distinct pin icon for tourist places colored by active dynamic safety status */
function makePlaceIcon(safetyColor: string) {
  return L.divIcon({
    className: "beacon-place-pin-div-icon",
    html: `
      <div class="place-pin-marker" style="width: 32px; height: 38px;">
        <svg width="32" height="38" viewBox="0 0 32 38" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 0C7.16344 0 0 7.16344 0 16C0 25.5 13.6 36.8 15.1 37.9C15.6 38.3 16.4 38.3 16.9 37.9C18.4 36.8 32 25.5 32 16C32 7.16344 24.8366 0 16 0Z" fill="${safetyColor}"/>
          <path d="M16 1.5C8.0 1.5 1.5 8.0 1.5 16C1.5 24.6 14.3 35.1 16 36.4C17.7 35.1 30.5 24.6 30.5 16C30.5 8.0 24.0 1.5 16 1.5Z" stroke="#FFFFFF" stroke-width="1.8" stroke-opacity="0.95"/>
          <circle cx="16" cy="15" r="6.5" fill="#FFFFFF" />
          <circle cx="16" cy="15" r="4.5" fill="${safetyColor}" />
        </svg>
      </div>
    `,
    iconSize: [32, 38],
    iconAnchor: [16, 38],
    popupAnchor: [0, -38],
  });
}

function makeStandardIcon(tone: Pin["tone"]) {
  if (tone === "self") return makeUserLocationIcon();
  const size = tone === "alert" ? 20 : 16;
  return L.divIcon({
    className: "beacon-standard-div-icon",
    html: `<div class="beacon-pin" style="width:${size}px;height:${size}px;background:${pinColor[tone]}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

/** Ensures Leaflet correctly invalidates container size and sets initial view cleanly without world zoom */
function MapInitializer({
  center,
  zoom,
}: {
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Invalidate container size to prevent grey tiles and world-zoom bug in flex containers
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 400);

    if (!hasInitialized.current) {
      hasInitialized.current = true;
      map.setView(center, zoom, { animate: false });
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map, center, zoom]);

  return null;
}

/** Recenter floating glass button */
function RecenterButton({ userLocation }: { userLocation?: [number, number] }) {
  const map = useMap();

  if (!userLocation) return null;

  return (
    <div
      className="pointer-events-auto absolute bottom-5 right-5 z-[400]"
      style={{ zIndex: 400 }}
    >
      <button
        onClick={() => {
          map.flyTo(userLocation, 13, { duration: 1.2, easeLinearity: 0.25 });
        }}
        className="flex h-11 w-11 items-center justify-center rounded-full glass shadow-lg hover:scale-110 active:scale-95 transition-all text-foreground hover:text-primary cursor-pointer border border-white/80 backdrop-blur-xl"
        title="Recenter to my GPS location"
        aria-label="Recenter to my GPS location"
      >
        <LocateFixed className="h-5 w-5" />
      </button>
    </div>
  );
}

export default function LeafletMap({
  zones = [],
  pins = [],
  places = [],
  center,
  zoom = 7,
  currentTime = new Date(),
  selectedStatus = null,
}: {
  zones?: Zone[];
  pins?: Pin[];
  places?: TouristPlace[];
  center: [number, number];
  zoom?: number;
  currentTime?: Date;
  selectedStatus?: SafetyStatus | null;
}) {
  const standardIcons = useMemo(
    () => ({
      self: makeUserLocationIcon(),
      tourist: makeStandardIcon("tourist"),
      alert: makeStandardIcon("alert"),
      place: makeStandardIcon("place"),
    }),
    [],
  );

  const placeIcons = useMemo(
    () => ({
      safe: makePlaceIcon("#3F9E6E"),
      caution: makePlaceIcon("#D7A93F"),
      restricted: makePlaceIcon("#C0483C"),
    }),
    [],
  );

  // Evaluate place safety dynamically and filter by selectedStatus
  const evaluatedPlaces = useMemo(() => {
    return places
      .map((place) => ({
        place,
        evaluation: evaluatePlaceSafety(place, currentTime),
      }))
      .filter(({ evaluation }) => {
        if (!selectedStatus) return true;
        return evaluation.status === selectedStatus;
      });
  }, [places, currentTime, selectedStatus]);

  // Find user's location coordinates for recentering button
  const userPin = pins.find((p) => p.tone === "self");
  const userLocation: [number, number] = userPin ? [userPin.lat, userPin.lng] : center;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom
      className="h-full w-full"
      style={{ height: "100%", width: "100%" }}
    >
      <MapInitializer center={center} zoom={zoom} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />

      {/* Geofence zones (if any present, e.g. for dashboard) */}
      {zones.map((zone) => {
        const color = riskColor[zone.risk_level] ?? riskColor["safe"]!;
        return (
          <Circle
            key={zone.id}
            center={[zone.center_lat, zone.center_lng]}
            radius={zone.radius_m}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.18, weight: 1.5 }}
          >
            <Tooltip sticky>
              <span className="font-medium">{zone.name}</span> — {zone.risk_level}
              {zone.description ? <div>{zone.description}</div> : null}
            </Tooltip>
          </Circle>
        );
      })}

      {/* Individual tourist place markers with dynamic safety evaluation & glassmorphic popups */}
      {evaluatedPlaces.map(({ place, evaluation }) => (
        <Marker
          key={place.id}
          position={[place.lat, place.lng]}
          icon={placeIcons[evaluation.status]}
        >
          <Popup className="beacon-place-popup" autoPanPadding={[20, 20]} maxWidth={320}>
            <div className="w-[280px] overflow-hidden text-left font-sans">
              {/* Place Cover Image */}
              <div className="relative h-32 w-full overflow-hidden bg-muted">
                <img
                  src={place.imageUrl || getPlaceImageUrl(place.id)}
                  alt={place.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={(event) => {
                    const target = event.currentTarget;
                    target.onerror = null;
                    target.src = getPlaceImageUrl(place.id);
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-white drop-shadow-md">
                  <span className="text-[10px] font-semibold tracking-wider uppercase opacity-95 bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-sm">
                    {place.region} · {place.category}
                  </span>
                </div>
              </div>

              {/* Content Body */}
              <div className="p-3.5 space-y-2.5">
                <div>
                  <h3 className="text-base font-bold text-foreground leading-snug">
                    {place.name}
                  </h3>
                  <p className="text-[12px] text-muted-foreground line-clamp-2 mt-0.5">
                    {place.shortDescription}
                  </p>
                </div>

                {/* Dynamic Safety Status Badge & Reason */}
                <div
                  className="rounded-xl p-2.5 transition-colors border"
                  style={{
                    backgroundColor: evaluation.bgColor,
                    borderColor: evaluation.borderColor,
                  }}
                >
                  <div
                    className="flex items-center gap-1.5 font-semibold text-xs"
                    style={{ color: evaluation.textColor }}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: evaluation.color }}
                    />
                    <span>{evaluation.label}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-foreground/85 mt-1">
                    {evaluation.reason}
                  </p>
                </div>

                {/* Address */}
                <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                  <span className="line-clamp-2 leading-tight">{place.address}</span>
                </div>

                {/* Get Directions Button */}
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-sm hover:brightness-105 transition-all active:scale-[0.98]"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Get Directions
                </a>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* User and other telemetry pins */}
      {pins.map((pin) => (
        <Marker
          key={pin.id}
          position={[pin.lat, pin.lng]}
          icon={standardIcons[pin.tone]}
        >
          <Popup autoPanPadding={[20, 20]}>
            <div className="p-1">
              <strong className="text-sm font-semibold">{pin.label}</strong>
              {pin.sublabel ? (
                <div className="text-xs text-muted-foreground mt-0.5">{pin.sublabel}</div>
              ) : null}
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Circular floating recenter button on bottom-right of map */}
      <RecenterButton userLocation={userLocation} />
    </MapContainer>
  );
}
