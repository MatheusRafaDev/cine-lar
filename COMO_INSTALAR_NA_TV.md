# Cinelar para Smart TV

O Cinelar usa uma interface de 10 pés e navegação por controle remoto. A versão web roda no navegador da TV; o pacote `.wgt` é direcionado a Samsung Tizen e depende do Tizen TV SDK para assinatura.

## Abrir pelo navegador da TV

1. Inicie o servidor Cine Lar no computador com `iniciar-cinelar.bat`.
2. Confira no terminal o endereço de rede exibido pelo servidor.
3. No navegador da TV, abra `http://IP_DO_COMPUTADOR:8085`.
4. Use as setas e OK do controle. Se o navegador oferecer essa opção, fixe o Cinelar na tela inicial.

A compatibilidade do navegador e dos formatos de vídeo depende do modelo da TV.

## Gerar o pacote Samsung Tizen

Instale o Samsung TV Extension/Tizen SDK e configure um perfil de assinatura no Tizen Studio. No PowerShell, na pasta do projeto, execute:

```powershell
.\build-tv.ps1
```

O script compila o frontend e gera `Cinelar-signed.wgt` na pasta do projeto. Ele procura `tz.exe` e `sdb.exe` no SDK, em `TIZEN_SDK`, `TIZEN_STUDIO`, no PATH e na pasta de extensão Tizen do usuário. Se o SDK estiver em outro local, informe a pasta `tools`:

```powershell
.\build-tv.ps1 -TizenToolsDir "C:\caminho\para\sdktools\data\tools" -SigningProfile "MeuPerfil"
```

O perfil padrão é `Matheus`. Para instalar e iniciar o pacote em uma TV com Developer Mode ativo, informe o IP da TV e solicite essas ações:

```powershell
.\build-tv.ps1 -TvIp "192.168.15.5:26101" -Deploy -Launch
```

Sem `-Deploy`, o script apenas gera o pacote. `-Launch` exige `-Deploy`.

## Controle remoto

| Controle | Ação |
|---|---|
| Setas e OK | Navegar e selecionar |
| Segurar OK | Abrir ações rápidas de um título |
| Voltar | Fechar a tela atual; na página inicial abre confirmação para sair |
| Play/Pause | Controlar a reprodução |
| Stop | Fechar o player |
| Esquerda/direita no player | Retroceder ou avançar na linha do tempo |
| Cima/baixo no player | Navegar entre a linha do tempo e os controles |
| Volume − / Volume + no player | Ajustar o volume do vídeo |
| Teclas físicas de volume da TV | Ajustar o volume geral da TV |
| Tecla S | Alternar legendas disponíveis |
| Botões coloridos | Buscar, Local/Drive, Favoritos e Downloads |

Ao trocar para outro app ou canal, o player salva a posição e pausa. Ao voltar ao Cinelar, retoma se estava reproduzindo antes da troca.
