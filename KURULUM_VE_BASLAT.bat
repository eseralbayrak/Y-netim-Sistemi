@echo off
chcp 65001 >nul
title B.R. Levent Plastik - Yonetim Sistemi Kurulum ve Baslatici
color 0B

echo =======================================================================
echo     B.R. LEVENT PLASTIK - YONETIM SISTEMI
echo     Tek Tikla Windows Kurulum ve Baslatma Sihirbazi
echo =======================================================================
echo.

:: 1. Node.js Kontrolu
echo [1/5] Node.js calisma ortami kontrol ediliyor...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [HATA] Node.js bilgisayarinizda kurulu bulunamadi!
    echo Lutfen Node.js LTS surumunu https://nodejs.org adresinden indirip kurun.
    echo Kurulum bittikten sonra bu dosyaya tekrar cift tiklayin.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo       - Node.js Surumu: %NODE_VER% (Tamam)

:: 2. Bagimliliklarin Kurulmasi
echo.
echo [2/5] Sistem bagimliliklari kontrol ediliyor...
if not exist "node_modules\" (
    echo       - Ilk kurulum tespit edildi, paketler yukleniyor (Lutfen bekleyin)...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [HATA] npm install sirasinda bir sorun olustu.
        pause
        exit /b 1
    )
) else (
    echo       - node_modules mevcut (Tamam).
)

:: 3. Frontend Derlemesi (Build)
echo.
echo [3/5] Arayuz dosyalari hazirlaniyor...
if not exist "dist\" (
    echo       - Ilk derleme yapiliyor (npm run build)...
    call npm run build
    if %ERRORLEVEL% NEQ 0 (
        echo [UYARI] Derleme uyarisi alindi, sunucu modu ile devam ediliyor.
    )
) else (
    echo       - dist/ klasoru hazir (Tamam).
)

:: 4. Belge & Veri Klasorlerinin Olusturulmasi
echo.
echo [4/5] Veri ve Belge klasorleri hazirlaniyor...
if not exist "server\data\" mkdir "server\data"
if not exist "server\data\uploads\" mkdir "server\data\uploads"
if not exist "server\data\uploads\msds\" mkdir "server\data\uploads\msds"
if not exist "server\data\uploads\tds\" mkdir "server\data\uploads\tds"
if not exist "server\data\uploads\coa\" mkdir "server\data\uploads\coa"
if not exist "server\data\uploads\yardimciParca\" mkdir "server\data\uploads\yardimciParca"
if not exist "server\data\uploads\kaliteRaporlari\" mkdir "server\data\uploads\kaliteRaporlari"
if not exist "server\data\uploads\genel\" mkdir "server\data\uploads\genel"
echo       - Klasorler hazirlandi (Tamam).

:: 5. Masaustu Kisayolu Olusturma
echo.
echo [5/5] Masaustu kisayolu olusturuluyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\B.R. Levent Plastik - Yonetim Sistemi.lnk'); $Shortcut.TargetPath = '%~dp0BASLAT.bat'; $Shortcut.WorkingDirectory = '%~dp0'; $Shortcut.Description = 'B.R. Levent Plastik Yonetim Sistemi'; $Shortcut.Save()" >nul 2>&1
echo       - Masaustunuze 'B.R. Levent Plastik - Yonetim Sistemi' kisayolu olusturuldu.

echo.
echo =======================================================================
echo   KURULUM BASARIYLA TAMAMLANDI! SISTEM BASLATILIYOR...
echo   Erisim Adresi: http://localhost:3000
echo   Yonetici Girisi: admin / admin123
echo =======================================================================
echo.

:: 2 saniye sonra tarayiciyi ac
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"

:: Sunucuyu calistir
node server/server.js

pause
