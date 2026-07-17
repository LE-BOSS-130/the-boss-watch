"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Input, Badge } from "@/components/ui";
import { LogOut, Plus, Users, Link2 } from "lucide-react";

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  role: string;
  memberCount: number;
  openTasks: number;
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [invite, setInvite] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/groups");
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    const data = await res.json();
    setGroups(data.groups || []);
    setLoading(false);
  }

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated") load();
  }, [status, router]);

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed");
      return;
    }
    setName("");
    setDescription("");
    router.push(`/groups/${data.group.id}`);
  }

  async function joinGroup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/groups/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: invite }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to join");
      return;
    }
    setInvite("");
    router.push(`/groups/${data.group.id}`);
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-zinc-500">Loading…</div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/" className="text-xs font-medium text-emerald-400">
            Pact
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">
            Hi{session?.user?.name ? `, ${session.user.name}` : ""}
          </h1>
          <p className="text-sm text-zinc-400">Your shared task groups</p>
        </div>
        <Button variant="ghost" onClick={() => signOut({ callbackUrl: "/" })}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </header>

      {error && (
        <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 flex items-center gap-2 font-medium">
            <Plus className="h-4 w-4 text-emerald-400" />
            Create Task Group
          </h2>
          <form onSubmit={createGroup} className="space-y-3">
            <Input
              placeholder="Household, Construction crew…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              placeholder="Optional description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Button type="submit" className="w-full">
              Create group
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-3 flex items-center gap-2 font-medium">
            <Link2 className="h-4 w-4 text-sky-400" />
            Join with invite code
          </h2>
          <form onSubmit={joinGroup} className="space-y-3">
            <Input
              placeholder="e.g. ABCD2345"
              value={invite}
              onChange={(e) => setInvite(e.target.value.toUpperCase())}
              required
              className="font-mono tracking-widest"
            />
            <Button type="submit" variant="secondary" className="w-full">
              Join group
            </Button>
          </form>
        </Card>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500">
          Your groups
        </h2>
        {groups.length === 0 ? (
          <Card className="text-center text-sm text-zinc-500">
            No groups yet. Create one or join with a code from a teammate.
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map((g) => (
              <Link key={g.id} href={`/groups/${g.id}`}>
                <Card className="transition hover:border-emerald-500/40 hover:bg-zinc-900/80">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-medium text-zinc-100">{g.name}</h3>
                      {g.description && (
                        <p className="mt-1 text-sm text-zinc-500 line-clamp-2">{g.description}</p>
                      )}
                    </div>
                    <Badge>{g.role}</Badge>
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {g.memberCount}
                    </span>
                    <span>{g.openTasks} open</span>
                    <span className="font-mono text-zinc-600">{g.inviteCode}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
