[CmdletBinding()]
param (
    [string]$TvIp = "192.168.15.4:26101",
    [bool]$Deploy = $true,
    [bool]$Launch = $true,
    [string]$SigningProfile = "Matheus",
    [string]$TizenToolsDir = ""
)

$ErrorActionPreference = "Stop"
$rootDir = $PSScriptRoot
$reactDir = Join-Path $rootDir "react-tv-app"
$pkgDir = Join-Path $rootDir "tizen-package"
$wgtOut = Join-Path $rootDir "Cinelar-signed.wgt"

if ($Launch -and -not $Deploy) {
    throw "Use -Deploy junto com -Launch para instalar e abrir o app na TV."
}
if ($Deploy -and [string]::IsNullOrWhiteSpace($TvIp)) {
    throw "Informe o endereco da TV com -TvIp, por exemplo -TvIp '192.168.15.5:26101'."
}

function Find-TizenTool([string]$ToolName) {
    $candidates = @()
    if (-not [string]::IsNullOrWhiteSpace($TizenToolsDir)) {
        $candidates += Join-Path $TizenToolsDir $ToolName
        $candidates += Join-Path (Join-Path $TizenToolsDir "tizen-core") $ToolName
    }

    foreach ($sdkRoot in @($env:TIZEN_SDK, $env:TIZEN_STUDIO, (Join-Path $env:USERPROFILE "tizen-studio"))) {
        if (-not [string]::IsNullOrWhiteSpace($sdkRoot)) {
            $candidates += Join-Path (Join-Path $sdkRoot "tools") $ToolName
            $candidates += Join-Path (Join-Path $sdkRoot "tools\ide\bin") $ToolName
        }
    }

    $extensionTools = Join-Path $env:USERPROFILE ".tizen-extension-platform\server\sdktools\data\tools"
    $candidates += Join-Path $extensionTools $ToolName
    $candidates += Join-Path (Join-Path $extensionTools "tizen-core") $ToolName

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    $onPath = Get-Command $ToolName -ErrorAction SilentlyContinue
    if ($onPath) {
        return $onPath.Source
    }
    return $null
}

$tzTool = Find-TizenTool "tz.exe"
$sdbTool = Find-TizenTool "sdb.exe"
if (-not $tzTool -or -not $sdbTool) {
    throw "Nao encontrei tz.exe e sdb.exe. Instale o Samsung TV Extension ou informe -TizenToolsDir com a pasta tools do SDK."
}

$resolvedRoot = [System.IO.Path]::GetFullPath($rootDir).TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$resolvedPackage = [System.IO.Path]::GetFullPath($pkgDir)
if (-not $resolvedPackage.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "O diretorio de pacote precisa permanecer dentro da pasta do projeto: $resolvedPackage"
}

Write-Host "[1/5] Compilando React TV App..." -ForegroundColor Cyan
Push-Location $reactDir
try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "A compilacao do React TV falhou (codigo $LASTEXITCODE)."
    }
} finally {
    Pop-Location
}

Write-Host "[2/5] Preparando diretorio do pacote Tizen..." -ForegroundColor Cyan
if (Test-Path -LiteralPath $pkgDir) {
    Remove-Item -LiteralPath $pkgDir -Recurse -Force
}
New-Item -ItemType Directory -Path $pkgDir -Force | Out-Null
Copy-Item -Path (Join-Path $reactDir "dist\*") -Destination $pkgDir -Recurse -Force

$iconSrc = Join-Path $reactDir "public\icon.png"
if (Test-Path -LiteralPath $iconSrc) {
    Copy-Item -LiteralPath $iconSrc -Destination (Join-Path $pkgDir "icon.png") -Force
}

$configXml = @"
<?xml version="1.0" encoding="UTF-8"?>
<widget xmlns:tizen="http://tizen.org/ns/widgets" xmlns="http://www.w3.org/ns/widgets" id="http://cinelar.tv/Cinelar" version="2.1.0" viewmodes="fullscreen">
    <access origin="*" subdomains="true"></access>
    <tizen:application id="AprZAARz4r.Cinelar" package="AprZAARz4r" required_version="2.3"/>
    <author href="http://192.168.15.2:8085" email="apps@cinelar.local">Cinelar</author>
    <content src="index.html"/>
    <description>Cinelar TV App para Samsung Smart TV</description>
    <feature name="http://tizen.org/feature/screen.size.normal.1080.1920"/>
    <feature name="http://tizen.org/feature/screen.size.all"/>
    <icon src="icon.png"/>
    <tizen:metadata key="http://tizen.org/metadata/app_ui_type/base_screen_resolution" value="extensive"/>
    <name>Cinelar</name>
    <tizen:privilege name="http://developer.samsung.com/privilege/productinfo"/>
    <tizen:privilege name="http://tizen.org/privilege/tv.inputdevice"/>
    <tizen:privilege name="http://tizen.org/privilege/internet"/>
    <tizen:profile name="tv"/>
    <tizen:setting screen-orientation="landscape" context-menu="enable" background-support="disable" encryption="disable" install-location="auto" hwkey-event="enable" pointing-device-support="disable"/>
</widget>
"@
Set-Content -LiteralPath (Join-Path $pkgDir "config.xml") -Value $configXml -Encoding UTF8

Write-Host "[3/5] Empacotando e assinando WGT com perfil '$SigningProfile'..." -ForegroundColor Cyan
& $tzTool pack -w $pkgDir -t wgt -s $SigningProfile
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao assinar o pacote Tizen (codigo $LASTEXITCODE). Verifique o perfil '$SigningProfile'."
}

$builtWgt = Join-Path $pkgDir "Debug\tizen-package.wgt"
if (-not (Test-Path -LiteralPath $builtWgt)) {
    throw "Falha: pacote WGT nao gerado em $builtWgt"
}
Copy-Item -LiteralPath $builtWgt -Destination $wgtOut -Force
$wgtSize = (Get-Item -LiteralPath $wgtOut).Length / 1KB
Write-Host "Pacote WGT assinado: $wgtOut ($([Math]::Round($wgtSize, 1)) KB)" -ForegroundColor Green

if ($Deploy) {
    Write-Host "[4/5] Conectando e instalando na Samsung Smart TV ($TvIp)..." -ForegroundColor Cyan
    & $sdbTool connect $TvIp
    if ($LASTEXITCODE -ne 0) {
        throw "Falha na conexao SDB com $TvIp (codigo $LASTEXITCODE)."
    }
    & $tzTool install -e $TvIp -p $wgtOut
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao instalar o Cinelar na TV (codigo $LASTEXITCODE)."
    }

    if ($Launch) {
        Write-Host "[5/5] Iniciando Cinelar na TV..." -ForegroundColor Cyan
        & $tzTool run -e $TvIp -p AprZAARz4r
        if ($LASTEXITCODE -ne 0) {
            throw "Falha ao iniciar o Cinelar na TV (codigo $LASTEXITCODE)."
        }
        Write-Host "Cinelar iniciado com sucesso na TV!" -ForegroundColor Green
    }
}
