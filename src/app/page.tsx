import Link from "next/link";
import {
  Users,
  Brain,
  BellRing,
  Shield,
  ArrowRight,
  Smartphone,
  Monitor,
  Globe,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30 text-xs font-bold">
            BW
          </span>
          THE BOSS Watch
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/login" className="text-zinc-400 hover:text-zinc-100">
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-xl bg-emerald-500 px-4 py-2 font-medium text-zinc-950 hover:bg-emerald-400"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-20 pt-10">
        <section className="max-w-3xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            Shared responsibility · One group AI
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl sm:leading-[1.1]">
            Reminders that coordinate people — not just nag phones.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-zinc-400">
            THE BOSS Watch is a cross-platform shared responsibility assistant. Families, crews, and teams
            manage obligations together through one persistent group AI that assigns, escalates,
            and follows up until work is truly done.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
            >
              Create your first Task Group
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-5 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-800/60"
            >
              Sign in
            </Link>
          </div>
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Users,
              title: "Task Groups",
              body: "Household, crew, caregiving, events — multiple people, clear roles.",
            },
            {
              icon: Brain,
              title: "Shared AI",
              body: "One coordinator memory across phones, web, and desktop — not siloed bots.",
            },
            {
              icon: BellRing,
              title: "Smart escalation",
              body: "Accept · backup · coordinator · overdue. Real commitment, not spam alarms.",
            },
            {
              icon: Shield,
              title: "Roles & privacy",
              body: "Owner, coordinator, member, dependent, guest — permissions per group.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5"
            >
              <f.icon className="mb-3 h-5 w-5 text-emerald-400" />
              <h3 className="font-medium text-zinc-100">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{f.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-16 rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 to-zinc-950 p-8">
          <h2 className="text-xl font-semibold text-white">Example: garbage night</h2>
          <div className="mt-4 space-y-3 text-sm text-zinc-400">
            <p>
              <span className="text-zinc-200">Joe</span> is primary.{" "}
              <span className="text-zinc-200">Matthew</span> is backup. Bins out before 7:00 a.m.
            </p>
            <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-amber-100">
              Joe hasn’t confirmed. Phone offline. Matthew is home and available — THE BOSS Watch asks him
              to take it.
            </p>
            <p className="text-zinc-500">
              That is coordination — not the same alarm every five minutes.
            </p>
          </div>
        </section>

        <section className="mt-12 flex flex-wrap items-center gap-6 text-sm text-zinc-500">
          <span className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" /> Mobile web / PWA
          </span>
          <span className="flex items-center gap-2">
            <Monitor className="h-4 w-4" /> Windows installer
          </span>
          <span className="flex items-center gap-2">
            <Globe className="h-4 w-4" /> Deployable on Vercel
          </span>
        </section>
      </main>

      <footer className="border-t border-zinc-900 py-8 text-center text-xs text-zinc-600">
        THE BOSS Watch · Shared responsibility assistant · Built with Next.js + SpaceXAI
      </footer>
    </div>
  );
}
