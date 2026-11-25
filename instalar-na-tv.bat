@echo off
chcp 65001 >nul
cls
echo =======================================================
echo          CINE LAR TV - INSTALADOR PARA SMART TV
echo =======================================================
echo.
echo Pacote: %~dp0Cinelar-signed.wgt
echo Servidor: http://IP_DO_COMPUTADOR:8085
echo.
echo A opcao 1 compila, assina e envia o pacote.
echo Escolha uma opcao:
echo [1] Compilar, instalar e abrir em Samsung Tizen
echo [2] Ver instrucoes para abrir pelo navegador da TV
echo [3] Testar conexao com a Smart TV
echo [4] Abrir pasta do pacote WGT
echo [5] Sair
echo.
set /p opcao="Digite a opcao (1-5): "

if "%opcao%"=="1" goto tizen_install
if "%opcao%"=="2" goto browser_method
if "%opcao%"=="3" goto ping_tv
if "%opcao%"=="4" goto open_folder
if "%opcao%"=="5" exit /b
goto fim

:tizen_install
cls
echo =======================================================
echo INSTALACAO NATIVA PARA SAMSUNG TIZEN
echo =======================================================
echo.
echo Ative o Developer Mode na TV e informe o IP exibido no menu de Rede.
echo O endereco pode incluir uma porta, por exemplo: 192.168.15.5:26101
echo.
set /p tv_ip="IP da TV: "
if "%tv_ip%"=="" goto fim
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-tv.ps1" -TvIp "%tv_ip%" -Deploy -Launch
echo.
pause
goto fim

:browser_method
cls
echo =======================================================
echo ABRIR PELO NAVEGADOR DA SMART TV
echo =======================================================
echo.
echo 1. No computador, execute iniciar-cinelar.bat e localize o IP da rede.
echo 2. Abra o navegador da TV e acesse http://IP_DO_COMPUTADOR:8085
echo 3. Navegue com as setas e o botao OK do controle remoto.
echo 4. Se o navegador oferecer, fixe o atalho do Cinelar na tela inicial.
echo.
pause
goto fim

:ping_tv
cls
echo Informe o IP da TV (sem a porta):
set /p tv_ip="IP da TV: "
if "%tv_ip%"=="" goto fim
ping %tv_ip% -n 4
echo.
pause
goto fim

:open_folder
if exist "%~dp0Cinelar-signed.wgt" (
    explorer.exe /select,"%~dp0Cinelar-signed.wgt"
) else (
    echo Pacote nao encontrado. Execute build-tv.ps1 primeiro.
    pause
)
goto fim

:fim
exit /b
