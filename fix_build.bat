@echo off
echo ===================================================
echo      MEDIX AI BUILD FIX UTILITY (LATEST)
echo ===================================================
echo.
echo The build failed because 'src/logo.png' is missing.
echo This script will fix it using the latest uploaded image (1769098373484).
echo.

if not exist "src" (
    echo [ERROR] 'src' folder not found! 
    echo Please make sure this file is in the 'medix-ai-dashboard-main' folder.
    pause
    exit /b
)

echo Copying latest logo to src/logo.png...
copy /Y "C:\Users\vivek\.gemini\antigravity\brain\e289e3a0-a76f-4697-8c12-0419c85d0056\uploaded_image_1769098373484.png" "src\logo.png"

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to copy file.
) else (
    echo.
    echo [SUCCESS] File restored!
    echo.
    echo You can now run 'npm run build' again.
)
echo.
pause
