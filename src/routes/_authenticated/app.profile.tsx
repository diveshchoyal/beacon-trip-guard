import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { LogOut } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard, PressButton } from "@/components/ui/glass";
import { useSignOut } from "@/components/layout/nav";
import { Field } from "@/routes/login";

export const Route = createFileRoute("/_authenticated/app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, refresh } = useAuth();
  const signOut = useSignOut();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
  }, [profile]);

  const save = async (e: React.FormEvent) => {
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
    toast.success("Profile updated");
    await refresh();
  };

  return (
    <div className="space-y-5">
      <GlassCard>
        <h2 className="text-sm font-semibold text-foreground">Your details</h2>
        <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
        <form onSubmit={save} className="mt-5 space-y-4">
          <Field label="Full name" value={fullName} onChange={setFullName} />
          <Field label="Phone" value={phone} onChange={setPhone} required={false} placeholder="+91…" />
          <PressButton type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </PressButton>
        </form>
      </GlassCard>

      <GlassCard transition={{ delay: 0.1, duration: 0.3 }}>
        <PressButton variant="ghost" onClick={signOut} className="w-full">
          <LogOut className="h-4 w-4" /> Sign out
        </PressButton>
      </GlassCard>
    </div>
  );
}
