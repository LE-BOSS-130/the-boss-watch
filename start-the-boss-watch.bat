@echo off
cd /d "%~dp0"
title THE BOSS Watch
if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
)
if not exist "prisma\dev.db" (
  echo Setting up database...
  call npx prisma db push
  call npm run db:seed
)
echo.
echo Starting THE BOSS Watch at http://127.0.0.1:3847
echo Demo logins: joe@bosswatch.local / password123
echo.
start "" "http://127.0.0.1:3847"
call npm run dev
