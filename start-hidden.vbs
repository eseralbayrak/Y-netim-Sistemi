' B.R. Levent Plastik - Yonetim Sistemi Arka Plan Baslatici (Sessiz Mod)
Set WshShell = CreateObject("WScript.Shell")
strCurrentDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\") - 1)
WshShell.CurrentDirectory = strCurrentDir
' 0 = Gizli pencere (konsol acilmaz)
WshShell.Run "node server\server.js", 0, False
