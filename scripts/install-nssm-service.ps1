# scripts/install-nssm-service.ps1
# Örnek: NSSM kullanarak GKYSSolo Node uygulamasını Windows servisi olarak kurar.
# Yönetici PowerShell ile çalıştırın.

param(
    [string]$InstallDir = "C:\gkys-solo",
    [string]$NodePath = "C:\Program Files\nodejs\node.exe",
    [string]$ServiceName = "GKYSSolo",
    [string]$ServerScript = "server\\server.js",
    [string]$DataDir = "D:\\Data\\GKYS",
    [string]$NssmDir = "C:\nssm\win64"
)

Write-Host "Service kurulumuna başlıyor: $ServiceName"

if (!(Test-Path $NssmDir)) {
    Write-Host "NSSM dizini bulunamadı: $NssmDir"
    Write-Host "Lütfen NSSM'i https://nssm.cc/download adresinden indirip $NssmDir altına çıkarın ve tekrar çalıştırın."
    exit 1
}

$nssm = Join-Path $NssmDir "nssm.exe"
if (!(Test-Path $nssm)) { Write-Error "nssm.exe bulunamadı: $nssm"; exit 1 }

# NSSM GUI ile kurulumu aç
& $nssm install $ServiceName

Write-Host "NSSM kurulum penceresi açıldı. Aşağıdaki değerleri girin:"
Write-Host "  Path: $NodePath"
Write-Host "  Startup directory: $InstallDir"
Write-Host "  Arguments: $ServerScript"
Write-Host "Environment sekmesinde ekleyin: DATA_DIR=$DataDir, PORT=80, NODE_ENV=production"
Write-Host "Kurulum tamamlandıktan sonra: Start-Service $ServiceName"

Write-Host "Not: Bu betik GUI üzerinden NSSM kurulumunu başlatır. Tam otomasyon isterseniz nssm set komutlarını kullanarak parametreleri script'e ekleyebiliriz."}