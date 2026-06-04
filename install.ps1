#Requires -Version 5
# LocoAgent one-click installer — Windows (PowerShell)
#   irm https://raw.githubusercontent.com/LocoreMind/locoagent/main/install.ps1 | iex
# Env overrides: $env:LOCO_DIR (target dir), $env:LOCO_BRANCH (default main).
$ErrorActionPreference = 'Stop'

$RepoSlug   = 'LocoreMind/locoagent'
$Branch     = if ($env:LOCO_BRANCH) { $env:LOCO_BRANCH } else { 'main' }

function Info($m){ Write-Host "==> $m" -ForegroundColor Cyan }
function Ok($m){   Write-Host "OK  $m" -ForegroundColor Green }
function Warn($m){ Write-Host "!!  $m" -ForegroundColor Yellow }
function Die($m){  Write-Host "XX  $m" -ForegroundColor Red; exit 1 }
function Have($c){ [bool](Get-Command $c -ErrorAction SilentlyContinue) }
function Refresh-BunPath { $b = Join-Path $HOME '.bun\bin'; if (Test-Path $b) { $env:PATH = "$b;$env:PATH" } }
function Dir-IsEmpty($p){ if (-not (Test-Path -LiteralPath $p)) { return $true }; -not (Get-ChildItem -LiteralPath $p -Force -ErrorAction SilentlyContinue | Select-Object -First 1) }
function Is-LocoRepo($p){ (Test-Path -LiteralPath (Join-Path $p 'install.ps1')) -and (Test-Path -LiteralPath (Join-Path $p 'src')) }

# Install target: honor $env:LOCO_DIR; otherwise install into the *current
# directory* (where the user ran the command). An empty dir is used directly;
# a dir that already holds the LocoAgent checkout updates in place; any other
# non-empty dir gets a ./locoagent subfolder so we never clobber existing files.
$cwd = (Get-Location).Path
$AutoDir = -not [bool]$env:LOCO_DIR
$InPlace = $false
if ($env:LOCO_DIR) {
  $InstallDir = $env:LOCO_DIR
} elseif (Is-LocoRepo $cwd) {
  $InstallDir = $cwd; $InPlace = $true
} elseif (Dir-IsEmpty $cwd) {
  $InstallDir = $cwd
} else {
  $InstallDir = Join-Path $cwd 'locoagent'
}

$Interactive = -not [Console]::IsInputRedirected
# Let the user confirm/redirect where files land (this is the #1 source of
# "where did my install go?" confusion). Enter accepts the shown default.
if ($Interactive -and $AutoDir -and -not $InPlace) {
  try { $a = Read-Host "Install location [$InstallDir]" } catch { $a = '' }
  if (-not [string]::IsNullOrWhiteSpace($a)) { $InstallDir = $a }
}
$InstallDir = [System.IO.Path]::GetFullPath($InstallDir)
Info "LocoAgent installer  ->  $InstallDir (branch $Branch)"

