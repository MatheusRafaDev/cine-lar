@echo off
title MatheusFlix - Iniciar Serviços
echo ========================================================
echo          Iniciando Servicos do MatheusFlix
echo ========================================================

echo [1/3] Iniciando Jellyfin Server com a interface MatheusFlix...
start "Jellyfin Server" /min "C:\Program Files\Jellyfin\Server\jellyfin.exe" --datadir "C:\ProgramData\Jellyfin\Server" -w "%~dp0jellyfin-web\dist"

echo [2/3] Iniciando Torrent & Discovery Service na porta 8085...
cd /d "%~dp0torrent-service"
start "MatheusFlix Backend" /min node server.js

echo [3/3] Iniciando MatheusFlix Web UI na porta 8080...
cd /d "%~dp0jellyfin-web"
start "MatheusFlix Web" /min npm start

echo ========================================================
echo MatheusFlix iniciado com sucesso!
echo Frontend: http://localhost:8080
echo Jellyfin: http://localhost:8096
echo Backend:  http://localhost:8085
echo ========================================================
pause
