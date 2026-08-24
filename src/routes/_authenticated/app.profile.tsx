import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  FileText,
  Fingerprint,
  Globe,
  IdCard,
  LogOut,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  User,
  X,
  Zap,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard, PressButton } from "@/components/ui/glass";
import { useSignOut } from "@/components/layout/nav";
import { Field } from "@/routes/login";
import {
  type DocumentWallet,
  loadDocumentWallet,
  saveDocumentWallet,
  parseDocumentInfo,
} from "@/lib/documents.types";

export const Route = createFileRoute("/_authenticated/app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, refresh } = useAuth();
  const signOut = useSignOut();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  // Document Wallet state
  const [wallet, setWallet] = useState<DocumentWallet>({});
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [editingDocType, setEditingDocType] = useState<"passport" | "visa" | "citizenId" | null>(
    null,
  );

  // Document Form State inside Modal
  const [docForm, setDocForm] = useState({
    docNumber: "",
    fullName: "",
    dob: "",
    nationality: "",
    gender: "",
    expiry: "",
    visaStatus: "",
    destination: "",
    validFrom: "",
    state: "",
  });
  const [isExtracting, setIsExtracting] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
    if (user?.id) {
      setWallet(loadDocumentWallet(user.id));
    }
  }, [profile, user]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim().slice(0, 100), phone: phone.trim().slice(0, 20) })
      .eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile details updated");
    await refresh();
  };

  const openDocModal = (type: "passport" | "visa" | "citizenId") => {
    setEditingDocType(type);
    if (type === "passport") {
      const p = wallet.passport;
      setDocForm({
        docNumber: p?.docNumber || "",
        fullName: p?.fullName || fullName || "",
        dob: p?.dob || "1998-05-14",
        nationality: p?.nationality || "Indian",
        gender: p?.gender || "Male",
        expiry: p?.expiry || "2032-11-20",
        visaStatus: "",
        destination: "",
        validFrom: "",
        state: "",
      });
    } else if (type === "visa") {
      const v = wallet.visa;
      setDocForm({
        docNumber: "",
        fullName: fullName || "",
        dob: "",
        nationality: "",
        gender: "",
        expiry: v?.expiry || "2026-09-30",
        visaStatus: v?.visaStatus || "Tourist / e-Visa (Active)",
        destination: v?.destination || "Chennai, Tamil Nadu",
        validFrom: v?.validFrom || "2026-08-01",
        state: "",
      });
    } else if (type === "citizenId") {
      const c = wallet.citizenId;
      setDocForm({
        docNumber: c?.idNumber || "",
        fullName: fullName || "",
        dob: "",
        nationality: "",
        gender: "",
        expiry: c?.expiry || "2030-01-01",
        visaStatus: "",
        destination: "",
        validFrom: "",
        state: c?.state || "Tamil Nadu, India",
      });
    }
    setDocModalOpen(true);
  };

  const handleSimulateExtract = () => {
    if (!editingDocType) return;
    setIsExtracting(true);
    setTimeout(() => {
      const parsed = parseDocumentInfo(editingDocType, "scanned_doc.pdf", fullName);
      if (editingDocType === "passport") {
        setDocForm((prev) => ({
          ...prev,
          docNumber: parsed.docNumber || prev.docNumber,
          fullName: parsed.fullName || prev.fullName,
          dob: parsed.dob || prev.dob,
          nationality: parsed.nationality || prev.nationality,
          gender: parsed.gender || prev.gender,
          expiry: parsed.expiry || prev.expiry,
        }));
      } else if (editingDocType === "visa") {
        setDocForm((prev) => ({
          ...prev,
          docNumber: parsed.visaNumber || prev.docNumber,
          visaStatus: parsed.visaStatus || prev.visaStatus,
          destination: parsed.destination || prev.destination,
          validFrom: parsed.validFrom || prev.validFrom,
          expiry: parsed.expiry || prev.expiry,
        }));
      } else if (editingDocType === "citizenId") {
        setDocForm((prev) => ({
          ...prev,
          docNumber: parsed.idNumber || prev.docNumber,
          state: parsed.state || prev.state,
          expiry: parsed.expiry || prev.expiry,
        }));
      }
      setIsExtracting(false);
      toast.success("Document information extracted! Review and save below.");
    }, 600);
  };

  const handleSaveDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingDocType) return;

    const newWallet: DocumentWallet = { ...wallet };
    const now = new Date().toISOString();

    if (editingDocType === "passport") {
      newWallet.passport = {
        docNumber: docForm.docNumber.trim() || "P8291047",
        fullName: docForm.fullName.trim() || fullName || "Tourist",
        dob: docForm.dob,
        nationality: docForm.nationality.trim() || "Indian",
        gender: docForm.gender.trim() || "Male",
        expiry: docForm.expiry || "2032-11-20",
        savedAt: now,
        verified: true,
      };
    } else if (editingDocType === "visa") {
      newWallet.visa = {
        visaNumber: docForm.docNumber.trim() || "V-IN-829104",
        visaStatus: docForm.visaStatus.trim() || "Tourist / e-Visa (Active)",
        destination: docForm.destination.trim() || "Chennai, Tamil Nadu",
        validFrom: docForm.validFrom || "2026-08-01",
        expiry: docForm.expiry || "2026-09-30",
        savedAt: now,
      };
    } else if (editingDocType === "citizenId") {
      newWallet.citizenId = {
        idNumber: docForm.docNumber.trim() || "CID-TN-8291-1094",
        state: docForm.state.trim() || "Tamil Nadu, India",
        expiry: docForm.expiry || "2030-01-01",
        savedAt: now,
      };
    }

    setWallet(newWallet);
    saveDocumentWallet(user.id, newWallet);
    setDocModalOpen(false);
    toast.success(
      `${editingDocType === "passport" ? "Passport" : editingDocType === "visa" ? "Visa" : "Citizen ID"} saved to My Documents`,
    );
  };

  const handleDeleteDocument = (type: "passport" | "visa" | "citizenId") => {
    if (!user) return;
    const newWallet = { ...wallet };
    delete newWallet[type];
    setWallet(newWallet);
    saveDocumentWallet(user.id, newWallet);
    toast.info("Document removed from wallet");
  };

  return (
    <div className="space-y-6 text-[#1E1E1E]">
      {/* ========================================================================= */}
      {/* 1. PROFILE HEADER */}
      {/* ========================================================================= */}
      <div className="rounded-[32px] border border-[#F6B28F]/30 bg-gradient-to-br from-white via-[#FFF8F3] to-[#FFF1EA] p-6 sm:p-8 shadow-[0_12px_40px_rgba(255,111,97,0.06)] text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F6B28F] to-[#FF6F61] text-white font-black text-xl shadow-md shadow-[#FF6F61]/20">
              {(fullName || "T").charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#39B86B]/15 px-2.5 py-0.5 text-[10px] font-black uppercase text-[#39B86B]">
                <ShieldCheck className="h-3 w-3" />
                <span>Verified Traveler</span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black text-[#1E1E1E]">
                {fullName || "Tourist Profile"}
              </h1>
              <p className="text-xs text-[#77716D] font-medium">{user?.email}</p>
            </div>
          </div>

          <Link
            to="/app/id"
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF6F61] to-[#F6B28F] px-4 py-2.5 text-xs font-black text-white shadow-md shadow-[#FF6F61]/25 hover:shadow-lg transition-all self-start sm:self-center"
          >
            <Fingerprint className="h-4 w-4" />
            <span>View Digital ID</span>
          </Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MY DOCUMENTS SECTION (DOCUMENT WALLET) */}
      {/* ========================================================================= */}
      <div className="rounded-3xl border border-[#F6B28F]/30 bg-white/95 p-6 shadow-sm text-left space-y-4">
        <div className="flex items-center justify-between border-b border-black/5 pb-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FF6F61]/15 text-[#FF6F61]">
                <FileText className="h-4 w-4" />
              </span>
              <h2 className="text-base font-black text-[#1E1E1E]">MY DOCUMENTS</h2>
            </div>
            <p className="text-xs text-[#77716D]">
              Secure credential wallet used to auto-fill and issue your BEACON Digital ID.
            </p>
          </div>

          <span className="text-[10px] font-black text-[#39B86B] bg-[#39B86B]/15 px-2.5 py-1 rounded-full uppercase">
            Encrypted Wallet
          </span>
        </div>

        {/* Compact Document Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Card 1: Passport */}
          <div className="rounded-2xl border border-[#F6B28F]/25 bg-[#FFF8F3] p-4 text-left space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#1E1E1E] flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-[#FF6F61]" />
                  Passport
                </span>
                {wallet.passport ? (
                  <span className="text-[10px] font-black text-[#39B86B] bg-[#39B86B]/15 px-2 py-0.5 rounded-full">
                    ✓ Saved
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-[#77716D] bg-black/5 px-2 py-0.5 rounded-full">
                    Missing
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#77716D]">
                {wallet.passport
                  ? `${wallet.passport.docNumber} · ${wallet.passport.nationality}`
                  : "Government ID / Passport"}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-black/5">
              <button
                onClick={() => openDocModal("passport")}
                className="flex-1 rounded-xl bg-white border border-[#F6B28F]/30 py-1.5 text-xs font-bold text-[#1E1E1E] hover:bg-[#FF6F61] hover:text-white transition-colors cursor-pointer"
              >
                {wallet.passport ? "Edit Passport" : "+ Add Passport"}
              </button>
              {wallet.passport && (
                <button
                  onClick={() => handleDeleteDocument("passport")}
                  className="p-1.5 text-[#77716D] hover:text-[#E94B5F] transition-colors"
                  title="Remove document"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Card 2: Visa */}
          <div className="rounded-2xl border border-[#F6B28F]/25 bg-[#FFF8F3] p-4 text-left space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#1E1E1E] flex items-center gap-1.5">
                  <IdCard className="h-3.5 w-3.5 text-blue-500" />
                  Travel Visa
                </span>
                {wallet.visa ? (
                  <span className="text-[10px] font-black text-[#39B86B] bg-[#39B86B]/15 px-2 py-0.5 rounded-full">
                    ✓ Saved
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-[#77716D] bg-black/5 px-2 py-0.5 rounded-full">
                    Missing
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#77716D]">
                {wallet.visa
                  ? `${wallet.visa.visaStatus} · Exp ${wallet.visa.expiry}`
                  : "e-Visa or Tourist Permit"}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-black/5">
              <button
                onClick={() => openDocModal("visa")}
                className="flex-1 rounded-xl bg-white border border-[#F6B28F]/30 py-1.5 text-xs font-bold text-[#1E1E1E] hover:bg-[#FF6F61] hover:text-white transition-colors cursor-pointer"
              >
                {wallet.visa ? "Edit Visa" : "+ Add Visa"}
              </button>
              {wallet.visa && (
                <button
                  onClick={() => handleDeleteDocument("visa")}
                  className="p-1.5 text-[#77716D] hover:text-[#E94B5F] transition-colors"
                  title="Remove document"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Card 3: Citizen ID */}
          <div className="rounded-2xl border border-[#F6B28F]/25 bg-[#FFF8F3] p-4 text-left space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#1E1E1E] flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
                  Citizen ID
                </span>
                {wallet.citizenId ? (
                  <span className="text-[10px] font-black text-[#39B86B] bg-[#39B86B]/15 px-2 py-0.5 rounded-full">
                    ✓ Saved
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-[#77716D] bg-black/5 px-2 py-0.5 rounded-full">
                    Missing
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#77716D]">
                {wallet.citizenId
                  ? `${wallet.citizenId.idNumber} · ${wallet.citizenId.state}`
                  : "National ID / Driver's Card"}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-black/5">
              <button
                onClick={() => openDocModal("citizenId")}
                className="flex-1 rounded-xl bg-white border border-[#F6B28F]/30 py-1.5 text-xs font-bold text-[#1E1E1E] hover:bg-[#FF6F61] hover:text-white transition-colors cursor-pointer"
              >
                {wallet.citizenId ? "Edit ID" : "+ Add Citizen ID"}
              </button>
              {wallet.citizenId && (
                <button
                  onClick={() => handleDeleteDocument("citizenId")}
                  className="p-1.5 text-[#77716D] hover:text-[#E94B5F] transition-colors"
                  title="Remove document"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. YOUR DETAILS SECTION */}
      {/* ========================================================================= */}
      <GlassCard className="text-left space-y-4">
        <div>
          <h2 className="text-base font-black text-[#1E1E1E]">Personal Account Details</h2>
          <p className="text-xs text-[#77716D]">
            Primary contact info synced across your BEACON safety profile.
          </p>
        </div>

        <form onSubmit={saveProfile} className="space-y-4">
          <Field label="Full name" value={fullName} onChange={setFullName} />
          <Field
            label="Phone number"
            value={phone}
            onChange={setPhone}
            required={false}
            placeholder="+91 98765 43210"
          />
          <PressButton type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </PressButton>
        </form>
      </GlassCard>

      {/* ========================================================================= */}
      {/* 4. SIGN OUT SECTION */}
      {/* ========================================================================= */}
      <GlassCard transition={{ delay: 0.1, duration: 0.3 }}>
        <PressButton
          variant="ghost"
          onClick={signOut}
          className="w-full text-xs font-bold text-[#E94B5F] hover:bg-[#FFF5F5]"
        >
          <LogOut className="h-4 w-4" /> Sign out of BEACON
        </PressButton>
      </GlassCard>

      {/* ========================================================================= */}
      {/* 5. DOCUMENT MANAGEMENT & EXTRACTION MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {docModalOpen && editingDocType && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDocModalOpen(false)}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              className="fixed inset-x-4 top-[10%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 w-full max-w-lg rounded-[32px] border border-[#F6B28F]/40 bg-white p-6 shadow-2xl space-y-4 text-left max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-black/5 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF6F61]/15 text-[#FF6F61]">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-[#1E1E1E]">
                      {editingDocType === "passport"
                        ? "Save Passport / Govt ID"
                        : editingDocType === "visa"
                          ? "Save Travel Visa"
                          : "Save Citizen ID"}
                    </h3>
                    <p className="text-xs text-[#77716D]">My Documents Secure Store</p>
                  </div>
                </div>
                <button
                  onClick={() => setDocModalOpen(false)}
                  className="rounded-full p-1.5 text-[#77716D] hover:bg-black/5 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Instant Document Extraction Trigger */}
              <div className="rounded-2xl bg-[#FFF8F3] p-3.5 border border-[#F6B28F]/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#1E1E1E] flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-[#FF6F61]" />
                    Smart Document Extraction
                  </span>
                  <span className="text-[10px] font-bold text-[#77716D]">AI OCR Ready</span>
                </div>
                <p className="text-[11px] text-[#77716D]">
                  Automatically extract document reference, nationality, and expiry for 1-click
                  verification.
                </p>
                <button
                  type="button"
                  onClick={handleSimulateExtract}
                  disabled={isExtracting}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-white border border-[#F6B28F]/40 py-2 text-xs font-bold text-[#FF6F61] hover:bg-[#FF6F61] hover:text-white transition-colors cursor-pointer shadow-2xs"
                >
                  <UploadCloud className="h-4 w-4" />
                  <span>
                    {isExtracting ? "Extracting document data…" : "⚡ Extract Document Fields"}
                  </span>
                </button>
              </div>

              {/* Document Edit Form */}
              <form onSubmit={handleSaveDocument} className="space-y-3">
                {editingDocType === "passport" && (
                  <>
                    <Field
                      label="Passport / ID Number"
                      value={docForm.docNumber}
                      onChange={(v) => setDocForm((p) => ({ ...p, docNumber: v }))}
                      placeholder="e.g. P8291047"
                    />
                    <Field
                      label="Full Name (as in Passport)"
                      value={docForm.fullName}
                      onChange={(v) => setDocForm((p) => ({ ...p, fullName: v }))}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Field
                        label="Nationality"
                        value={docForm.nationality}
                        onChange={(v) => setDocForm((p) => ({ ...p, nationality: v }))}
                        placeholder="Indian"
                      />
                      <Field
                        label="Gender"
                        value={docForm.gender}
                        onChange={(v) => setDocForm((p) => ({ ...p, gender: v }))}
                        placeholder="Male"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field
                        label="Date of Birth"
                        type="date"
                        value={docForm.dob}
                        onChange={(v) => setDocForm((p) => ({ ...p, dob: v }))}
                      />
                      <Field
                        label="Expiry Date"
                        type="date"
                        value={docForm.expiry}
                        onChange={(v) => setDocForm((p) => ({ ...p, expiry: v }))}
                      />
                    </div>
                  </>
                )}

                {editingDocType === "visa" && (
                  <>
                    <Field
                      label="Visa / e-Permit Reference Number"
                      value={docForm.docNumber}
                      onChange={(v) => setDocForm((p) => ({ ...p, docNumber: v }))}
                      placeholder="e.g. V-IN-829104"
                    />
                    <Field
                      label="Visa Status / Type"
                      value={docForm.visaStatus}
                      onChange={(v) => setDocForm((p) => ({ ...p, visaStatus: v }))}
                      placeholder="Tourist / e-Visa (Active)"
                    />
                    <Field
                      label="Destination"
                      value={docForm.destination}
                      onChange={(v) => setDocForm((p) => ({ ...p, destination: v }))}
                      placeholder="Chennai, Tamil Nadu"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Field
                        label="Valid From"
                        type="date"
                        value={docForm.validFrom}
                        onChange={(v) => setDocForm((p) => ({ ...p, validFrom: v }))}
                      />
                      <Field
                        label="Expiry Date"
                        type="date"
                        value={docForm.expiry}
                        onChange={(v) => setDocForm((p) => ({ ...p, expiry: v }))}
                      />
                    </div>
                  </>
                )}

                {editingDocType === "citizenId" && (
                  <>
                    <Field
                      label="Citizen ID / National ID Number"
                      value={docForm.docNumber}
                      onChange={(v) => setDocForm((p) => ({ ...p, docNumber: v }))}
                      placeholder="e.g. CID-TN-8291-1094"
                    />
                    <Field
                      label="Issuing State / Country"
                      value={docForm.state}
                      onChange={(v) => setDocForm((p) => ({ ...p, state: v }))}
                      placeholder="Tamil Nadu, India"
                    />
                    <Field
                      label="Expiry Date"
                      type="date"
                      value={docForm.expiry}
                      onChange={(v) => setDocForm((p) => ({ ...p, expiry: v }))}
                    />
                  </>
                )}

                <div className="flex items-center gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setDocModalOpen(false)}
                    className="w-full rounded-2xl bg-black/5 py-2.5 text-xs font-bold text-[#1E1E1E] hover:bg-black/10 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-gradient-to-r from-[#FF6F61] to-[#F6B28F] py-2.5 text-xs font-black text-white shadow-md shadow-[#FF6F61]/25 hover:shadow-lg transition-all cursor-pointer"
                  >
                    Confirm & Save Document
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
