@echo off
echo Attempting to update logo to medix-logo.png...
copy /Y "C:\Users\vivek\.gemini\antigravity\brain\e289e3a0-a76f-4697-8c12-0419c85d0056\uploaded_image_1769090214064.png" "c:\Users\vivek\PharmaAssist.AI Dashboard\medix-ai-dashboard-main\medix-ai-dashboard-main\public\medix-logo.png"
if %errorlevel% neq 0 (
    echo Error copying file. Please check permissions.
) else (
    echo Success! New logo (medix-logo.png) placed.
)
pause
