@echo off
echo ===================================================
echo      MEDIX AI NEW LOGO FIX UTILITY
echo ===================================================
echo.
echo The build failed because 'src/new-logo.jpg' is missing.
echo This script will fix it using the latest uploaded image.
echo.

if not exist "src" (
    echo [ERROR] 'src' folder not found! 
    echo Please make sure this file is in the 'medix-ai-dashboard-main' folder.
    pause
    exit /b
)

echo Copying latest logo to src/new-logo.jpg...
copy /Y "C:\Users\vivek\.gemini\antigravity\brain\e289e3a0-a76f-4697-8c12-0419c85d0056\uploaded_image_1_1769099521569.jpg" "src\new-logo.jpg"

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
