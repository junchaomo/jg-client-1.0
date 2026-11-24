# 九规智能中枢 · OnlyOffice 文档服务部署/启动脚本
# 用法：
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\onlyoffice-deploy.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\onlyoffice-deploy.ps1 -StartOnly
# 说明：
#   - 已有容器 jg-onlyoffice 时只做启动，不重建、不动数据卷。
#   - 首次运行会生成 data\onlyoffice.json 和 64 位 JWT 密钥。
#   - Docker 不可用时只告警，不阻断中枢启动；中枢会自动回退 PDF 预览。

param(
  [switch]$StartOnly,
  [switch]$EnsureDockerDesktop,
  [switch]$SkipFonts,
  [int]$WaitSeconds = 60,
  [switch]$Strict
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$DataDir = Join-Path $Root 'data'
$ConfigPath = Join-Path $DataDir 'onlyoffice.json'
$ContainerName = 'jg-onlyoffice'
$Image = if ($env:JG_ONLYOFFICE_IMAGE) { $env:JG_ONLYOFFICE_IMAGE } else { 'docker.m.daocloud.io/onlyoffice/documentserver:latest' }
$HostPort = if ($env:JG_ONLYOFFICE_PORT) { [int]$env:JG_ONLYOFFICE_PORT } else { 8082 }

function Write-Info([string]$Message) { Write-Host "[jg-office] $Message" }
function Write-Warn([string]$Message) { Write-Warning "[jg-office] $Message" }

function New-Secret {
  $bytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
}

function Read-Config {
  if (-not (Test-Path -LiteralPath $ConfigPath)) { return $null }
  try { return Get-Content -Raw -LiteralPath $ConfigPath | ConvertFrom-Json } catch { return $null }
}

function Save-Config($Config) {
  if (-not (Test-Path -LiteralPath $DataDir)) { New-Item -ItemType Directory -Path $DataDir -Force | Out-Null }
  $json = $Config | ConvertTo-Json -Depth 6
  [System.IO.File]::WriteAllText($ConfigPath, $json, (New-Object System.Text.UTF8Encoding($false)))
}

function Resolve-Secret($Config) {
  $envSecret = [string]$env:JG_ONLYOFFICE_SECRET
  if ($envSecret.Trim()) { return $envSecret.Trim() }
  if ($Config -and [string]$Config.secret) { return [string]$Config.secret }
  $secret = New-Secret
  $documentHost = if ($env:JG_ONLYOFFICE_DOCUMENT_HOST_URL) { [string]$env:JG_ONLYOFFICE_DOCUMENT_HOST_URL } else { 'http://host.docker.internal:54270' }
  if (-not $Config) {
    $Config = [pscustomobject]@{
      enabled = $true
      internalUrl = "http://127.0.0.1:$HostPort"
      publicUrl = "http://127.0.0.1:$HostPort"
      documentHostUrl = $documentHost
      secret = $secret
      header = 'AuthorizationJwt'
    }
  } else {
    $Config | Add-Member -NotePropertyName secret -NotePropertyValue $secret -Force
    if (-not $Config.header) { $Config | Add-Member -NotePropertyName header -NotePropertyValue 'AuthorizationJwt' -Force }
    if (-not $Config.internalUrl) { $Config | Add-Member -NotePropertyName internalUrl -NotePropertyValue "http://127.0.0.1:$HostPort" -Force }
    if (-not $Config.publicUrl) { $Config | Add-Member -NotePropertyName publicUrl -NotePropertyValue "http://127.0.0.1:$HostPort" -Force }
    if (-not $Config.documentHostUrl) { $Config | Add-Member -NotePropertyName documentHostUrl -NotePropertyValue 'http://host.docker.internal:54270' -Force }
  }
  Save-Config $Config
  return $secret
}

function Test-Docker {
  $cmd = Get-Command docker -ErrorAction SilentlyContinue
  if (-not $cmd) { return $false }
  & docker info *> $null
  return ($LASTEXITCODE -eq 0)
}

function Start-DockerDesktopIfNeeded {
  if (Test-Docker) { return $true }
  if (-not $EnsureDockerDesktop) { return $false }
  $candidates = @(
    (Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'),
    (Join-Path $env:LOCALAPPDATA 'Docker\Docker Desktop.exe')
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
  if (-not $candidates) { return $false }
  Write-Info 'Docker engine is unavailable; starting Docker Desktop...'
  try { Start-Process -FilePath $candidates[0] -WindowStyle Hidden | Out-Null } catch { return $false }
  for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Seconds 2
    if (Test-Docker) { Write-Info 'Docker engine is ready.'; return $true }
  }
  return $false
}

function Test-OnlyOfficeHealth {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$HostPort/healthcheck" -TimeoutSec 3 -UseBasicParsing
    return ($response.StatusCode -eq 200)
  } catch { return $false }
}

function Wait-OnlyOfficeHealth {
  $deadline = (Get-Date).AddSeconds([Math]::Max(5, $WaitSeconds))
  while ((Get-Date) -lt $deadline) {
    if (Test-OnlyOfficeHealth) { return $true }
    Start-Sleep -Seconds 2
  }
  return (Test-OnlyOfficeHealth)
}

function Test-ContainerSecret([string]$Secret) {
  try {
    $envLines = @(& docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' $ContainerName 2>$null)
    if ($LASTEXITCODE -ne 0) { return $null }
    $match = $envLines | Where-Object { $_ -like 'JWT_SECRET=*' } | Select-Object -First 1
    if (-not $match) { return $false }
    return ($match.Substring('JWT_SECRET='.Length) -eq $Secret)
  } catch { return $null }
}

try {
  $config = Read-Config
  $documentHost = if ($env:JG_ONLYOFFICE_DOCUMENT_HOST_URL) { [string]$env:JG_ONLYOFFICE_DOCUMENT_HOST_URL } else { 'http://host.docker.internal:54270' }
  if (-not $config) {
    Write-Info 'No OnlyOffice config found; creating data\onlyoffice.json.'
    $config = [pscustomobject]@{
      enabled = $true
      internalUrl = "http://127.0.0.1:$HostPort"
      publicUrl = "http://127.0.0.1:$HostPort"
      documentHostUrl = $documentHost
      secret = ''
      header = 'AuthorizationJwt'
    }
  }
  $secret = Resolve-Secret $config
  if (-not $secret) { throw 'OnlyOffice JWT secret is empty.' }

  if (-not (Start-DockerDesktopIfNeeded)) {
    $message = 'Docker engine is not available; OnlyOffice will stay offline and the platform will fall back to PDF preview.'
    if ($Strict) { throw $message }
    Write-Warn $message
    exit 0
  }

  $exists = $false
  & docker inspect $ContainerName *> $null
  if ($LASTEXITCODE -eq 0) { $exists = $true }

  if ($exists) {
    $secretMatches = Test-ContainerSecret $secret
    if ($secretMatches -eq $false) {
      throw "Container $ContainerName uses a different JWT secret. Remove it manually before redeploying, or align JG_ONLYOFFICE_SECRET with the container."
    }
    $running = (& docker inspect --format '{{.State.Running}}' $ContainerName 2>$null) -eq 'true'
    if (-not $running) {
      Write-Info "Starting existing container $ContainerName..."
      & docker start $ContainerName *> $null
      if ($LASTEXITCODE -ne 0) { throw "docker start $ContainerName failed." }
    } else {
      Write-Info "Container $ContainerName is already running."
    }
  } else {
    Write-Info "Creating container $ContainerName from $Image..."
    & docker run -d `
      --name $ContainerName `
      --restart unless-stopped `
      -p "${HostPort}:80" `
      -e JWT_ENABLED=true `
      -e "JWT_SECRET=$secret" `
      -e JWT_HEADER=AuthorizationJwt `
      --shm-size=2g `
      --add-host host.docker.internal:host-gateway `
      -v jg-onlyoffice-data:/var/www/onlyoffice/Data `
      -v jg-onlyoffice-log:/var/log/onlyoffice `
      -v jg-onlyoffice-lib:/var/lib/onlyoffice `
      -v jg-onlyoffice-fonts:/usr/share/fonts/truetype/custom `
      -v jg-onlyoffice-fonts:/var/www/onlyoffice/Data/custom-fonts `
      $Image *> $null
    if ($LASTEXITCODE -ne 0) { throw "docker run $ContainerName failed." }
  }

  if (Wait-OnlyOfficeHealth) {
    Write-Info "OnlyOffice is healthy at http://127.0.0.1:$HostPort"
    if (-not $SkipFonts) {
      $fontScript = Join-Path $PSScriptRoot 'onlyoffice-fonts.ps1'
      if (Test-Path -LiteralPath $fontScript) {
        try {
          $shell = if (Get-Command pwsh.exe -ErrorAction SilentlyContinue) { 'pwsh.exe' } else { 'powershell.exe' }
          Write-Info 'Ensuring Chinese document fonts...'
          & $shell -NoProfile -ExecutionPolicy Bypass -File $fontScript -ContainerName $ContainerName *> $null
          if ($LASTEXITCODE -eq 0) {
            Write-Info 'Chinese document font manifest is ready.'
          } else {
            Write-Warn 'Chinese font installation failed; Office documents may fall back to WenQuanYi Zen Hei.'
          }
        } catch {
          Write-Warn "Chinese font installation skipped: $($_.Exception.Message)"
        }
      }
    }
    exit 0
  }

  $timeoutMessage = "OnlyOffice started but health check did not pass within $WaitSeconds seconds."
  if ($Strict) { throw $timeoutMessage }
  Write-Warn "$timeoutMessage The container will keep starting in the background."
  exit 0
} catch {
  $message = $_.Exception.Message
  if ($Strict) { Write-Error "[jg-office] $message"; exit 1 }
  Write-Warn "$message Platform will continue and fall back to PDF preview."
  exit 0
}
