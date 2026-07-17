# Deploying THE BOSS Watch

## Local / desktop (recommended for MVP multi-user on one LAN)

```bash
npm install
cp .env.example .env
# set AUTH_SECRET and optional XAI_API_KEY
npm run db:push
npm run db:seed
npm run dev          # http://localhost:3000
# or
npm run build && npm run start
```

### Windows installer

```bash
npm run dist:win
# → release/THE-BOSS-Watch-Setup-0.1.0.exe
```

The desktop shell opens THE BOSS Watch UI. By default it loads `http://localhost:3000`.  
To point the desktop app at a hosted backend:

```bat
set BOSS_WATCH_URL=https://your-app.vercel.app
"THE BOSS Watch.exe"
```

Or set `BOSS_WATCH_URL` before `npm run desktop`.

### Private network with Tailscale

1. Run `npm run start` on a always-on PC.
2. Install [Tailscale](https://tailscale.com) on that PC and family/crew devices.
3. Open `http://<machine-name>.tailnet-name.ts.net:3000` (or the Tailscale IP).
4. Everyone shares the same SQLite database and group AI memory on that host.

## Vercel (public web)

SQLite is **not** durable on serverless. For Vercel:

1. Create a free Postgres database ([Neon](https://neon.tech) or [Supabase](https://supabase.com) or Vercel Postgres).
2. In `prisma/schema.prisma`, change:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

3. Set env vars in Vercel:

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | Long random string |
| `NEXTAUTH_URL` / `AUTH_URL` | `https://your-domain.vercel.app` |
| `XAI_API_KEY` | From https://console.x.ai |

4. Deploy:

```bash
npx vercel --prod
```

5. After first deploy, run migrations against production:

```bash
npx prisma db push
```

(Or add a `prisma migrate` workflow.)

## GitHub

Repo: https://github.com/LE-BOSS-130/the-boss-watch  
(Product name: **THE BOSS Watch**)

```bash
git push origin master
```
