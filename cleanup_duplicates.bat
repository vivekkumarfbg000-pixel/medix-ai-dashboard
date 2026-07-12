@echo off
echo ==========================================
echo   Medix AI Codebase Cleanup Utility
echo ==========================================
echo.
echo This script will delete duplicate/stale files in this directory.
echo.
pause

echo Deleting stale Vite config mjs files...
if exist vite.config.ts.timestamp-1766777572822-cd0fcf56684798.mjs del /f /q vite.config.ts.timestamp-1766777572822-cd0fcf56684798.mjs
if exist vite.config.ts.timestamp-1766778587752-75078d2240d3d8.mjs del /f /q vite.config.ts.timestamp-1766778587752-75078d2240d3d8.mjs

echo Deleting old DebugAI page...
if exist src\pages\DebugAI.tsx del /f /q src\pages\DebugAI.tsx

echo Deleting duplicate n8n JSON files in root...
if exist medix-integrated-workflow.json del /f /q medix-integrated-workflow.json
if exist medix-operations-workflow-v2.json del /f /q medix-operations-workflow-v2.json

echo Deleting duplicate n8n JSON files in public...
if exist public\medix-integrated-workflow.json del /f /q public\medix-integrated-workflow.json
if exist public\medix-operations-workflow.json del /f /q public\medix-operations-workflow.json
if exist public\medix-background-workflow.json del /f /q public\medix-background-workflow.json

echo Deleting legacy n8n directories...
if exist n8n rmdir /s /q n8n
if exist n8n_workflows rmdir /s /q n8n_workflows

echo.
echo ==========================================
echo   Cleanup completed successfully!
echo ==========================================
echo.
pause
