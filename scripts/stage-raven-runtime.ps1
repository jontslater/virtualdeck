# Stage Raven Runtime for VirtualDeck Installer
# Prepares the Raven voice AI sidecar from the AITuber repo for bundling with VirtualDeck.
#
# REQUIREMENTS (Windows build PC):
# - AITuber clone (https://github.com/jontslater/AITuber) - default E:\AIChatBot or $env:AITUBER_ROOT
# - pnpm via npx (default: npx --yes pnpm@9.15.0) or $env:PNPM_CMD
# - Node.js on PATH (or AITuber\runtime\node\node.exe for portable bundle)
# - ffmpeg + ffplay real binaries (not Chocolatey shims), or $env:FFMPEG_DIR
#
# SECURITY: Default staging never copies AITuber .env. Use -BundleKeys only for personal builds.

param(
    [string]$AITuberRoot = $env:AITUBER_ROOT,
    [switch]$Clean = $false,
    [switch]$BundleKeys = $false
)

$ErrorActionPreference = "Stop"

$Script:BundleKeys = $BundleKeys -or ($env:RAVEN_BUNDLE_KEYS -eq '1')

$Script:SecretKeyNames = 'LLM_API_KEY|TTS_API_KEY|OPENAI_API_KEY|ELEVENLABS_API_KEY'
$Script:PlaceholderValues = @(
    '', 'changeme', 'change-me', 'your-api-key', 'your-key-here', 'your_key_here',
    'placeholder', 'todo', 'tbd', 'none', 'null', 'sk-your', 'sk-your-key-here'
)

$Script:SidecarControllerEntry = 'app\apps\controller\dist\index.js'
$Script:SidecarBridgeEntry = 'app\packages\integrations\virtualdeck\dist\bridge-server.js'
$Script:BridgeSourceRel = 'packages\integrations\virtualdeck'

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

function Get-ControllerPackageName([string]$Root) {
    if ($env:RAVEN_CONTROLLER_PACKAGE -and $env:RAVEN_CONTROLLER_PACKAGE.Trim()) {
        return $env:RAVEN_CONTROLLER_PACKAGE.Trim()
    }
    $pkgJson = Join-Path $Root 'apps\controller\package.json'
    if (-not (Test-Path -LiteralPath $pkgJson)) {
        throw 'apps/controller/package.json not found (cannot resolve controller package name).'
    }
    $pkg = Get-Content -LiteralPath $pkgJson -Raw | ConvertFrom-Json
    if (-not $pkg.name) {
        throw 'apps/controller/package.json is missing a "name" field.'
    }
    return [string]$pkg.name
}

function Invoke-PnpmCapture {
    param(
        [Parameter(Mandatory = $true)][string[]]$PnpmArgs,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory
    )
    $pnpm = Get-PnpmInvocation
    Push-Location $WorkingDirectory
    try {
        $output = & $pnpm[0] @($pnpm[1..($pnpm.Length - 1)]) @PnpmArgs 2>&1 | Out-String
        if ($LASTEXITCODE -ne 0) {
            throw "$($pnpm -join ' ') $($PnpmArgs -join ' ') failed with exit code $LASTEXITCODE`n$output"
        }
        return $output
    } finally {
        Pop-Location
    }
}

