@echo off
chcp 65001 >nul
title 更新 kb-server.local IP 映射

:: 请求管理员权限
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo 需要管理员权限，正在申请...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo ========================================
echo   更新 kb-server.local IP 映射
echo ========================================
echo.

:: 获取当前 IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4"') do (
    set currentIP=%%a
    goto :gotIP
)
:gotIP
set currentIP=%currentIP: =%
echo 当前内网 IP: %currentIP%
echo.

:: hosts 文件路径
set hostsPath=C:\Windows\System32\drivers\etc\hosts
set backupPath=C:\Windows\System32\drivers\etc\hosts.backup.%date:~0,4%%date:~5,2%%date:~8,2%%time:~0,2%%time:~3,2%%time:~6,2%

:: 备份
copy "%hostsPath%" "%backupPath%" >nul 2>&1
echo 已备份 hosts 文件
echo.

:: 创建临时文件
type nul > %temp%\hosts_new.txt

:: 读取并更新
set found=0
set oldIP=

for /f "delims=" %%a in ('type "%hostsPath%"') do (
    set line=%%a
    echo %%a | findstr /C:"kb-server.local" >nul
    if !errorlevel! equ 0 (
        echo %%a | findstr /B /C:"#" >nul
        if !errorlevel! equ 0 (
            :: 注释掉的行，替换
            set found=1
            echo %currentIP%  kb-server.local >> %temp%\hosts_new.txt
        ) else (
            :: 检查是否是 IP 开头的行
            echo %%a | findstr /R "^[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*.*kb-server" >nul
            if !errorlevel! equ 0 (
                set found=1
                for /f "tokens=1" %%b in ("%%a") do set oldIP=%%b
                echo %currentIP%  kb-server.local >> %temp%\hosts_new.txt
            ) else (
                echo %%a >> %temp%\hosts_new.txt
            )
        )
    ) else (
        echo %%a >> %temp%\hosts_new.txt
    )
)

:: 如果没有找到，添加到最后
if %found% equ 0 (
    echo. >> %temp%\hosts_new.txt
    echo # kb-server 项目 >> %temp%\hosts_new.txt
    echo %currentIP%  kb-server.local >> %temp%\hosts_new.txt
    echo 新增: %currentIP%  kb-server.local
) else (
    if defined oldIP (
        if "%oldIP%"=="%currentIP%" (
            echo IP 已是最新: %currentIP%
        ) else (
            echo 更新: %oldIP% -^> %currentIP%
        )
    ) else (
        echo 已更新为: %currentIP%
    )
)

:: 替换原文件
copy /Y %temp%\hosts_new.txt "%hostsPath%" >nul
del %temp%\hosts_new.txt

:: 刷新 DNS
ipconfig /flushdns >nul
echo.
echo DNS 缓存已刷新

:: 验证
echo.
echo 验证结果:
findstr /C:"kb-server.local" "%hostsPath%" | findstr /V /C:"#"

:: ping 测试
echo.
echo 网络测试:
ping -n 1 kb-server.local | findstr "来自"

echo.
echo ========================================
echo   完成!
echo ========================================
echo.
pause
