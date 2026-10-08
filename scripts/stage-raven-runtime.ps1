# Stage Raven Runtime for VirtualDeck Installer
# Prepares the Raven voice AI sidecar from the AITuber repo for bundling with VirtualDeck.
#
# REQUIREMENTS (Windows build PC):
# - AITuber clone (https://github.com/jontslater/AITuber) — default E:\AIChatBot or $env:AITUBER_ROOT
# - pnpm (monorepo layout: apps/controller, packages/*, scripts/raven-sidecar.js)
# - Node.js on PATH (or AITuber\runtime\node\node.exe for portable bundle)
# - ffmpeg + ffplay real binaries (not Chocolatey shims), or $env:FFMPEG_DIR
#
# SECURITY: Never copies .env / raven.env with keys. env.defaults is blank placeholders only.

param(
    [string]$AITuberRoot = $env:AITUBER_ROOT,
    [switch]$Clean = $false
)

$ErrorActionPreference = "Stop"

$Script:SecretKeyNames = 'LLM_API_KEY|TTS_API_KEY|OPENAI_API_KEY|ELEVENLABS_API_KEY'
$Script:PlaceholderValues = @(
    '', 'changeme', 'change-me', 'your-api-key', 'your-key-here', 'your_key_here',
    'placeholder', 'todo', 'tbd', 'none', 'null', 'sk-your', 'sk-your-key-here'
)

function Write-Step([string]$Message) {
    Write-Host $Message -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
    Write-Host "  $Message" -ForegroundColor Green
}

function Write-Warn([string]$Message) {
    Write-Host "  $Message" -ForegroundColor Yellow
}

function Write-Fail([string]$Message) {
    Write-Host $Message -ForegroundColor Red
}

