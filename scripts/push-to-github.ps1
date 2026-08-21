# scripts/push-to-github.ps1
# Kullanım: Yönetici olmayan normal PowerShell'de çalıştırabilirsiniz.
# Bu betik GitHub CLI (gh) kullanarak interaktif olarak oturum açmanızı sağlar ve
# repoyu origin'e push eder. PAT kesinlikle komut satırına yapıştırılmamalıdır.

param(
    [string]$RepoUrl = 'https://github.com/eaggyea/YS.git',
    [string]$Branch = 'main'
)

function Ensure-CommandExists {
    param($cmd, $installHint)
    $null -ne (Get-Command $cmd -ErrorAction SilentlyContinue) -and return $true
    Write-Host "$cmd bulunamadı. $installHint"
    return $false
}

if (-not (Ensure-CommandExists -cmd 'git' -installHint 'Git kurulumu için https://git-scm.com/downloads adresini ziyaret edin.')) { exit 1 }
if (-not (Ensure-CommandExists -cmd 'gh' -installHint 'GitHub CLI kurulumu için https://cli.github.com/ adresini ziyaret edin.')) {
    Write-Host "Devam etmek için gh (GitHub CLI) kurulmalı. Kurduktan sonra bu betiği yeniden çalıştırın."; exit 1
}

$repoPath = (Get-Location).Path
Write-Host "Çalışılan dizin: $repoPath"

# gh ile oturum kontrolü
$ghStatus = gh auth status 2>&1
if ($ghStatus -match 'Logged in as') {
    Write-Host "gh ile giriş yapılmış: $ghStatus" -ForegroundColor Green
} else {
    Write-Host "GitHub CLI ile giriş yapmanız gerekiyor. Tarayıcı tabanlı oturum açma başlatılıyor..."
    gh auth login --web
    if ($LASTEXITCODE -ne 0) { Write-Error "gh auth login başarısız. Lütfen manuel olarak gh auth login çalıştırıp tekrar deneyin."; exit 1 }
}

# Git repo hazır mı?
if (-not (Test-Path (Join-Path $repoPath '.git'))) {
    Write-Host ".git bulunamadı — git init ile yeni repo oluşturuluyor."
    git init
}

# Commit işlemi
Write-Host "Tüm dosyalar ekleniyor ve commit ediliyor."
git add .
# Eğer commit yoksa commit yap
$hasCommits = (git rev-parse --is-inside-work-tree 2>$null) -ne $null -and (git rev-parse --verify HEAD 2>$null) -eq $null -or $false
# Simpler: try commit and ignore if no changes
try {
    git commit -m "Add deployment instructions and NSSM install script" -q
} catch {
    Write-Host "Commit oluşturulamadı (muhtemelen değişiklik yok). Devam ediliyor."
}

# Branch ve remote ayarları
git branch -M $Branch
$remoteExists = (git remote get-url origin 2>$null) -ne $null
if (-not $remoteExists) {
    Write-Host "Remote origin ekleniyor: $RepoUrl"
    git remote add origin $RepoUrl
} else {
    Write-Host "Remote origin mevcut: $(git remote get-url origin)"
}

# Push
Write-Host "Origin'e push ediliyor (branch: $Branch). Eğer ilk push ise gh auth ile yetkilendirme gerekli olabilir."
git push -u origin $Branch
if ($LASTEXITCODE -eq 0) { Write-Host "Push başarılı." -ForegroundColor Green } else { Write-Error "Push başarısız. Hata mesajını kontrol edin ve gh auth login ile tekrar deneyin." }

Write-Host "Önemli: Daha önce paylaştığınız PAT varsa hemen GitHub hesabınızdan iptal edin (revoke)." -ForegroundColor Yellow
