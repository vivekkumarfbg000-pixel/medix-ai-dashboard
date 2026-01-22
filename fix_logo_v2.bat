@echo off
echo ===================================================
echo      MEDIX AI DASHBOARD LOGO UPDATE UTILITY
echo ===================================================
echo.
echo Attempting to copy new logo file...
echo Source: C:\Users\vivek\.gemini\antigravity\brain\e289e3a0-a76f-4697-8c12-0419c85d0056\uploaded_image_1769091623367.png
echo Destination: public\medix-logo.png
echo.

if not exist "public" (
    echo ERROR: 'public' folder not found! 
    echo Please make sure this file is in the 'medix-ai-dashboard-main' folder.
    pause
    exit /b
)

copy /Y "C:\Users\vivek\.gemini\antigravity\brain\e289e3a0-a76f-4697-8c12-0419c85d0056\uploaded_image_1769091623367.png" "public\medix-logo.png"

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to copy file.
) else (
    echo.
    echo [SUCCESS] Logo updated successfully!
    echo.
    echo Please REFRESH your browser to see the changes.
)
echo.
pause
