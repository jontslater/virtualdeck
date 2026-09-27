# Stage Raven Runtime for VirtualDeck Installer
# This script prepares the Raven voice AI sidecar for bundling with VirtualDeck
# 
# REQUIREMENTS:
# - AITuber repository cloned locally (https://github.com/jontslater/AITuber)
#   Default location: E:\AIChatBot
#   Or set $env:AITUBER_ROOT to point to your clone
#
# WHAT THIS DOES:
# 1. Copies Raven sidecar runtime (sidecar.js + dependencies) to extra/raven/
# 2. Bundles Node.js portable runtime to extra/raven/node/
# 3. Bundles ffmpeg binaries to extra/raven/ffmpeg/
# 4. Creates env.defaults template (NEVER with actual API keys)
# 5. Validates no secrets are being staged
#
# SECURITY: This script NEVER copies .env or raven.env files with API keys.
# Users must provide their own keys after installation (BYOK).

param(
    [string]$AITuberRoot = $env:AITUBER_ROOT,
    [switch]$Clean = $false
)

$ErrorActionPreference = "Stop"

# Determine AITuber source location
if (-not $AITuberRoot) {
    $AITuberRoot = "E:\AIChatBot"
}

if (-not (Test-Path $AITuberRoot)) {
    Write-Host "ERROR: AITuber repository not found at: $AITuberRoot" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please either:" -ForegroundColor Yellow
    Write-Host "  1. Clone AITuber to E:\AIChatBot:"
    Write-Host "     git clone https://github.com/jontslater/AITuber E:\AIChatBot"
    Write-Host "  2. Set AITUBER_ROOT environment variable to your clone location:"
    Write-Host "     `$env:AITUBER_ROOT = 'C:\path\to\AITuber'"
    Write-Host "     npm run stage-raven"
    exit 1
}

Write-Host "Staging Raven from: $AITuberRoot" -ForegroundColor Cyan

# Setup staging directory
$StageDir = Join-Path $PSScriptRoot "..\extra\raven"
if ($Clean -and (Test-Path $StageDir)) {
    Write-Host "Cleaning existing stage: $StageDir" -ForegroundColor Yellow
    Remove-Item -Path $StageDir -Recurse -Force
}

New-Item -ItemType Directory -Path $StageDir -Force | Out-Null

# 1. Copy Raven sidecar application
Write-Host "Copying Raven sidecar..." -ForegroundColor Cyan

# Detect AITuber layout - sidecar.js can be at root or scripts/raven-sidecar.js
$SidecarSource = $null
$SidecarRootPath = Join-Path $AITuberRoot "sidecar.js"
$SidecarScriptsPath = Join-Path $AITuberRoot "scripts\raven-sidecar.js"

if (Test-Path $SidecarRootPath) {
    Write-Host "  Detected root-level sidecar.js layout"
    $SidecarSource = "root"
} elseif (Test-Path $SidecarScriptsPath) {
    Write-Host "  Detected scripts/raven-sidecar.js layout"
    $SidecarSource = "scripts"
} else {
    Write-Host "  ERROR: Cannot find sidecar.js at:" -ForegroundColor Red
    Write-Host "    - $SidecarRootPath" -ForegroundColor Red
    Write-Host "    - $SidecarScriptsPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Please ensure AITuber repository is properly set up." -ForegroundColor Yellow
    exit 1
}

