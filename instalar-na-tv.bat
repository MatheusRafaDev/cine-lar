@echo off
chcp 65001 >nul
cls
echo =======================================================
echo          MATHEUSFLIX - INSTALADOR PARA SMART TV
echo =======================================================
echo.
echo Pacote gerado com sucesso:
echo [Arquivo] MatheusFlix.wgt (36.5 MB)
echo [Servidor] http://192.168.15.9:8096
echo [Download direto na rede] http://192.168.15.9:8085/download/MatheusFlix.wgt
echo.
echo =======================================================
echo ESCOLHA COMO DESEJA INSTALAR NA SUA TV:
echo =======================================================
echo.
echo [1] Metodo Oficial Samsung (Tizen Studio / SDB via Developer Mode)
echo [2] Metodo Mais Rapido: Navegador Web da TV (Sem instalar nada)
echo [3] Testar conexao com a Smart TV (IP: 192.168.15.5)
echo [4] Abrir pasta do arquivo MatheusFlix.wgt
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
echo    - No campo "Host PC IP", digite: 192.168.15.9
echo 4. Reinicie a Smart TV (segure o botao Power do controle por 5s
echo    ate o logo da Samsung reaparecer).
echo.
echo 5. No computador:
where sdb >nul 2>&1
if %errorlevel% equ 0 (
    echo SDB detectado! Conectando na TV...
    sdb connect 192.168.15.5
    echo Instalando MatheusFlix.wgt...
    tizen install -n MatheusFlix.wgt
) else (
    echo [AVISO] O comando SDB/Tizen Studio nao esta instalado no Windows PATH.
    echo Voce pode instalar o Tizen Studio ou usar o pacote MatheusFlix.wgt
    echo no Tizen Device Manager.
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
echo    http://192.168.15.9:8096
echo.
echo 3. O MatheusFlix carregara imediatamente com:
echo    - Layout Netflix / Cinelar TV completo.
echo    - Stremio Details, Cinema Player e Auto-login.
echo.
echo 4. DICA DE OURO: No menu de opcoes do navegador da TV (tres pontinhos),
echo    clique em "Adicionar a Tela Inicial" ou "Fixar na barra de apps".
echo    Um icone do MatheusFlix sera criado direto na barra principal da TV!
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
explorer.exe /select,"c:\Users\rafae\Documents\GitHub\matheus-flix\MatheusFlix.wgt"
goto fim

:fim
exit /b
