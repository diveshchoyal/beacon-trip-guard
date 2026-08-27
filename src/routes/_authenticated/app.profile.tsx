import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  CheckCircle2,
  Eye,
  FileCheck,
  FileText,
  Fingerprint,
  Globe,
  IdCard,
  Image as ImageIcon,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
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
  getDemoDocumentWallet,
  clearDocumentWallet,
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

  // Photo upload & preview state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Signed URLs cache for cards
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Full-size image modal state
  const [viewingPhoto, setViewingPhoto] = useState<{
    url: string;
    title: string;
    docNumber: string;
  } | null>(null);

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
      const loaded = loadDocumentWallet(user.id);
      setWallet(loaded);
      void resolveSignedUrls(loaded);
    }
  }, [profile, user]);

  // Resolves Supabase Storage signed URLs for all saved wallet documents
  const resolveSignedUrls = async (w: DocumentWallet) => {
    const urls: Record<string, string> = {};

    const resolvePath = async (key: string, pathOrUrl?: string) => {
      if (!pathOrUrl) return;
      // If already data URL or full HTTP link
      if (pathOrUrl.startsWith("data:") || pathOrUrl.startsWith("http")) {
        urls[key] = pathOrUrl;
        return;
      }
      try {
        const { data, error } = await supabase.storage
          .from("wallet-documents")
          .createSignedUrl(pathOrUrl, 3600);
        if (!error && data?.signedUrl) {
          urls[key] = data.signedUrl;
        } else {
          urls[key] = pathOrUrl;
        }
      } catch {
        urls[key] = pathOrUrl;
      }
    };

    if (w.passport?.photoUrl) await resolvePath("passport", w.passport.photoUrl);
    if (w.visa?.fileUrl) await resolvePath("visa", w.visa.fileUrl);
    if (w.citizenId?.fileUrl) await resolvePath("citizenId", w.citizenId.fileUrl);

    setSignedUrls(urls);
  };

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
    setSelectedFile(null);

    let existingPhoto: string | null = null;
    if (type === "passport") {
      const p = wallet.passport;
      existingPhoto = signedUrls.passport || p?.photoUrl || null;
      setDocForm({
        docNumber: p?.docNumber || "",
        fullName: p?.fullName || fullName || "",
        dob: p?.dob || "",
        nationality: p?.nationality || "",
        gender: p?.gender || "",
        expiry: p?.expiry || "",
        visaStatus: "",
        destination: "",
        validFrom: "",
        state: "",
      });
    } else if (type === "visa") {
      const v = wallet.visa;
      existingPhoto = signedUrls.visa || v?.fileUrl || null;
      setDocForm({
        docNumber: v?.visaNumber || "",
        fullName: fullName || "",
        dob: "",
        nationality: "",
        gender: "",
        expiry: v?.expiry || "",
        visaStatus: v?.visaStatus || "",
        destination: v?.destination || "",
        validFrom: v?.validFrom || "",
        state: "",
      });
    } else if (type === "citizenId") {
      const c = wallet.citizenId;
      existingPhoto = signedUrls.citizenId || c?.fileUrl || null;
      setDocForm({
        docNumber: c?.idNumber || "",
        fullName: fullName || "",
        dob: "",
        nationality: "",
        gender: "",
        expiry: c?.expiry || "",
        visaStatus: "",
        destination: "",
        validFrom: "",
        state: c?.state || "",
      });
    }

    setPhotoPreview(existingPhoto);
    setDocModalOpen(true);
  };

  // Handle local file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be under 10MB");
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSimulateExtract = () => {
    if (!editingDocType) return;
    setIsExtracting(true);
    setTimeout(() => {
      const parsed = parseDocumentInfo(
        editingDocType,
        selectedFile?.name || "scanned_doc.pdf",
        fullName,
      );
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

  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingDocType) return;

    if (!docForm.docNumber.trim()) {
      toast.error("Please enter a document reference number.");
      return;
    }

    setUploadingPhoto(true);
    let finalPhotoPath: string | undefined = undefined;

    // Upload to Supabase Storage if a new file was chosen
    if (selectedFile) {
      try {
        const fileExt = selectedFile.name.split(".").pop() || "png";
        const filePath = `${user.id}/${editingDocType}_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("wallet-documents")
          .upload(filePath, selectedFile, {
            upsert: true,
            contentType: selectedFile.type,
          });

        if (!uploadError) {
          finalPhotoPath = filePath;
        } else {
          // If storage bucket is not configured or fails, store local preview data URL
          finalPhotoPath = photoPreview || undefined;
        }
      } catch {
        finalPhotoPath = photoPreview || undefined;
      }
    } else {
      // Preserve existing photo if not changed
      if (editingDocType === "passport") finalPhotoPath = wallet.passport?.photoUrl;
      else if (editingDocType === "visa") finalPhotoPath = wallet.visa?.fileUrl;
      else if (editingDocType === "citizenId") finalPhotoPath = wallet.citizenId?.fileUrl;
    }

    const newWallet: DocumentWallet = { ...wallet };
    const now = new Date().toISOString();

    if (editingDocType === "passport") {
      newWallet.passport = {
        docNumber: docForm.docNumber.trim(),
        fullName: docForm.fullName.trim() || fullName || "Traveler",
        dob: docForm.dob,
        nationality: docForm.nationality.trim(),
        gender: docForm.gender.trim(),
        expiry: docForm.expiry,
        photoUrl: finalPhotoPath,
        savedAt: now,
        verified: true,
      };
    } else if (editingDocType === "visa") {
      newWallet.visa = {
        visaNumber: docForm.docNumber.trim(),
        visaStatus: docForm.visaStatus.trim() || "Valid",
        destination: docForm.destination.trim(),
        validFrom: docForm.validFrom,
        expiry: docForm.expiry,
        fileUrl: finalPhotoPath,
        savedAt: now,
      };
    } else if (editingDocType === "citizenId") {
      newWallet.citizenId = {
        idNumber: docForm.docNumber.trim(),
        state: docForm.state.trim(),
        expiry: docForm.expiry,
        fileUrl: finalPhotoPath,
        savedAt: now,
      };
    }

    setWallet(newWallet);
    saveDocumentWallet(user.id, newWallet);
    await resolveSignedUrls(newWallet);
    setUploadingPhoto(false);
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
    void resolveSignedUrls(newWallet);
    toast.info("Document removed from wallet");
  };

  const handleLoadDemo = () => {
    if (!user) return;
    const demo = getDemoDocumentWallet();
    setWallet(demo);
    saveDocumentWallet(user.id, demo);
    void resolveSignedUrls(demo);
    toast.success("Loaded realistic Demo Documents (Passport, Visa, Citizen ID)!");
  };

  const handleClearDemo = () => {
    if (!user) return;
    clearDocumentWallet(user.id);
    setWallet({});
    setSignedUrls({});
    toast.info("Cleared all saved documents from wallet");
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

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
            <Link
              to="/app/id"
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF6F61] to-[#F6B28F] px-4 py-2.5 text-xs font-black text-white shadow-md shadow-[#FF6F61]/25 hover:shadow-lg transition-all"
            >
              <Fingerprint className="h-4 w-4" />
              <span>View Digital ID</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MY DOCUMENTS SECTION (DOCUMENT WALLET WITH PHOTO THUMBNAILS) */}
      {/* ========================================================================= */}
      <div className="rounded-3xl border border-[#F6B28F]/30 bg-white/95 p-6 shadow-sm text-left space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/5 pb-3">
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

          {/* Demo Data Quick Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadDemo}
              className="flex items-center gap-1.5 rounded-xl bg-[#FFF8F3] border border-[#F6B28F]/40 px-3 py-1.5 text-xs font-black text-[#FF6F61] hover:bg-[#FF6F61] hover:text-white transition-colors cursor-pointer shadow-2xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>⚡ Load Demo Docs</span>
            </button>
            {wallet.passport && (
              <button
                type="button"
                onClick={handleClearDemo}
                className="rounded-xl bg-black/5 px-2.5 py-1.5 text-[11px] font-bold text-[#77716D] hover:bg-[#E94B5F]/15 hover:text-[#E94B5F] transition-colors cursor-pointer"
              >
                Clear Docs
              </button>
            )}
          </div>
        </div>

        {/* Document Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* ========================================================================= */}
          {/* Card 1: Passport */}
          {/* ========================================================================= */}
          <div className="rounded-2xl border border-[#F6B28F]/30 bg-[#FFF8F3] p-4 text-left space-y-3 flex flex-col justify-between shadow-xs">
            <div className="space-y-2.5">
              {/* Header Status */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#1E1E1E] flex items-center gap-1.5">
                  <Globe className="h-4 w-4 text-[#FF6F61]" />
                  Passport
                </span>
                {wallet.passport ? (
                  <span className="text-[10px] font-black text-[#39B86B] bg-[#39B86B]/15 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Added ✓</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-[#77716D] bg-black/5 px-2 py-0.5 rounded-full">
                    Missing
                  </span>
                )}
              </div>

              {/* Photo Thumbnail + Details */}
              {wallet.passport ? (
                <div className="flex items-start gap-3">
                  {signedUrls.passport ? (
                    <div
                      onClick={() =>
                        setViewingPhoto({
                          url: signedUrls.passport,
                          title: "Passport Photo",
                          docNumber: wallet.passport?.docNumber || "",
                        })
                      }
                      className="relative h-16 w-16 rounded-xl overflow-hidden border border-[#F6B28F]/40 bg-white shadow-xs cursor-pointer group shrink-0"
                    >
                      <img
                        src={signedUrls.passport}
                        alt="Passport Preview"
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                        <Eye className="h-4 w-4 drop-shadow-md" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white border border-[#F6B28F]/30 text-[#FF6F61] shrink-0">
                      <Globe className="h-6 w-6" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-0.5 text-xs">
                    <p className="font-black text-[#1E1E1E] font-mono truncate">
                      {wallet.passport.docNumber}
                    </p>
                    <p className="text-[11px] text-[#77716D] truncate">
                      {wallet.passport.fullName}
                    </p>
                    <p className="text-[10px] text-[#77716D]">
                      {wallet.passport.nationality} · Exp: {wallet.passport.expiry || "N/A"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-2 text-xs text-[#77716D]">
                  No passport saved. Add your passport details and photo to enable auto-fill.
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 pt-2 border-t border-black/5">
              {wallet.passport && signedUrls.passport && (
                <button
                  type="button"
                  onClick={() =>
                    setViewingPhoto({
                      url: signedUrls.passport,
                      title: "Passport Photo",
                      docNumber: wallet.passport?.docNumber || "",
                    })
                  }
                  className="flex items-center justify-center gap-1 rounded-xl bg-white border border-[#F6B28F]/30 px-2.5 py-1.5 text-[11px] font-bold text-[#1E1E1E] hover:bg-[#FFF8F3] transition-colors cursor-pointer"
                  title="View full-size photo"
                >
                  <Eye className="h-3 w-3 text-[#FF6F61]" />
                  <span>View</span>
                </button>
              )}

              <button
                onClick={() => openDocModal("passport")}
                className="flex-1 rounded-xl bg-white border border-[#F6B28F]/30 py-1.5 text-xs font-bold text-[#1E1E1E] hover:bg-[#FF6F61] hover:text-white transition-colors cursor-pointer text-center"
              >
                {wallet.passport ? "Edit / Replace" : "+ Add Passport"}
              </button>

              {wallet.passport && (
                <button
                  onClick={() => handleDeleteDocument("passport")}
                  className="rounded-xl bg-black/5 p-1.5 text-[#77716D] hover:bg-[#E94B5F]/15 hover:text-[#E94B5F] transition-colors cursor-pointer"
                  title="Remove passport"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* Card 2: Travel Visa */}
          {/* ========================================================================= */}
          <div className="rounded-2xl border border-[#F6B28F]/30 bg-[#FFF8F3] p-4 text-left space-y-3 flex flex-col justify-between shadow-xs">
            <div className="space-y-2.5">
              {/* Header Status */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#1E1E1E] flex items-center gap-1.5">
                  <FileCheck className="h-4 w-4 text-[#FF6F61]" />
                  Travel Visa
                </span>
                {wallet.visa ? (
                  <span className="text-[10px] font-black text-[#39B86B] bg-[#39B86B]/15 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Added ✓</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-[#77716D] bg-black/5 px-2 py-0.5 rounded-full">
                    Missing
                  </span>
                )}
              </div>

              {/* Photo Thumbnail + Details */}
              {wallet.visa ? (
                <div className="flex items-start gap-3">
                  {signedUrls.visa ? (
                    <div
                      onClick={() =>
                        setViewingPhoto({
                          url: signedUrls.visa,
                          title: "Travel Visa Photo",
                          docNumber: wallet.visa?.visaNumber || "",
                        })
                      }
                      className="relative h-16 w-16 rounded-xl overflow-hidden border border-[#F6B28F]/40 bg-white shadow-xs cursor-pointer group shrink-0"
                    >
                      <img
                        src={signedUrls.visa}
                        alt="Visa Preview"
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                        <Eye className="h-4 w-4 drop-shadow-md" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white border border-[#F6B28F]/30 text-[#FF6F61] shrink-0">
                      <FileCheck className="h-6 w-6" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-0.5 text-xs">
                    <p className="font-black text-[#1E1E1E] font-mono truncate">
                      {wallet.visa.visaNumber}
                    </p>
                    <p className="text-[11px] text-[#77716D] truncate">{wallet.visa.destination}</p>
                    <p className="text-[10px] text-[#77716D]">
                      {wallet.visa.visaStatus} · Exp: {wallet.visa.expiry || "N/A"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-2 text-xs text-[#77716D]">
                  No travel visa attached. Add your visa/e-permit to auto-fill trip destination and
                  validity.
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 pt-2 border-t border-black/5">
              {wallet.visa && signedUrls.visa && (
                <button
                  type="button"
                  onClick={() =>
                    setViewingPhoto({
                      url: signedUrls.visa,
                      title: "Travel Visa Photo",
                      docNumber: wallet.visa?.visaNumber || "",
                    })
                  }
                  className="flex items-center justify-center gap-1 rounded-xl bg-white border border-[#F6B28F]/30 px-2.5 py-1.5 text-[11px] font-bold text-[#1E1E1E] hover:bg-[#FFF8F3] transition-colors cursor-pointer"
                  title="View full-size photo"
                >
                  <Eye className="h-3 w-3 text-[#FF6F61]" />
                  <span>View</span>
                </button>
              )}

              <button
                onClick={() => openDocModal("visa")}
                className="flex-1 rounded-xl bg-white border border-[#F6B28F]/30 py-1.5 text-xs font-bold text-[#1E1E1E] hover:bg-[#FF6F61] hover:text-white transition-colors cursor-pointer text-center"
              >
                {wallet.visa ? "Edit / Replace" : "+ Add Visa"}
              </button>

              {wallet.visa && (
                <button
                  onClick={() => handleDeleteDocument("visa")}
                  className="rounded-xl bg-black/5 p-1.5 text-[#77716D] hover:bg-[#E94B5F]/15 hover:text-[#E94B5F] transition-colors cursor-pointer"
                  title="Remove visa"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* Card 3: Citizen ID */}
          {/* ========================================================================= */}
          <div className="rounded-2xl border border-[#F6B28F]/30 bg-[#FFF8F3] p-4 text-left space-y-3 flex flex-col justify-between shadow-xs">
            <div className="space-y-2.5">
              {/* Header Status */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#1E1E1E] flex items-center gap-1.5">
                  <IdCard className="h-4 w-4 text-[#FF6F61]" />
                  Citizen ID
                </span>
                {wallet.citizenId ? (
                  <span className="text-[10px] font-black text-[#39B86B] bg-[#39B86B]/15 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Added ✓</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-[#77716D] bg-black/5 px-2 py-0.5 rounded-full">
                    Missing
                  </span>
                )}
              </div>

              {/* Photo Thumbnail + Details */}
              {wallet.citizenId ? (
                <div className="flex items-start gap-3">
                  {signedUrls.citizenId ? (
                    <div
                      onClick={() =>
                        setViewingPhoto({
                          url: signedUrls.citizenId,
                          title: "Citizen ID Photo",
                          docNumber: wallet.citizenId?.idNumber || "",
                        })
                      }
                      className="relative h-16 w-16 rounded-xl overflow-hidden border border-[#F6B28F]/40 bg-white shadow-xs cursor-pointer group shrink-0"
                    >
                      <img
                        src={signedUrls.citizenId}
                        alt="Citizen ID Preview"
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                        <Eye className="h-4 w-4 drop-shadow-md" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white border border-[#F6B28F]/30 text-[#FF6F61] shrink-0">
                      <IdCard className="h-6 w-6" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-0.5 text-xs">
                    <p className="font-black text-[#1E1E1E] font-mono truncate">
                      {wallet.citizenId.idNumber}
                    </p>
                    <p className="text-[11px] text-[#77716D] truncate">
                      {wallet.citizenId.state || "National ID"}
                    </p>
                    <p className="text-[10px] text-[#77716D]">
                      Exp: {wallet.citizenId.expiry || "Permanent"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-2 text-xs text-[#77716D]">
                  Optional National ID / Aadhaar card for domestic safety verification.
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 pt-2 border-t border-black/5">
              {wallet.citizenId && signedUrls.citizenId && (
                <button
                  type="button"
                  onClick={() =>
                    setViewingPhoto({
                      url: signedUrls.citizenId,
                      title: "Citizen ID Photo",
                      docNumber: wallet.citizenId?.idNumber || "",
                    })
                  }
                  className="flex items-center justify-center gap-1 rounded-xl bg-white border border-[#F6B28F]/30 px-2.5 py-1.5 text-[11px] font-bold text-[#1E1E1E] hover:bg-[#FFF8F3] transition-colors cursor-pointer"
                  title="View full-size photo"
                >
                  <Eye className="h-3 w-3 text-[#FF6F61]" />
                  <span>View</span>
                </button>
              )}

              <button
                onClick={() => openDocModal("citizenId")}
                className="flex-1 rounded-xl bg-white border border-[#F6B28F]/30 py-1.5 text-xs font-bold text-[#1E1E1E] hover:bg-[#FF6F61] hover:text-white transition-colors cursor-pointer text-center"
              >
                {wallet.citizenId ? "Edit / Replace" : "+ Add ID"}
              </button>

              {wallet.citizenId && (
                <button
                  onClick={() => handleDeleteDocument("citizenId")}
                  className="rounded-xl bg-black/5 p-1.5 text-[#77716D] hover:bg-[#E94B5F]/15 hover:text-[#E94B5F] transition-colors cursor-pointer"
                  title="Remove citizen ID"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. PROFILE SETTINGS FORM */}
      {/* ========================================================================= */}
      <div className="rounded-3xl border border-[#F6B28F]/30 bg-white/95 p-6 sm:p-8 shadow-sm text-left space-y-4">
        <h2 className="text-base font-black text-[#1E1E1E]">CONTACT & DETAILS</h2>

        <form onSubmit={saveProfile} className="space-y-4 max-w-md">
          <Field
            label="Full Name"
            value={fullName}
            onChange={setFullName}
            placeholder="Your name"
          />

          <Field
            label="Phone Number"
            value={phone}
            onChange={setPhone}
            placeholder="+91 98765 43210"
            required={false}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#1E1E1E]">Email Address</label>
            <input
              type="email"
              disabled
              value={user?.email ?? ""}
              className="w-full rounded-2xl border border-black/10 bg-black/5 px-4 py-3 text-xs font-medium text-[#77716D] cursor-not-allowed"
            />
          </div>

          <PressButton type="submit" disabled={busy} className="py-3 px-6 text-xs font-black">
            {busy ? "Saving…" : "Save Changes"}
          </PressButton>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* 4. SIGN OUT SECTION */}
      {/* ========================================================================= */}
      <div className="rounded-3xl border border-[#F6B28F]/25 bg-white/90 p-5 shadow-xs flex items-center justify-between">
        <div>
          <h3 className="text-xs font-black text-[#1E1E1E]">Sign Out</h3>
          <p className="text-[11px] text-[#77716D]">End your session on this device</p>
        </div>

        <button
          onClick={() => signOut()}
          className="flex items-center gap-1.5 rounded-xl bg-[#E94B5F]/10 px-4 py-2 text-xs font-black text-[#E94B5F] hover:bg-[#E94B5F]/20 transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 5. DOCUMENT MANAGEMENT & PHOTO UPLOAD MODAL */}
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
              className="fixed inset-x-4 top-[8%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 w-full max-w-lg rounded-[32px] border border-[#F6B28F]/40 bg-white p-6 shadow-2xl space-y-4 text-left max-h-[86vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-black/5 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF6F61]/15 text-[#FF6F61]">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-[#1E1E1E]">
                      {editingDocType === "passport"
                        ? "Save Passport & Photo"
                        : editingDocType === "visa"
                          ? "Save Travel Visa & Photo"
                          : "Save Citizen ID & Photo"}
                    </h3>
                    <p className="text-xs text-[#77716D]">Secure Document Wallet Storage</p>
                  </div>
                </div>
                <button
                  onClick={() => setDocModalOpen(false)}
                  className="rounded-full p-1.5 text-[#77716D] hover:bg-black/5 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Photo Upload Zone */}
              <div className="rounded-2xl bg-[#FFF8F3] p-4 border border-[#F6B28F]/30 space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#FF6F61] block">
                  DOCUMENT PHOTO / SCAN (OPTIONAL)
                </span>

                {photoPreview ? (
                  <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-[#F6B28F]/30">
                    <img
                      src={photoPreview}
                      alt="Document Photo Preview"
                      className="h-16 w-16 object-cover rounded-lg border border-black/10 shrink-0"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-xs font-bold text-[#1E1E1E] truncate">
                        {selectedFile?.name || "Uploaded Document Image"}
                      </p>
                      <p className="text-[10px] text-[#39B86B] font-bold">
                        ✓ Photo ready for secure storage
                      </p>
                    </div>
                    <label className="rounded-xl bg-[#FFF8F3] border border-[#F6B28F]/40 px-3 py-1.5 text-xs font-bold text-[#FF6F61] hover:bg-[#FF6F61] hover:text-white transition-colors cursor-pointer">
                      <span>Replace</span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-[#F6B28F]/40 rounded-xl bg-white hover:bg-[#FFF8F3] transition-colors cursor-pointer text-center space-y-1.5">
                    <Camera className="h-6 w-6 text-[#FF6F61]" />
                    <span className="text-xs font-bold text-[#1E1E1E]">
                      Upload or take a photo of your {editingDocType}
                    </span>
                    <span className="text-[10px] text-[#77716D]">
                      PNG, JPG or WebP (stored securely in private storage)
                    </span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Instant Document Extraction Trigger */}
              <div className="rounded-2xl bg-[#FFF8F3] p-3.5 border border-[#F6B28F]/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#1E1E1E] flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-[#FF6F61]" />
                    Smart Document Extraction
                  </span>
                  <span className="text-[10px] font-bold text-[#77716D]">AI Helper</span>
                </div>
                <p className="text-[11px] text-[#77716D]">
                  Automatically extract document reference, nationality, and expiry for 1-click
                  auto-fill.
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
                        required={false}
                      />
                      <Field
                        label="Gender"
                        value={docForm.gender}
                        onChange={(v) => setDocForm((p) => ({ ...p, gender: v }))}
                        placeholder="Male"
                        required={false}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field
                        label="Date of Birth"
                        type="date"
                        value={docForm.dob}
                        onChange={(v) => setDocForm((p) => ({ ...p, dob: v }))}
                        required={false}
                      />
                      <Field
                        label="Expiry Date"
                        type="date"
                        value={docForm.expiry}
                        onChange={(v) => setDocForm((p) => ({ ...p, expiry: v }))}
                        required={false}
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
                      required={false}
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
                        required={false}
                      />
                      <Field
                        label="Expiry Date"
                        type="date"
                        value={docForm.expiry}
                        onChange={(v) => setDocForm((p) => ({ ...p, expiry: v }))}
                        required={false}
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
                      required={false}
                    />
                    <Field
                      label="Expiry Date"
                      type="date"
                      value={docForm.expiry}
                      onChange={(v) => setDocForm((p) => ({ ...p, expiry: v }))}
                      required={false}
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
                    disabled={uploadingPhoto}
                    className="w-full rounded-2xl bg-gradient-to-r from-[#FF6F61] to-[#F6B28F] py-2.5 text-xs font-black text-white shadow-md shadow-[#FF6F61]/25 hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {uploadingPhoto ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving…</span>
                      </>
                    ) : (
                      <span>Confirm & Save Document</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 6. FULL-SIZE DOCUMENT PHOTO VIEWER MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {viewingPhoto && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingPhoto(null)}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              className="fixed inset-x-4 top-[10%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 w-full max-w-lg rounded-[32px] border border-[#F6B28F]/40 bg-white p-6 shadow-2xl space-y-4 text-left"
            >
              <div className="flex items-center justify-between border-b border-black/5 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF6F61]/15 text-[#FF6F61]">
                    <ImageIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-[#1E1E1E]">{viewingPhoto.title}</h3>
                    <p className="text-xs font-mono font-bold text-[#77716D]">
                      {viewingPhoto.docNumber}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingPhoto(null)}
                  className="rounded-full p-1.5 text-[#77716D] hover:bg-black/5 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Full Image Container */}
              <div className="rounded-2xl overflow-hidden border border-[#F6B28F]/30 bg-[#FFF8F3] max-h-[60vh] flex items-center justify-center p-2">
                <img
                  src={viewingPhoto.url}
                  alt={viewingPhoto.title}
                  className="max-h-[56vh] w-auto max-w-full object-contain rounded-xl shadow-md"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={() => setViewingPhoto(null)}
                  className="rounded-2xl bg-gradient-to-r from-[#FF6F61] to-[#F6B28F] px-6 py-2.5 text-xs font-black text-white shadow-md cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
