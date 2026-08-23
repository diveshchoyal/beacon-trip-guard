export type Zone = {
  id: string;
  name: string;
  risk_level: string;
  description: string | null;
  center_lat: number;
  center_lng: number;
  radius_m: number;
};

export type Pin = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  sublabel?: string;
  tone: "self" | "tourist" | "alert" | "place";
};

export type {
  TouristPlace,
  TimeRule,
  SafetyStatus,
  PlaceSafetyEvaluation,
} from "./places-data";
