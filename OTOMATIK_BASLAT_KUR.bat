@echo off
chcp 65001 >nul
title Windows Baslangicina Otomatik Baslatma Ekle
color 0B

echo =======================================================================
echo     B.R. LEVENT PLASTIK - YONETIM SISTEMI
echo     Windows Baslangicinda Otomatik Calisma Kurulumu
echo =======================================================================
echo.

set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT_NAME=B.R. Levent Plastik - Otomatik Baslat.lnk

echo [1/2] Windows Baslangic (Startup) klasorune sessiz baslatici kisayolu ekleniyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%STARTUP_DIR%\%SHORTCUT_NAME%'); $Shortcut.TargetPath = 'wscript.exe'; $Shortcut.Arguments = '\"%~dp0start-hidden.vbs\"'; $Shortcut.WorkingDirectory = '%~dp0'; $Shortcut.Description = 'B.R. Levent Plastik Yonetim Sistemi Otomatik Baslatici'; $Shortcut.Save()"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo =======================================================================
    echo [BASARILI] Otomatik baslatma basariyla kuruldu!
    echo.
    echo Artik bilgisayariniz her acildiginda veya yeniden basladiginda:
    echo - Sistem arka planda sessizce (konsol penceresi olmadan) calisacaktir.
    echo - Tarayicinizdan http://localhost:3000 adresine direkt erisebilirsiniz.
    echo.
    echo Otomatik baslatmayi kaldirmak icin OTOMATIK_BASLAT_KALDIR.bat calistirabilirsiniz.
    echo =======================================================================
) else (
    echo.
    echo [HATA] Kisayol olusturulamadi. Lutfen Yonetici olarak calistirmayi deneyin.
)

echo.
pause
