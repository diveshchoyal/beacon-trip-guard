import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { toast } from "sonner";

import logo from "@/assets/beacon-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard, PressButton } from "@/components/ui/glass";
import { Field } from "./login";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create account — BEACON" },
      {
        name: "description",
        content: "Create a BEACON account as a tourist or as a police / admin responder.",
      },
      { property: "og:title", content: "Create account — BEACON" },
      {
        property: "og:description",
        content: "Create a BEACON account as a tourist or as a police / admin responder.",
      },
    ],
  }),
  component: SignupPage,
});

const roles = [
  { value: "tourist", label: "Tourist" },
  { value: "police", label: "Police / Admin" },
] as const;

function SignupPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<"tourist" | "police">("tourist");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName.trim(), role },
      },
    });
    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      toast.success("Check your email to confirm your BEACON account.");
      return;
    }
    toast.success("Account created");
    navigate({ to: role === "police" ? "/dashboard" : "/app", replace: true });
  };

  return (
    <main className="flex min-h-screen flex-col px-5 py-6">
      <div className="mx-auto flex w-full max-w-md items-center justify-between">
        <Link to="/" className="text-sm font-semibold tracking-[0.35em] text-muted-foreground">
          BEACON
        </Link>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 items-center py-8">
        <GlassCard className="w-full p-8">
          <img
            src={logo}
            alt="BEACON"
            width={1024}
            height={1024}
            loading="lazy"
            className="mx-auto h-20 w-20 object-contain"
          />
          <h1 className="mt-5 text-center text-2xl font-bold text-foreground">Create your account</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Safe Travel. Smart Response.
          </p>

          <div className="mt-7">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              I am a
            </span>
            <div className="glass relative flex gap-1 rounded-2xl p-1">
              {roles.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className="relative flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground"
                >
                  {role === r.value && (
                    <motion.span
                      layoutId="role-pill"
                      className="absolute inset-0 rounded-xl bg-primary"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span
                    className={`relative ${role === r.value ? "text-primary-foreground" : "text-muted-foreground"}`}
                  >
                    {r.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <Field label="Full name" value={fullName} onChange={setFullName} placeholder="Asha Rao" />
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
              placeholder="At least 6 characters"
            />
            <PressButton type="submit" disabled={busy} className="w-full">
              {busy ? "Creating…" : "Sign Up"}
            </PressButton>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already registered?{" "}
            <Link to="/login" className="font-semibold text-[var(--sand)]">
              Log in
            </Link>
          </p>
        </GlassCard>
      </div>
    </main>
  );
}
