@echo off
echo Creating YomiMochi extension ZIP...
echo.

powershell -Command "Compress-Archive -Path manifest.json,content.js,background.js,icon.png,popup.html,popup.js -DestinationPath yomimochi.zip -Force"

if %errorlevel%==0 (
    echo.
    echo [SUCCESS] yomimochi.zip created!
    echo.
    echo Install in YomiNinja: Extensions -^> Install from ZIP
    echo.
) else (
    echo [ERROR] Failed to create ZIP
)

pause
