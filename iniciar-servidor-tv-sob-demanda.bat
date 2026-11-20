@echo off
title MatheusFlix - Servidor de Streaming Sob Demanda para TV
cls
echo ========================================================
echo        MATHEUSFLIX - SERVIDOR SOB DEMANDA (SMART TV)
echo ========================================================
echo.
echo [INFO] IP Local do Computador: 192.168.15.9
echo [INFO] Porta do Servidor Jellyfin: 8096
echo [INFO] Porta do Servidor de Streaming Torrent: 8085
echo.
echo ========================================================
echo 1. Verificando Servidor Jellyfin...
tasklist /fi "imagename eq jellyfin.exe" 2>NUL | find /i /n "jellyfin.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [OK] Servidor Jellyfin ja esta rodando na porta 8096.
) else (
    echo [INICIANDO] Abrindo Jellyfin Server em segundo plano...
    start "Jellyfin Server" /min "C:\Program Files\Jellyfin\Server\jellyfin.exe" --datadir "C:\ProgramData\Jellyfin\Server" -w "%~dp0jellyfin-web\dist"
)

echo.
echo 2. Verificando Servidor de Torrents Sob Demanda...
tasklist /fi "imagename eq node.exe" 2>NUL | find /i /n "node.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [OK] Servico de Torrents e Catalogo ja esta ativo na porta 8085.
) else (
    echo [INICIANDO] Abrindo servico de torrents sob demanda...
    cd /d "%~dp0torrent-service"
    start "MatheusFlix Torrent Streamer" /min node server.js
)

echo.
echo ========================================================
echo STATUS: Servidor pronto para uso na sua Smart TV Samsung!
echo.
echo - Streaming Sob Demanda: Ao clicar em um filme ou episodio
echo   na TV, o video comeca a tocar em poucos segundos via rede.
echo - Nao e necessario digitar IP, usuario ou senha na TV.
echo ========================================================
echo Pressione qualquer tecla para fechar esta janela (os servicos continuarao ativos).
pause >nul
