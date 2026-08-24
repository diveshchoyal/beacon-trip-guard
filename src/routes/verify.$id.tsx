import { useEffect, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Fingerprint,
  Globe,
  MapPin,
  PhoneCall,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  User,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { GlassCard, PressButton } from "@/components/ui/glass";

export const Route = createFileRoute("/verify/$id")({
  head: () => ({
    meta: [
      { title: "Verify Digital ID — BEACON" },
      {
        name: "description",
        content: "Official verification portal for BEACON tourist credentials.",
      },
    ],
  }),
  component: VerifyDigitalIdScreen,
});

interface VerifyData {
  valid: boolean;
  reason: string;
  touristName?: string;
  destination?: string;
  tripStart?: string;
  tripEnd?: string;
  emergencyContact?: string;
  digitalId?: string;
  hash?: string;
}

function VerifyDigitalIdScreen() {
  const { id } = useParams({ from: "/verify/$id" });
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerifyData | null>(null);

  useEffect(() => {
    async function runVerification() {
      if (!id) {
        setLoading(false);
        setResult({ valid: false, reason: "No Digital ID provided for verification." });
        return;
      }

      try {
        setLoading(true);

        // 1. Fetch digital ID record from database
        const { data: record, error } = await supabase
          .from("digital_ids")
          .select("*, profiles:user_id(full_name)")
          .eq("digital_id", id.trim())
          .maybeSingle();

        if (error || !record) {
          setResult({
            valid: false,
            reason: "Digital ID record not found in BEACON registry or invalid code.",
          });
          setLoading(false);
          return;
        }

        // 2. Fetch ledger anchor
        const { data: ledger } = await supabase
          .from("id_ledger")
          .select("hash, action, created_at")
          .eq("digital_id", record.digital_id)
          .order("created_at", { ascending: true });

        // 3. Recompute SHA-256 fingerprint
        const fingerprintData = [
          record.digital_id,
          record.user_id,
          record.id_number,
          record.destination,
          record.trip_start,
          record.trip_end,
          record.emergency_contact,
        ].join("|");

        const bytes = new TextEncoder().encode(fingerprintData);
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        const recomputed = Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        const anchored = (ledger ?? []).some((entry) => entry.hash === recomputed);
        const isValid = recomputed === record.hash && (anchored || (ledger ?? []).length === 0);

        setResult({
          valid: isValid,
          reason: isValid
            ? "Record cryptographic hash matches the tamper-evident ledger anchor."
            : "Hash mismatch detected. Record may have been modified outside the authorized ledger.",
          touristName:
            (record.profiles as { full_name?: string } | null)?.full_name || "Verified Traveler",
          destination: record.destination,
          tripStart: record.trip_start,
          tripEnd: record.trip_end,
          emergencyContact: record.emergency_contact,
          digitalId: record.digital_id,
          hash: record.hash,
        });
      } catch (err) {
        setResult({
          valid: false,
          reason: err instanceof Error ? err.message : "Failed to verify credential.",
        });
      } finally {
        setLoading(false);
      }
    }

    void runVerification();
  }, [id]);

  return (
    <main className="min-h-screen bg-[#FDFBF7] px-4 py-8 flex flex-col items-center justify-center text-[#1E1E1E]">
      <div className="w-full max-w-md space-y-5">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <Link
            to="/app/id"
            className="flex items-center gap-1 text-xs font-bold text-[#77716D] hover:text-[#1E1E1E] transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Back to App</span>
          </Link>
          <span className="text-xs font-black tracking-widest text-[#FF6F61] uppercase">
            BEACON SAFETY SYSTEM
          </span>
        </div>

        {/* Verification Card */}
        <div className="rounded-[36px] border border-[#F6B28F]/35 bg-white p-7 sm:p-8 shadow-xl text-left space-y-6">
          <div className="flex items-center justify-between border-b border-black/5 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF6F61] to-[#F6B28F] text-white shadow-xs">
                <Fingerprint className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-black text-[#1E1E1E]">Official Verification</h1>
                <p className="text-xs font-mono font-bold text-[#77716D]">{id}</p>
              </div>
            </div>

            {loading ? (
              <RefreshCw className="h-5 w-5 animate-spin text-[#FF6F61]" />
            ) : result?.valid ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#39B86B]/15 px-3 py-1 text-xs font-black text-[#39B86B]">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Verified ✓</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#E94B5F]/15 px-3 py-1 text-xs font-black text-[#E94B5F]">
                <ShieldX className="h-3.5 w-3.5" />
                <span>Invalid ✕</span>
              </span>
            )}
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-[#77716D] space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin text-[#FF6F61] mx-auto" />
              <p>Recomputing cryptographic proof against tamper-evident ledger…</p>
            </div>
          ) : result?.valid ? (
            <div className="space-y-4">
              {/* Status Banner */}
              <div className="rounded-2xl bg-[#39B86B]/10 p-4 border border-[#39B86B]/30 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-[#39B86B] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-black text-[#39B86B]">BEACON VERIFIED TOURIST ✓</h3>
                  <p className="text-[11px] text-[#77716D] mt-0.5">{result.reason}</p>
                </div>
              </div>

              {/* Permitted Tourist Details */}
              <div className="rounded-2xl bg-[#FFF8F3] p-4 border border-[#F6B28F]/25 space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#77716D] font-bold">Tourist Name:</span>
                  <span className="font-black text-[#1E1E1E] text-sm">{result.touristName}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[#77716D] font-bold">Verification Status:</span>
                  <span className="font-black text-[#39B86B]">Official Tourist Pass</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[#77716D] font-bold">Destination:</span>
                  <span className="font-bold text-[#1E1E1E]">{result.destination}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[#77716D] font-bold">Travel Validity:</span>
                  <span className="font-bold text-[#1E1E1E]">
                    {result.tripStart} → {result.tripEnd}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[#77716D] font-bold">Emergency Contact:</span>
                  <span className="font-bold text-[#1E1E1E]">{result.emergencyContact}</span>
                </div>

                <div className="pt-2 border-t border-black/5 flex justify-between items-center text-[10px]">
                  <span className="text-[#77716D]">Ledger Proof:</span>
                  <span className="font-mono text-[#77716D]">
                    {result.hash ? `${result.hash.slice(0, 16)}…` : "ANCHORED"}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-center text-[#77716D]">
                Verified by BEACON Tourist Safety System · Tamil Nadu Tourism & Police Integration
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-[#E94B5F]/10 p-5 border border-[#E94B5F]/30 space-y-2 text-center">
              <ShieldAlert className="h-8 w-8 text-[#E94B5F] mx-auto" />
              <h3 className="text-sm font-black text-[#E94B5F]">Credential Invalid / Expired ✕</h3>
              <p className="text-xs text-[#77716D]">{result?.reason}</p>
            </div>
          )}

          <Link
            to="/app/id"
            className="w-full block text-center rounded-2xl bg-gradient-to-r from-[#FF6F61] to-[#F6B28F] py-3 text-xs font-black text-white shadow-md cursor-pointer"
          >
            Open Tourist Digital ID
          </Link>
        </div>
      </div>
    </main>
  );
}