# Copy sidecar based on detected layout
if ($SidecarSource -eq "root") {
    # Root layout: sidecar.js, app/, scripts/, package.json at root
    $SidecarFiles = @(
        "sidecar.js",
        "app",
        "scripts",
        "package.json",
        "package-lock.json"
    )
    
    foreach ($Item in $SidecarFiles) {
        $SourcePath = Join-Path $AITuberRoot $Item
        $DestPath = Join-Path $StageDir $Item
        
        if (Test-Path $SourcePath) {
            if (Test-Path $SourcePath -PathType Container) {
                Write-Host "  Copying directory: $Item"
                Copy-Item -Path $SourcePath -Destination $DestPath -Recurse -Force
            } else {
                Write-Host "  Copying file: $Item"
                Copy-Item -Path $SourcePath -Destination $DestPath -Force
            }
        } else {
            Write-Host "  WARNING: Not found: $Item (skipping)" -ForegroundColor Yellow
        }
    }
} else {
    # Scripts layout: scripts/raven-sidecar.js and related files in scripts/
    # Copy raven-sidecar.js as sidecar.js for compatibility
    $SourceSidecar = Join-Path $AITuberRoot "scripts\raven-sidecar.js"
    $DestSidecar = Join-Path $StageDir "sidecar.js"
    Write-Host "  Copying scripts/raven-sidecar.js -> sidecar.js"
    Copy-Item -Path $SourceSidecar -Destination $DestSidecar -Force
    
    # Copy app/ directory (check multiple possible locations)
    $AppDirs = @(
        "app",
        "scripts\app",
        "src\app",
        "raven\app"
    )
    
    $AppFound = $false
    foreach ($AppDir in $AppDirs) {
        $SourceApp = Join-Path $AITuberRoot $AppDir
        if (Test-Path $SourceApp) {
            $DestApp = Join-Path $StageDir "app"
            Write-Host "  Copying $AppDir -> app/"
            Copy-Item -Path $SourceApp -Destination $DestApp -Recurse -Force
            $AppFound = $true
            break
        }
    }
    
    if (-not $AppFound) {
        Write-Host "  WARNING: app/ directory not found in any expected location" -ForegroundColor Yellow
        Write-Host "    Checked: $($AppDirs -join ', ')" -ForegroundColor Yellow
    }
    
    # Copy scripts/ directory (contains supporting files)
    $SourceScripts = Join-Path $AITuberRoot "scripts"
    $DestScripts = Join-Path $StageDir "scripts"
    if (Test-Path $SourceScripts) {
        Write-Host "  Copying scripts/"
        Copy-Item -Path $SourceScripts -Destination $DestScripts -Recurse -Force
    }
    
    # Copy package.json and package-lock.json
    $PackageFiles = @("package.json", "package-lock.json")
    foreach ($PkgFile in $PackageFiles) {
        $SourcePkg = Join-Path $AITuberRoot $PkgFile
        $DestPkg = Join-Path $StageDir $PkgFile
        if (Test-Path $SourcePkg) {
            Write-Host "  Copying $PkgFile"
            Copy-Item -Path $SourcePkg -Destination $DestPkg -Force
        }
    }
}

# 2. Bundle Node.js portable runtime
Write-Host "Bundling Node.js runtime..." -ForegroundColor Cyan

$NodeDir = Join-Path $StageDir "node"
New-Item -ItemType Directory -Path $NodeDir -Force | Out-Null

# Check for pre-downloaded portable Node.js
$PortableNode = Join-Path $AITuberRoot "runtime\node\node.exe"
if (Test-Path $PortableNode) {
    Write-Host "  Found portable node.exe in AITuber runtime/"
    Copy-Item -Path (Join-Path $AITuberRoot "runtime\node\*") -Destination $NodeDir -Recurse -Force
} else {
    # Fallback: use system Node.js
    $SystemNode = (Get-Command node -ErrorAction SilentlyContinue).Path
    if ($SystemNode) {
        Write-Host "  Using system Node.js: $SystemNode"
        Copy-Item -Path $SystemNode -Destination (Join-Path $NodeDir "node.exe") -Force
        
        # Also copy node.lib if available (needed for some native modules)
        $NodeLib = Join-Path (Split-Path $SystemNode) "node.lib"
        if (Test-Path $NodeLib) {
            Copy-Item -Path $NodeLib -Destination (Join-Path $NodeDir "node.lib") -Force
        }
    } else {
        Write-Host "  ERROR: Node.js not found. Please install Node.js or place portable node.exe in $AITuberRoot\runtime\node\" -ForegroundColor Red
        exit 1
    }
}

# 3. Bundle ffmpeg binaries
Write-Host "Bundling ffmpeg..." -ForegroundColor Cyan

$FfmpegDir = Join-Path $StageDir "ffmpeg"
New-Item -ItemType Directory -Path $FfmpegDir -Force | Out-Null

# Check for pre-downloaded ffmpeg
$PortableFfmpeg = Join-Path $AITuberRoot "runtime\ffmpeg\ffmpeg.exe"
if (Test-Path $PortableFfmpeg) {
    Write-Host "  Found ffmpeg in AITuber runtime/"
    Copy-Item -Path (Join-Path $AITuberRoot "runtime\ffmpeg\*") -Destination $FfmpegDir -Recurse -Force
} else {
    # Check system PATH for ffmpeg
    $SystemFfmpeg = (Get-Command ffmpeg -ErrorAction SilentlyContinue).Path
    $SystemFfplay = (Get-Command ffplay -ErrorAction SilentlyContinue).Path
    
    if ($SystemFfmpeg) {
        Write-Host "  Using system ffmpeg: $SystemFfmpeg"
        Copy-Item -Path $SystemFfmpeg -Destination (Join-Path $FfmpegDir "ffmpeg.exe") -Force
        
        if ($SystemFfplay) {
            Copy-Item -Path $SystemFfplay -Destination (Join-Path $FfmpegDir "ffplay.exe") -Force
        }
    } else {
        Write-Host "  WARNING: ffmpeg not found. TTS audio playback may not work." -ForegroundColor Yellow
        Write-Host "  Download ffmpeg from: https://github.com/BtbN/FFmpeg-Builds/releases" -ForegroundColor Yellow
        Write-Host "  Place ffmpeg.exe and ffplay.exe in: $AITuberRoot\runtime\ffmpeg\" -ForegroundColor Yellow
    }
}

