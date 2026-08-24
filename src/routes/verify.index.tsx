import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ChevronLeft, Fingerprint, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import beaconLogo from "@/assets/beacon-logo.png";

export const Route = createFileRoute("/verify/")({
  head: () => ({
    meta: [
      { title: "Verify Digital ID — BEACON" },
      { name: "description", content: "Check and verify a BEACON tourist safety credential." },
    ],
  }),
  component: VerifyIndexScreen,
});

function VerifyIndexScreen() {
  const navigate = useNavigate();
  const [digitalIdInput, setDigitalIdInput] = useState("");

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = digitalIdInput.trim();
    if (!clean) {
      toast.error("Please enter a valid Digital ID");
      return;
    }
    navigate({ to: "/verify/$id", params: { id: clean } });
  };

  return (
    <main className="min-h-screen bg-[#FDFBF7] px-4 py-8 flex flex-col items-center justify-center text-[#1E1E1E]">
      <div className="w-full max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <Link
            to="/app/id"
            className="flex items-center gap-1 text-xs font-bold text-[#77716D] hover:text-[#1E1E1E] transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Back to App</span>
          </Link>
          <span className="text-xs font-black tracking-widest text-[#FF6F61] uppercase">
            BEACON VERIFIER
          </span>
        </div>

        <div className="rounded-[36px] border border-[#F6B28F]/35 bg-white p-7 sm:p-8 shadow-xl text-left space-y-6">
          <div className="flex items-center gap-4 border-b border-black/5 pb-4">
            <img
              src={beaconLogo}
              alt="BEACON"
              className="h-14 w-14 object-contain drop-shadow-md shrink-0"
            />
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF6F61] block">
                BEACON
              </span>
              <h1 className="text-lg font-black text-[#1E1E1E]">VERIFY DIGITAL ID</h1>
              <p className="text-xs text-[#77716D]">Tamper-evident credential lookup</p>
            </div>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1E1E1E]">BEACON Digital ID Code</label>
              <input
                type="text"
                value={digitalIdInput}
                onChange={(e) => setDigitalIdInput(e.target.value)}
                placeholder="e.g. BCN-2026-A1B2C3D4"
                className="w-full rounded-2xl border border-[#F6B28F]/40 bg-[#FFF8F3] px-4 py-3 text-sm font-mono font-bold text-[#1E1E1E] outline-hidden focus:border-[#FF6F61] focus:ring-2 focus:ring-[#FF6F61]/20"
              />
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF6F61] to-[#F6B28F] py-3 text-xs font-black text-white shadow-md cursor-pointer"
            >
              <Search className="h-4 w-4" />
              <span>Verify Credential</span>
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
