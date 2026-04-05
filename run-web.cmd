@echo off
cd /d "%~dp0frontend"
echo Starting Vue dev server...
call npm run dev
pause
