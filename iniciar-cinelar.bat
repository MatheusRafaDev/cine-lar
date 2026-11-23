@echo off
chcp 65001 >nul
title Cine Lar - Servidor e Plataforma de Streaming TV
cls
echo ========================================================
echo               CINE LAR TV - PLATAFORMA INTEGRADA
echo ========================================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao foi detectado no PATH do sistema.
    echo Por favor, instale o Node.js v18+ para continuar.
    pause
    exit /b 1
)

:: Verifica se a interface React TV já foi compilada
if not exist "%~dp0react-tv-app\dist\index.html" (
    echo [1/2] Compilando interface Cine Lar TV pela primeira vez...
    cd /d "%~dp0react-tv-app"
    call npm run build
    cd /d "%~dp0"
)

:: Verifica se o backend já está ativo na porta 8085
tasklist /fi "imagename eq node.exe" 2>nul | find /i "node.exe" >nul
if %errorlevel% equ 0 (
    echo [OK] Backend Torrent e Servidor Web ja estao ativos na porta 8085.
) else (
    echo [2/2] Iniciando Cinelar Torrent ^& Streaming Service (Porta 8085)...
    cd /d "%~dp0torrent-service"
    start "Cinelar Backend" /min node server.js
    cd /d "%~dp0"
    timeout /t 2 /nobreak >nul
)

:: Obtém IP local na rede
for /f "tokens=4" %%a in ('route print ^| findstr " 0.0.0.0.*0.0.0.0"') do (
    set LOCAL_IP=%%a
    goto :ip_found
)
:ip_found
if "%LOCAL_IP%"=="" set LOCAL_IP=localhost

echo.
echo ========================================================
echo  STATUS: Servicos do Cine Lar iniciados com sucesso!
echo.
echo  - Acesso no Computador:      http://localhost:8085
echo  - Acesso na Smart TV / Rede: http://%LOCAL_IP%:8085
echo  - Pacote Tizen para TV:      %~dp0Cinelar-signed.wgt
echo.
echo  DICA: Na TV Samsung ou celular, basta abrir o navegador
echo  e acessar http://%LOCAL_IP%:8085 para assistir instantaneamente!
echo ========================================================
echo.

:: Abre a interface no navegador padrão do computador
start http://localhost:8085

echo Pressione qualquer tecla para encerrar esta janela (o servidor continuara ativo em segundo plano).
pause >nul
