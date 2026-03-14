#Requires -RunAsAdministrator

param(
  [Parameter(Mandatory = $false)]
  [string]$IP,

  [Parameter(Mandatory = $false)]
  [string]$InterfaceAlias
)

$ErrorActionPreference = "Stop"
$hostName = "kb-server.local"
$hostsPath = Join-Path $env:SystemRoot "System32\drivers\etc\hosts"
$backupPath = "$hostsPath.backup.$(Get-Date -Format 'yyyyMMddHHmmss')"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Update kb-server.local in hosts file" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

function Test-ValidIPv4 {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Address
  )

  $parsed = $null
  if (-not [System.Net.IPAddress]::TryParse($Address, [ref]$parsed)) {
    return $false
  }

  return $parsed.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork
}

function Test-UsableIPv4 {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Address
  )

  if ($Address -like "127.*") { return $false }
  if ($Address -like "169.254.*") { return $false }
  if ($Address -like "0.*") { return $false }
  if ($Address -like "198.18.*" -or $Address -like "198.19.*") { return $false }
  return $true
}

function Test-VirtualInterfaceAlias {
  param(
    [Parameter(Mandatory = $false)]
    [string]$AliasName
  )

  if (-not $AliasName) {
    return $false
  }

  $lower = $AliasName.ToLowerInvariant()
  return $lower -match "meta|loopback|vethernet|virtual|vmware|hyper-v|npcap|wintun|zerotier|tailscale|isatap|teredo|6to4"
}

function Get-UsableIPv4FromCandidates {
  param(
    [Parameter(Mandatory = $true)]
    [Object[]]$Candidates
  )

  $usable = $Candidates |
    Where-Object {
      (Test-ValidIPv4 $_.IPAddress) -and
      (Test-UsableIPv4 $_.IPAddress) -and
      $_.PrefixOrigin -ne "WellKnown"
    } |
    Sort-Object -Property @{ Expression = "SkipAsSource"; Descending = $false }, @{ Expression = "InterfaceMetric"; Descending = $false }

  if ($usable -and $usable.Count -gt 0) {
    return $usable[0].IPAddress
  }

  return ""
}

function Get-BestLocalIPv4 {
  if ($InterfaceAlias) {
    $interfaceCandidates = @(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias $InterfaceAlias -ErrorAction SilentlyContinue)
    $interfaceIP = Get-UsableIPv4FromCandidates -Candidates $interfaceCandidates
    if ($interfaceIP) {
      return $interfaceIP
    }
    throw "No usable IPv4 found on interface '$InterfaceAlias'."
  }

  $routes = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq "Alive" } |
    Sort-Object -Property RouteMetric, InterfaceMetric

  foreach ($route in $routes) {
    if (Test-VirtualInterfaceAlias $route.InterfaceAlias) {
      continue
    }

    $routeCandidates = @(Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $route.ifIndex -ErrorAction SilentlyContinue)
    $routeIP = Get-UsableIPv4FromCandidates -Candidates $routeCandidates
    if ($routeIP) {
      return $routeIP
    }
  }

  $allCandidates = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { -not (Test-VirtualInterfaceAlias $_.InterfaceAlias) }
  )
  $allIP = Get-UsableIPv4FromCandidates -Candidates $allCandidates

  if ($allIP) {
    return $allIP
  }

  throw "No usable IPv4 address was found. Use -IP to specify one manually."
}

$currentIP = ""
if ($IP) {
  if (-not (Test-ValidIPv4 $IP)) {
    throw "Invalid IPv4 address: $IP"
  }
  if (-not (Test-UsableIPv4 $IP)) {
    throw "IPv4 address is not usable for hosts mapping: $IP"
  }
  $currentIP = $IP
  Write-Host "Using manual IPv4: $currentIP" -ForegroundColor Yellow
} else {
  $currentIP = Get-BestLocalIPv4
  Write-Host "Detected local IPv4: $currentIP" -ForegroundColor Yellow
}
Write-Host ""

Copy-Item -Path $hostsPath -Destination $backupPath -Force
Write-Host "Backup created: $backupPath" -ForegroundColor Gray
Write-Host ""

$content = Get-Content -Path $hostsPath -ErrorAction Stop
$newContent = New-Object System.Collections.Generic.List[string]
$updated = $false

foreach ($line in $content) {
  if ($line -match "^\s*#") {
    if ($line -match [regex]::Escape($hostName)) {
      continue
    }
    $newContent.Add($line)
    continue
  }

  if ($line -match "^\s*\d{1,3}(?:\.\d{1,3}){3}\s+$([regex]::Escape($hostName))(\s|$)") {
    if (-not $updated) {
      $newContent.Add("$currentIP`t$hostName")
      $updated = $true
    }
    continue
  }

  if ($line -match [regex]::Escape($hostName)) {
    if (-not $updated) {
      $newContent.Add("$currentIP`t$hostName")
      $updated = $true
    }
    continue
  }

  $newContent.Add($line)
}

if (-not $updated) {
  if ($newContent.Count -gt 0 -and $newContent[$newContent.Count - 1] -ne "") {
    $newContent.Add("")
  }
  $newContent.Add("# kb-server mapping")
  $newContent.Add("$currentIP`t$hostName")
}

# Use .NET file writer to avoid Set-Content stream issues on some systems.
$ascii = [System.Text.Encoding]::ASCII
[System.IO.File]::WriteAllLines($hostsPath, [string[]]$newContent, $ascii)
ipconfig /flushdns | Out-Null

Write-Host "Hosts updated and DNS cache flushed." -ForegroundColor Green
Write-Host ""
Write-Host "Current mapping lines:" -ForegroundColor Cyan
Get-Content -Path $hostsPath | Select-String -Pattern $hostName | ForEach-Object {
  Write-Host $_.Line
}

Write-Host ""
Write-Host "Ping test:" -ForegroundColor Cyan
try {
  ping -n 1 $hostName
} catch {
  Write-Host "Ping failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
