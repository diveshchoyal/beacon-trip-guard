export type Zone = {
  id: string;
  name: string;
  risk_level: string;
  description: string | null;
  polygon: unknown;
};

export type Pin = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  sublabel?: string;
  tone: "self" | "tourist" | "alert";
};
