@echo off
echo Restoring logo...
copy /Y "C:\Users\vivek\.gemini\antigravity\brain\e289e3a0-a76f-4697-8c12-0419c85d0056\uploaded_image_1769098373484.png" "logo.png"
if exist "logo.png" (
    echo SUCCESS: logo.png restored.
) else (
    echo ERROR: Failed to restore logo.png
)
pause
