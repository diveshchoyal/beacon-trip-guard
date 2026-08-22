import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ShieldCheck, MapPin, Fingerprint } from "lucide-react";

import logo from "@/assets/beacon-logo.png";
import { GlassCard, PressButton } from "@/components/ui/glass";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BEACON — Safe Travel. Smart Response." },
      {
        name: "description",
        content:
          "Travel with a guardian. BEACON pairs AI safety scoring, live geofencing and blockchain-anchored digital IDs with instant police response.",
      },
      { property: "og:title", content: "BEACON — Safe Travel. Smart Response." },
      {
        property: "og:description",
        content:
          "AI safety scoring, live geofencing and blockchain-anchored tourist digital IDs in one calm, premium app.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: ShieldCheck, title: "AI safety score", copy: "Live risk read on every step of your trip." },
  { icon: MapPin, title: "Geo-fencing", copy: "Know the moment you enter a high-risk zone." },
  { icon: Fingerprint, title: "Digital ID", copy: "Tamper-evident identity, verifiable anywhere." },
];

function Landing() {
  return (
    <main className="relative min-h-screen overflow-hidden px-5 py-6">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <span className="text-sm font-semibold tracking-[0.35em] text-muted-foreground">BEACON</span>
      </div>

      <div className="mx-auto mt-8 grid w-full max-w-5xl gap-6 lg:mt-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <GlassCard className="p-8 text-center lg:p-12 lg:text-left">
          <motion.img
            src={logo}
            alt="BEACON logo — a lighthouse inside a shield"
            width={1024}
            height={1024}
            className="animate-float mx-auto h-36 w-36 object-contain lg:mx-0 lg:h-44 lg:w-44"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground lg:text-5xl">
            BEACON
          </h1>
          <p className="mt-3 text-base font-medium text-[var(--sand)]">
            Safe Travel. Smart Response.
          </p>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground lg:mx-0">
            Smart tourist safety monitoring and incident response — AI risk scoring, geo-fencing and
            blockchain-based digital identity, in one calm place.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Link to="/login">
              <PressButton className="w-full sm:w-auto">Log In</PressButton>
            </Link>
            <Link to="/signup">
              <PressButton variant="ghost" className="w-full sm:w-auto">
                Sign Up
              </PressButton>
            </Link>
          </div>
        </GlassCard>

        <div className="grid gap-4">
          {features.map((f, i) => (
            <GlassCard key={f.title} transition={{ delay: 0.1 * i, duration: 0.35 }}>
              <div className="flex min-w-0 items-start gap-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-secondary/40 text-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-foreground">{f.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{f.copy}</p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </main>
  );
}
