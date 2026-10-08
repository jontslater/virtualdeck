# Stage Raven Runtime for VirtualDeck Installer
# Prepares the Raven voice AI sidecar from the AITuber repo for bundling with VirtualDeck.
#
# REQUIREMENTS (Windows build PC):
# - AITuber clone (https://github.com/jontslater/AITuber) - default E:\AIChatBot or $env:AITUBER_ROOT
# - pnpm via npx (default: npx --yes pnpm@9.15.0) or $env:PNPM_CMD
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

$Script:SidecarControllerEntry = 'app\apps\controller\dist\index.js'
$Script:SidecarBridgeEntry = 'app\packages\integrations\virtualdeck\dist\bridge-server.js'
$Script:BridgePackageFilter = './packages/integrations/virtualdeck'

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
    $linePattern = "^\s*($($Script:SecretKeyNames))\s*[ \t]*=\s*(?:`"([^`"]*)`"|'([^']*)'|([^\s#;]*))?\s*$"
    foreach ($line in ($Text -split "`r?`n")) {
        if (-not ($line -match $linePattern)) { continue }
        $val = ''
        if ($Matches[2]) { $val = $Matches[2] }
        elseif ($Matches[3]) { $val = $Matches[3] }
        elseif ($Matches[4]) { $val = $Matches[4] }
        $val = $val.Trim()
        if (-not $val) { continue }
        $lower = $val.ToLower()
        if ($Script:PlaceholderValues -contains $lower) { continue }
        if ($lower -match '^(your|my|insert|add|enter|put)[-_ ]') { continue }
        return $true
    }
    return $false
}

function Get-PnpmInvocation {
    if ($env:PNPM_CMD -and $env:PNPM_CMD.Trim()) {
        return @($env:PNPM_CMD.Trim().Split(' ', [System.StringSplitOptions]::RemoveEmptyEntries))
    }
    return @('npx', '--yes', 'pnpm@9.15.0')
}

function Invoke-Pnpm {
    param(
        [Parameter(Mandatory = $true)][string[]]$PnpmArgs,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory
    )
    $pnpm = Get-PnpmInvocation
    Push-Location $WorkingDirectory
    try {
        Write-Host "  $($pnpm -join ' ') $($PnpmArgs -join ' ')" -ForegroundColor DarkGray
        & $pnpm[0] @($pnpm[1..($pnpm.Length - 1)]) @PnpmArgs
        if ($LASTEXITCODE -ne 0) {
            throw "$($pnpm -join ' ') $($PnpmArgs -join ' ') failed with exit code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
}

function Test-ReparsePoint([System.IO.FileSystemInfo]$Item) {
    return ($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq [IO.FileAttributes]::ReparsePoint
}

function Resolve-ReparseTarget([string]$Path) {
    $item = Get-Item -LiteralPath $Path -Force
    if (-not (Test-ReparsePoint $item)) {
        return $item.FullName
    }
    $target = $null
    if ($item.PSObject.Properties.Match('Target').Count -gt 0 -and $item.Target) {
        if ($item.Target -is [Array]) { $target = $item.Target[0] }
        else { $target = [string]$item.Target }
    }
    if (-not $target) {
        throw "Could not resolve reparse point target for: $Path"
    }
    if (-not [IO.Path]::IsPathRooted($target)) {
        $target = Join-Path $item.Parent.FullName $target
    }
    return (Resolve-Path -LiteralPath $target).Path
}

function Copy-TreeAsRealFiles {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination,
        [string[]]$ExcludeDirNames = @('.git', '.turbo', '.cache')
    )
    if (-not (Test-Path -LiteralPath $Source)) {
        throw "Copy source not found: $Source"
    }
    $resolvedSource = (Resolve-Path -LiteralPath $Source).Path
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null

    function Copy-Recursive {
        param([string]$Src, [string]$Dst)
        $item = Get-Item -LiteralPath $Src -Force
        if (Test-ReparsePoint $item) {
            $real = Resolve-ReparseTarget $Src
            $realItem = Get-Item -LiteralPath $real -Force
            if ($realItem.PSIsContainer) {
                New-Item -ItemType Directory -Path $Dst -Force | Out-Null
                foreach ($child in Get-ChildItem -LiteralPath $real -Force) {
                    Copy-Recursive -Src $child.FullName -Dst (Join-Path $Dst $child.Name)
                }
            } else {
                $parent = Split-Path -Parent $Dst
                if (-not (Test-Path -LiteralPath $parent)) {
                    New-Item -ItemType Directory -Path $parent -Force | Out-Null
                }
                Copy-Item -LiteralPath $real -Destination $Dst -Force
            }
            return
        }
        if ($item.PSIsContainer) {
            if ($ExcludeDirNames -contains $item.Name) { return }
            New-Item -ItemType Directory -Path $Dst -Force | Out-Null
            foreach ($child in Get-ChildItem -LiteralPath $Src -Force) {
                Copy-Recursive -Src $child.FullName -Dst (Join-Path $Dst $child.Name)
            }
            return
        }
        $parent = Split-Path -Parent $Dst
        if ($parent -and -not (Test-Path -LiteralPath $parent)) {
            New-Item -ItemType Directory -Path $parent -Force | Out-Null
        }
        Copy-Item -LiteralPath $Src -Destination $Dst -Force
    }

    Copy-Recursive -Src $resolvedSource -Dst $Destination
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

function Get-ControllerFilter([string]$Root) {
    if ($env:RAVEN_CONTROLLER_FILTER) { return $env:RAVEN_CONTROLLER_FILTER }
    $controllerDir = Join-Path $Root 'apps\controller'
    if (Test-Path -LiteralPath $controllerDir) { return './apps/controller' }
    return $null
}

function Get-WorkspacePackageFilters([string]$Root) {
    $filters = New-Object System.Collections.Generic.List[string]
    $packagesRoot = Join-Path $Root 'packages'
    if (-not (Test-Path -LiteralPath $packagesRoot)) { return @() }
    Get-ChildItem -LiteralPath $packagesRoot -Recurse -Filter 'package.json' -File | ForEach-Object {
        $rel = $_.DirectoryName.Substring($Root.Length).TrimStart('\', '/').Replace('\', '/')
        $filters.Add("./$rel")
    }
    return $filters | Sort-Object -Unique
}

function Get-PackageDirectoryFromFilter([string]$Root, [string]$Filter) {
    $rel = $Filter -replace '^\./', '' -replace '/', '\'
    return Join-Path $Root $rel
}

function Test-PackageHasBuiltOutput([string]$PackageDir) {
    $dist = Join-Path $PackageDir 'dist'
    if (-not (Test-Path -LiteralPath $dist)) { return $false }
    $js = Get-ChildItem -LiteralPath $dist -Filter '*.js' -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
    return $null -ne $js
}

function Invoke-PackageBuildOptional {
    param(
        [string]$Root,
        [string]$Filter
    )
    $pkgDir = Get-PackageDirectoryFromFilter -Root $Root -Filter $Filter
    $pkgJson = Join-Path $pkgDir 'package.json'
    if (-not (Test-Path -LiteralPath $pkgJson)) { return }
    $pkg = Get-Content -LiteralPath $pkgJson -Raw | ConvertFrom-Json
    if (-not ($pkg.scripts -and $pkg.scripts.build)) { return }

    $hasDist = Test-PackageHasBuiltOutput -PackageDir $pkgDir
    try {
        Write-Host "  building $Filter"
        Invoke-Pnpm -PnpmArgs @('--filter', $Filter, 'run', 'build') -WorkingDirectory $Root
    } catch {
        if ($hasDist) {
            Write-Warn "Build failed for $Filter but dist/ already exists - continuing ($($_.Exception.Message))"
        } else {
            throw
        }
    }
}

function Invoke-PnpmInstallFrozen([string]$Root) {
    try {
        Invoke-Pnpm -PnpmArgs @('install', '--frozen-lockfile') -WorkingDirectory $Root
    } catch {
        throw @"
pnpm install --frozen-lockfile failed. The AITuber lockfile must match node_modules without being rewritten.
Run 'pnpm install' in the AITuber repo on the dev PC, commit pnpm-lock.yaml if needed, then re-run stage-raven.
Original error: $($_.Exception.Message)
"@
    }
}

function Invoke-PnpmDeployPackage {
    param(
        [string]$Root,
        [string]$Filter,
        [string]$Destination
    )
    if (Test-Path -LiteralPath $Destination) {
        Remove-Item -LiteralPath $Destination -Recurse -Force
    }
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    Invoke-Pnpm -PnpmArgs @('--filter', $Filter, 'deploy', '--prod', $Destination) -WorkingDirectory $Root
}

function Assert-SidecarLayoutPresent([string]$StageDir) {
    $controller = Join-Path $StageDir $Script:SidecarControllerEntry
    $bridge = Join-Path $StageDir $Script:SidecarBridgeEntry
    $missing = @()
    if (-not (Test-Path -LiteralPath $controller)) { $missing += $Script:SidecarControllerEntry }
    if (-not (Test-Path -LiteralPath $bridge)) { $missing += $Script:SidecarBridgeEntry }
    if ($missing.Count -gt 0) {
        throw "Staged layout missing sidecar entrypoints: $($missing -join ', ')"
    }
    Write-Ok "Sidecar entrypoints present (controller + VirtualDeck bridge)"
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

    $sidecarSrc = Join-Path $Root 'scripts\raven-sidecar.js'
    if (-not (Test-Path -LiteralPath $sidecarSrc)) {
        throw "Missing scripts/raven-sidecar.js under $Root"
    }

    Write-Step 'Installing AITuber workspace (frozen lockfile)...'
    Invoke-PnpmInstallFrozen -Root $Root

    Write-Step 'Building workspace packages (nested packages included)...'
    $packageFilters = Get-WorkspacePackageFilters -Root $Root
    foreach ($filter in $packageFilters) {
        Invoke-PackageBuildOptional -Root $Root -Filter $filter
    }

    Write-Step 'Building apps/controller...'
    Invoke-Pnpm -PnpmArgs @('--filter', $controllerFilter, 'run', 'build') -WorkingDirectory $Root

    $bridgeFilter = $Script:BridgePackageFilter
    $bridgeDir = Get-PackageDirectoryFromFilter -Root $Root -Filter $bridgeFilter
    if (-not (Test-Path -LiteralPath $bridgeDir)) {
        throw "Missing VirtualDeck bridge package at packages/integrations/virtualdeck"
    }

    Write-Step 'Deploying controller and VirtualDeck bridge (monorepo paths under app/)...'
    $controllerStage = Join-Path $StageDir 'app\apps\controller'
    $bridgeStage = Join-Path $StageDir 'app\packages\integrations\virtualdeck'
    Invoke-PnpmDeployPackage -Root $Root -Filter $controllerFilter -Destination $controllerStage
    Invoke-PnpmDeployPackage -Root $Root -Filter $bridgeFilter -Destination $bridgeStage

    Assert-SidecarLayoutPresent -StageDir $StageDir

    Write-Step 'Copying Raven sidecar entrypoint...'
    Copy-Item -LiteralPath $sidecarSrc -Destination (Join-Path $StageDir 'sidecar.js') -Force

    $sidecarPkg = Join-Path $Root 'package.json'
    if (Test-Path -LiteralPath $sidecarPkg) {
        Copy-Item -LiteralPath $sidecarPkg -Destination (Join-Path $StageDir 'package.json') -Force
    } else {
        @{
            name = 'raven-sidecar-staged'
            private = $true
            type = 'commonjs'
        } | ConvertTo-Json | Set-Content -Path (Join-Path $StageDir 'package.json') -Encoding ASCII
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
    $modulesCandidates = @(
        (Join-Path $StageDir 'app\apps\controller\node_modules'),
        (Join-Path $StageDir 'app\packages\integrations\virtualdeck\node_modules'),
        (Join-Path $StageDir 'app\node_modules')
    )
    foreach ($mod in $modulesCandidates) {
        if (Test-Path -LiteralPath $mod) {
            Write-Ok "Using production node_modules from pnpm deploy ($mod)"
            return
        }
    }

    $pkg = Join-Path $StageDir 'package.json'
    if (-not (Test-Path -LiteralPath $pkg)) { return }

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

function Write-EnvDefaultsTemplate {
    param(
        [string]$StageDir,
        [string]$RepoRoot
    )
    $EnvDefaultsPath = Join-Path $StageDir 'env.defaults'
    $TemplateInRepo = Join-Path $RepoRoot 'extra\raven\env.defaults'

    if (Test-Path -LiteralPath $TemplateInRepo) {
        $srcFull = (Resolve-Path -LiteralPath $TemplateInRepo).Path
        $destFull = [IO.Path]::GetFullPath($EnvDefaultsPath)
        if ($srcFull -ieq $destFull) {
            Write-Ok 'env.defaults template already at destination (skipped copy)'
            return
        }
        Copy-Item -LiteralPath $TemplateInRepo -Destination $EnvDefaultsPath -Force
        return
    }

    @(
        '# Raven Voice AI - fill API keys after install (never ship real keys)',
        'RAVEN_VOICE_ONLY=1',
        'LLM_PROVIDER=openai',
        'LLM_API_KEY=',
        'TTS_PROVIDER=elevenlabs',
        'TTS_API_KEY=',
        'TTS_VOICE_ID=',
        'JARVIS_BASE_URL=http://127.0.0.1:8091',
        'VIRTUALDECK_JARVIS_URL=http://127.0.0.1:8091'
    ) | Set-Content -Path $EnvDefaultsPath -Encoding ASCII
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
    Get-ChildItem -LiteralPath $StageDir -Force | Where-Object { $_.Name -notin @('README.md', 'env.defaults') } | Remove-Item -Recurse -Force
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
    Copy-TreeAsRealFiles -Source (Join-Path $AITuberRoot 'runtime\node') -Destination $NodeDir
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
        Write-Fail "ERROR: $($pair.Name) at $($pair.Src) is only $len bytes - likely a shim, not the real binary."
        exit 1
    }
    Copy-Item -LiteralPath $pair.Src -Destination (Join-Path $FfmpegDir $pair.Name) -Force
    Write-Ok "Bundled $($pair.Name) from $($pair.Src)"
}

Write-Step 'Creating env.defaults (blank API key placeholders only)...'
Write-EnvDefaultsTemplate -StageDir $StageDir -RepoRoot $RepoRoot

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

$EnvDefaultsPath = Join-Path $StageDir 'env.defaults'
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

if ($isMonorepo -and $hasScriptsSidecar) {
    try {
        Assert-SidecarLayoutPresent -StageDir $StageDir
    } catch {
        Write-Fail $_.Exception.Message
        exit 1
    }
}

Write-Host ''
Write-Host 'Raven staging complete!' -ForegroundColor Green
Write-Host "Staged to: $StageDir"
Write-Host ''
Write-Host 'Next: npm run build:win:with-raven' -ForegroundColor Yellow
