# GKYS Solo sunucusunu baslatir.
# Once asagidaki $DataDir yolunu kendi "Data" paylasiminizin GERCEK yerel
# yoluyla degistirin (agdaki \\ad\shares$\DATA degil, sunucunun kendi
# diskindeki karsiligi, ornek: D:\Data\GKYS).
#
# Port=80 secildi ki tarayicida port numarasi yazmaya gerek kalmasin
# (ornek: http://hammadde yeter, http://hammadde:5173 degil).
# Sunucuda IIS gibi baska bir program zaten 80 portunu kullaniyorsa,
# $Port degerini "8080" gibi bos bir port ile degistirin.

$DataDir = "D:\Data\GKYS"
$Port = "80"

$env:DATA_DIR = $DataDir
$env:PORT = $Port

Set-Location -Path $PSScriptRoot
Write-Host "Baslatiliyor: DATA_DIR=$DataDir  PORT=$Port"
node server.js
