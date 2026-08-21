@echo off
chcp 65001 >nul
title B.R. Levent Plastik - Yonetim Sistemini Durdur
color 0C

echo =======================================================================
echo     B.R. LEVENT PLASTIK - YONETIM SISTEMI DURDURULUYOR
echo =======================================================================
echo.

:: 3000 portunda calisan node islemini bul ve sonlandir
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    echo Port 3000 kullanan islem (PID: %%a) durduruluyor...
    taskkill /f /pid %%a >nul 2>&1
)

echo.
echo Sistem basariyla durduruldu.
echo Yeniden baslatmak icin BASLAT.bat dosyasina tiklayabilirsiniz.
echo.
timeout /t 3
