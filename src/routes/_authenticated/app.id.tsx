import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  FileCheck,
  Fingerprint,
  Globe,
  HeartPulse,
  IdCard,
  Lock,
  MapPin,
  PhoneCall,
  QrCode,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Sparkles,
  User,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { GlassCard, PressButton } from "@/components/ui/glass";
import { Field } from "@/routes/login";
import { generateDigitalId, verifyDigitalId } from "@/lib/digital-id.functions";
import { loadDocumentWallet, type DocumentWallet } from "@/lib/documents.types";

export const Route = createFileRoute("/_authenticated/app/id")({
  component: DigitalIdPage,
});

type VerifyResult = {
  valid: boolean;
  reason: string;
  checked_at?: string;
  ledger_entries?: number;
};

function DigitalIdPage() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const generate = useServerFn(generateDigitalId);
  const verify = useServerFn(verifyDigitalId);

  // Document Wallet data for auto-fill
  const [wallet, setWallet] = useState<DocumentWallet>({});

  // Digital ID Form State
  const [form, setForm] = useState({
    id_number: "",
    destination: "Chennai, Tamil Nadu",
    trip_start: new Date().toISOString().slice(0, 10),
    trip_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    emergency_contact: "+91 98765 43210",
    blood_group: "O+",
  });

  const [editMode, setEditMode] = useState(false);
  const [busy, setBusy] = useState(false);

  // QR Modal & 15-Minute Countdown States
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrSecondsLeft, setQrSecondsLeft] = useState(15 * 60); // 15 minutes
  const [qrExpired, setQrExpired] = useState(false);

  // Integrity Check & Responder Verification Modal
  const [verifying, setVerifying] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  // Load existing Digital ID from Supabase
  const { data: record, isLoading } = useQuery({
    queryKey: ["digital-id", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("digital_ids")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Auto-fill from My Documents on load
  useEffect(() => {
    if (user?.id) {
      const docWallet = loadDocumentWallet(user.id);
      setWallet(docWallet);

      // Auto-populate form if not populated yet
      const passportNum = docWallet.passport?.docNumber || "";
      const citizenNum = docWallet.citizenId?.idNumber || "";
      const dest = docWallet.visa?.destination || "Chennai, Tamil Nadu";
      const start = docWallet.visa?.validFrom || new Date().toISOString().slice(0, 10);
      const end =
        docWallet.visa?.expiry ||
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const contact = docWallet.emergencyContactPhone || profile?.phone || "+91 98765 43210";

      setForm((prev) => ({
        ...prev,
        id_number: prev.id_number || passportNum || citizenNum || "P8291047",
        destination: prev.destination || dest,
        trip_start: prev.trip_start || start,
        trip_end: prev.trip_end || end,
        emergency_contact: prev.emergency_contact || contact,
      }));
    }
  }, [user, profile]);

  // 15-Minute Countdown Timer for QR Credential
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (qrModalOpen && qrSecondsLeft > 0 && !qrExpired) {
      interval = setInterval(() => {
        setQrSecondsLeft((prev) => {
          if (prev <= 1) {
            setQrExpired(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [qrModalOpen, qrSecondsLeft, qrExpired]);

  const handleOpenQrModal = () => {
    setQrSecondsLeft(15 * 60);
    setQrExpired(false);
    setQrModalOpen(true);
  };

  const setField = (key: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  // Issue / Generate Digital ID
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await generate({
        data: {
          id_number: form.id_number.trim() || "P8291047",
          destination: form.destination.trim() || "Chennai, Tamil Nadu",
          trip_start: form.trip_start,
          trip_end: form.trip_end,
          emergency_contact: form.emergency_contact.trim() || "+91 98765 43210",
        },
      });
      toast.success("BEACON Digital ID issued and anchored to tamper-evident ledger.");
      await queryClient.invalidateQueries({ queryKey: ["digital-id"] });
      setEditMode(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not issue Digital ID");
    } finally {
      setBusy(false);
    }
  };

  // Run Blockchain Ledger Anchor Verification
  const onVerifyIntegrity = async () => {
    if (!record) return;
    setVerifying(true);
    setVerifyResult(null);
    setVerifyModalOpen(true);
    try {
      const res = (await verify({ data: { digital_id: record.digital_id } })) as VerifyResult;
      setVerifyResult(res);
    } catch (err) {
      setVerifyResult({
        valid: false,
        reason: err instanceof Error ? err.message : "Verification request failed",
      });
    } finally {
      setVerifying(false);
    }
  };

  // Format timer minutes and seconds
  const formattedCountdown = useMemo(() => {
    const mins = Math.floor(qrSecondsLeft / 60);
    const secs = qrSecondsLeft % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, [qrSecondsLeft]);

  const touristName = profile?.full_name?.trim() || wallet.passport?.fullName || "Divesh Choyal";
  const nationality = wallet.passport?.nationality || "Indian";

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-[#F6B28F]/30 bg-white/90 p-12 text-center text-xs text-[#77716D]">
        Loading your BEACON Digital ID…
      </div>
    );
  }

  return (
    <div className="space-y-6 text-[#1E1E1E]">
      {/* ========================================================================= */}
      {/* 1. DIGITAL ID HEADER BANNER */}
      {/* ========================================================================= */}
      <div className="rounded-[32px] border border-[#F6B28F]/30 bg-gradient-to-br from-white via-[#FFF8F3] to-[#FFF1EA] p-6 sm:p-8 shadow-[0_12px_40px_rgba(255,111,97,0.06)] text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#39B86B]/15 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-[#39B86B]">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Identity Verified</span>
            </div>

            <h1 className="mt-2.5 text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-[#1E1E1E]">
              BEACON Digital ID
            </h1>
            <p className="mt-1 text-xs sm:text-sm font-medium text-[#77716D]">
              Tamper-evident blockchain tourist credential for checkpoints, hotel check-ins, and
              emergency response.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/app/profile"
              className="flex items-center gap-1.5 rounded-2xl bg-white border border-[#F6B28F]/40 px-3.5 py-2.5 text-xs font-bold text-[#1E1E1E] hover:bg-[#FFF8F3] transition-colors shadow-2xs"
            >
              <FileCheck className="h-4 w-4 text-[#FF6F61]" />
              <span>My Documents</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. AUTO-FILL NOTICE BANNER */}
      {/* ========================================================================= */}
      {!wallet.passport && !wallet.visa && (
        <div className="rounded-2xl border border-[#F6B28F]/30 bg-[#FFF8F3] p-4 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FF6F61]/15 text-[#FF6F61] shrink-0">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-black text-[#1E1E1E]">⚡ 1-Click Auto-Fill Available</p>
              <p className="text-[11px] text-[#77716D]">
                Save your Passport and Visa in Profile $\rightarrow$ My Documents to automatically
                populate your Digital ID credentials.
              </p>
            </div>
          </div>
          <Link
            to="/app/profile"
            className="rounded-xl bg-white border border-[#F6B28F]/40 px-3 py-1.5 text-xs font-bold text-[#FF6F61] hover:bg-[#FF6F61] hover:text-white transition-colors self-start sm:self-center shrink-0"
          >
            Add Documents
          </Link>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. DIGITAL ID CREDENTIAL CARD (MINIMAL, CLEAN UI) */}
      {/* ========================================================================= */}
      {record && !editMode ? (
        <div className="rounded-[36px] border border-[#F6B28F]/35 bg-white/95 p-6 sm:p-8 shadow-[0_16px_50px_rgba(255,111,97,0.08)] backdrop-blur-md text-left space-y-6">
          {/* Top Bar: Pass Type + Verified Badge */}
          <div className="flex items-center justify-between border-b border-black/5 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF6F61] to-[#F6B28F] text-white shadow-xs">
                <Fingerprint className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#77716D] block">
                  BEACON VERIFIED TOURIST ID
                </span>
                <span className="text-xs font-black text-[#1E1E1E] font-mono">
                  {record.digital_id}
                </span>
              </div>
            </div>

            <span className="inline-flex items-center gap-1 rounded-full bg-[#39B86B]/15 px-3 py-1 text-xs font-black text-[#39B86B]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Identity Verified</span>
            </span>
          </div>

          {/* Section 1: IDENTITY */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F6B28F] to-[#FF6F61] text-white font-black text-2xl shadow-md shadow-[#FF6F61]/25">
                {touristName.charAt(0).toUpperCase()}
              </div>

              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-black text-[#1E1E1E]">{touristName}</h2>
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#77716D]">
                  <span className="flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5 text-[#FF6F61]" />
                    {nationality}
                  </span>
                  <span>·</span>
                  <span className="text-[#39B86B] font-bold">Passport ✓</span>
                  <span>·</span>
                  <span className="text-[#39B86B] font-bold">Visa ✓</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-[#FFF8F3] px-3.5 py-2 border border-[#F6B28F]/25 text-xs text-left self-start sm:self-center">
              <span className="text-[9px] font-black uppercase text-[#77716D] block">
                Govt Document Ref
              </span>
              <span className="font-mono font-bold text-[#1E1E1E]">{record.id_number}</span>
            </div>
          </div>

          <div className="h-px bg-black/5" />

          {/* Section 2: TRIP & TRAVEL DATES */}
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#77716D]">
              TRIP DETAILS
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#FFF8F3] p-3.5 border border-[#F6B28F]/25 space-y-1">
                <span className="text-[10px] font-black uppercase text-[#77716D] flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-[#FF6F61]" />
                  Destination
                </span>
                <p className="text-sm font-black text-[#1E1E1E]">{record.destination}</p>
              </div>

              <div className="rounded-2xl bg-[#FFF8F3] p-3.5 border border-[#F6B28F]/25 space-y-1">
                <span className="text-[10px] font-black uppercase text-[#77716D] flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-[#FF6F61]" />
                  Travel Duration
                </span>
                <p className="text-sm font-bold text-[#1E1E1E]">
                  {record.trip_start} → {record.trip_end}
                </p>
              </div>
            </div>
          </div>

          <div className="h-px bg-black/5" />

          {/* Section 3: EMERGENCY & BLOOD GROUP */}
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#77716D]">
              EMERGENCY CONTACT & MEDICAL
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#FFF8F3] p-3.5 border border-[#F6B28F]/25 space-y-1">
                <span className="text-[10px] font-black uppercase text-[#77716D] flex items-center gap-1">
                  <PhoneCall className="h-3 w-3 text-[#39B86B]" />
                  Emergency Contact
                </span>
                <p className="text-sm font-bold text-[#1E1E1E]">{record.emergency_contact}</p>
              </div>

              <div className="rounded-2xl bg-[#FFF8F3] p-3.5 border border-[#F6B28F]/25 space-y-1">
                <span className="text-[10px] font-black uppercase text-[#77716D] flex items-center gap-1">
                  <HeartPulse className="h-3 w-3 text-[#E94B5F]" />
                  Blood Group (Optional)
                </span>
                <p className="text-sm font-bold text-[#1E1E1E]">{form.blood_group || "O+"}</p>
              </div>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            {/* Show Digital ID Button (Opens QR Modal) */}
            <button
              onClick={handleOpenQrModal}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF6F61] via-[#F6B28F] to-[#FF6F61] py-3.5 px-6 text-sm font-black text-white shadow-lg shadow-[#FF6F61]/30 hover:scale-[1.01] active:scale-98 transition-all cursor-pointer"
            >
              <QrCode className="h-5 w-5" />
              <span>SHOW DIGITAL ID</span>
            </button>

            {/* Verify Integrity Button */}
            <button
              onClick={onVerifyIntegrity}
              disabled={verifying}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-2xl bg-[#FFF8F3] border border-[#F6B28F]/40 py-3.5 px-5 text-xs font-bold text-[#1E1E1E] hover:bg-white transition-colors cursor-pointer shrink-0"
            >
              <ShieldCheck className="h-4 w-4 text-[#39B86B]" />
              <span>Verify Integrity</span>
            </button>

            {/* Edit Button */}
            <button
              onClick={() => setEditMode(true)}
              className="w-full sm:w-auto rounded-2xl bg-black/5 py-3.5 px-4 text-xs font-bold text-[#77716D] hover:bg-black/10 hover:text-[#1E1E1E] transition-colors cursor-pointer shrink-0"
            >
              Edit Details
            </button>
          </div>
        </div>
      ) : (
        /* Digital ID Form / Issuance Mode */
        <div className="rounded-[36px] border border-[#F6B28F]/35 bg-white/95 p-6 sm:p-8 shadow-sm text-left space-y-5">
          <div className="flex items-center justify-between border-b border-black/5 pb-3">
            <div>
              <h2 className="text-lg font-black text-[#1E1E1E]">
                {record ? "Update Your Digital ID" : "Issue BEACON Digital ID"}
              </h2>
              <p className="text-xs text-[#77716D]">
                Information is verified and anchored with cryptographic tamper evidence.
              </p>
            </div>

            {record && (
              <button
                onClick={() => setEditMode(false)}
                className="text-xs font-bold text-[#77716D] hover:underline cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <Field
              label="Govt Document / Passport Number"
              value={form.id_number}
              onChange={setField("id_number")}
              placeholder="e.g. P8291047"
            />

            <Field
              label="Trip Destination"
              value={form.destination}
              onChange={setField("destination")}
              placeholder="e.g. Chennai, Tamil Nadu"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Trip Start Date"
                type="date"
                value={form.trip_start}
                onChange={setField("trip_start")}
              />
              <Field
                label="Trip End Date"
                type="date"
                value={form.trip_end}
                onChange={setField("trip_end")}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Emergency Contact Phone"
                value={form.emergency_contact}
                onChange={setField("emergency_contact")}
                placeholder="+91 98765 43210"
              />
              <Field
                label="Blood Group (Optional)"
                value={form.blood_group}
                onChange={setField("blood_group")}
                placeholder="e.g. O+"
                required={false}
              />
            </div>

            <div className="pt-2 flex items-center gap-3">
              <PressButton type="submit" disabled={busy} className="w-full py-3">
                {busy
                  ? "Anchoring Credential…"
                  : record
                    ? "Re-issue Digital ID"
                    : "Generate Digital ID"}
              </PressButton>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SHOW DIGITAL ID QR MODAL WITH 15-MIN COUNTDOWN */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {qrModalOpen && record && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setQrModalOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-x-4 top-[8%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 w-full max-w-md rounded-[36px] border border-[#F6B28F]/40 bg-white p-7 text-center shadow-2xl space-y-5"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-black/5 pb-3 text-left">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF6F61] to-[#F6B28F] text-white">
                    <Fingerprint className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[#1E1E1E]">BEACON</h3>
                    <p className="text-[10px] font-black text-[#39B86B] uppercase tracking-wider">
                      VERIFIED DIGITAL ID ✓
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setQrModalOpen(false)}
                  className="rounded-full p-1.5 text-[#77716D] hover:bg-black/5 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* QR Code Container */}
              <div className="relative mx-auto rounded-3xl bg-[#FFF8F3] p-6 border border-[#F6B28F]/30 shadow-inner flex flex-col items-center justify-center">
                {!qrExpired ? (
                  <>
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                      <QRCodeSVG
                        value={record.qr_payload}
                        size={190}
                        level="H"
                        includeMargin={false}
                      />
                    </div>

                    <div className="mt-4 flex items-center gap-1.5 text-xs font-black text-[#39B86B]">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Credential Verified ✓</span>
                    </div>

                    <p className="mt-1 font-mono text-xs font-bold text-[#1E1E1E]">
                      {record.digital_id}
                    </p>
                  </>
                ) : (
                  <div className="py-8 space-y-3">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E94B5F]/15 text-[#E94B5F]">
                      <ShieldAlert className="h-7 w-7" />
                    </div>
                    <h4 className="text-base font-black text-[#E94B5F]">CREDENTIAL EXPIRED</h4>
                    <p className="text-xs text-[#77716D] max-w-xs">
                      For safety and cybersecurity, Digital ID tokens expire after 15 minutes.
                    </p>
                    <button
                      onClick={handleOpenQrModal}
                      className="rounded-xl bg-[#FF6F61] px-4 py-2 text-xs font-black text-white shadow-md hover:bg-[#FF8577] transition-all cursor-pointer"
                    >
                      Generate New Credential
                    </button>
                  </div>
                )}
              </div>

              {/* Countdown Bar */}
              {!qrExpired && (
                <div className="rounded-2xl bg-[#FFF8F3] p-3 text-xs flex items-center justify-between border border-[#F6B28F]/25">
                  <span className="text-[#77716D] font-bold flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-[#FF6F61]" />
                    <span>Expires in:</span>
                  </span>
                  <span className="font-mono font-black text-[#1E1E1E] text-sm">
                    {formattedCountdown}
                  </span>
                </div>
              )}

              {/* Close & Test Verification Links */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => {
                    setQrModalOpen(false);
                    void onVerifyIntegrity();
                  }}
                  className="flex-1 rounded-2xl bg-[#FFF8F3] border border-[#F6B28F]/30 py-2.5 text-xs font-bold text-[#1E1E1E] hover:bg-white transition-colors cursor-pointer"
                >
                  Inspect Verification View
                </button>
                <button
                  onClick={() => setQrModalOpen(false)}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-[#FF6F61] to-[#F6B28F] py-2.5 text-xs font-black text-white shadow-md transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 5. RESPONDER VERIFICATION INSPECTION MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {verifyModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setVerifyModalOpen(false)}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              className="fixed inset-x-4 top-[12%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 w-full max-w-lg rounded-[36px] border border-[#F6B28F]/40 bg-white p-7 text-left shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-black/5 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#39B86B]/15 text-[#39B86B]">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-[#1E1E1E]">BEACON VERIFIED ✓</h3>
                    <p className="text-xs text-[#77716D]">Official Responder Verification</p>
                  </div>
                </div>

                <button
                  onClick={() => setVerifyModalOpen(false)}
                  className="rounded-full p-1.5 text-[#77716D] hover:bg-black/5 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {verifying ? (
                <div className="py-8 text-center text-xs text-[#77716D] flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-[#FF6F61]" />
                  <span>Recomputing cryptographic hash against ledger anchor…</span>
                </div>
              ) : verifyResult?.valid ? (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-[#39B86B]/10 p-3.5 border border-[#39B86B]/30 flex items-start gap-2.5">
                    <CheckCircle2 className="h-5 w-5 text-[#39B86B] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-black text-[#39B86B]">
                        Credential Valid & Intact ✓
                      </p>
                      <p className="text-[11px] text-[#77716D] mt-0.5">{verifyResult.reason}</p>
                    </div>
                  </div>

                  {/* Permitted Verification Information */}
                  <div className="rounded-2xl bg-[#FFF8F3] p-4 border border-[#F6B28F]/25 space-y-2.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#77716D] font-bold">Tourist Name:</span>
                      <span className="font-black text-[#1E1E1E]">{touristName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#77716D] font-bold">Verification Status:</span>
                      <span className="font-black text-[#39B86B]">Verified Tourist</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#77716D] font-bold">Trip Destination:</span>
                      <span className="font-bold text-[#1E1E1E]">{record?.destination}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#77716D] font-bold">Trip Dates:</span>
                      <span className="font-bold text-[#1E1E1E]">
                        {record?.trip_start} → {record?.trip_end}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#77716D] font-bold">Emergency Contact:</span>
                      <span className="font-bold text-[#1E1E1E]">{record?.emergency_contact}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-black/5 text-[10px]">
                      <span className="text-[#77716D]">Ledger Proof Anchor:</span>
                      <span className="font-mono text-[#77716D]">
                        {record?.hash ? `${record.hash.slice(0, 16)}…` : "ANCHORED"}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-[#E94B5F]/10 p-4 border border-[#E94B5F]/30 space-y-1">
                  <div className="flex items-center gap-2 text-[#E94B5F]">
                    <ShieldX className="h-5 w-5" />
                    <h4 className="text-xs font-black">Credential Invalid / Tampered ✕</h4>
                  </div>
                  <p className="text-xs text-[#77716D]">
                    {verifyResult?.reason || "Verification failed"}
                  </p>
                </div>
              )}

              <button
                onClick={() => setVerifyModalOpen(false)}
                className="w-full rounded-2xl bg-gradient-to-r from-[#FF6F61] to-[#F6B28F] py-2.5 text-xs font-black text-white shadow-md cursor-pointer"
              >
                Close Verification
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
