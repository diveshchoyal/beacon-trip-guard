// Supabase Edge Function: generate-digital-id
// Deploy with: supabase functions deploy generate-digital-id
//
// What it does:
// 1. Takes the tourist's KYC/trip form data
// 2. Saves it to digital_ids table
// 3. Builds a tamper-evident hash-chain entry in id_ledger:
//    current_hash = SHA256(record_data + previous_hash)
// 4. Returns a QR payload (a short verification code) for the ID card

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// service_role key lives ONLY here, server-side. Never expose it to the frontend.

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify the calling user via their JWT (passed from the frontend)
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401 });
    }
    const touristId = userData.user.id;

    const body = await req.json();
    const {
      id_number,
      destination,
      trip_start,
      trip_end,
      emergency_contact_name,
      emergency_contact_phone,
    } = body;

    if (!id_number || !destination || !trip_start || !trip_end) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    // 1. Insert the digital ID record
    const { data: digitalId, error: insertErr } = await supabase
      .from("digital_ids")
      .insert({
        tourist_id: touristId,
        id_number,
        destination,
        trip_start,
        trip_end,
        emergency_contact_name,
        emergency_contact_phone,
        status: "active",
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // 2. Get the previous hash in the chain (or '0' if this is the first ever record)
    const { data: lastEntry } = await supabase
      .from("id_ledger")
      .select("current_hash")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    const previousHash = lastEntry?.current_hash ?? "0".repeat(64);

    // 3. Build the record snapshot and compute the new hash
    const recordData = {
      digital_id: digitalId.id,
      tourist_id: touristId,
      id_number,
      destination,
      trip_start,
      trip_end,
      timestamp: new Date().toISOString(),
    };

    const dataString = JSON.stringify(recordData) + previousHash;
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(dataString));
    const currentHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // 4. Write the ledger entry
    const { error: ledgerErr } = await supabase.from("id_ledger").insert({
      digital_id_ref: digitalId.id,
      record_data: recordData,
      previous_hash: previousHash,
      current_hash: currentHash,
    });

    if (ledgerErr) throw ledgerErr;

    // 5. QR payload = short verification string (digital_id + hash prefix)
    const qrPayload = `${digitalId.id}:${currentHash.slice(0, 16)}`;

    await supabase.from("digital_ids").update({ qr_payload: qrPayload }).eq("id", digitalId.id);

    return new Response(
      JSON.stringify({
        success: true,
        digital_id: digitalId.id,
        qr_payload: qrPayload,
        hash: currentHash,
      }),
      { headers: { "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
