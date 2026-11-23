@echo off
chcp 65001 >nul
cls
echo =======================================================
echo          CINE LAR TV - INSTALADOR PARA SMART TV
echo =======================================================
echo.
echo Pacote gerado:
echo [Arquivo] %~dp0Cinelar-signed.wgt
echo [Servidor Web e API] http://192.168.15.9:8085
echo [Download direto na rede] http://192.168.15.9:8085/download/Cinelar.wgt
echo.
echo =======================================================
echo ESCOLHA COMO DESEJA INSTALAR NA SUA TV:
echo =======================================================
echo.
echo [1] Metodo Oficial Samsung (Tizen Studio / SDB via Developer Mode)
echo [2] Metodo Mais Rapido: Navegador Web da TV (Sem instalar nada)
echo [3] Testar conexao com a Smart TV (IP: 192.168.15.5)
echo [4] Abrir pasta do pacote Cinelar-signed.wgt
echo [5] Sair
echo.
set /p opcao="Digite a opcao desejada (1-5): "

if "%opcao%"=="1" goto tizen_install
if "%opcao%"=="2" goto browser_method
if "%opcao%"=="3" goto ping_tv
if "%opcao%"=="4" goto open_folder
if "%opcao%"=="5" exit /b
goto fim

:tizen_install
cls
echo =======================================================
echo PASSO A PASSO: INSTALACAO VIA TIZEN / MODO DESENVOLVEDOR
echo =======================================================
echo.
echo 1. Na sua Smart TV Samsung, abra o aplicativo APPS.
echo 2. No controle remoto, digite a sequencia: 1 2 3 4 5
echo 3. A janela "Developer Mode" vai abrir:
echo    - Mude para "ON" (Ligado).
echo    - No campo "Host PC IP", digite o IP deste computador.
echo 4. Reinicie a Smart TV (segure o botao Power do controle por 5s
echo    ate o logo da Samsung reaparecer).
echo.
echo 5. No computador:
where sdb >nul 2>&1
if %errorlevel% equ 0 (
    echo SDB detectado! Conectando na TV...
    sdb connect 192.168.15.5
    echo Instalando Cinelar-signed.wgt...
    if exist "%~dp0Cinelar-signed.wgt" (
        tizen install -n "%~dp0Cinelar-signed.wgt"
    ) else (
        echo [AVISO] Execute build-tv.ps1 primeiro para gerar Cinelar-signed.wgt
    )
) else (
    echo [AVISO] O comando SDB/Tizen Studio nao esta instalado no Windows PATH.
    echo Voce pode executar .\build-tv.ps1 no PowerShell para compilar e instalar automaticamente!
)
echo.
pause
goto fim

:browser_method
cls
echo =======================================================
echo METODO RAPIDO: NAVEGADOR DA SMART TV (100%% FUNCIONAL)
echo =======================================================
echo.
echo 1. Na sua Smart TV, abra o aplicativo "Internet" (Navegador).
echo 2. Digite na barra de enderecos:
echo.
echo    http://192.168.15.9:8085
echo.
echo 3. O Cine Lar carregara imediatamente com:
echo    - Layout TV completo (10-foot UI adaptada para controle remoto).
echo    - Player cinematografico com retomada automatica.
echo    - Suporte a nuvem Google Drive e torrents sob demanda.
echo.
echo 4. DICA DE OURO: No menu de opcoes do navegador da TV (tres pontinhos),
echo    clique em "Adicionar a Tela Inicial" ou "Fixar na barra de apps".
echo    Um icone do Cine Lar sera criado direto na barra principal da TV!
echo.
pause
goto fim

:ping_tv
cls
echo =======================================================
echo TESTANDO CONEXAO COM A SMART TV (192.168.15.5)...
echo =======================================================
echo.
ping 192.168.15.5 -n 4
echo.
pause
goto fim

:open_folder
explorer.exe /select,"%~dp0Cinelar-signed.wgt"
goto fim

:fim
exit /b
