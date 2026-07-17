"use client";

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Bot,
  Check,
  Copy,
  HelpCircle,
  Plus,
  RefreshCw,
  Send,
  Siren,
  UserPlus,
  X,
} from "lucide-react";
import { Badge, Button, Card, Input, Textarea, statusTone } from "@/components/ui";
import { statusLabel } from "@/lib/utils";

type Member = {
  id: string;
  role: string;
  available: boolean;
  user: { id: string; name: string; email: string };
};

type Assignment = {
  id: string;
  role: string;
  commitment: string;
  user: { id: string; name: string };
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  remindAt: string | null;
  escalationStage: number;
  recurrenceRule: string | null;
  verificationType: string;
  notes: string | null;
  assignments: Assignment[];
  actions: { id: string; type: string; createdAt: string; user: { name: string } }[];
};

type Message = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  user?: { name: string } | null;
};

type GroupPayload = {
  group: {
    id: string;
    name: string;
    description: string | null;
    inviteCode: string;
    members: Member[];
    tasks: Task[];
    rules: { id: string; name: string; ruleText: string }[];
    messages: Message[];
  };
  myRole: string;
  schedulerNotes: string[];
};

export default function GroupPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const groupId = params.groupId as string;
  const router = useRouter();
  const [data, setData] = useState<GroupPayload | null>(null);
  const [briefing, setBriefing] = useState<string>("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"tasks" | "ai" | "people">("tasks");
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [primaryUserId, setPrimaryUserId] = useState("");
  const [backupUserId, setBackupUserId] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}`);
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    if (!res.ok) {
      setError("Could not load group");
      return;
    }
    const json = await res.json();
    setData(json);
    const br = await fetch(`/api/groups/${groupId}/briefing`);
    if (br.ok) {
      const b = await br.json();
      setBriefing(b.summary);
    }
  }, [groupId, router]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated") load();
  }, [status, load, router]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.group.messages, tab]);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/groups/${groupId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || undefined,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        primaryUserId: primaryUserId || null,
        backupUserId: backupUserId || null,
      }),
    });
    if (!res.ok) {
      const j = await res.json();
      setError(j.error || "Failed to create task");
      return;
    }
    setTitle("");
    setDescription("");
    setDueAt("");
    setPrimaryUserId("");
    setBackupUserId("");
    setShowNew(false);
    await load();
  }

  async function taskAction(taskId: string, type: string, extra?: Record<string, string>) {
    const res = await fetch(`/api/tasks/${taskId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...extra }),
    });
    if (!res.ok) {
      const j = await res.json();
      setError(j.error || "Action failed");
      return;
    }
    await load();
  }

  async function sendAi(e: React.FormEvent) {
    e.preventDefault();
    if (!aiInput.trim() || aiBusy) return;
    setAiBusy(true);
    const message = aiInput.trim();
    setAiInput("");
    // optimistic user bubble
    setData((prev) =>
      prev
        ? {
            ...prev,
            group: {
              ...prev.group,
              messages: [
                ...prev.group.messages,
                {
                  id: `tmp-${Date.now()}`,
                  role: "user",
                  content: message,
                  createdAt: new Date().toISOString(),
                  user: { name: session?.user?.name || "You" },
                },
              ],
            },
          }
        : prev
    );
    const res = await fetch(`/api/groups/${groupId}/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    setAiBusy(false);
    if (!res.ok) {
      setError("AI request failed");
      return;
    }
    await load();
    setTab("tasks"); // refresh tasks if AI created any
    setTimeout(() => setTab("ai"), 0);
  }

  function copyInvite() {
    if (!data) return;
    navigator.clipboard.writeText(data.group.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center text-zinc-500">
        {error || "Loading group…"}
      </div>
    );
  }

  const { group } = data;
  const openTasks = group.tasks.filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED");
  const doneTasks = group.tasks.filter((t) => t.status === "COMPLETED");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6">
      <header className="mb-6">
        <Link
          href="/dashboard"
          className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300"
        >
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{group.name}</h1>
            {group.description && (
              <p className="mt-1 text-sm text-zinc-400">{group.description}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <Badge>{data.myRole}</Badge>
              <span>{group.members.length} members</span>
              <button
                type="button"
                onClick={copyInvite}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 px-2 py-1 font-mono text-zinc-400 hover:border-zinc-600"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {group.inviteCode}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => load()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4" />
              Task
            </Button>
          </div>
        </div>
      </header>

      {briefing && (
        <Card className="mb-6 border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-start gap-3">
            <Bot className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-emerald-400/80">
                Group briefing
              </p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-300">{briefing}</p>
            </div>
          </div>
        </Card>
      )}

      {error && (
        <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
          {error}
          <button className="ml-2 underline" onClick={() => setError("")}>
            dismiss
          </button>
        </p>
      )}

      <div className="mb-4 flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900/40 p-1">
        {(
          [
            ["tasks", "Tasks"],
            ["ai", "Group AI"],
            ["people", "People & rules"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === id
                ? "bg-zinc-800 text-white shadow"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "tasks" && (
        <div className="space-y-3">
          {openTasks.length === 0 && (
            <Card className="text-center text-sm text-zinc-500">
              No open tasks. Create one or ask the Group AI in natural language.
            </Card>
          )}
          {openTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              members={group.members}
              currentUserId={session?.user?.id}
              onAction={taskAction}
            />
          ))}
          {doneTasks.length > 0 && (
            <div className="pt-6">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-600">
                Completed
              </h3>
              <div className="space-y-2 opacity-70">
                {doneTasks.slice(0, 8).map((task) => (
                  <Card key={task.id} className="py-3">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-400" />
                      <span className="text-sm line-through">{task.title}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "ai" && (
        <Card className="flex min-h-[480px] flex-col p-0 overflow-hidden">
          <div className="border-b border-zinc-800 px-4 py-3">
            <p className="text-sm font-medium">Shared group assistant</p>
            <p className="text-xs text-zinc-500">
              Same memory for everyone in this group — phones, web, desktop.
            </p>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {group.messages.length === 0 && (
              <div className="rounded-xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">
                Try: “Every second Friday, remind whoever is home to put recycling out before 7.”
                <br />
                Or: “Who is picking up Emma?” · “Daily briefing”
              </div>
            )}
            {group.messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-emerald-500/20 text-emerald-50"
                      : "bg-zinc-800/80 text-zinc-200"
                  }`}
                >
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wide opacity-60">
                    {m.role === "user" ? m.user?.name || "Member" : "BOSS Watch AI"}
                  </p>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              </div>
            ))}
            {aiBusy && (
              <p className="text-xs text-zinc-500">Coordinator thinking…</p>
            )}
            <div ref={chatEnd} />
          </div>
          <form onSubmit={sendAi} className="flex gap-2 border-t border-zinc-800 p-3">
            <Input
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Talk to the group AI…"
              className="flex-1"
            />
            <Button type="submit" disabled={aiBusy || !aiInput.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Card>
      )}

      {tab === "people" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <h3 className="mb-3 flex items-center gap-2 font-medium">
              <UserPlus className="h-4 w-4 text-sky-400" />
              Members
            </h3>
            <ul className="space-y-2">
              {group.members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-800/80 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{m.user.name}</p>
                    <p className="text-xs text-zinc-500">{m.user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${m.available ? "bg-emerald-400" : "bg-zinc-600"}`}
                      title={m.available ? "Available" : "Unavailable"}
                    />
                    <Badge>{m.role}</Badge>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-zinc-500">
              Share invite code <span className="font-mono text-zinc-300">{group.inviteCode}</span>{" "}
              so others can join from their dashboard.
            </p>
          </Card>
          <Card>
            <h3 className="mb-3 font-medium">Group rules</h3>
            {group.rules.length === 0 ? (
              <p className="text-sm text-zinc-500">No rules yet. Ask the AI to add one.</p>
            ) : (
              <ul className="space-y-3">
                {group.rules.map((r) => (
                  <li key={r.id} className="rounded-xl border border-zinc-800/80 px-3 py-2">
                    <p className="text-sm font-medium text-zinc-200">{r.name}</p>
                    <p className="mt-1 text-xs text-zinc-500">{r.ruleText}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <Card className="w-full max-w-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New coordinated task</h2>
              <button type="button" onClick={() => setShowNew(false)} className="text-zinc-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={createTask} className="space-y-3">
              <Input
                placeholder="Title — e.g. Garbage collection"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <Textarea
                placeholder="Details, deadline rules, location…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Due</label>
                <Input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Primary</label>
                  <select
                    className="w-full rounded-xl border border-zinc-700/80 bg-zinc-900/80 px-3 py-2.5 text-sm"
                    value={primaryUserId}
                    onChange={(e) => setPrimaryUserId(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {group.members.map((m) => (
                      <option key={m.user.id} value={m.user.id}>
                        {m.user.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Backup</label>
                  <select
                    className="w-full rounded-xl border border-zinc-700/80 bg-zinc-900/80 px-3 py-2.5 text-sm"
                    value={backupUserId}
                    onChange={(e) => setBackupUserId(e.target.value)}
                  >
                    <option value="">None</option>
                    {group.members.map((m) => (
                      <option key={m.user.id} value={m.user.id}>
                        {m.user.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowNew(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create task</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  members,
  currentUserId,
  onAction,
}: {
  task: Task;
  members: Member[];
  currentUserId?: string;
  onAction: (taskId: string, type: string, extra?: Record<string, string>) => void;
}) {
  const [reassign, setReassign] = useState("");

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-zinc-100">{task.title}</h3>
            <Badge tone={statusTone(task.status)}>{statusLabel(task.status)}</Badge>
            {task.priority !== "NORMAL" && (
              <Badge tone={task.priority === "URGENT" ? "danger" : "warn"}>{task.priority}</Badge>
            )}
          </div>
          {task.description && (
            <p className="mt-1 text-sm text-zinc-400">{task.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
            {task.dueAt && (
              <span>
                Due {format(new Date(task.dueAt), "MMM d, h:mm a")} (
                {formatDistanceToNow(new Date(task.dueAt), { addSuffix: true })})
              </span>
            )}
            {task.recurrenceRule && <span>↻ {task.recurrenceRule}</span>}
            <span>Verify: {task.verificationType}</span>
            <span>Stage {task.escalationStage}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {task.assignments.map((a) => (
              <span
                key={a.id}
                className="rounded-lg bg-zinc-800/80 px-2 py-1 text-xs text-zinc-300"
              >
                {a.user.name} · {a.role} · {a.commitment}
              </span>
            ))}
            {task.assignments.length === 0 && (
              <span className="text-xs text-amber-400/90">Needs an owner</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="primary"
          className="!py-1.5 text-xs"
          onClick={() => onAction(task.id, "ACCEPT")}
        >
          Accept
        </Button>
        <Button
          variant="outline"
          className="!py-1.5 text-xs"
          onClick={() => onAction(task.id, "DECLINE", { reason: "Cannot take this" })}
        >
          Decline
        </Button>
        <Button
          variant="secondary"
          className="!py-1.5 text-xs"
          onClick={() => onAction(task.id, "HELP", { reason: "Need help" })}
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Help
        </Button>
        <Button
          variant="secondary"
          className="!py-1.5 text-xs"
          onClick={() =>
            onAction(task.id, "SNOOZE", {
              reason: "Later",
              snoozeUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            })
          }
        >
          Snooze 1h
        </Button>
        <Button
          variant="primary"
          className="!py-1.5 text-xs"
          onClick={() => onAction(task.id, "COMPLETE")}
        >
          <Check className="h-3.5 w-3.5" />
          Complete
        </Button>
        <Button
          variant="danger"
          className="!py-1.5 text-xs"
          onClick={() => onAction(task.id, "ESCALATE")}
        >
          <Siren className="h-3.5 w-3.5" />
          Escalate
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
          value={reassign}
          onChange={(e) => setReassign(e.target.value)}
        >
          <option value="">Reassign to…</option>
          {members
            .filter((m) => m.user.id !== currentUserId)
            .map((m) => (
              <option key={m.user.id} value={m.user.id}>
                {m.user.name}
              </option>
            ))}
        </select>
        <Button
          variant="ghost"
          className="!py-1.5 text-xs"
          disabled={!reassign}
          onClick={() => {
            onAction(task.id, "REASSIGN", { reassignUserId: reassign });
            setReassign("");
          }}
        >
          Reassign
        </Button>
      </div>
    </Card>
  );
}
