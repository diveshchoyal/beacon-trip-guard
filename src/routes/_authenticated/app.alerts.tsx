import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { GlassCard, StatusBadge } from "@/components/ui/glass";

export const Route = createFileRoute("/_authenticated/app/alerts")({
  component: MyAlerts,
});

function MyAlerts() {
  const { user } = useAuth();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["my-alerts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <GlassCard>Loading your alerts…</GlassCard>;

  if (alerts.length === 0) {
    return (
      <GlassCard className="py-12 text-center">
        <p className="text-sm font-semibold text-foreground">No alerts raised</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything is calm. Your SOS history will appear here.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {alerts.map((a, i) => (
        <GlassCard key={a.id} transition={{ delay: i * 0.04, duration: 0.3 }}>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold uppercase tracking-wide text-foreground">
                {a.type}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{a.message ?? "Emergency alert"}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                {a.lat != null && a.lng != null
                  ? ` · ${a.lat.toFixed(4)}, ${a.lng.toFixed(4)}`
                  : ""}
              </p>
            </div>
            <StatusBadge status={a.status} />
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
