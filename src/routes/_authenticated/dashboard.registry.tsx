import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/ui/glass";

export const Route = createFileRoute("/_authenticated/dashboard/registry")({
  component: Registry,
});

function Registry() {
  const [q, setQ] = useState("");

  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, safety_score, created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: ids = [] } = useQuery({
    queryKey: ["all-digital-ids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("digital_ids")
        .select("user_id, digital_id, destination, status, trip_end");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return profiles
      .map((p) => ({ ...p, id_record: ids.find((d) => d.user_id === p.id) ?? null }))
      .filter((r) =>
        term
          ? r.full_name.toLowerCase().includes(term) ||
            (r.id_record?.destination ?? "").toLowerCase().includes(term) ||
            (r.id_record?.digital_id ?? "").toLowerCase().includes(term)
          : true,
      );
  }, [profiles, ids, q]);

  return (
    <div className="space-y-5">
      <GlassCard>
        <div className="flex min-w-0 items-center gap-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={80}
            placeholder="Search by name, destination or Digital ID"
            className="h-10 w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
          />
        </div>
      </GlassCard>

      <GlassCard className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-muted-foreground">
              <th className="pb-3 pr-4 font-semibold">Tourist</th>
              <th className="pb-3 pr-4 font-semibold">Phone</th>
              <th className="pb-3 pr-4 font-semibold">Digital ID</th>
              <th className="pb-3 pr-4 font-semibold">Destination</th>
              <th className="pb-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[var(--glass-border)]">
                <td className="py-3 pr-4 font-medium text-foreground">
                  {r.full_name || "Unnamed"}
                </td>
                <td className="py-3 pr-4 text-muted-foreground">{r.phone ?? "—"}</td>
                <td className="py-3 pr-4 text-muted-foreground">{r.id_record?.digital_id ?? "—"}</td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {r.id_record?.destination ?? "—"}
                </td>
                <td className="py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase ${
                      r.id_record
                        ? "bg-[var(--safe)]/18 text-[var(--safe)]"
                        : "bg-[var(--caution)]/20 text-[var(--caution)]"
                    }`}
                  >
                    {r.id_record ? "issued" : "not issued"}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground">
                  No tourists match that search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
