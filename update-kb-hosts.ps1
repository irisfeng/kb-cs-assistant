#Requires -RunAsAdministrator
# 自动更新 kb-server.local 的 IP 映射（只修改 kb-server.local，保留其他所有内容）

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  更新 kb-server.local IP 映射" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 获取当前 IP
$ipconfigOutput = ipconfig | findstr "IPv4"
if (-not $ipconfigOutput) {
    Write-Host "错误：无法获取 IP 地址" -ForegroundColor Red
    Read-Host "按 Enter 退出"
    exit 1
}
$currentIP = ($ipconfigOutput -split ":")[1].Trim()
Write-Host "当前内网 IP: $currentIP" -ForegroundColor Yellow
Write-Host ""

# hosts 文件路径
$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$backupPath = "$env:SystemRoot\System32\drivers\etc\hosts.backup.$(Get-Date -Format 'yyyyMMddHHmmss')"

# 备份
Copy-Item $hostsPath $backupPath -Force -ErrorAction SilentlyContinue
Write-Host "已备份 hosts 文件到: $backupPath" -ForegroundColor Gray
Write-Host ""

# 读取 hosts 内容
$content = Get-Content $hostsPath
$newContent = @()
$found = $false
$action = ""

foreach ($line in $content) {
    # 匹配 kb-server.local 的行（包括注释掉的）
    if ($line -match "kb-server\.local") {
        if ($line -match "^\s*#") {
            # 被注释掉的行：替换为新 IP（取消注释）
            $oldLine = $line
            $newContent += "$currentIP  kb-server.local"
            $found = $true
            $action = "替换（取消注释）"
            Write-Host "发现被注释的条目:" -ForegroundColor Yellow
            Write-Host "  $oldLine" -ForegroundColor Gray
            Write-Host "  -> $currentIP  kb-server.local" -ForegroundColor Green
        } elseif ($line -match "^\d+\.\d+\.\d+\.\d+\s+kb-server\.local") {
            # 已存在的有效条目：更新 IP
            $oldIP = $line -replace "^(\d+\.\d+\.\d+\.\d+).*", '$1'
            $newContent += "$currentIP  kb-server.local"
            $found = $true
            $action = "更新 IP"
            if ($oldIP -eq $currentIP) {
                Write-Host "IP 已是最新: $currentIP" -ForegroundColor Green
            } else {
                Write-Host "更新 IP: $oldIP -> $currentIP" -ForegroundColor Green
            }
        } else {
            # 其他包含 kb-server.local 的行，直接保留
            $newContent += $line
        }
    } else {
        # 其他行（包括 Docker 的）全部保留
        $newContent += $line
    }
}

# 如果没找到 kb-server.local，添加到文件末尾
if (-not $found) {
    $newContent += ""
    $newContent += "# kb-server 项目"
    $newContent += "$currentIP  kb-server.local"
    $action = "新增"
    Write-Host "新增条目: $currentIP  kb-server.local" -ForegroundColor Green
}

Write-Host ""

# 写入文件
$newContent | Set-Content $hostsPath -Force

# 刷新 DNS
ipconfig /flushdns | Out-Null
Write-Host "DNS 缓存已刷新" -ForegroundColor Green

# 验证
Write-Host ""
Write-Host "验证结果:" -ForegroundColor Cyan
$verify = Get-Content $hostsPath | findstr "kb-server.local" | findstr /V "^#"
if ($verify) {
    Write-Host $verify -ForegroundColor Green
} else {
    Write-Host "验证失败！请手动检查 hosts 文件" -ForegroundColor Red
}

# 测试 ping
Write-Host ""
Write-Host "网络测试:" -ForegroundColor Cyan
try {
    $pingResult = ping -n 1 kb-server.local | findstr "来自"
    if ($pingResult) {
        Write-Host $pingResult -ForegroundColor Green
    } else {
        Write-Host "Ping 测试失败" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Ping 测试出错" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
if ($action) {
    Write-Host "  完成! ($action)" -ForegroundColor Green
} else {
    Write-Host "  完成!" -ForegroundColor Green
}
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Read-Host "按任意键关闭"
