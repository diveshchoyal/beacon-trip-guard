import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { GlassCard, PressButton, StatusBadge } from "@/components/ui/glass";

export const Route = createFileRoute("/_authenticated/dashboard/alerts")({
  component: DashboardAlerts,
});

function DashboardAlerts() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["dashboard-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, phone");
      if (error) throw error;
      return data ?? [];
    },
  });

  const nameFor = (id: string) =>
    profiles.find((p) => p.id === id)?.full_name || "Unnamed tourist";

  useEffect(() => {
    const channel = supabase
      .channel("alerts-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["dashboard-alerts"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("alerts").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Alert ${status}`);
    void queryClient.invalidateQueries({ queryKey: ["dashboard-alerts"] });
  };

  const fileEfir = async (alert: (typeof alerts)[number]) => {
    if (!user) return;
    const firNumber = `FIR-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const { error } = await supabase.from("efir_records").insert({
      alert_id: alert.id,
      officer_id: user.id,
      tourist_id: alert.user_id,
      fir_number: firNumber,
      details: `${alert.type.toUpperCase()} reported by ${nameFor(alert.user_id)} at ${alert.lat ?? "?"}, ${alert.lng ?? "?"}`,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await setStatus(alert.id, "acknowledged");
    toast.success(`E-FIR ${firNumber} filed`);
    void queryClient.invalidateQueries({ queryKey: ["efir"] });
  };

  if (isLoading) return <GlassCard>Loading alerts…</GlassCard>;
  if (alerts.length === 0)
    return (
      <GlassCard className="py-12 text-center">
        <p className="text-sm font-semibold text-foreground">No alerts yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Incoming SOS signals appear here live.</p>
      </GlassCard>
    );

  return (
    <div className="space-y-4">
      {alerts.map((a, i) => (
        <GlassCard key={a.id} transition={{ delay: Math.min(i, 8) * 0.03, duration: 0.3 }}>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{nameFor(a.user_id)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {a.type.toUpperCase()} · {a.message ?? "Emergency alert"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                {a.lat != null && a.lng != null
                  ? ` · ${a.lat.toFixed(4)}, ${a.lng.toFixed(4)}`
                  : ""}
              </p>
            </div>
            <StatusBadge status={a.status} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <PressButton
              variant="ghost"
              className="h-10 px-4 text-xs"
              onClick={() => setStatus(a.id, "acknowledged")}
            >
              Acknowledge
            </PressButton>
            <PressButton
              variant="ghost"
              className="h-10 px-4 text-xs"
              onClick={() => setStatus(a.id, "resolved")}
            >
              Resolve
            </PressButton>
            <PressButton className="h-10 px-4 text-xs" onClick={() => fileEfir(a)}>
              File E-FIR
            </PressButton>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
