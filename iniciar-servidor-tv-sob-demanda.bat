@echo off
chcp 65001 >nul
title Cine Lar - Servidor de Streaming Sob Demanda para TV
cls
echo ========================================================
echo        CINE LAR TV - SERVIDOR SOB DEMANDA (SMART TV)
echo ========================================================
echo.
echo [INFO] Porta do Servidor de Streaming Torrent: 8085
echo.
echo ========================================================
echo Verificando Servidor de Torrents Sob Demanda...
tasklist /fi "imagename eq node.exe" 2>nul | find /i "node.exe" >nul
if "%ERRORLEVEL%"=="0" (
    echo [OK] Servico de Torrents, Catalogo e Web TV ja esta ativo na porta 8085.
) else (
    echo [INICIANDO] Abrindo servico de streaming e catalogo sob demanda...
    cd /d "%~dp0torrent-service"
    start "Cinelar Torrent Streamer" /min node server.js
    cd /d "%~dp0"
)

echo.
echo ========================================================
echo STATUS: Servidor pronto para uso na sua Smart TV Samsung!
echo.
echo - Streaming Sob Demanda: Ao clicar em um filme ou episodio
echo   na TV, o video comeca a tocar em poucos segundos via rede.
echo - Suporte a reproducao direta na TV via app nativo ou navegador.
echo ========================================================
echo Pressione qualquer tecla para fechar esta janela (o servidor continuara ativo).
pause >nul
