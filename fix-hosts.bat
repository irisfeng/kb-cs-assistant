@echo off
chcp 65001 >nul
echo ========================================
echo  更新 kb-server.local IP
echo ========================================
echo.

:: Check admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo 正在申请管理员权限...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit
)

:: Get IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4"') do (
    set IP=%%a
    goto next
)
:next
set IP=%IP: =%
echo 当前 IP: %IP%
echo.

:: Backup
copy C:\Windows\System32\drivers\etc\hosts C:\Windows\System32\drivers\etc\hosts.bak >nul
echo 已备份 hosts.bak
echo.

:: PowerShell to update
powershell -Command "$ip='%IP%'; $h='C:\Windows\System32\drivers\etc\hosts'; $c=Get-Content $h; $f=0; $o=@(); foreach($l in $c){ if($l-match'kb-server.local'){ if($l-match'^#'){ $o+="$ip  kb-server.local"; $f=1; }elseif($l-match'^\d+\.\d+\.\d+\.\d+'){ $o+="$ip  kb-server.local"; $f=1; }else{ $o+=$l; } }else{ $o+=$l; } }; if(!$f){ $o+=''; $o+='# kb-server'; $o+="$ip  kb-server.local"; }; $o|Set-Content $h;"

echo 已更新 kb-server.local 为 %IP%
ipconfig /flushdns >nul
echo DNS 已刷新
echo.

:: Verify
echo 验证:
findstr /C:"kb-server.local" C:\Windows\System32\drivers\etc\hosts | findstr /V "^#"
echo.

pause
