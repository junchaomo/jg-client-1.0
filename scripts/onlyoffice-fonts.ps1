# 九规智能中枢 · OnlyOffice 中文字体安装/校验脚本
# 用法：
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\onlyoffice-fonts.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\onlyoffice-fonts.ps1 -Rebuild
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\onlyoffice-fonts.ps1 -VerifyOnly
# 说明：
#   - 默认只在 AllFonts.js 缺少公文字体时安装，避免每次启动都重建字体缓存。
#   - 字体文件来自 deploy\onlyoffice\fonts\aliases，开源 Fandol 的家族名别名；不是微软/方正的授权原字体。
#   - 安装后调用 documentserver-generate-allfonts.sh，重建 AllFonts.js 和缩略图，并重启文档服务。

param(
  [string]$ContainerName = 'jg-onlyoffice',
  [string]$FontDir = '',
  [switch]$Rebuild,
  [switch]$VerifyOnly,
  [int]$GenerateTimeoutSeconds = 300
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
if (-not $FontDir) {
  $FontDir = Join-Path $Root 'deploy\onlyoffice\fonts\aliases'
}
$RequiredFamilies = @(
  '仿宋_GB2312',
  '楷体_GB2312',
  '黑体',
  '宋体',
  '方正小标宋简体',
  '微软雅黑',
  '等线',
  '仿宋',
  '楷体',
  '新宋体'
)
$AllFontsPath = '/var/www/onlyoffice/documentserver/sdkjs/common/AllFonts.js'

function Write-Info([string]$Message) { Write-Host "[jg-fonts] $Message" }
function Fail([string]$Message) { throw "[jg-fonts] $Message" }

function Test-ContainerRunning {
  & docker inspect --format '{{.State.Running}}' $ContainerName *> $null
  if ($LASTEXITCODE -ne 0) { return $false }
  return ((& docker inspect --format '{{.State.Running}}' $ContainerName 2>$null) -eq 'true')
}

function Test-FontManifest {
  foreach ($name in $RequiredFamilies) {
    & docker exec $ContainerName grep -Fq $name $AllFontsPath *> $null
    if ($LASTEXITCODE -ne 0) {
      Write-Info "缺少字体：$name"
      return $false
    }
  }
  return $true
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Fail '未找到 docker 命令。' }
if (-not (Test-ContainerRunning)) { Fail "容器 $ContainerName 未运行。" }

if ($VerifyOnly) {
  if (Test-FontManifest) {
    Write-Info '公文字体清单校验通过。'
    exit 0
  }
  Fail '公文字体清单不完整。'
}

if (-not $Rebuild -and (Test-FontManifest)) {
  Write-Info '公文字体已存在，跳过安装。需要强制重建请加 -Rebuild。'
  exit 0
}

if (-not (Test-Path -LiteralPath $FontDir)) { Fail "字体目录不存在：$FontDir" }
$fonts = Get-ChildItem -LiteralPath $FontDir -File -Filter '*.otf'
if ($fonts.Count -lt 10) { Fail "字体目录中的 OTF 数量异常：$($fonts.Count)" }
Write-Info "准备安装 $($fonts.Count) 个字体别名到 $ContainerName ..."

$tempTar = Join-Path $env:TEMP ("jg-onlyoffice-fonts-{0}.tar" -f (Get-Date -Format 'yyyyMMddHHmmss'))
try {
  & tar -cf $tempTar -C $FontDir .
  if ($LASTEXITCODE -ne 0) { Fail '打包字体文件失败。' }
  & docker cp $tempTar "${ContainerName}:/tmp/jg-onlyoffice-fonts.tar" *> $null
  if ($LASTEXITCODE -ne 0) { Fail '复制字体包到容器失败。' }
  $extract = @'
mkdir -p /usr/share/fonts/truetype/custom /var/www/onlyoffice/Data
tar -xf /tmp/jg-onlyoffice-fonts.tar -C /usr/share/fonts/truetype/custom
rm -f /tmp/jg-onlyoffice-fonts.tar
if [ -d /var/www/onlyoffice/Data/custom-fonts ] && [ ! -L /var/www/onlyoffice/Data/custom-fonts ]; then
  cp -f /usr/share/fonts/truetype/custom/*.otf /var/www/onlyoffice/Data/custom-fonts/ 2>/dev/null || true
else
  ln -sfn /usr/share/fonts/truetype/custom /var/www/onlyoffice/Data/custom-fonts
fi
chmod 644 /usr/share/fonts/truetype/custom/*.otf
echo FONT_COPIED
'@
  $copyOutput = & docker exec $ContainerName sh -lc $extract 2>&1
  if ($LASTEXITCODE -ne 0 -or ($copyOutput -join "`n") -notmatch 'FONT_COPIED') {
    Fail "字体复制失败：$($copyOutput -join ' ')"
  }
  Write-Info '字体文件已写入容器，开始重建 AllFonts.js ...'
  $generate = & docker exec $ContainerName sh -lc 'documentserver-generate-allfonts.sh' 2>&1
  if ($LASTEXITCODE -ne 0) { Fail "字体缓存重建失败：$($generate -join ' ')" }
  Write-Info 'AllFonts.js 重建完成。'
} finally {
  if (Test-Path -LiteralPath $tempTar) { Remove-Item -LiteralPath $tempTar -Force -ErrorAction SilentlyContinue }
}

$deadline = (Get-Date).AddSeconds([Math]::Max(20, $GenerateTimeoutSeconds))
$healthy = $false
while ((Get-Date) -lt $deadline) {
  try {
    $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8082/healthcheck' -TimeoutSec 3 -UseBasicParsing
    if ($r.StatusCode -eq 200) { $healthy = $true; break }
  } catch { }
  Start-Sleep -Seconds 2
}
if (-not $healthy) { Fail '字体安装后 OnlyOffice 健康检查未通过。' }
if (-not (Test-FontManifest)) { Fail '字体安装后 AllFonts.js 仍缺少公文字体。' }
Write-Info '公文字体安装并校验通过。'
