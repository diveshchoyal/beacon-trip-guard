import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { GlassCard, StatusBadge } from "@/components/ui/glass";

export const Route = createFileRoute("/_authenticated/dashboard/efir")({
  component: EfirLog,
});

function EfirLog() {
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["efir"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("efir_records")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <GlassCard>Loading E-FIR records…</GlassCard>;
  if (records.length === 0)
    return (
      <GlassCard className="py-12 text-center">
        <p className="text-sm font-semibold text-foreground">No E-FIRs filed</p>
        <p className="mt-1 text-sm text-muted-foreground">
          File one from an alert to start the log.
        </p>
      </GlassCard>
    );

  return (
    <div className="space-y-4">
      {records.map((r, i) => (
        <GlassCard key={r.id} transition={{ delay: Math.min(i, 8) * 0.03, duration: 0.3 }}>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{r.fir_number}</p>
              <p className="mt-1 text-sm text-muted-foreground">{r.details ?? "—"}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {format(new Date(r.created_at), "dd MMM yyyy, HH:mm")}
              </p>
            </div>
            <StatusBadge status={r.status} />
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