function Test-EnvTextHasPopulatedSecrets([string]$Text) {
    if (-not $Text) { return $false }
    $pattern = "(?m)^\s*($($Script:SecretKeyNames))\s*[ \t]*=\s*[ \t]*(?:`"([^`"\r\n]*)`"|'([^'\r\n]*)'|([^\s#;\r\n][^\r\n]*))?"
    foreach ($match in [regex]::Matches($Text, $pattern)) {
        $val = ''
        if ($match.Groups[2].Success -and $match.Groups[2].Value) { $val = $match.Groups[2].Value }
        elseif ($match.Groups[3].Success -and $match.Groups[3].Value) { $val = $match.Groups[3].Value }
        elseif ($match.Groups[4].Success -and $match.Groups[4].Value) { $val = $match.Groups[4].Value }
        $val = $val.Trim()
        if (-not $val) { continue }
        $lower = $val.ToLower()
        if ($Script:PlaceholderValues -contains $lower) { continue }
        if ($lower -match '^(your|my|insert|add|enter|put)[-_ ]') { continue }
        return $true
    }
    return $false
}

function Copy-TreeAsRealFiles {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination,
        [string[]]$ExcludeDirNames = @('node_modules', '.git', '.turbo', '.cache')
    )
    if (-not (Test-Path -LiteralPath $Source)) {
        throw "Copy source not found: $Source"
    }
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    if (Get-Command robocopy -ErrorAction SilentlyContinue) {
        $xd = @()
        foreach ($name in $ExcludeDirNames) { $xd += '/XD'; $xd += $name }
        $null = robocopy $Source $Destination /E /COPY:DAT /DCOPY:DAT /SL /XJ /R:2 /W:2 /NFL /NDL /NJH /NJS @xd
        if ($LASTEXITCODE -ge 8) {
            throw "robocopy failed ($LASTEXITCODE) copying $Source -> $Destination"
        }
        return
    }
    Get-ChildItem -LiteralPath $Source -Force | ForEach-Object {
        $destItem = Join-Path $Destination $_.Name
        if ($_.PSIsContainer) {
            if ($ExcludeDirNames -contains $_.Name) { return }
            Copy-TreeAsRealFiles -Source $_.FullName -Destination $destItem -ExcludeDirNames $ExcludeDirNames
        } else {
            Copy-Item -LiteralPath $_.FullName -Destination $destItem -Force
        }
    }
}

function Resolve-RealFilePath([string]$Path) {
    if (-not $Path -or -not (Test-Path -LiteralPath $Path)) { return $null }
    try {
        return (Get-Item -LiteralPath $Path -Force).FullName
    } catch {
        return $Path
    }
}

function Resolve-ChocolateyFfmpegBin([string]$ExeName) {
    $roots = @()
    if ($env:ChocolateyInstall) { $roots += $env:ChocolateyInstall }
    $roots += 'C:\ProgramData\chocolatey'
    foreach ($root in $roots) {
        $candidate = Join-Path $root "lib\ffmpeg\tools\ffmpeg\bin\$ExeName"
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    return $null
}

function Resolve-FfmpegBinary([string]$ExeName) {
    $checked = @()

    if ($env:FFMPEG_DIR) {
        $fromEnv = Join-Path $env:FFMPEG_DIR $ExeName
        $checked += $fromEnv
        if (Test-Path -LiteralPath $fromEnv) { return (Resolve-RealFilePath $fromEnv) }
    }

    $portable = Join-Path $AITuberRoot "runtime\ffmpeg\$ExeName"
    $checked += $portable
    if (Test-Path -LiteralPath $portable) { return (Resolve-RealFilePath $portable) }

    $cmd = Get-Command $ExeName.Replace('.exe', '') -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Path) {
        $resolved = Resolve-RealFilePath $cmd.Path
        $checked += $resolved
        if ($resolved) {
            $len = (Get-Item -LiteralPath $resolved -Force).Length
            if ($len -lt 1MB) {
                $real = Resolve-ChocolateyFfmpegBin $ExeName
                if ($real) {
                    Write-Warn "Resolved Chocolatey shim for $ExeName -> $real"
                    return (Resolve-RealFilePath $real)
                }
                Write-Warn "$ExeName on PATH looks like a shim ($len bytes): $resolved"
            } else {
                return $resolved
            }
        }
    }

    $choco = Resolve-ChocolateyFfmpegBin $ExeName
    if ($choco) { return (Resolve-RealFilePath $choco) }

    Write-Fail "ERROR: Could not resolve $ExeName. Checked: $($checked -join ', ')"
    return $null
}

function Assert-ControllerDistPresent([string]$AppDir) {
    $markers = @(
        (Join-Path $AppDir 'dist\index.js'),
        (Join-Path $AppDir 'dist\main.js'),
        (Join-Path $AppDir 'dist\server.js'),
        (Join-Path $AppDir 'index.js')
    )
    foreach ($m in $markers) {
        if (Test-Path -LiteralPath $m) { return $m }
    }
    $anyDistJs = Get-ChildItem -Path (Join-Path $AppDir 'dist') -Filter '*.js' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($anyDistJs) { return $anyDistJs.FullName }
    return $null
}

function Get-ControllerFilter([string]$Root) {
    if ($env:RAVEN_CONTROLLER_FILTER) { return $env:RAVEN_CONTROLLER_FILTER }
    $controllerDir = Join-Path $Root 'apps\controller'
    if (Test-Path -LiteralPath $controllerDir) { return './apps/controller' }
    return $null
}

function Invoke-Pnpm {
    param([string[]]$Args, [string]$WorkingDirectory)
    Push-Location $WorkingDirectory
    try {
        Write-Host "  pnpm $($Args -join ' ')" -ForegroundColor DarkGray
        & pnpm @Args
        if ($LASTEXITCODE -ne 0) {
            throw "pnpm $($Args -join ' ') failed with exit code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
}

function Stage-MonorepoLayout {
    param(
        [string]$Root,
        [string]$StageDir
    )

    $controllerFilter = Get-ControllerFilter $Root
    if (-not $controllerFilter) {
        throw 'Monorepo layout detected but apps/controller is missing (set RAVEN_CONTROLLER_FILTER if needed).'
    }

    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        throw 'pnpm is required to build AITuber apps/controller. Install pnpm and re-run stage-raven.'
    }

    $sidecarSrc = Join-Path $Root 'scripts\raven-sidecar.js'
    if (-not (Test-Path -LiteralPath $sidecarSrc)) {
        throw "Missing scripts/raven-sidecar.js under $Root"
    }

    Write-Step 'Building AITuber controller (pnpm monorepo)...'
    Invoke-Pnpm -Args @('install') -WorkingDirectory $Root
    Invoke-Pnpm -Args @('--filter', $controllerFilter, 'run', 'build') -WorkingDirectory $Root

    $packagesDir = Join-Path $Root 'packages'
    if (Test-Path -LiteralPath $packagesDir) {
        Write-Step 'Building workspace packages (when build script exists)...'
        Get-ChildItem -LiteralPath $packagesDir -Directory | ForEach-Object {
            $pkgJsonPath = Join-Path $_.FullName 'package.json'
            if (-not (Test-Path -LiteralPath $pkgJsonPath)) { return }
            $pkg = Get-Content -LiteralPath $pkgJsonPath -Raw | ConvertFrom-Json
            if ($pkg.scripts -and $pkg.scripts.build) {
                $filter = "./packages/$($_.Name)"
                Write-Host "  building $filter"
                Invoke-Pnpm -Args @('--filter', $filter, 'run', 'build') -WorkingDirectory $Root
            }
        }
    }

    Write-Step 'Deploying controller production bundle (real files, no workspace symlinks)...'
    $deployRoot = Join-Path $StageDir '.deploy-tmp'
    if (Test-Path -LiteralPath $deployRoot) {
        Remove-Item -LiteralPath $deployRoot -Recurse -Force
    }
    New-Item -ItemType Directory -Path $deployRoot -Force | Out-Null
    Invoke-Pnpm -Args @('--filter', $controllerFilter, 'deploy', '--prod', $deployRoot) -WorkingDirectory $Root

    $appDir = Join-Path $StageDir 'app'
    if (Test-Path -LiteralPath $appDir) { Remove-Item -LiteralPath $appDir -Recurse -Force }
    Copy-TreeAsRealFiles -Source $deployRoot -Destination $appDir
    Remove-Item -LiteralPath $deployRoot -Recurse -Force -ErrorAction SilentlyContinue

    $distMarker = Assert-ControllerDistPresent $appDir
    if (-not $distMarker) {
        throw "Controller deploy succeeded but no dist/*.js found under $appDir"
    }
    Write-Ok "Controller dist: $distMarker"

    Write-Step 'Copying Raven sidecar entrypoint...'
    Copy-Item -LiteralPath $sidecarSrc -Destination (Join-Path $StageDir 'sidecar.js') -Force

    if (Test-Path -LiteralPath $packagesDir) {
        Write-Step 'Copying packages/* (sources + dist, excluding node_modules)...'
        $destPackages = Join-Path $StageDir 'packages'
        if (Test-Path -LiteralPath $destPackages) { Remove-Item -LiteralPath $destPackages -Recurse -Force }
        Copy-TreeAsRealFiles -Source $packagesDir -Destination $destPackages
    }

    $bridgeNames = @('virtualdeck-bridge', 'virtual-deck-bridge', 'vd-bridge', 'virtualdeck')
    foreach ($name in $bridgeNames) {
        $bridgePath = Join-Path $packagesDir $name
        if (Test-Path -LiteralPath $bridgePath) {
            Write-Ok "VirtualDeck bridge package present: packages/$name"
            break
        }
    }

    $sidecarPkg = Join-Path $Root 'package.json'
    if (Test-Path -LiteralPath $sidecarPkg) {
        Copy-Item -LiteralPath $sidecarPkg -Destination (Join-Path $StageDir 'package.json') -Force
    } else {
        @{
            name = 'raven-sidecar-staged'
            private = $true
            type = 'commonjs'
        } | ConvertTo-Json | Set-Content -Path (Join-Path $StageDir 'package.json') -Encoding UTF8
    }
}

function Stage-LegacyRootLayout {
    param([string]$Root, [string]$StageDir)

    $items = @('sidecar.js', 'app', 'scripts', 'package.json', 'package-lock.json')
    foreach ($item in $items) {
        $src = Join-Path $Root $item
        $dest = Join-Path $StageDir $item
        if (-not (Test-Path -LiteralPath $src)) {
            Write-Warn "Legacy layout: missing $item (skipped)"
            continue
        }
        if (Test-Path -LiteralPath $src -PathType Container) {
            if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Recurse -Force }
            Copy-TreeAsRealFiles -Source $src -Destination $dest
        } else {
            Copy-Item -LiteralPath $src -Destination $dest -Force
        }
    }
}

function Stage-LegacyScriptsLayout {
    param([string]$Root, [string]$StageDir)

    $sidecarSrc = Join-Path $Root 'scripts\raven-sidecar.js'
    Copy-Item -LiteralPath $sidecarSrc -Destination (Join-Path $StageDir 'sidecar.js') -Force

    $appDirs = @('app', 'scripts\app', 'src\app', 'raven\app')
    $appFound = $false
    foreach ($rel in $appDirs) {
        $src = Join-Path $Root $rel
        if (Test-Path -LiteralPath $src) {
            Copy-TreeAsRealFiles -Source $src -Destination (Join-Path $StageDir 'app')
            $appFound = $true
            Write-Ok "Copied $rel -> app/"
            break
        }
    }
    if (-not $appFound) {
        throw "Legacy scripts layout: app/ not found (checked: $($appDirs -join ', '))"
    }

    foreach ($pkgFile in @('package.json', 'package-lock.json')) {
        $src = Join-Path $Root $pkgFile
        if (Test-Path -LiteralPath $src) {
            Copy-Item -LiteralPath $src -Destination (Join-Path $StageDir $pkgFile) -Force
        }
    }
}

function Install-StagedProductionDeps {
    param(
        [string]$StageDir,
        [string]$NodeExe
    )
    $pkg = Join-Path $StageDir 'package.json'
    if (-not (Test-Path -LiteralPath $pkg)) { return }

    $appModules = Join-Path $StageDir 'app\node_modules'
    if (Test-Path -LiteralPath $appModules) {
        Write-Ok 'Using production node_modules from pnpm deploy (app/node_modules)'
        return
    }

    Write-Step 'Installing production dependencies in staged sidecar root...'
    Push-Location $StageDir
    try {
        if ($NodeExe -and (Test-Path -LiteralPath $NodeExe)) {
            $npmCli = (Get-Command npm -ErrorAction SilentlyContinue).Source
            if (-not $npmCli) { throw 'npm CLI not found on PATH (needed for staged dependency install)' }
            & $NodeExe $npmCli install --omit=dev --no-optional
        } else {
            npm install --omit=dev --no-optional
        }
        if ($LASTEXITCODE -ne 0) {
            throw "npm install in staged directory failed (exit $LASTEXITCODE)"
        }
        Write-Ok 'Dependencies installed'
    } finally {
        Pop-Location
    }
}

# --- Main ---

if (-not $AITuberRoot) {
    $AITuberRoot = 'E:\AIChatBot'
}

if (-not (Test-Path -LiteralPath $AITuberRoot)) {
    Write-Fail "ERROR: AITuber repository not found at: $AITuberRoot"
    Write-Host ''
    Write-Host 'Clone AITuber or set $env:AITUBER_ROOT, then run: npm run stage-raven' -ForegroundColor Yellow
    exit 1
}

Write-Step "Staging Raven from: $AITuberRoot"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$StageDir = Join-Path $RepoRoot 'extra\raven'

if ($Clean -and (Test-Path -LiteralPath $StageDir)) {
    Write-Warn "Cleaning existing stage: $StageDir"
    Get-ChildItem -LiteralPath $StageDir -Force | Where-Object { $_.Name -notin @('README.md') } | Remove-Item -Recurse -Force
}

New-Item -ItemType Directory -Path $StageDir -Force | Out-Null

$isMonorepo = (Test-Path -LiteralPath (Join-Path $AITuberRoot 'pnpm-workspace.yaml')) -or
    (Test-Path -LiteralPath (Join-Path $AITuberRoot 'apps\controller'))
$hasRootSidecar = Test-Path -LiteralPath (Join-Path $AITuberRoot 'sidecar.js')
$hasScriptsSidecar = Test-Path -LiteralPath (Join-Path $AITuberRoot 'scripts\raven-sidecar.js')

Write-Step 'Copying Raven sidecar application...'
if ($isMonorepo -and $hasScriptsSidecar) {
    Write-Ok 'Detected AITuber pnpm monorepo (apps/controller + scripts/raven-sidecar.js)'
    Stage-MonorepoLayout -Root $AITuberRoot -StageDir $StageDir
} elseif ($hasRootSidecar) {
    Write-Ok 'Detected legacy root sidecar.js layout'
    Stage-LegacyRootLayout -Root $AITuberRoot -StageDir $StageDir
} elseif ($hasScriptsSidecar) {
    Write-Ok 'Detected legacy scripts/raven-sidecar.js layout'
    Stage-LegacyScriptsLayout -Root $AITuberRoot -StageDir $StageDir
} else {
    Write-Fail 'ERROR: Cannot find Raven sidecar entrypoint.'
    Write-Fail "  Checked: $(Join-Path $AITuberRoot 'sidecar.js')"
    Write-Fail "           $(Join-Path $AITuberRoot 'scripts\raven-sidecar.js')"
    exit 1
}

if (-not (Test-Path -LiteralPath (Join-Path $StageDir 'sidecar.js'))) {
    Write-Fail 'ERROR: sidecar.js was not staged.'
    exit 1
}

Write-Step 'Bundling Node.js runtime...'
$NodeDir = Join-Path $StageDir 'node'
New-Item -ItemType Directory -Path $NodeDir -Force | Out-Null
$PortableNode = Join-Path $AITuberRoot 'runtime\node\node.exe'
$BundledNodeExe = Join-Path $NodeDir 'node.exe'
if (Test-Path -LiteralPath $PortableNode) {
    Write-Ok 'Using portable node from AITuber runtime/node'
    Copy-TreeAsRealFiles -Source (Join-Path $AITuberRoot 'runtime\node') -Destination $NodeDir -ExcludeDirNames @()
} else {
    $systemNode = (Get-Command node -ErrorAction SilentlyContinue).Path
    if (-not $systemNode) {
        Write-Fail "ERROR: node.exe not found. Install Node.js or place portable node under $PortableNode"
        exit 1
    }
    Write-Ok "Using system Node.js: $systemNode"
    Copy-Item -LiteralPath $systemNode -Destination $BundledNodeExe -Force
}

if (-not (Test-Path -LiteralPath $BundledNodeExe)) {
    Write-Fail 'ERROR: Bundled node.exe is missing after staging.'
    exit 1
}

Write-Step 'Bundling ffmpeg (real binaries required)...'
$FfmpegDir = Join-Path $StageDir 'ffmpeg'
New-Item -ItemType Directory -Path $FfmpegDir -Force | Out-Null
$ffmpegSrc = Resolve-FfmpegBinary 'ffmpeg.exe'
$ffplaySrc = Resolve-FfmpegBinary 'ffplay.exe'
if (-not $ffmpegSrc -or -not $ffplaySrc) {
    Write-Fail 'ERROR: ffmpeg.exe and ffplay.exe are required. Set FFMPEG_DIR or install ffmpeg (not only Chocolatey shims).'
    exit 1
}
foreach ($pair in @(
        @{ Src = $ffmpegSrc; Name = 'ffmpeg.exe' },
        @{ Src = $ffplaySrc; Name = 'ffplay.exe' }
    )) {
    $len = (Get-Item -LiteralPath $pair.Src -Force).Length
    if ($len -lt 1MB) {
        Write-Fail "ERROR: $($pair.Name) at $($pair.Src) is only $len bytes — likely a shim, not the real binary."
        exit 1
    }
    Copy-Item -LiteralPath $pair.Src -Destination (Join-Path $FfmpegDir $pair.Name) -Force
    Write-Ok "Bundled $($pair.Name) from $($pair.Src)"
}

Write-Step 'Creating env.defaults (blank API key placeholders only)...'
$EnvDefaultsPath = Join-Path $StageDir 'env.defaults'
$TemplateInRepo = Join-Path $RepoRoot 'extra\raven\env.defaults'
if (Test-Path -LiteralPath $TemplateInRepo) {
    Copy-Item -LiteralPath $TemplateInRepo -Destination $EnvDefaultsPath -Force
} else {
    @(
        '# Raven Voice AI — fill API keys after install (never ship real keys)',
        'RAVEN_VOICE_ONLY=1',
        'LLM_PROVIDER=openai',
        'LLM_API_KEY=',
        'TTS_PROVIDER=elevenlabs',
        'TTS_API_KEY=',
        'TTS_VOICE_ID=',
        'JARVIS_BASE_URL=http://127.0.0.1:8091',
        'VIRTUALDECK_JARVIS_URL=http://127.0.0.1:8091'
    ) | Set-Content -Path $EnvDefaultsPath -Encoding UTF8
}

Write-Step 'Running security checks...'
$dangerousNames = @('.env', 'raven.env', 'twitch-oauth-config.js')
$foundDangerous = $false
foreach ($name in $dangerousNames) {
    $p = Join-Path $StageDir $name
    if (Test-Path -LiteralPath $p) {
        Write-Fail "  ERROR: staged file must not be bundled: $name"
        $foundDangerous = $true
    }
}

$defaultsText = Get-Content -LiteralPath $EnvDefaultsPath -Raw
if (Test-EnvTextHasPopulatedSecrets $defaultsText) {
    Write-Fail '  ERROR: env.defaults contains non-placeholder API key values.'
    $foundDangerous = $true
}

Get-ChildItem -LiteralPath $StageDir -Recurse -File -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -in @('.env', 'raven.env') } |
    ForEach-Object {
        Write-Fail "  ERROR: credential file staged: $($_.FullName)"
        $foundDangerous = $true
    }

if ($foundDangerous) {
    Write-Fail ''
    Write-Fail 'STAGING ABORTED: Security validation failed'
    exit 1
}
Write-Ok 'Security checks passed'

Install-StagedProductionDeps -StageDir $StageDir -NodeExe $BundledNodeExe

if (-not (Test-Path -LiteralPath (Join-Path $StageDir 'sidecar.js'))) {
    Write-Fail 'ERROR: sidecar.js missing after dependency install.'
    exit 1
}
$appDirFinal = Join-Path $StageDir 'app'
if (Test-Path -LiteralPath $appDirFinal) {
    $dist = Assert-ControllerDistPresent $appDirFinal
    if (-not $dist) {
        Write-Fail "ERROR: controller app/ has no dist entrypoint under $appDirFinal"
        exit 1
    }
}

Write-Host ''
Write-Host 'Raven staging complete!' -ForegroundColor Green
Write-Host "Staged to: $StageDir"
Write-Host ''
Write-Host 'Next: npm run build:win:with-raven' -ForegroundColor Yellow
