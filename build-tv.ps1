# Script de Build e Deploy do MatheusFlix para Samsung Smart TV (Tizen)
param (
    [string]$TvIp = "192.168.15.5:26101",
    [switch]$Deploy = $true,
    [switch]$Launch = $true
)

$ErrorActionPreference = "Stop"
$rootDir = $PSScriptRoot
$reactDir = Join-Path $rootDir "react-tv-app"
$pkgDir = Join-Path $rootDir "tizen-package"
$wgtOut = Join-Path $rootDir "MatheusFlix-signed.wgt"
$tzTool = "C:\Users\rafae\.tizen-extension-platform\server\sdktools\data\tools\tizen-core\tz.exe"
$sdbTool = "C:\Users\rafae\.tizen-extension-platform\server\sdktools\data\tools\sdb.exe"

Write-Host "[1/5] Compilando React TV App..." -ForegroundColor Cyan
Set-Location $reactDir
npm run build

Write-Host "[2/5] Preparando diretorio do pacote Tizen..." -ForegroundColor Cyan
if (Test-Path $pkgDir) { Remove-Item $pkgDir -Recurse -Force }
New-Item -ItemType Directory -Path $pkgDir -Force | Out-Null

Copy-Item -Path (Join-Path $reactDir "dist\*") -Destination $pkgDir -Recurse -Force
Copy-Item -Path "c:\Users\rafae\Documents\GitHub\jellyfin-tizen\icon.png" -Destination $pkgDir -Force

$configXml = @"
<?xml version="1.0" encoding="UTF-8"?>
<widget xmlns:tizen="http://tizen.org/ns/widgets" xmlns="http://www.w3.org/ns/widgets" id="http://jellyfin.org/Jellyfin" version="2.0.0" viewmodes="fullscreen">
    <access origin="*" subdomains="true"></access>
    <tizen:application id="AprZAARz4r.Jellyfin" package="AprZAARz4r" required_version="2.3"/>
    <author href="http://192.168.15.9:8085" email="apps@matheusflix.local">MatheusFlix</author>
    <content src="index.html"/>
    <description>MatheusFlix React TV App para Samsung Smart TV</description>
    <feature name="http://tizen.org/feature/screen.size.all"/>
    <icon src="icon.png"/>
    <tizen:metadata key="http://tizen.org/metadata/app_ui_type/base_screen_resolution" value="fullscreen"/>
    <name>MatheusFlix</name>
    <tizen:privilege name="http://developer.samsung.com/privilege/productinfo"/>
    <tizen:privilege name="http://tizen.org/privilege/tv.inputdevice"/>
    <tizen:privilege name="http://tizen.org/privilege/internet"/>
    <tizen:profile name="tv"/>
    <tizen:setting screen-orientation="landscape" context-menu="enable" background-support="disable" encryption="disable" install-location="auto" hwkey-event="enable"/>
</widget>
"@
Set-Content -Path (Join-Path $pkgDir "config.xml") -Value $configXml -Encoding UTF8

Write-Host "[3/5] Empacotando e assinando WGT com perfil Matheus..." -ForegroundColor Cyan
& $tzTool pack -w $pkgDir -t wgt -s Matheus

$builtWgt = Join-Path $pkgDir "Debug\tizen-package.wgt"
if (-not (Test-Path $builtWgt)) {
    throw "Falha: pacote WGT nao gerado em $builtWgt"
}
Copy-Item $builtWgt $wgtOut -Force

$wgtSize = (Get-Item $wgtOut).Length / 1KB
Write-Host "Pacote WGT assinado com sucesso: $([Math]::Round($wgtSize, 1)) KB" -ForegroundColor Green

if ($Deploy) {
    Write-Host "[4/5] Instalando na Samsung Smart TV ($TvIp)..." -ForegroundColor Cyan
    & $sdbTool connect $TvIp
    & $tzTool install -e $TvIp -p $wgtOut

    if ($Launch) {
        Write-Host "[5/5] Iniciando MatheusFlix na TV..." -ForegroundColor Cyan
        & $tzTool run -e $TvIp -p AprZAARz4r
        Write-Host "MatheusFlix iniciado com sucesso na TV!" -ForegroundColor Green
    }
}
