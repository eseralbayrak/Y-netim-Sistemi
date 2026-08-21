@echo off
REM GKYS Solo sunucusunu baslatir.
REM Once asagidaki DATA_DIR yolunu kendi "Data" paylasiminizin GERCEK yerel
REM yoluyla degistirin (agdaki \\ad\shares$\DATA degil, sunucunun kendi
REM diskindeki karsiligi, ornek: D:\Data\GKYS).
REM
REM PORT=80 secildi ki tarayicida port numarasi yazmaya gerek kalmasin
REM (ornek: http://hammadde yeter, http://hammadde:5173 degil).
REM Eger sunucuda IIS gibi baska bir program zaten 80 portunu kullaniyorsa,
REM asagida "80" yerine "8080" gibi bos bir port yazip, tarayicida
REM http://hammadde:8080 seklinde erismeniz gerekir.

set DATA_DIR=D:\Data\GKYS
set PORT=80

cd /d "%~dp0"
echo Baslatiliyor: DATA_DIR=%DATA_DIR%  PORT=%PORT%
node server.js
pause
