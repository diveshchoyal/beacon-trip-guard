import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GlassCard({
  className,
  children,
  ...props
}: HTMLMotionProps<"div"> & { children?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn("glass p-5", className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

type PressButtonProps = HTMLMotionProps<"button"> & {
  variant?: "primary" | "ghost" | "blush";
};

export function PressButton({ className, variant = "primary", ...props }: PressButtonProps) {
  const styles = {
    primary:
      "bg-primary text-primary-foreground shadow-[0_12px_30px_-14px_var(--sand)] hover:brightness-105",
    blush: "bg-secondary text-secondary-foreground hover:brightness-105",
    ghost: "glass text-foreground",
  } as const;

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      whileHover={{ y: -1 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "resolved"
      ? "bg-[var(--safe)]/18 text-[var(--safe)]"
      : status === "acknowledged"
        ? "bg-[var(--caution)]/20 text-[var(--caution)]"
        : "bg-[var(--danger)]/18 text-[var(--danger)]";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide",
        tone,
      )}
    >
      {status}
    </span>
  );
}

export function RiskBadge({ level }: { level: string }) {
  const tone =
    level === "high"
      ? "bg-[var(--danger)]/18 text-[var(--danger)]"
      : level === "medium"
        ? "bg-[var(--caution)]/20 text-[var(--caution)]"
        : "bg-[var(--safe)]/18 text-[var(--safe)]";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide",
        tone,
      )}
    >
      {level} risk
    </span>
  );
}
