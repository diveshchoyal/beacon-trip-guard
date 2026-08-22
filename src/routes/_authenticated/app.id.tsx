import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, ShieldX } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { GlassCard, PressButton } from "@/components/ui/glass";
import { Field } from "@/routes/login";
import { generateDigitalId, verifyDigitalId } from "@/lib/digital-id.functions";

export const Route = createFileRoute("/_authenticated/app/id")({
  component: DigitalIdPage,
});

type VerifyResult = { valid: boolean; reason: string; ledger_entries?: number };

function DigitalIdPage() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const generate = useServerFn(generateDigitalId);
  const verify = useServerFn(verifyDigitalId);

  const [form, setForm] = useState({
    id_number: "",
    destination: "",
    trip_start: "",
    trip_end: "",
    emergency_contact: "",
  });
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);

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

  const set = (key: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await generate({ data: form });
      toast.success("Digital ID issued and anchored to the ledger.");
      await queryClient.invalidateQueries({ queryKey: ["digital-id"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not issue Digital ID");
    } finally {
      setBusy(false);
    }
  };

  const onVerify = async () => {
    if (!record) return;
    setVerifying(true);
    setResult(null);
    try {
      const res = (await verify({ data: { digital_id: record.digital_id } })) as VerifyResult;
      setResult(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  if (isLoading) return <GlassCard>Loading your Digital ID…</GlassCard>;

  if (!record) {
    return (
      <GlassCard>
        <h2 className="text-sm font-semibold text-foreground">Register your Digital ID</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Issued once per trip and anchored with a tamper-evident hash.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Field
            label="ID number (passport / Aadhaar)"
            value={form.id_number}
            onChange={set("id_number")}
            placeholder="P1234567"
          />
          <Field
            label="Destination"
            value={form.destination}
            onChange={set("destination")}
            placeholder="Shillong, Meghalaya"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Trip start" type="date" value={form.trip_start} onChange={set("trip_start")} />
            <Field label="Trip end" type="date" value={form.trip_end} onChange={set("trip_end")} />
          </div>
          <Field
            label="Emergency contact"
            value={form.emergency_contact}
            onChange={set("emergency_contact")}
            placeholder="+91 98765 43210"
          />
          <PressButton type="submit" disabled={busy} className="w-full">
            {busy ? "Issuing…" : "Generate Digital ID"}
          </PressButton>
        </form>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-5">
      <GlassCard className="overflow-hidden p-0">
        <div className="bg-primary/15 px-6 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            BEACON Tourist Pass
          </p>
          <p className="mt-1 truncate text-lg font-bold text-foreground">
            {profile?.full_name || "Traveller"}
          </p>
        </div>
        <div className="grid gap-6 px-6 py-6 sm:grid-cols-[minmax(0,1fr)_auto]">
          <dl className="min-w-0 space-y-3 text-sm">
            <Row label="Digital ID" value={record.digital_id} />
            <Row label="ID number" value={record.id_number} />
            <Row label="Destination" value={record.destination} />
            <Row label="Trip" value={`${record.trip_start} → ${record.trip_end}`} />
            <Row label="Emergency contact" value={record.emergency_contact} />
            <Row label="Status" value={record.status} />
          </dl>
          <div className="mx-auto rounded-2xl bg-white p-3">
            <QRCodeSVG value={record.qr_payload} size={132} level="M" />
          </div>
        </div>
      </GlassCard>

      <GlassCard transition={{ delay: 0.05, duration: 0.3 }}>
        <h2 className="text-sm font-semibold text-foreground">Integrity check</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Recomputes the record hash and compares it against the ledger anchor.
        </p>
        <PressButton onClick={onVerify} disabled={verifying} className="mt-4">
          {verifying ? "Verifying…" : "Verify Integrity"}
        </PressButton>

        {result && (
          <div
            className={`mt-5 flex items-start gap-3 rounded-2xl p-4 ${
              result.valid
                ? "bg-[var(--safe)]/15 text-[var(--safe)]"
                : "bg-[var(--danger)]/15 text-[var(--danger)]"
            }`}
          >
            {result.valid ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <ShieldX className="mt-0.5 h-5 w-5 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold">{result.valid ? "Verified" : "Tampered"}</p>
              <p className="mt-1 text-sm opacity-90">{result.reason}</p>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="truncate text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
