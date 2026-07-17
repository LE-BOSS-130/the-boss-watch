@echo off
cd /d "%~dp0"
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
echo Starting Pact at http://localhost:3000
echo Demo logins: joe@pact.local / password123
echo.
call npm run dev
