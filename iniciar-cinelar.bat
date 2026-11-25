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
    echo Por favor, instale o Node.js v22.13.0+ para continuar.
    pause
    exit /b 1
)

node -e "const [major, minor] = process.versions.node.split('.').map(Number); if (major < 22 || (major === 22 && minor < 13)) process.exit(1)"
if %errorlevel% neq 0 (
    echo [ERRO] Este backend requer Node.js v22.13.0 ou superior por causa do node:sqlite.
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
netstat -ano | findstr :8085 >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Servidor Cine Lar ja esta ativo na porta 8085.
) else (
    echo [2/2] Iniciando Servidor Cine Lar (Porta 8085)...
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
echo  STATUS: Cine Lar pronto para uso!
echo.
echo  - No Computador:         http://localhost:8085
echo  - Na Smart TV / Celular: http://%LOCAL_IP%:8085
echo.
echo  Origens de Midia Mapeadas:
echo  - Pasta Local (PC):      D:\Filmes
echo  - Google Drive (Nuvem):  G:\Meu Drive\cinelar
echo.
echo  DICA: Na TV Samsung ou celular, basta abrir o navegador
echo  e acessar http://%LOCAL_IP%:8085 para assistir instantaneamente!
echo ========================================================
echo.

:: Abre a interface no navegador padrão do computador
start http://localhost:8085

echo Pressione qualquer tecla para encerrar esta janela (o servidor continuara ativo em segundo plano).
pause >nul
