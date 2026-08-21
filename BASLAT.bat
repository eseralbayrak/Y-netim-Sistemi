@echo off
chcp 65001 >nul
title B.R. Levent Plastik - Yonetim Sistemi
color 0A

echo =======================================================================
echo     B.R. LEVENT PLASTIK - YONETIM SISTEMI BASLATILIYOR
echo =======================================================================
echo.
echo Sunucu calisiyor: http://localhost:3000
echo Pencereyi acik birakin veya kucultun (Kapatirsaniz sistem durur).
echo Durdurmak icin bu pencereyi kapatabilir veya DURDUR.bat calistirabilirsiniz.
echo.

:: 2 saniye sonra tarayiciyi ac
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"

:: Sunucuyu baslat
node server/server.js

pause
