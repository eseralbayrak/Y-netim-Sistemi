@echo off
chcp 65001 >nul
title Windows Baslangicindan Otomatik Baslatmayi Kaldir
color 0E

echo =======================================================================
echo     B.R. LEVENT PLASTIK - YONETIM SISTEMI
echo     Windows Baslangicindan Otomatik Calismayi Kaldirma
echo =======================================================================
echo.

set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT_NAME=B.R. Levent Plastik - Otomatik Baslat.lnk

if exist "%STARTUP_DIR%\%SHORTCUT_NAME%" (
    del /f /q "%STARTUP_DIR%\%SHORTCUT_NAME%"
    echo [BASARILI] Otomatik baslatma kisayolu Windows Baslangic klasorunden silindi.
    echo Bilgisayar basladiginda sistem artik otomatik calismayacaktir.
) else (
    echo [BILGI] Baslangic klasorunde aktif bir otomatik baslatma kisayolu bulunamadi.
)

echo.
pause