# 1. Bun
if (Have bun) { Ok "Bun present ($(bun --version))" }
else {
  Info "Installing Bun..."
  try { Invoke-RestMethod https://bun.sh/install.ps1 | Invoke-Expression } catch { Die "Bun install failed: $_" }
  Refresh-BunPath
  if (-not (Have bun)) { Die "Bun installed but not on PATH; open a new terminal and re-run." }
  Ok "Bun installed ($(bun --version))"
}
Refresh-BunPath

# 2. agent-browser
if (Have agent-browser) { Ok "agent-browser present" }
else {
  Info "Installing agent-browser..."
  if (Have npm) { try { npm install -g agent-browser 2>$null } catch {} }
  else { try { bun add -g agent-browser 2>$null } catch {} }
  Refresh-BunPath
  if (Have agent-browser) { Ok "agent-browser installed" }
  else { Warn "agent-browser not on PATH - install manually later: npm i -g agent-browser" }
}

# 3. Detect Chrome & Git (detect-only)
$chromePaths = @(
  (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
  (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
)
$chromeFound = $false
foreach ($p in $chromePaths) { if ($p -and (Test-Path $p)) { $chromeFound = $true; break } }
if ($chromeFound) { Ok "Chrome detected" }
else { Warn "Google Chrome not detected. Install: winget install Google.Chrome  (or https://www.google.com/chrome/)" }
$GitOk = Have git
if ($GitOk) { Ok "Git present" } else { Warn "Git not found - will download a source zip (no auto-updates)." }

# 4. Clone / update
function Fetch-Zip {
  Info "Downloading source zip..."
  $url = "https://codeload.github.com/$RepoSlug/zip/refs/heads/$Branch"
  $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("loco-" + [System.IO.Path]::GetRandomFileName())
  New-Item -ItemType Directory -Path $tmp | Out-Null
  $zip = Join-Path $tmp 'loco.zip'
  try { Invoke-RestMethod $url -OutFile $zip } catch { Die "zip download failed: $_" }
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $top = Get-ChildItem -Path $tmp -Directory | Where-Object { $_.Name -like 'locoagent-*' } | Select-Object -First 1
  if (-not $top) { Die "unexpected zip layout" }
  if (-not (Test-Path $InstallDir)) { New-Item -ItemType Directory -Path $InstallDir | Out-Null }
  Copy-Item -Path (Join-Path $top.FullName '*') -Destination $InstallDir -Recurse -Force
  Remove-Item -Recurse -Force $tmp
}
if ((Test-Path (Join-Path $InstallDir '.git')) -and $GitOk) {
  Info "Updating existing checkout..."
  try { git -C $InstallDir pull --ff-only } catch { Warn "git pull failed; continuing" }
}
elseif ((Test-Path $InstallDir) -and (Get-ChildItem $InstallDir -Force -ErrorAction SilentlyContinue)) {
  Warn "$InstallDir exists and is not a git checkout - using as-is."
}
elseif ($GitOk) {
  Info "Cloning $RepoSlug ..."
  try { git clone --branch $Branch --depth 1 "https://github.com/$RepoSlug.git" $InstallDir } catch { Die "git clone failed: $_" }
}
else { Fetch-Zip }
Ok "Source ready at $InstallDir"

# 5. Dependencies
Info "Installing dependencies (bun install)..."
Push-Location $InstallDir
try { bun install } catch { Pop-Location; Die "bun install failed: $_" }
Pop-Location
Ok "Dependencies installed"

# 6. .env scaffold + configure
$EnvFile = Join-Path $InstallDir '.env'
$Example = Join-Path $InstallDir '.env.example'
if (-not (Test-Path $EnvFile)) {
  if (Test-Path $Example) { Copy-Item $Example $EnvFile; Ok "Created .env from .env.example" }
  else { Warn ".env.example missing; creating empty .env"; New-Item -ItemType File -Path $EnvFile | Out-Null }
}
function Get-EnvVal($key){
  $rx = "^$([regex]::Escape($key))="
  $line = Select-String -Path $EnvFile -Pattern $rx -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($line) { return ($line.Line -replace $rx, '') } else { return '' }
}
function Set-EnvVal($key,$val){
  $rx = "^$([regex]::Escape($key))="
  $content = @(Get-Content $EnvFile -ErrorAction SilentlyContinue)
  if ($content -match $rx) { $new = $content | ForEach-Object { if ($_ -match $rx) { "$key=$val" } else { $_ } } }
  else { $new = $content + "$key=$val" }
  Set-Content -Path $EnvFile -Value $new -Encoding UTF8
}
# Blank out a legacy var IF it already exists in .env (never append it). Keeps the
# neutral LLM_* front door the single source of truth when migrating an old .env.
function Clear-EnvVal($key){
  $rx = "^$([regex]::Escape($key))="
  $content = @(Get-Content $EnvFile -ErrorAction SilentlyContinue)
  if ($content -match $rx) {
    $new = $content | ForEach-Object { if ($_ -match $rx) { "$key=" } else { $_ } }
    Set-Content -Path $EnvFile -Value $new -Encoding UTF8
  }
}
function Clear-LegacyProviderVars {
  foreach ($k in @('CLAUDE_CODE_USE_OPENAI','OPENAI_API_KEY','OPENAI_BASE_URL','OPENAI_MODEL','ANTHROPIC_API_KEY','ANTHROPIC_MODEL')) { Clear-EnvVal $k }
}
function Read-Default($prompt,$def){
  $label = if ($def) { "$prompt [$def]" } else { $prompt }
  try { $a = Read-Host $label } catch { $a = '' }
  if ([string]::IsNullOrWhiteSpace($a)) { return $def } else { return $a }
}
function Read-Secret($prompt){
  try {
    $s = Read-Host $prompt -AsSecureString
    $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
    $p = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)
    return $p
  } catch { return '' }
}
# Choose-Model: print a numbered menu (first entry = default), read a choice from
# the terminal. Enter keeps the default; 'c' types a custom name; a bare number
# picks; anything else is taken literally as a model id. Menu goes to the host so
# only the chosen id is returned.
function Choose-Model($desc, $opts, $def){
  Write-Host "Select $desc model (Enter = default):" -ForegroundColor Cyan
  for ($i = 0; $i -lt $opts.Count; $i++) {
    $mark = if ($i -eq 0) { '  [default]' } else { '' }
    Write-Host ("  {0}) {1,-28} {2}{3}" -f ($i + 1), $opts[$i].Val, $opts[$i].Label, $mark)
  }
  Write-Host "  c) custom - type any model name"
  try { $ans = Read-Host 'Choice [1]' } catch { $ans = '' }
  if ([string]::IsNullOrWhiteSpace($ans)) { return $def }
  if ('c','C','custom' -contains $ans) {
    try { $c = Read-Host 'Custom model name' } catch { $c = '' }
    if ([string]::IsNullOrWhiteSpace($c)) { return $def } else { return $c.Trim() }
  }
  $num = 0
  if ([int]::TryParse($ans, [ref]$num)) {
    if ($num -ge 1 -and $num -le $opts.Count) { return $opts[$num - 1].Val }
    return $def   # out-of-range number → default (treat as a typo, not a model id)
  }
  return $ans.Trim()   # non-numeric free-form → literal model id
}
# Prompt for the provider key and write it to the neutral LLM_API_KEY. The label
# is provider-correct (e.g. "DeepSeek API key") so the user never sees OPENAI_*.
function Ask-LlmKey($label){
  $existing = Get-EnvVal 'LLM_API_KEY'
  $v = Read-Secret "$label (Enter to keep existing)"
  if ($v) { Set-EnvVal 'LLM_API_KEY' $v }
  elseif (-not $existing) { Warn "No API key entered - add LLM_API_KEY to .env before running." }
}
if ($Interactive) {
  Info "Configure your LLM provider."
  # One neutral front door: pick provider -> enter that provider's key -> pick model.
  # We write LLM_PROVIDER/LLM_API_KEY/LLM_MODEL (+LLM_BASE_URL for custom) and clear
  # any legacy OPENAI_*/ANTHROPIC_* so the .env has a single, unambiguous source.
  $prov = Read-Default 'Provider - 1) DeepSeek  2) Anthropic  3) OpenAI  4) Custom (OpenAI-compatible)' '1'
  Clear-LegacyProviderVars
  Set-EnvVal 'LLM_BASE_URL' ''
  switch ($prov) {
    '2' {
      Set-EnvVal 'LLM_PROVIDER' 'anthropic'
      Ask-LlmKey 'Anthropic API key'
      $opts = @(
        @{ Val = 'claude-sonnet-4-6';           Label = 'balanced (recommended)' },
        @{ Val = 'claude-opus-4-8';             Label = 'most capable' },
        @{ Val = 'claude-haiku-4-5-20251001';   Label = 'fast' }
      )
      Set-EnvVal 'LLM_MODEL' (Choose-Model 'Anthropic' $opts 'claude-sonnet-4-6')
    }
    '3' {
      Set-EnvVal 'LLM_PROVIDER' 'openai'
      Ask-LlmKey 'OpenAI API key'
      $opts = @(
        @{ Val = 'gpt-5.5';  Label = 'latest' },
        @{ Val = 'gpt-4o';   Label = 'multimodal' },
        @{ Val = 'gpt-4.1';  Label = 'general' }
      )
      Set-EnvVal 'LLM_MODEL' (Choose-Model 'OpenAI' $opts 'gpt-5.5')
    }
    '4' {
      Set-EnvVal 'LLM_PROVIDER' 'custom'
      Set-EnvVal 'LLM_BASE_URL' (Read-Default 'Base URL (OpenAI-compatible endpoint)' 'http://localhost:1234/v1')
      Ask-LlmKey 'API key (Enter if your endpoint needs none)'
      Set-EnvVal 'LLM_MODEL' (Read-Default 'Model id' '')
    }
    default {
      Set-EnvVal 'LLM_PROVIDER' 'deepseek'
      Ask-LlmKey 'DeepSeek API key'
      $opts = @(
        @{ Val = 'deepseek-chat';     Label = 'V3 general' },
        @{ Val = 'deepseek-reasoner'; Label = 'R1 reasoning' }
      )
      Set-EnvVal 'LLM_MODEL' (Choose-Model 'DeepSeek' $opts 'deepseek-chat')
    }
  }
  Ok ".env configured"
} else {
  Warn "Non-interactive install - edit $EnvFile and set LLM_PROVIDER + LLM_API_KEY before running."
}

# 6b. git-bash auto-detect (Windows runtime needs CLAUDE_CODE_GIT_BASH_PATH)
if (-not (Get-EnvVal 'CLAUDE_CODE_GIT_BASH_PATH')) {
  $cand = @()
  $g = Get-Command git -ErrorAction SilentlyContinue
  if ($g) { $root = Split-Path (Split-Path $g.Source -Parent) -Parent; $cand += (Join-Path $root 'bin\bash.exe') }
  $cand += @(
    (Join-Path $env:ProgramFiles 'Git\bin\bash.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Git\bin\bash.exe')
  )
  foreach ($b in $cand) { if ($b -and (Test-Path $b)) { Set-EnvVal 'CLAUDE_CODE_GIT_BASH_PATH' $b; Ok "git-bash: $b"; break } }
}

# 7. Health check
Info "Running health check (bun run doctor)..."
Push-Location $InstallDir
try { bun run doctor } catch { Warn "doctor reported issues - usually just a missing API key or Chrome." }
Pop-Location

# 7b. Offer to launch the isolated CDP Chrome now, so the user can log into their
# accounts once before starting. This is the step that creates the persistent,
# isolated profile; skipping it is why automation can fall back to a throwaway
# browser. Interactive only.
if ($Interactive) {
  $launch = Read-Default 'Launch the isolated CDP Chrome now to log into your accounts? (Y/n)' 'Y'
  if ($launch -notmatch '^[Nn]') {
    Push-Location $InstallDir
    try { bun run setup-chrome } catch { Warn "setup-chrome reported issues; run it later with: bun run setup-chrome" }
    Pop-Location
  }
}

# 8. Next steps
Write-Host ""
Ok "LocoAgent installed at $InstallDir"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  cd `"$InstallDir`""
if (-not (Get-EnvVal 'LLM_API_KEY') -and -not (Get-EnvVal 'OPENAI_API_KEY') -and -not (Get-EnvVal 'ANTHROPIC_API_KEY')) {
  Write-Host "  # add LLM_API_KEY to .env first"
}
Write-Host "  bun run setup-chrome     # launch an isolated Chrome with CDP on :9222 (won't touch your normal Chrome)"
Write-Host "  bun start                # interactive REPL"
