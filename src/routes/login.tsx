import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import logo from "@/assets/beacon-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard, PressButton } from "@/components/ui/glass";
import { ThemeToggle } from "@/components/theme-provider";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — BEACON" },
      { name: "description", content: "Sign in to your BEACON tourist safety account." },
      { property: "og:title", content: "Log in — BEACON" },
      { property: "og:description", content: "Sign in to your BEACON tourist safety account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user!.id)
      .maybeSingle();
    toast.success("Welcome back");
    navigate({ to: roleRow?.role === "police" ? "/dashboard" : "/app", replace: true });
  };

  return (
    <main className="flex min-h-screen flex-col px-5 py-6">
      <div className="mx-auto flex w-full max-w-md items-center justify-between">
        <Link to="/" className="text-sm font-semibold tracking-[0.35em] text-muted-foreground">
          BEACON
        </Link>
        <ThemeToggle />
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 items-center">
        <GlassCard className="w-full p-8">
          <img
            src={logo}
            alt="BEACON"
            width={1024}
            height={1024}
            loading="lazy"
            className="mx-auto h-20 w-20 object-contain"
          />
          <h1 className="mt-5 text-center text-2xl font-bold text-foreground">Welcome back</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Log in to continue your journey safely.
          </p>

          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
            />
            <PressButton type="submit" disabled={busy} className="w-full">
              {busy ? "Signing in…" : "Log In"}
            </PressButton>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            New here?{" "}
            <Link to="/signup" className="font-semibold text-[var(--sand)]">
              Create an account
            </Link>
          </p>
        </GlassCard>
      </div>
    </main>
  );
}

export function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        maxLength={200}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}
