# THE BOSS Watch — Shared Responsibility Assistant

> A cross-platform **shared responsibility assistant** that coordinates people, reminders, tasks, and devices through **one persistent group AI**.

THE BOSS Watch is more than a reminder app. Families, crews, coworkers, and caregiving teams share **Task Groups** with commitments, backups, escalation, and a single AI coordinator that has the same memory on every device.

## Features (MVP)

- **Task Groups** with invite codes
- **Roles**: Owner · Coordinator · Member · Dependent · Guest
- **Commitments**: Accept · Decline · Request help · Snooze · Reassign · Complete · Escalate
- **Escalation ladder**: Upcoming → Reminder → Accepted → Deadline approaching → Backup → Coordinator → Overdue
- **Shared Group AI** (SpaceXAI / xAI Grok) with group memory and structured task actions
- **Daily briefing** per group
- **Web app** (PWA-ready) + **Windows desktop installer** (Electron)
- **SQLite** local database (swap to Postgres for multi-user cloud)

## Quick start

```bash
# Requirements: Node.js 20+
cd the-boss-watch
cp .env.example .env
# Optional: set XAI_API_KEY from https://console.x.ai

npm install
npm run db:push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo accounts (after seed)

| Email | Password | Role |
|-------|----------|------|
| `joe@bosswatch.local` | `password123` | Owner |
| `matthew@bosswatch.local` | `password123` | Member |
| `sam@bosswatch.local` | `password123` | Coordinator |

Invite code for the demo household: **`HOUSEHOLD`**

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production web build |
| `npm run start` | Production web server |
| `npm run db:push` | Apply Prisma schema (SQLite) |
| `npm run db:seed` | Seed demo users & tasks |
| `npm run db:studio` | Prisma Studio |
| `npm run desktop` | Electron shell against running app |
| `npm run desktop:dev` | Next dev + Electron together |
| `npm run dist:win` | Build **Windows NSIS installer** |

## Architecture

```text
iPhone / Android / Windows / Web
              │
              ▼
     THE BOSS Watch (Next.js)
              │
     Shared sync + auth
              │
              ▼
  Authoritative task DB  +  Shared AI coordinator (xAI)
              │
     Optional desktop worker (future: Ollama / local models)
```

- **Authoritative state**: Prisma + SQLite (dev/desktop) or Postgres (cloud)
- **AI provider layer**: OpenAI-compatible client → `https://api.x.ai/v1` (replaceable)
- **Without `XAI_API_KEY`**: local rule-based coordinator still creates tasks & briefings

## Deploy (Vercel)

1. Push this repo to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. For production multi-user hosting, point `DATABASE_URL` at **Postgres** (Neon, Supabase, or Vercel Postgres) and update `prisma/schema.prisma` `provider` to `postgresql`.
4. Set env vars: `AUTH_SECRET`, `NEXTAUTH_URL` / `AUTH_URL`, `XAI_API_KEY`, `DATABASE_URL`.
5. Build command: `prisma generate && next build` (see `package.json`).

> SQLite files are ideal for the **desktop installer** and local dev. Serverless hosts need Postgres.

## Windows installer

```bash
npm run dist:win
```

Installers are **never** left on the Desktop. Builds publish to OneDrive Documents:

```text
OneDrive\Documents\THE BOSS Watch\Installers\THE-BOSS-Watch-Setup-*.exe
```

(full path example: `C:\Users\<you>\OneDrive\Documents\THE BOSS Watch\Installers`)

The desktop app embeds its own local server (no separate terminal required). Data lives under the app’s user data folder; a seeded demo DB is copied on first run.

Optional: point the desktop shell at a remote host:

```bash
set BOSS_WATCH_URL=https://your-deployment.vercel.app
npm run desktop
```

## Tailscale / private network (optional)

Run THE BOSS Watch on a home server or desktop and share only with your family/crew:

```bash
npm run build && npm run start
# Install Tailscale on the host and clients
# Open http://<magicdns-or-tailscale-ip>:3000
```

No public internet exposure required for private groups.

## Project layout

```text
src/app          Next.js App Router (UI + API)
src/lib          auth, AI coordinator, escalation, permissions
prisma/          schema + local SQLite
electron/        desktop shell
scripts/         seed + desktop helpers
```

## Roadmap

- [ ] Push notifications (FCM / APNs / Windows)
- [ ] Photo / location completion verification
- [ ] Desktop worker nodes (Ollama) for private inference
- [ ] WebRTC device channels
- [ ] Flutter mobile clients sharing the same API
- [ ] Passkeys & device approval

## License

MIT — built for LE-BOSS-130 / personal and team use.
