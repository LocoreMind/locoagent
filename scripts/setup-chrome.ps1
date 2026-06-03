# setup-chrome.ps1  (Windows equivalent of setup-chrome.sh)
# Pre-launch Chrome with CDP remote debugging, copying the real Chrome profile
# so agent-browser can operate social accounts with existing login sessions.
#
# Usage:
#   bun run setup-chrome:win
#   pwsh -File scripts/setup-chrome.ps1
#
# Config (read from .env, overridable by real env vars):
#   CHROME_SOURCE_PROFILE  - real Chrome profile dir   (default: %LOCALAPPDATA%\Google\Chrome\User Data\Default)
#   CHROME_WORK_PROFILE    - temp dir to copy into      (default: %TEMP%\locoagent-chrome-profile)
#   CHROME_DEBUG_PORT      - CDP remote debugging port  (default: 9222)
#   CHROME_BIN             - path to chrome.exe         (default: C:\Program Files\Google\Chrome\Application\chrome.exe)

$ErrorActionPreference = 'Stop'

# -- Load .env if present (does not overwrite already-set env vars) --
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'
if (Test-Path $envFile) {
  foreach ($line in Get-Content $envFile) {
    $t = $line.Trim()
    if (-not $t -or $t.StartsWith('#')) { continue }
    $i = $t.IndexOf('=')
    if ($i -lt 1) { continue }
    $k = $t.Substring(0, $i).Trim()
    $v = $t.Substring($i + 1).Trim()
    if ($k -and -not [Environment]::GetEnvironmentVariable($k, 'Process')) {
      [Environment]::SetEnvironmentVariable($k, $v, 'Process')
    }
  }
}

# -- Defaults --
$src  = if ($env:CHROME_SOURCE_PROFILE) { $env:CHROME_SOURCE_PROFILE } else { Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data\Default' }
$work = if ($env:CHROME_WORK_PROFILE)   { $env:CHROME_WORK_PROFILE }   else { Join-Path $env:TEMP 'locoagent-chrome-profile' }
$port = if ($env:CHROME_DEBUG_PORT)     { $env:CHROME_DEBUG_PORT }     else { '9222' }
$bin  = if ($env:CHROME_BIN)            { $env:CHROME_BIN }            else { 'C:\Program Files\Google\Chrome\Application\chrome.exe' }
$localStateSrc = Join-Path (Split-Path -Parent $src) 'Local State'

if (-not (Test-Path $bin)) {
  Write-Error "Chrome binary not found: $bin  (set CHROME_BIN in .env)"; exit 1
}

# -- Step 1: Kill existing Chrome --
Write-Host "-> Killing any existing Chrome processes..."
Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# -- Step 2: Copy Chrome profile --
if (-not (Test-Path $src)) {
  Write-Error "Chrome source profile not found: $src  (set CHROME_SOURCE_PROFILE in .env)"; exit 1
}
Write-Host "-> Copying Chrome profile to $work ..."
Write-Host "   (source: $src)"
if (Test-Path $work) { Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Force $work | Out-Null
# robocopy is resilient to locked cache files; exit codes 0-7 are success.
$null = robocopy $src (Join-Path $work 'Default') /E /NFL /NDL /NJH /NJS /NP /R:1 /W:1
if ($LASTEXITCODE -ge 8) { Write-Warning "robocopy reported issues (exit $LASTEXITCODE) - profile may be partially copied" }
$global:LASTEXITCODE = 0

if (Test-Path $localStateSrc) {
  Copy-Item $localStateSrc (Join-Path $work 'Local State') -Force
  Write-Host "   Local State copied"
} else {
  Write-Warning "Local State not found at: $localStateSrc (may cause profile read errors)"
}

# -- Step 3: Launch Chrome with CDP --
Write-Host "-> Launching Chrome on port $port ..."
$proc = Start-Process -FilePath $bin -PassThru -ArgumentList @(
  "--remote-debugging-port=$port",
  "--user-data-dir=$work",
  "--no-first-run",
  "--disable-default-apps"
)
Write-Host "   Chrome PID: $($proc.Id)"

# -- Step 4: Wait for CDP port --
Write-Host "-> Waiting for CDP port $port to be ready..."
$ready = $false
for ($i = 1; $i -le 15; $i++) {
  try {
    $null = Invoke-WebRequest -Uri "http://127.0.0.1:$port/json/version" -UseBasicParsing -TimeoutSec 2
    Write-Host "   Chrome CDP ready (${i}s)"; $ready = $true; break
  } catch { Start-Sleep -Seconds 1 }
}
if (-not $ready) { Write-Error "Chrome CDP port $port did not become ready after 15s"; exit 1 }

# -- Step 5: Connect agent-browser --
Write-Host "-> Connecting agent-browser to CDP port $port ..."
agent-browser connect $port

Write-Host ""
Write-Host "Chrome setup complete. agent-browser is ready."
Write-Host "  Profile: $work"
Write-Host "  CDP:     http://127.0.0.1:$port"
Write-Host ""
Write-Host "  Run: bun run start"
