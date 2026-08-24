import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
        content: "Create your BEACON tourist account and travel with live safety monitoring.",
      },
      { property: "og:title", content: "Create account — BEACON" },
      {
        property: "og:description",
        content: "Create your BEACON tourist account and travel with live safety monitoring.",
      },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
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
        data: { full_name: fullName.trim() },
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
    navigate({ to: "/app", replace: true });
  };

  return (
    <main className="flex min-h-screen flex-col px-5 py-6">
      <div className="mx-auto flex w-full max-w-sm items-center justify-between">
        <Link to="/" className="text-sm font-semibold tracking-[0.35em] text-muted-foreground">
          BEACON
        </Link>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 items-center py-8">
        <GlassCard className="w-full p-8 lg:p-10">
          <div className="relative mx-auto h-24 w-24">
            <div className="absolute inset-0 rounded-full bg-[var(--sand)]/25 blur-2xl" />
            <img
              src={logo}
              alt="BEACON"
              width={1024}
              height={1024}
              loading="lazy"
              className="relative z-10 h-full w-full object-contain drop-shadow-[0_8px_24px_rgba(201,165,116,0.45)]"
            />
          </div>

          <h1 className="mt-6 text-center text-2xl font-bold tracking-tight text-foreground lg:text-3xl">
            Create your account
          </h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Join BEACON and travel with confidence.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <Field
              label="Full name"
              value={fullName}
              onChange={setFullName}
              placeholder="Asha Rao"
            />
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

          <p className="mt-8 text-center text-sm text-muted-foreground">
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
