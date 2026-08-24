import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";

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

function Landing() {
  return (
    <main className="relative min-h-screen overflow-hidden px-5 py-6">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <span className="text-sm font-semibold tracking-[0.35em] text-muted-foreground">
          BEACON
        </span>
      </div>

      <div className="mx-auto mt-12 flex w-full max-w-3xl items-center justify-center lg:mt-24">
        <GlassCard className="w-full p-8 text-center lg:p-12">
          <div className="relative mx-auto h-44 w-44 lg:h-56 lg:w-56">
            <div className="absolute inset-0 rounded-full bg-[var(--sand)]/20 blur-3xl" />
            <div className="absolute inset-0 rounded-full bg-[var(--blush)]/20 blur-2xl" />
            <motion.img
              src={logo}
              alt="BEACON logo — a lighthouse inside a shield"
              width={1024}
              height={1024}
              className="animate-float relative z-10 h-full w-full object-contain drop-shadow-[0_12px_40px_rgba(201,165,116,0.55)]"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>

          <h1 className="mt-8 text-4xl font-bold tracking-tight text-foreground lg:text-6xl">
            BEACON
          </h1>
          <p className="mt-3 text-lg font-medium text-[var(--sand)] lg:text-xl">
            Safe Travel. Smart Response.
          </p>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground lg:text-base">
            Smart tourist safety monitoring and incident response — AI risk scoring, geo-fencing and
            blockchain-based digital identity, in one calm place.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
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
      </div>
    </main>
  );
}
