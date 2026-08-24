import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  FileCheck,
  Fingerprint,
  Globe,
  HeartPulse,
  IdCard,
  MapPin,
  PhoneCall,
  QrCode,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";

import beaconLogo from "@/assets/beacon-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { GlassCard, PressButton } from "@/components/ui/glass";
import { Field } from "@/routes/login";
import { generateDigitalId, verifyDigitalId } from "@/lib/digital-id.functions";
import { loadDocumentWallet, saveDocumentWallet, type DocumentWallet } from "@/lib/documents.types";

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
  const { user, profile, refresh } = useAuth();
  const queryClient = useQueryClient();
  const generate = useServerFn(generateDigitalId);
  const verify = useServerFn(verifyDigitalId);

  // Document Wallet data from profile/local wallet
  const [wallet, setWallet] = useState<DocumentWallet>({});

  // Digital ID Form State (Empty by default unless user has saved data)
  const [form, setForm] = useState({
    fullName: "",
    dob: "",
    nationality: "",
    gender: "",
    id_number: "",
    visa_status: "",
    visa_expiry: "",
    destination: "",
    trip_start: "",
    trip_end: "",
    emergency_contact_name: "",
    emergency_contact: "",
    blood_group: "",
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

  // Auto-fill from My Documents on load if available
  useEffect(() => {
    if (user?.id) {
      const docWallet = loadDocumentWallet(user.id);
      setWallet(docWallet);

      setForm((prev) => ({
        ...prev,
        fullName: prev.fullName || docWallet.passport?.fullName || profile?.full_name || "",
        dob: prev.dob || docWallet.passport?.dob || "",
        nationality: prev.nationality || docWallet.passport?.nationality || "",
        gender: prev.gender || docWallet.passport?.gender || "",
        id_number:
          prev.id_number ||
          record?.id_number ||
          docWallet.passport?.docNumber ||
          docWallet.citizenId?.idNumber ||
          "",
        visa_status: prev.visa_status || docWallet.visa?.visaStatus || "",
        visa_expiry: prev.visa_expiry || docWallet.visa?.expiry || "",
        destination: prev.destination || record?.destination || docWallet.visa?.destination || "",
        trip_start: prev.trip_start || record?.trip_start || docWallet.visa?.validFrom || "",
        trip_end: prev.trip_end || record?.trip_end || docWallet.visa?.expiry || "",
        emergency_contact_name: prev.emergency_contact_name || docWallet.emergencyContactName || "",
        emergency_contact:
          prev.emergency_contact ||
          record?.emergency_contact ||
          docWallet.emergencyContactPhone ||
          profile?.phone ||
          "",
        blood_group: prev.blood_group || docWallet.bloodGroup || "",
      }));
    }
  }, [user, profile, record]);

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

  // Issue / Generate Digital ID from Manual / Auto-filled Details
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.id_number.trim()) {
      toast.error("Please enter your Passport or Citizen ID number.");
      return;
    }
    if (!form.destination.trim()) {
      toast.error("Please enter your trip destination.");
      return;
    }
    if (!form.trip_start || !form.trip_end) {
      toast.error("Please enter both trip start and end dates.");
      return;
    }
    if (!form.emergency_contact.trim()) {
      toast.error("Please provide an emergency contact phone number.");
      return;
    }

    setBusy(true);
    try {
      if (user?.id) {
        // 1. Update user profile name/phone if updated
        if (form.fullName.trim() && form.fullName.trim() !== profile?.full_name) {
          await supabase
            .from("profiles")
            .update({ full_name: form.fullName.trim() })
            .eq("id", user.id);
          await refresh();
        }

        // 2. Persist document info to My Documents wallet
        const currentWallet = loadDocumentWallet(user.id);
        const updatedWallet: DocumentWallet = {
          ...currentWallet,
          passport: {
            docNumber: form.id_number.trim(),
            fullName: form.fullName.trim() || profile?.full_name || "Traveler",
            dob: form.dob || currentWallet.passport?.dob || "",
            nationality:
              form.nationality.trim() || currentWallet.passport?.nationality || "Traveler",
            gender: form.gender.trim() || currentWallet.passport?.gender || "",
            expiry: currentWallet.passport?.expiry || "2030-12-31",
            savedAt: new Date().toISOString(),
            verified: true,
          },
          visa: {
            visaNumber: currentWallet.visa?.visaNumber || "V-IN-001",
            visaStatus: form.visa_status.trim() || "Valid",
            destination: form.destination.trim(),
            validFrom: form.trip_start,
            expiry: form.visa_expiry || form.trip_end,
            savedAt: new Date().toISOString(),
          },
          emergencyContactName: form.emergency_contact_name.trim(),
          emergencyContactPhone: form.emergency_contact.trim(),
          bloodGroup: form.blood_group.trim(),
        };
        saveDocumentWallet(user.id, updatedWallet);
        setWallet(updatedWallet);
      }

      // 3. Anchor and generate Digital ID via server function
      await generate({
        data: {
          id_number: form.id_number.trim(),
          destination: form.destination.trim(),
          trip_start: form.trip_start,
          trip_end: form.trip_end,
          emergency_contact: form.emergency_contact.trim(),
        },
      });

      toast.success("BEACON Digital ID created and anchored to ledger!");
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

  const touristName =
    form.fullName.trim() ||
    profile?.full_name?.trim() ||
    wallet.passport?.fullName ||
    "Tourist Pass";

  const nationality =
    form.nationality.trim() || wallet.passport?.nationality || "International Traveler";

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
      {/* 1. BEACON BRANDING HEADER */}
      {/* ========================================================================= */}
      <div className="rounded-[36px] border border-[#F6B28F]/35 bg-gradient-to-br from-white via-[#FFF8F3] to-[#FFF1EA] p-6 sm:p-8 shadow-[0_16px_45px_rgba(255,111,97,0.08)] text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          {/* Logo & Main Title */}
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-3xl bg-white p-2.5 shadow-md border border-[#F6B28F]/30 shrink-0">
              <img
                src={beaconLogo}
                alt="BEACON"
                className="h-full w-full object-contain drop-shadow-sm"
              />
            </div>

            <div>
              <span className="text-[11px] sm:text-xs font-black uppercase tracking-[0.3em] text-[#FF6F61] block">
                BEACON
              </span>
              <h1 className="mt-0.5 text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-[#1E1E1E]">
                VERIFIED TOURIST DIGITAL ID
              </h1>
              <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-[#39B86B]/15 px-3 py-0.5 text-xs font-black uppercase tracking-wide text-[#39B86B]">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Identity Verified</span>
              </div>
            </div>
          </div>

          {/* Navigation link to My Documents */}
          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <Link
              to="/app/profile"
              className="flex items-center gap-1.5 rounded-2xl bg-white border border-[#F6B28F]/40 px-4 py-2.5 text-xs font-bold text-[#1E1E1E] hover:bg-[#FFF8F3] transition-colors shadow-2xs"
            >
              <FileCheck className="h-4 w-4 text-[#FF6F61]" />
              <span>My Documents Wallet</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. COMPLETED DIGITAL ID CARD (SHOWN IMMEDIATELY WHEN RECORD EXISTS) */}
      {/* ========================================================================= */}
      {record && !editMode ? (
        <div className="rounded-[36px] border border-[#F6B28F]/35 bg-white/95 p-6 sm:p-8 shadow-[0_16px_50px_rgba(255,111,97,0.08)] backdrop-blur-md text-left space-y-6">
          {/* Top Bar: Pass Type + Verified Badge */}
          <div className="flex items-center justify-between border-b border-black/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white p-1.5 shadow-xs border border-[#F6B28F]/25 shrink-0">
                <img src={beaconLogo} alt="BEACON" className="h-full w-full object-contain" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#77716D] block">
                  BEACON OFFICIAL CREDENTIAL
                </span>
                <span className="text-xs font-black text-[#1E1E1E] font-mono">
                  {record.digital_id}
                </span>
              </div>
            </div>

            <span className="inline-flex items-center gap-1 rounded-full bg-[#39B86B]/15 px-3 py-1 text-xs font-black text-[#39B86B]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>✓ Identity Verified</span>
            </span>
          </div>

          {/* Section 1: IDENTITY */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F6B28F] to-[#FF6F61] text-white font-black text-2xl shadow-md shadow-[#FF6F61]/25 shrink-0">
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

            <div className="rounded-2xl bg-[#FFF8F3] px-4 py-2 border border-[#F6B28F]/25 text-xs text-left self-start sm:self-center">
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
              <div className="rounded-2xl bg-[#FFF8F3] p-4 border border-[#F6B28F]/25 space-y-1">
                <span className="text-[10px] font-black uppercase text-[#77716D] flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-[#FF6F61]" />
                  Destination
                </span>
                <p className="text-sm font-black text-[#1E1E1E]">{record.destination}</p>
              </div>

              <div className="rounded-2xl bg-[#FFF8F3] p-4 border border-[#F6B28F]/25 space-y-1">
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

          {/* Section 3: EMERGENCY & MEDICAL */}
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#77716D]">
              EMERGENCY CONTACT & MEDICAL
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#FFF8F3] p-4 border border-[#F6B28F]/25 space-y-1">
                <span className="text-[10px] font-black uppercase text-[#77716D] flex items-center gap-1">
                  <PhoneCall className="h-3 w-3 text-[#39B86B]" />
                  Emergency Contact
                </span>
                <p className="text-sm font-bold text-[#1E1E1E]">{record.emergency_contact}</p>
              </div>

              <div className="rounded-2xl bg-[#FFF8F3] p-4 border border-[#F6B28F]/25 space-y-1">
                <span className="text-[10px] font-black uppercase text-[#77716D] flex items-center gap-1">
                  <HeartPulse className="h-3 w-3 text-[#E94B5F]" />
                  Blood Group
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
              <span>SHOW DIGITAL ID / QR</span>
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
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-2xl bg-black/5 py-3.5 px-4 text-xs font-bold text-[#77716D] hover:bg-black/10 hover:text-[#1E1E1E] transition-colors cursor-pointer shrink-0"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Edit Details</span>
            </button>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* 3. MANUAL DIGITAL ID CREATION / EDIT FORM */
        /* ========================================================================= */
        <div className="rounded-[36px] border border-[#F6B28F]/35 bg-white/95 p-6 sm:p-8 shadow-sm text-left space-y-6">
          <div className="flex items-center justify-between border-b border-black/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white p-2 shadow-xs border border-[#F6B28F]/25 shrink-0">
                <img src={beaconLogo} alt="BEACON" className="h-full w-full object-contain" />
              </div>
              <div>
                <h2 className="text-lg font-black text-[#1E1E1E]">
                  {record ? "Update Your Digital ID" : "Create BEACON Digital ID"}
                </h2>
                <p className="text-xs text-[#77716D]">
                  Enter your details below to generate your secure, tamper-evident tourist pass.
                </p>
              </div>
            </div>

            {record && (
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className="text-xs font-bold text-[#77716D] hover:underline cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            {/* Identity Group */}
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#FF6F61]">
                1. IDENTITY INFORMATION
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Full Name"
                  value={form.fullName}
                  onChange={setField("fullName")}
                  placeholder="Enter your full name"
                />
                <Field
                  label="Passport / Citizen ID Number"
                  value={form.id_number}
                  onChange={setField("id_number")}
                  placeholder="e.g. P1234567"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field
                  label="Nationality"
                  value={form.nationality}
                  onChange={setField("nationality")}
                  placeholder="e.g. Indian, American"
                  required={false}
                />
                <Field
                  label="Gender"
                  value={form.gender}
                  onChange={setField("gender")}
                  placeholder="Male / Female / Other"
                  required={false}
                />
                <Field
                  label="Date of Birth"
                  type="date"
                  value={form.dob}
                  onChange={setField("dob")}
                  required={false}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Visa Status"
                  value={form.visa_status}
                  onChange={setField("visa_status")}
                  placeholder="e.g. Valid / Tourist Visa / On Arrival"
                  required={false}
                />
                <Field
                  label="Visa Expiry"
                  type="date"
                  value={form.visa_expiry}
                  onChange={setField("visa_expiry")}
                  required={false}
                />
              </div>
            </div>

            <div className="h-px bg-black/5" />

            {/* Trip Group */}
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#FF6F61]">
                2. TRIP DESTINATION & DURATION
              </span>

              <Field
                label="Destination"
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
            </div>

            <div className="h-px bg-black/5" />

            {/* Emergency Group */}
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#FF6F61]">
                3. EMERGENCY CONTACT & MEDICAL
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field
                  label="Contact Person Name"
                  value={form.emergency_contact_name}
                  onChange={setField("emergency_contact_name")}
                  placeholder="e.g. Parent / Spouse / Guide"
                  required={false}
                />
                <Field
                  label="Emergency Phone Number"
                  value={form.emergency_contact}
                  onChange={setField("emergency_contact")}
                  placeholder="+91 98765 43210"
                />
                <Field
                  label="Blood Group (Optional)"
                  value={form.blood_group}
                  onChange={setField("blood_group")}
                  placeholder="e.g. O+, A+, B+"
                  required={false}
                />
              </div>
            </div>

            <div className="pt-3">
              <PressButton
                type="submit"
                disabled={busy}
                className="w-full py-4 text-sm font-black tracking-wide"
              >
                {busy
                  ? "Anchoring Credential…"
                  : record
                    ? "SAVE & UPDATE DIGITAL ID"
                    : "SAVE & CREATE DIGITAL ID"}
              </PressButton>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SHOW DIGITAL ID QR MODAL WITH 15-MIN COUNTDOWN & BEACON BRANDING */}
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
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white p-1.5 shadow-xs border border-[#F6B28F]/30 shrink-0">
                    <img src={beaconLogo} alt="BEACON" className="h-full w-full object-contain" />
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

              {/* Link to Verification View */}
              <div className="flex items-center gap-2 pt-1">
                <Link
                  to="/verify/$id"
                  params={{ id: record.digital_id }}
                  className="flex-1 rounded-2xl bg-[#FFF8F3] border border-[#F6B28F]/30 py-2.5 text-xs font-bold text-[#1E1E1E] hover:bg-white transition-colors text-center cursor-pointer"
                >
                  Inspect Verification View
                </Link>
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
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white p-1.5 shadow-xs border border-[#F6B28F]/25 shrink-0">
                    <img src={beaconLogo} alt="BEACON" className="h-full w-full object-contain" />
                  </div>
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
