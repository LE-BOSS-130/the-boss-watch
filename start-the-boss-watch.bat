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
echo Starting THE BOSS Watch at http://localhost:3000
echo Demo logins: joe@bosswatch.local / password123
echo.
call npm run dev
