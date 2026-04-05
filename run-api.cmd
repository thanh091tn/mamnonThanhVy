@echo off
cd /d "%~dp0backend"
echo Starting API (PostgreSQL)...
node src\index.js
pause
