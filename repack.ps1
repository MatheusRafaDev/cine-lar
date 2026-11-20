$tizenDir = "c:\Users\rafae\Documents\GitHub\jellyfin-tizen"
$outDir = "c:\Users\rafae\Documents\GitHub\matheus-flix"
$wgtPath = Join-Path $outDir "MatheusFlix.wgt"
$signedWgtPath = Join-Path $outDir "MatheusFlix-signed.wgt"
$tzPath = "C:\Users\rafae\.tizen-extension-platform\server\sdktools\data\tools\tizen-core\tz.exe"

Write-Host "Criando arquivo MatheusFlix.wgt..."
if (Test-Path $wgtPath) { Remove-Item $wgtPath -Force }
if (Test-Path $signedWgtPath) { Remove-Item $signedWgtPath -Force }

# Compactar conteudo de jellyfin-tizen para MatheusFlix.wgt (zip format)
Set-Location $tizenDir
$zipPath = Join-Path $outDir "MatheusFlix.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path config.xml, icon.png, index.html, tizen.js, www -DestinationPath $zipPath -Force
Rename-Item $zipPath "MatheusFlix.wgt" -Force

Write-Host "Assinando com perfil Matheus..."
& $tzPath pack -t wgt -s Matheus -b $wgtPath -o $signedWgtPath

Write-Host "Finalizado com sucesso: $signedWgtPath"