# 4. Create env.defaults template
Write-Host "Creating env.defaults template..." -ForegroundColor Cyan

$EnvDefaultsPath = Join-Path $StageDir "env.defaults"
$EnvTemplate = @"
# Raven Voice AI Configuration Template
# Users MUST fill in their own API keys after installation
# SECURITY: NEVER commit this file with actual API keys

# Voice-only mode (no VTube Studio / Live2D)
RAVEN_VOICE_ONLY=1
VTUBE_STUDIO_ENABLED=false
COPILOT_AVATAR=0

# LLM Provider (openai, anthropic, etc.)
LLM_PROVIDER=openai
LLM_API_KEY=
LLM_MODEL=gpt-4

# TTS Provider (elevenlabs, azure, etc.)
TTS_PROVIDER=elevenlabs
TTS_API_KEY=
TTS_VOICE_ID=

# VirtualDeck JARVIS Integration
# This connects Raven to VirtualDeck's tool server (already running on port 8091)
JARVIS_BASE_URL=http://127.0.0.1:8091
VIRTUALDECK_JARVIS_URL=http://127.0.0.1:8091

# WebSocket bridge for VirtualDeck (do not change unless ports conflict)
VIRTUALDECK_WS_PORT=8081
VIRTUALDECK_WS_URL=ws://localhost:8081

# Overlay HTTP server (do not change unless ports conflict)
VIRTUALDECK_HTTP_URL=http://localhost:8080

# Director mode
DIRECTOR_INITIAL_MODE=COPILOT
"@

Set-Content -Path $EnvDefaultsPath -Value $EnvTemplate -Encoding UTF8

# 5. Security validation
Write-Host "Running security checks..." -ForegroundColor Cyan

$DangerousFiles = @(
    ".env",
    "raven.env",
    "twitch-oauth-config.js"
)

$FoundDangerous = $false
foreach ($File in $DangerousFiles) {
    $FilePath = Join-Path $StageDir $File
    if (Test-Path $FilePath) {
        Write-Host "  ERROR: Found dangerous file: $File" -ForegroundColor Red
        Write-Host "         This file may contain API keys and should NOT be staged." -ForegroundColor Red
        $FoundDangerous = $true
    }
}

# Check env.defaults for populated API keys (non-empty values)
# Match API_KEY=<non-whitespace> but allow API_KEY= or API_KEY=<whitespace-only>
$EnvDefaultsContent = Get-Content $EnvDefaultsPath -Raw
if ($EnvDefaultsContent -match '(LLM_API_KEY|TTS_API_KEY|OPENAI_API_KEY|ELEVENLABS_API_KEY)\s*=\s*[^\s\r\n]+') {
    Write-Host "  ERROR: env.defaults contains API keys!" -ForegroundColor Red
    Write-Host "         API keys must be empty placeholders only." -ForegroundColor Red
    $FoundDangerous = $true
}

if ($FoundDangerous) {
    Write-Host ""
    Write-Host "STAGING ABORTED: Security validation failed" -ForegroundColor Red
    Write-Host "Remove sensitive files before staging." -ForegroundColor Red
    exit 1
}

Write-Host "  Security checks passed" -ForegroundColor Green

# 6. Install Node.js dependencies in staged directory
Write-Host "Installing Node.js dependencies..." -ForegroundColor Cyan

Push-Location $StageDir
try {
    $NodeExe = Join-Path $NodeDir "node.exe"
    if (Test-Path $NodeExe) {
        # Use bundled node to install deps
        & $NodeExe (Get-Command npm).Path install --production --no-optional
    } else {
        # Use system npm
        npm install --production --no-optional
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  WARNING: npm install had issues (exit code $LASTEXITCODE)" -ForegroundColor Yellow
        Write-Host "  The build may still work if core dependencies are present." -ForegroundColor Yellow
    } else {
        Write-Host "  Dependencies installed successfully" -ForegroundColor Green
    }
} finally {
    Pop-Location
}

# Summary
Write-Host ""
Write-Host "Raven staging complete!" -ForegroundColor Green
Write-Host "Staged to: $StageDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Run: npm run build:win:with-raven"
Write-Host "  2. Installer will be in dist/"
Write-Host "  3. After installation, users must fill API keys in raven.env"
Write-Host ""
Write-Host "IMPORTANT: Users must provide their own API keys (BYOK model)" -ForegroundColor Yellow
Write-Host "           Never distribute installers with pre-filled API keys" -ForegroundColor Yellow
