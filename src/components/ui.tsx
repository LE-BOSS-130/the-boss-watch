import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
}) {
  const variants = {
    primary:
      "bg-emerald-500 text-zinc-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 disabled:opacity-50",
    secondary: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 disabled:opacity-50",
    ghost: "bg-transparent text-zinc-300 hover:bg-zinc-800/80 disabled:opacity-50",
    danger: "bg-rose-600/90 text-white hover:bg-rose-500 disabled:opacity-50",
    outline:
      "border border-zinc-700 bg-transparent text-zinc-200 hover:bg-zinc-800/60 disabled:opacity-50",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-zinc-700/80 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-zinc-700/80 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20",
        className
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-5 shadow-xl shadow-black/20 backdrop-blur",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "ok" | "warn" | "danger" | "info";
}) {
  const tones = {
    default: "bg-zinc-800 text-zinc-300",
    ok: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
    warn: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30",
    danger: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30",
    info: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

export function statusTone(
  status: string
): "default" | "ok" | "warn" | "danger" | "info" {
  if (status === "COMPLETED" || status === "ACCEPTED") return "ok";
  if (status === "OVERDUE" || status === "COORDINATOR_NOTIFIED") return "danger";
  if (
    status === "DEADLINE_APPROACHING" ||
    status === "BACKUP_CONTACTED" ||
    status === "REMINDED"
  )
    return "warn";
  if (status === "UPCOMING") return "info";
  return "default";
}