function Test-PathUnderNodeModules([string]$FullPath) {
    $normalized = $FullPath.Replace('/', '\')
    return $normalized -match '\\node_modules(\\|$)'
}

function Get-WorkspacePackageFilters([string]$Root) {
    $filters = New-Object System.Collections.Generic.List[string]
    $rootFull = (Resolve-Path -LiteralPath $Root).Path

    try {
        $jsonText = Invoke-PnpmCapture -PnpmArgs @('ls', '-r', '--depth', '-1', '--json') -WorkingDirectory $Root
        $entries = $jsonText | ConvertFrom-Json
        if ($entries -isnot [Array]) { $entries = @($entries) }
        foreach ($entry in $entries) {
            if (-not $entry.path) { continue }
            $pkgPath = [IO.Path]::GetFullPath([string]$entry.path)
            if (Test-PathUnderNodeModules $pkgPath) { continue }
            if ($pkgPath -notlike "$rootFull*") { continue }
            $rel = $pkgPath.Substring($rootFull.Length).TrimStart('\', '/').Replace('\', '/')
            if ($rel -notmatch '^packages/') { continue }
            $filters.Add("./$rel")
        }
    } catch {
        Write-Warn "pnpm ls -r --json failed; falling back to filesystem package scan ($($_.Exception.Message))"
    }

    if ($filters.Count -eq 0) {
        $packagesRoot = Join-Path $Root 'packages'
        if (Test-Path -LiteralPath $packagesRoot) {
            Get-ChildItem -LiteralPath $packagesRoot -Recurse -Filter 'package.json' -File -ErrorAction SilentlyContinue |
                Where-Object { -not (Test-PathUnderNodeModules $_.DirectoryName) } |
                ForEach-Object {
                    $rel = $_.DirectoryName.Substring($rootFull.Length).TrimStart('\', '/').Replace('\', '/')
                    if ($rel -match '^packages/') { $filters.Add("./$rel") }
                }
        }
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

function Invoke-PnpmInstallFrozenForRaven {
    param(
        [string]$Root,
        [string]$ControllerPackageName
    )
    $filter = "${ControllerPackageName}..."
    try {
        Invoke-Pnpm -PnpmArgs @('install', '--frozen-lockfile', '--filter', $filter) -WorkingDirectory $Root
    } catch {
        throw @"
pnpm install --frozen-lockfile --filter $filter failed.
Only the controller dependency subtree is installed so unrelated workspace apps (e.g. apps/hud) do not block Raven staging.
If controller dependencies changed, run 'pnpm install' in AITuber, commit pnpm-lock.yaml, then re-run stage-raven.
Original error: $($_.Exception.Message)
"@
    }
}

function Get-NpmCliPath {
    $npm = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $npm -or -not $npm.Source) {
        throw 'npm CLI not found on PATH (needed to install bridge production dependencies).'
    }
    return $npm.Source
}

function Initialize-BundledNode {
    param(
        [string]$AITuberRoot,
        [string]$StageDir
    )
    Write-Step 'Bundling Node.js runtime (needed before bridge npm install)...'
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
            throw "node.exe not found. Install Node.js or place portable node under $PortableNode"
        }
        Write-Ok "Using system Node.js: $systemNode"
        Copy-Item -LiteralPath $systemNode -Destination $BundledNodeExe -Force
    }
    if (-not (Test-Path -LiteralPath $BundledNodeExe)) {
        throw 'Bundled node.exe is missing after copy.'
    }
    return $BundledNodeExe
}

function Stage-VirtualDeckBridge {
    param(
        [string]$Root,
        [string]$StageDir,
        [string]$NodeExe
    )
    $bridgeDir = Join-Path $Root $Script:BridgeSourceRel
    if (-not (Test-Path -LiteralPath $bridgeDir)) {
        throw "Missing VirtualDeck bridge at $Script:BridgeSourceRel"
    }

    $bridgeStage = Join-Path $StageDir 'app\packages\integrations\virtualdeck'
    if (Test-Path -LiteralPath $bridgeStage) {
        Remove-Item -LiteralPath $bridgeStage -Recurse -Force
    }
    New-Item -ItemType Directory -Path $bridgeStage -Force | Out-Null

    $entrySrc = Join-Path $bridgeDir 'dist\bridge-server.js'
    $tsconfig = Join-Path $bridgeDir 'tsconfig.json'
    if (-not (Test-Path -LiteralPath $tsconfig)) {
        $alt = Join-Path $bridgeDir 'tsconfig.build.json'
        if (Test-Path -LiteralPath $alt) { $tsconfig = $alt }
    }

    $hasDist = Test-Path -LiteralPath $entrySrc
    if (Test-Path -LiteralPath $tsconfig) {
        Write-Host "  compiling VirtualDeck bridge: tsc -p $tsconfig" -ForegroundColor DarkGray
        $tscCandidates = @(
            (Join-Path $Root 'node_modules\typescript\bin\tsc'),
            (Join-Path $bridgeDir 'node_modules\typescript\bin\tsc')
        )
        $tsc = $tscCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
        $npmCli = Get-NpmCliPath
        try {
            Push-Location $bridgeDir
            if ($tsc) {
                & $NodeExe $tsc -p $tsconfig
            } else {
                Push-Location $Root
                & $NodeExe $npmCli exec -- tsc -p $tsconfig
            }
            if ($LASTEXITCODE -ne 0) {
                throw "tsc exited with code $LASTEXITCODE"
            }
            $hasDist = Test-Path -LiteralPath $entrySrc
        } catch {
            if ($hasDist) {
                Write-Warn "VirtualDeck bridge tsc failed but dist/bridge-server.js exists - using existing dist ($($_.Exception.Message))"
            } else {
                throw
            }
        } finally {
            Pop-Location
        }
    } elseif (-not $hasDist) {
        throw 'VirtualDeck bridge has no tsconfig.json and no dist/bridge-server.js'
    } else {
        Write-Warn 'VirtualDeck bridge: no tsconfig.json; using existing dist/bridge-server.js'
    }

    if (-not (Test-Path -LiteralPath $entrySrc)) {
        throw 'VirtualDeck bridge dist/bridge-server.js is missing after compile'
    }

    $pkgJson = Join-Path $bridgeDir 'package.json'
    if (-not (Test-Path -LiteralPath $pkgJson)) {
        throw 'VirtualDeck bridge package.json is missing'
    }
    Copy-Item -LiteralPath $pkgJson -Destination (Join-Path $bridgeStage 'package.json') -Force
    Copy-TreeAsRealFiles -Source (Join-Path $bridgeDir 'dist') -Destination (Join-Path $bridgeStage 'dist')

    Write-Step 'Installing VirtualDeck bridge production dependencies (npm)...'
    $npmCli = Get-NpmCliPath
    Push-Location $bridgeStage
    try {
        & $NodeExe $npmCli install --omit=dev --no-optional
        if ($LASTEXITCODE -ne 0) {
            throw "npm install in VirtualDeck bridge failed (exit $LASTEXITCODE)"
        }
    } finally {
        Pop-Location
    }

    Assert-BridgeWsResolvable -BridgeStage $bridgeStage -NodeExe $NodeExe
    Write-Ok 'VirtualDeck bridge staged with production node_modules'
}

function Assert-BridgeWsResolvable {
    param(
        [string]$BridgeStage,
        [string]$NodeExe
    )
    Push-Location $BridgeStage
    try {
        $resolveScript = "try { console.log(require.resolve('ws')); process.exit(0); } catch (e) { console.error(e.message); process.exit(1); }"
        & $NodeExe -e $resolveScript
        if ($LASTEXITCODE -ne 0) {
            throw "require.resolve('ws') failed from VirtualDeck bridge directory"
        }
        $wsPath = & $NodeExe -e "console.log(require.resolve('ws'))"
        Write-Ok "ws resolves from VirtualDeck bridge ($wsPath)"
    } finally {
        Pop-Location
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
        [string]$StageDir,
        [string]$NodeExe
    )

    $controllerFilter = Get-ControllerFilter $Root
    if (-not $controllerFilter) {
        throw 'Monorepo layout detected but apps/controller is missing (set RAVEN_CONTROLLER_FILTER if needed).'
    }
    $controllerPackageName = Get-ControllerPackageName -Root $Root

    $sidecarSrc = Join-Path $Root 'scripts\raven-sidecar.js'
    if (-not (Test-Path -LiteralPath $sidecarSrc)) {
        throw "Missing scripts/raven-sidecar.js under $Root"
    }

    Write-Step "Installing Raven pnpm subtree (frozen lockfile, filter $controllerPackageName...)..."
    Invoke-PnpmInstallFrozenForRaven -Root $Root -ControllerPackageName $controllerPackageName

    Write-Step 'Building workspace packages (pnpm workspace only, excludes node_modules)...'
    $packageFilters = Get-WorkspacePackageFilters -Root $Root
    foreach ($filter in $packageFilters) {
        if ($filter -replace '^\./', '' -eq $Script:BridgeSourceRel.Replace('\', '/')) { continue }
        Invoke-PackageBuildOptional -Root $Root -Filter $filter
    }

    Write-Step 'Building apps/controller...'
    Invoke-Pnpm -PnpmArgs @('--filter', $controllerFilter, 'run', 'build') -WorkingDirectory $Root

    Write-Step 'Deploying controller to app/apps/controller...'
    $controllerStage = Join-Path $StageDir 'app\apps\controller'
    Invoke-PnpmDeployPackage -Root $Root -Filter $controllerFilter -Destination $controllerStage

    Write-Step 'Building and staging VirtualDeck bridge (outside pnpm workspace)...'
    Stage-VirtualDeckBridge -Root $Root -StageDir $StageDir -NodeExe $NodeExe

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

function Parse-DotEnvFile {
    param([string]$Path)
    $map = @{}
    if (-not (Test-Path -LiteralPath $Path)) { return $map }
    foreach ($raw in (Get-Content -LiteralPath $Path)) {
        $line = $raw.Trim()
        if (-not $line -or $line.StartsWith('#')) { continue }
        $eq = $line.IndexOf('=')
        if ($eq -lt 1) { continue }
        $key = $line.Substring(0, $eq).Trim()
        $val = $line.Substring($eq + 1).Trim()
        $hash = $val.IndexOf(' #')
        if ($hash -ge 0) { $val = $val.Substring(0, $hash).Trim() }
        if ($val.Length -ge 2) {
            if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
                $val = $val.Substring(1, $val.Length - 2)
            }
        }
        $map[$key] = $val
    }
    return $map
}

function Get-TemplateEnvKeys([string]$TemplateText) {
    $keys = New-Object System.Collections.Generic.List[string]
    foreach ($line in ($TemplateText -split "`r?`n")) {
        if ($line -match '^\s*#' -or -not $line.Trim()) { continue }
        if ($line -match '^\s*([^=\s#]+)\s*=') {
            $keys.Add($Matches[1])
        }
    }
    return $keys
}

function Format-EnvValueForFile([string]$Value) {
    if ($null -eq $Value) { return '' }
    if ($Value -match '[\s#;"\\]' -or $Value -match '^\s|\s$') {
        $escaped = $Value -replace '\\', '\\\\' -replace '"', '\"'
        return "`"$escaped`""
    }
    return $Value
}

function Merge-EnvDefaultsWithAituberDotenv {
    param(
        [string]$TemplateText,
        [hashtable]$SourceMap
    )
    $templateKeys = Get-TemplateEnvKeys -TemplateText $TemplateText
    $overlay = @{}
    foreach ($key in $templateKeys) {
        if ($SourceMap.ContainsKey($key) -and [string]::IsNullOrWhiteSpace($SourceMap[$key]) -eq $false) {
            $overlay[$key] = $SourceMap[$key]
        }
    }
    $extraKeys = @('OPENAI_API_KEY', 'ELEVENLABS_API_KEY')
    foreach ($alias in $extraKeys) {
        if ($SourceMap.ContainsKey($alias) -and -not [string]::IsNullOrWhiteSpace($SourceMap[$alias])) {
            if ($alias -eq 'OPENAI_API_KEY' -and -not $overlay.ContainsKey('LLM_API_KEY')) {
                $overlay['LLM_API_KEY'] = $SourceMap[$alias]
            }
            if ($alias -eq 'ELEVENLABS_API_KEY' -and -not $overlay.ContainsKey('TTS_API_KEY')) {
                $overlay['TTS_API_KEY'] = $SourceMap[$alias]
            }
        }
    }

    $lines = New-Object System.Collections.Generic.List[string]
    foreach ($raw in ($TemplateText -split "`r?`n")) {
        if (-not $raw.Trim() -or $raw.Trim().StartsWith('#') -or $raw.IndexOf('=') -lt 1) {
            $lines.Add($raw)
            continue
        }
        $eq = $raw.IndexOf('=')
        $key = $raw.Substring(0, $eq).Trim()
        if ($overlay.ContainsKey($key)) {
            $lines.Add("$key=$(Format-EnvValueForFile $overlay[$key])")
        } else {
            $lines.Add($raw)
        }
    }
    return ($lines -join "`n").TrimEnd() + "`n"
}

function Write-EnvDefaultsTemplate {
    param(
        [string]$StageDir,
        [string]$RepoRoot,
        [string]$AITuberRoot
    )
    $EnvDefaultsPath = Join-Path $StageDir 'env.defaults'
    $TemplateInRepo = Join-Path $RepoRoot 'extra\raven\env.defaults'
    $BackupPath = Join-Path $StageDir '.env.defaults.template.backup'

    $templateText = $null
    if (Test-Path -LiteralPath $TemplateInRepo) {
        $templateText = Get-Content -LiteralPath $TemplateInRepo -Raw
    } else {
        $templateText = @(
            '# Raven Voice AI - fill API keys after install (never ship real keys)',
            'RAVEN_VOICE_ONLY=1',
            'LLM_PROVIDER=openai',
            'LLM_API_KEY=',
            'TTS_PROVIDER=elevenlabs',
            'TTS_API_KEY=',
            'TTS_VOICE_ID=',
            'JARVIS_BASE_URL=http://127.0.0.1:8091',
            'VIRTUALDECK_JARVIS_URL=http://127.0.0.1:8091'
        ) -join "`n"
    }

    Set-Content -LiteralPath $BackupPath -Value $templateText -Encoding UTF8 -NoNewline
    if (-not $templateText.EndsWith("`n")) {
        Add-Content -LiteralPath $BackupPath -Value '' -Encoding UTF8
    }
    Write-Ok 'Saved committed env.defaults template backup (.env.defaults.template.backup)'

    if ($Script:BundleKeys) {
        $dotenvPath = Join-Path $AITuberRoot '.env'
        if (-not (Test-Path -LiteralPath $dotenvPath)) {
            throw "BundleKeys enabled but AITuber .env not found at $dotenvPath"
        }
        $sourceMap = Parse-DotEnvFile -Path $dotenvPath
        $merged = Merge-EnvDefaultsWithAituberDotenv -TemplateText $templateText -SourceMap $sourceMap
        Set-Content -LiteralPath $EnvDefaultsPath -Value $merged -Encoding UTF8 -NoNewline
        if (-not $merged.EndsWith("`n")) {
            Add-Content -LiteralPath $EnvDefaultsPath -Value '' -Encoding UTF8
        }
        $templateKeys = Get-TemplateEnvKeys -TemplateText $templateText
        foreach ($key in $templateKeys) {
            if ($sourceMap.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace($sourceMap[$key])) {
                Write-Ok "Bundled env key $key (length $($sourceMap[$key].Length))"
            }
        }
        if ($sourceMap.ContainsKey('OPENAI_API_KEY') -and $sourceMap['OPENAI_API_KEY']) {
            Write-Ok "Bundled env key OPENAI_API_KEY (length $($sourceMap['OPENAI_API_KEY'].Length))"
        }
        if ($sourceMap.ContainsKey('ELEVENLABS_API_KEY') -and $sourceMap['ELEVENLABS_API_KEY']) {
            Write-Ok "Bundled env key ELEVENLABS_API_KEY (length $($sourceMap['ELEVENLABS_API_KEY'].Length))"
        }
        return
    }

    $srcFull = (Resolve-Path -LiteralPath $TemplateInRepo -ErrorAction SilentlyContinue)
    $destFull = [IO.Path]::GetFullPath($EnvDefaultsPath)
    if ($srcFull -and $srcFull.Path -ieq $destFull) {
        Write-Ok 'env.defaults template already at destination (skipped copy)'
        return
    }
    Set-Content -LiteralPath $EnvDefaultsPath -Value $templateText -Encoding UTF8 -NoNewline
    if (-not $templateText.EndsWith("`n")) {
        Add-Content -LiteralPath $EnvDefaultsPath -Value '' -Encoding UTF8
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
    Get-ChildItem -LiteralPath $StageDir -Force | Where-Object { $_.Name -notin @('README.md', 'env.defaults') } | Remove-Item -Recurse -Force
}

New-Item -ItemType Directory -Path $StageDir -Force | Out-Null

$isMonorepo = (Test-Path -LiteralPath (Join-Path $AITuberRoot 'pnpm-workspace.yaml')) -or
    (Test-Path -LiteralPath (Join-Path $AITuberRoot 'apps\controller'))
$hasRootSidecar = Test-Path -LiteralPath (Join-Path $AITuberRoot 'sidecar.js')
$hasScriptsSidecar = Test-Path -LiteralPath (Join-Path $AITuberRoot 'scripts\raven-sidecar.js')

$BundledNodeExe = Initialize-BundledNode -AITuberRoot $AITuberRoot -StageDir $StageDir

Write-Step 'Copying Raven sidecar application...'
if ($isMonorepo -and $hasScriptsSidecar) {
    Write-Ok 'Detected AITuber pnpm monorepo (apps/controller + scripts/raven-sidecar.js)'
    Stage-MonorepoLayout -Root $AITuberRoot -StageDir $StageDir -NodeExe $BundledNodeExe
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

if (-not (Test-Path -LiteralPath $BundledNodeExe)) {
    Write-Fail 'ERROR: Bundled node.exe is missing.'
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
Write-EnvDefaultsTemplate -StageDir $StageDir -RepoRoot $RepoRoot -AITuberRoot $AITuberRoot

if ($Script:BundleKeys) {
    Write-Host ''
    Write-Host '**********************************************************************' -ForegroundColor Red
    Write-Host '** PERSONAL BUILD: staged env.defaults CONTAINS API KEYS              **' -ForegroundColor Red
    Write-Host '** Do NOT share this installer or commit extra/raven/env.defaults.  **' -ForegroundColor Red
    Write-Host '**********************************************************************' -ForegroundColor Red
    Write-Host ''
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

$EnvDefaultsPath = Join-Path $StageDir 'env.defaults'
$defaultsText = Get-Content -LiteralPath $EnvDefaultsPath -Raw
if (-not $Script:BundleKeys) {
    if (Test-EnvTextHasPopulatedSecrets $defaultsText) {
        Write-Fail '  ERROR: env.defaults contains non-placeholder API key values.'
        $foundDangerous = $true
    }
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
