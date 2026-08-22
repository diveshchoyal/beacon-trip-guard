import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const generateSchema = z.object({
  id_number: z.string().trim().min(4).max(40),
  destination: z.string().trim().min(2).max(120),
  trip_start: z.string().min(8).max(20),
  trip_end: z.string().min(8).max(20),
  emergency_contact: z.string().trim().min(5).max(40),
});

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fingerprint(row: {
  digital_id: string;
  user_id: string;
  id_number: string;
  destination: string;
  trip_start: string;
  trip_end: string;
  emergency_contact: string;
}) {
  return [
    row.digital_id,
    row.user_id,
    row.id_number,
    row.destination,
    row.trip_start,
    row.trip_end,
    row.emergency_contact,
  ].join("|");
}

export const generateDigitalId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => generateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const digitalId = `BCN-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const hash = await sha256(fingerprint({ ...data, digital_id: digitalId, user_id: userId }));
    const qrPayload = JSON.stringify({ digital_id: digitalId, hash, issuer: "BEACON" });

    const { data: inserted, error } = await supabase
      .from("digital_ids")
      .insert({
        user_id: userId,
        digital_id: digitalId,
        id_number: data.id_number,
        destination: data.destination,
        trip_start: data.trip_start,
        trip_end: data.trip_end,
        emergency_contact: data.emergency_contact,
        qr_payload: qrPayload,
        hash,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    const { data: prev } = await supabase
      .from("id_ledger")
      .select("hash")
      .eq("digital_id", digitalId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    await supabase.from("id_ledger").insert({
      digital_id: digitalId,
      action: "issued",
      hash,
      prev_hash: prev?.hash ?? null,
    });

    return inserted;
  });

export const verifyDigitalId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ digital_id: z.string().min(3) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: row, error } = await supabase
      .from("digital_ids")
      .select("*")
      .eq("digital_id", data.digital_id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) return { valid: false, reason: "No record found for this Digital ID." };

    const recomputed = await sha256(
      fingerprint({
        digital_id: row.digital_id,
        user_id: row.user_id,
        id_number: row.id_number,
        destination: row.destination,
        trip_start: row.trip_start,
        trip_end: row.trip_end,
        emergency_contact: row.emergency_contact,
      }),
    );

    const { data: ledger } = await supabase
      .from("id_ledger")
      .select("hash, action, created_at")
      .eq("digital_id", data.digital_id)
      .order("created_at", { ascending: true });

    const anchored = (ledger ?? []).some((entry) => entry.hash === recomputed);
    const valid = recomputed === row.hash && anchored;

    return {
      valid,
      reason: valid
        ? "Record hash matches the ledger anchor. Identity is intact."
        : "Hash mismatch — this record does not match its ledger anchor.",
      checked_at: new Date().toISOString(),
      ledger_entries: ledger?.length ?? 0,
    };
  });
