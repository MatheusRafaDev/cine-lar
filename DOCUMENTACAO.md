# Documentacao Tecnica Completa - MatheusFlix

Esta documentacao descreve a arquitetura interna, o motor de streaming, o modelo de dados, os contratos de API e o design system do sistema **MatheusFlix**.

---

## 1. Visao Geral e Objetivos do Projeto

O MatheusFlix e uma plataforma de entretenimento concebida para integrar streaming de midia local e distribuida em redes P2P sob uma interface de televisao (10-foot UI). 

### Objetivos Fundamentais:
1. **Transmissao em Tempo Real:** Permitir o consumo imediato de conteudos sem a necessidade de aguardar o download integral do arquivo.
2. **Experiencia Cinematografica de TV:** Eliminar interfaces complexas, caixas de dialogo redundantes e elementos com aparencia de geracao por inteligencia artificial, aplicando o design system profissional **Cinelar TV**.
3. **Navegacao Fluida por Controle Remoto:** Total suporte a navegacao direcionada por teclado e D-Pad, com estados de foco evidentes e previsiveis.
4. **Independencia de Nuvem:** Indexacao e armazenamento em discos locais com sincronizacao de metadados de alto desempenho.

---

## 2. Arquitetura Tecnica

A solucao e estruturada em tres camadas funcionais:

```
[ Cliente / TV / Navegador ]
             |
             v
+--------------------------------------------------------------+
|                    CAMADA DE APRESENTACAO                    |
|             react-tv-app (Porta 8085 - Vite + React 18)      |
|                                                              |
|  - Roteamento e Modulos Cinelar TV (10-Foot UI)              |
|  - Animacoes Fluidas de Tela com Framer Motion               |
|  - Player de Video com Controles OSD Inteligentes            |
|  - Modais de Detalhes, Acoes Rapidas e Nuvem Google Drive    |
+------------------------------+-------------------------------+
                               | HTTP / REST (Nativo)
                               v
+--------------------------------------------------------------+
|             BACKEND INTEGRADO & STREAMING PROPRIETARIO       |
|             torrent-service (Porta 8085 - Node.js)           |
|                                                              |
|  - Engine WebTorrent Sequencial para Streaming Instantaneo   |
|  - Scanner de Midia Local (D:\Filmes) e Nuvem (Google Drive) |
|  - Banco de Dados SQLite (Perfis, Favoritos e Historico)     |
|  - Organizador Automatico de Franquias e Series              |
|  - Servidor Web Estatico com Cache e Compressao Gzip         |
+------------------------------+-------------------------------+
                               |
                               v
+--------------------------------------------------------------+
|                      STORAGE & DISCOS                        |
|       - Disco Local (PC): D:\Filmes (266+ GB)                |
|       - Google Drive: G:\Meu Drive\cinelar                   |
+--------------------------------------------------------------+
```

---

## 3. Modulos do Frontend (`react-tv-app`)

O frontend reside no diretorio `react-tv-app/` e foi desenvolvido sob medida para a experiencia Cinelar TV (Smart TVs e Navegadores Modernos):

### 3.1. `homeSectionsEmbed.js` (Tela 1 - Inicio)
- **Funcao:** Renderiza o banner Hero principal com metadados do titulo em destaque (badge de resolucao 4K, audio dublado, nota IMDb) e botoes de acao rapida ("Assistir" e "Mais informacoes").
- **Trilhos Horizontais:** Gera fileiras de filmes organizadas por categorias ("Em Alta", "Lancamentos", "Franquias"), respeitando a proporcao de cartaz 2:3 com efeito de elevacao e borda suave no foco do controle remoto.

### 3.2. `streamingView.js` (Tela 2 - Hub de Torrents)
- **Funcao:** Interface de catalogo e busca de torrents em tempo real.
- **Filtros em Pilula:** Permite selecionar categorias (Filmes, Series, Animacoes) e generos (Acao, Ficcao, Comedia, etc.) atraves de chips discretos.
- **Barra de Pesquisa:** Integrada com debounce para pesquisa instantanea de torrents disponiveis com sementes ativas.

### 3.3. `localFolderView.js` (Tela 3 - Pasta Local)
- **Funcao:** Apresenta os filmes e series ja salvos no disco local (`D:\filmes`).
- **Agrupamento por Sagas:** Agrupa titulos pertencentes a mesma franquia (ex.: Harry Potter, Star Wars, Velozes e Furiosos) com contagem de capitulos e reproducao direta do disco sem buffer de rede.

### 3.4. `downloadsView.js` (Tela 4 - Downloads)
- **Funcao:** Painel de controle de transferencias ativas e historico de downloads concluidos.
- **Metricas Exibidas:** Progresso percentual, velocidade de download/upload, quantidade de peers/sementes e acao direta para reproduzir ou excluir do disco.

### 3.5. `stremioDetail.js` (Tela 5 - Detalhes do Titulo)
- **Funcao:** Ficha tecnica cinematografica em modal sobreposto.
- **Metadados:** Imagem de fundo panoramica (backdrop), sinopse oficial, classificacao etaria, ano de lancamento e tempo de duracao.
- **Selecao de Streams:** Lista as versoes encontradas (Dublado PT-BR, Original Legendado, 1080p, 4K UHD), permitindo iniciar a reproducao imediata ou enfileirar para download.

### 3.6. `cinemaPlayer.js` (Tela 6 - Player Cinematografico)
- **Funcao:** Reprodutor de video baseado em HTML5 customizado com controles OSD otimizados para controle remoto.
- **Recursos:** Barra de tempo com preenchimento em vermelho vivo (`#E50914`), salto de 10 segundos para frente e para tras, seletor de faixas de audio e legendas e reconexao automatica em caso de oscilacao de rede.

### 3.7. `user/settings/index.tsx` (Tela 7 - Perfil e Preferencias)
- **Funcao:** Gestao do perfil ativo do usuario e configuracoes locais.
- **Ajuste de Nome:** Edicao rapida do nome de exibicao do perfil sem exigencia de senhas.
- **Preferencias de Audio e Legenda:** Escolha entre Dublado PT-BR e Audio Original, alem de regras de ativacao de legendas.
- **Pasta de Armazenamento:** Exibicao e configuracao da pasta de gravação de arquivos com persistencia no servico de torrent.

### 3.8. `libraryMenu.js` e `maintabsmanager.js` (Tela 8 - Cabecalho Global)
- **Funcao:** Barra superior unificada persistente.
- **Logotipo:** Identidade `MATHEUSFLIX` em destaque permanente a esquerda.
- **Abas Centrais:** Links diretos para Inicio, Torrents, Pasta Local e Downloads.
- **Contexto de Tela:** Desativa o destaque de abas quando o usuario esta em telas internas (Perfil ou Detalhes) e exibe o botao voltar (`←`).

---

## 4. Servico Backend (`torrent-service`)

O backend e implementado em Node.js nativo utilizando o motor `WebTorrent`:

### 4.1. Mecanismo de Streaming Sequencial
Diferente dos clientes convencionais de torrent que baixam pedacos (pieces) em ordem aleatoria para maximizar a distribuicao na rede, o motor MatheusFlix implementa selecao sequencial:
1. Quando uma reproducao e solicitada via magnet link, o motor conecta aos metadados do torrent e identifica o arquivo de video principal.
2. Os pedacos correspondentes ao cabecalho do video (moov atom em arquivos MP4 ou clusters iniciais em MKV) sao baixados com prioridade maxima.
3. Conforme o player requisita posicoes de video atraves do cabecalho `Range: bytes=inicio-fim`, o backend ajusta a prioridade das pecas subsequentes, mantendo um buffer deslizante de 15 a 30 segundos a frente do ponto de reproducao.
4. Os dados sao transmitidos ao cliente por HTTP com codigo de status `206 Partial Content`.

### 4.2. Persistencia com SQLite (`movies.db`)
O servico utiliza SQLite para indexacao com desempenho de leitura sub-milissegundo:
- **Tabela `movies`:** Armazena titulos locais e catalogo remoto, com titulo, ano, genero, caminho no disco, magnet link, poster e classificacao IMDb.
- **Tabela `user_favorites`:** Registra a lista de filmes marcados pelo usuario.
- **Tabela `watch_history`:** Mantem o ponto de reproducao e tempo assistido para retomar conteudos exatamente de onde parou.
- **Tabela `downloads`:** Controla o estado de downloads persistentes e metricas de transferencia.

---

## 5. Referencia Completa da API REST

O servico responde na porta `8085` com cabecalhos CORS configurados para a interface web.

### 5.1. Status e Sistema

#### `GET /api/status`
Verifica se o backend esta operacional e relata informacoes do sistema.
- **Resposta:**
```json
{
  "status": "online",
  "version": "1.0.0",
  "uptime": 3600,
  "savePath": "D:\\filmes",
  "activeTorrents": 2
}
```

#### `GET /api/settings/save-path`
Retorna a pasta configurada para gravacao de midias.
- **Resposta:**
```json
{
  "savePath": "D:\\filmes"
}
```

#### `POST /api/settings/save-path`
Atualiza a pasta de gravacao de arquivos no servidor.
- **Corpo da Requisicao:**
```json
{
  "savePath": "D:\\NovosFilmes"
}
```
- **Resposta:**
```json
{
  "success": true,
  "savePath": "D:\\NovosFilmes"
}
```

---

### 5.2. Catalogo e Midias

#### `GET /api/movies`
Retorna a lista paginada de filmes indexados no catalogo.
- **Parametros de Consulta:** `page`, `limit`, `genre`, `type`
- **Resposta:**
```json
{
  "movies": [
    {
      "id": "tt1375666",
      "title": "A Origem",
      "year": 2010,
      "rating": "8.8",
      "poster": "https://image.tmdb.org/t/p/w500/...",
      "genres": ["Ficcao Cientifica", "Acao"]
    }
  ],
  "total": 120,
  "page": 1
}
```

#### `GET /api/movies/trending`
Retorna os filmes em alta no momento.

#### `GET /api/torrents/search`
Busca fontes de torrent em tempo real.
- **Parametros:** `q` (termo de busca), `imdb` (opcional).
- **Resposta:**
```json
{
  "streams": [
    {
      "name": "1080p Dublado PT-BR",
      "title": "A.Origem.2010.1080p.Dual.Audio",
      "infoHash": "a1b2c3d4e5f6...",
      "magnet": "magnet:?xt=urn:btih:a1b2c3d4e5f6...",
      "seeds": 45,
      "peers": 8,
      "size": "2.4 GB"
    }
  ]
}
```

---

### 5.3. Streaming e Downloads

#### `GET /api/stream/:infoHash`
Endpoint de streaming de video em tempo real.
- **Cabecalhos Suportados:** `Range: bytes=0-`
- **Codigo de Resposta:** `206 Partial Content` (ou `200 OK` se conteudo total for transmitido).

#### `GET /api/stream/:infoHash/status`
Retorna o estado do buffer de reproducao do torrent especificado.
- **Resposta:**
```json
{
  "ready": true,
  "progress": 0.12,
  "downloadSpeed": 5242880,
  "numPeers": 18
}
```

#### `GET /api/downloads`
Lista os downloads em andamento e concluidos.
- **Resposta:**
```json
{
  "downloads": [
    {
      "infoHash": "a1b2c3d4e5f6...",
      "title": "Interestelar (2014)",
      "progress": 0.65,
      "speed": "4.2 MB/s",
      "seeds": 32,
      "status": "downloading",
      "savePath": "D:\\filmes\\Interestelar.mp4"
    }
  ]
}
```

#### `POST /api/downloads/start`
Inicia um download permanente via magnet link.
- **Corpo:**
```json
{
  "magnet": "magnet:?xt=urn:btih:...",
  "title": "Nome do Filme"
}
```

#### `DELETE /api/downloads/:infoHash`
Cancela um download ativo ou remove o registro da lista.
- **Query Params:**
  - `deleteFiles`: `true` (padrão) para apagar os arquivos baixados do computador; `false` para remover somente o registro da lista mantendo o arquivo no disco.

#### `POST /api/downloads/rename`
Altera o título de exibição de um download ativo ou concluído.
- **Corpo:**
```json
{
  "id": "infoHash",
  "newTitle": "Novo Título do Filme (2024)"
}
```

#### `GET /api/settings/save-path`
Retorna a pasta configurada atualmente para downloads e vídeos locais.

#### `POST /api/settings/save-path`
Altera o diretório raiz de downloads e biblioteca local no computador.
- **Corpo:**
```json
{
  "savePath": "D:\\filmes"
}
```

---

### 5.4. Biblioteca Local

#### `GET /api/local-movies`
Varre e lista todos os arquivos de video armazenados na pasta configurada.

#### `POST /api/local-movies/rescan`
Forca uma nova varredura completa do disco local.

#### `POST /api/local/rename`
Renomeia um arquivo de vídeo (e legendas pareadas) diretamente no disco.
- **Corpo:**
```json
{
  "filePath": "D:\\filmes\\Interestelar.2014.1080p.mp4",
  "newTitle": "Interestelar (2014)"
}
```

#### `DELETE /api/local/file`
Exclui um arquivo de video do disco local, removendo legendas associadas e diretórios vazios.
- **Corpo:**
```json
{
  "path": "D:\\filmes\\FilmeExemplo.mp4"
}
```

---

## 6. Padrao Visual Cinelar TV

O MatheusFlix adota integralmente as diretrizes do **Cinelar TV Design System**:

### 6.1. Paleta Cromatica
- **Superficie de Fundo (`--bg-base`):** `#141413` (preto profundo levemente aquecido, evitando cansaco visual).
- **Cards e Paineis (`--bg-card`):** `#1E1D1B` (cinza escuro texturado).
- **Contornos e Linhas (`--border-line`):** `rgba(250, 249, 245, 0.1)` (delimitacao sutil de bordas).
- **Acento de Marca (`--brand-red`):** `#E50914` (vermelho cinematografico vibrante).
- **Tipografia Primaria (`--text-main`):** `#FAF9F5` (branco marfim de alto contraste).
- **Tipografia Secundaria (`--text-muted`):** `#A8A59C` (cinza neutro para metadados e rotulos).

### 6.2. Componentes e Controles
- **Chips em Pilula:** Elementos com borda arredondada (`border-radius: 999px`), fundo transparente quando inativos e preenchimento total em `#FAF9F5` com tipografia escura `#141413` quando ativos.
- **Menu de Ações Contextual (3 Pontinhos):** Botão discreto com ícone `more_vert` presente nos cartazes da Pasta Local, na lista de Downloads e na linha de arquivo local. Ao ser acionado, abre um menu modal em estilo Cinelar TV para renomear, excluir do disco ou remover do histórico, eliminando a poluição de botões múltiplos na interface.
- **Indicador de Foco TV:** Contorno de alta visibilidade `outline: 3px solid #FAF9F5; outline-offset: 3px; transform: scale(1.04);` em qualquer elemento selecionado via controle remoto.
- **Proporcao de Cartazes:** Cartazes de filmes mantem proporcao rigida `aspect-ratio: 2 / 3` com cantos arredondados em 14px.

### 6.3. Tipografia Moderna de Streaming
- **Outfit (Display & Brand Sans-serif):** Tipografia geométrica moderna e arrojada (estilo Netflix Sans / modern cinema) utilizada no logotipo compacto (`MATHEUSFLIX`), títulos de destaque hero e seções principais, proporcionando acabamento contemporâneo e máxima nitidez em televisores e monitores.
- **Inter (Interface Sans-serif):** Utilizada em todos os rótulos de navegação, abas, metadados (resolução, ano, duração, sementes), tabelas de downloads, chips e controles funcionais para máxima legibilidade a distância na TV.

### 6.4. Identidade Visual e Favicons
- **Emblema Profissional de Streaming (Monograma 3D Ribbon 'M'):** Insignia de alta fidelidade baseada em fitas tridimensionais dobradas com acabamento acetinado em gradiente vermelho carmesim vibrante (`#FF3847`, `#E50914`, `#B20710`), iluminacao especular e sombreamento de profundidade sobre azulejo squircle em grafite escuro (`#121316`) com borda de vidro e backlight sutil.
- **Wordmark da Barra Superior (`.mf-header-logo`):** Componente refinado e proporcional de 15px com kerning amplo de 2px no bloco `MATHEUS` em marfim puro (`#FAF9F5`) e `FLIX` em negrito 900 com preenchimento em gradiente vermelho streaming com text-shadow sutil, eliminando qualquer visual generico ou infantil.
- **Pacote de Favicons e PWA de Alta Resolucao:** Conjunto vetorial `favicon.svg`, `icon.svg` e `logo.svg`, alem de icones rasterizados em alta qualidade (512x512, 192x192, 180x180, 144x144, 114x114, 72x72, 32x32, 16x16) para navegadores desktop, mobile, telas Retina e Smart TVs.

---

## 7. Guia de Instalacao e Implantacao

### 7.1. Pre-requisitos
- Sistema operacional Windows 10/11 ou Linux x64.
- Node.js instalado (versao 22.13.0 ou superior; o backend usa `node:sqlite` sem flags experimentais).

### 7.2. Passo a Passo de Execucao
1. Clone o projeto para o diretorio desejado.
2. No diretorio `torrent-service`, execute `npm install`.
3. No diretorio `react-tv-app`, execute `npm install`.
4. Execute o script `iniciar-cinelar.bat` na raiz do projeto.
5. Acesse no computador em `http://localhost:8085` ou na Smart TV no IP da rede local.

---

## 8. Solucao de Problemas Comuns

### O video nao inicia a reproducao imediata
- **Causa:** O torrent selecionado possui poucas sementes ativas (seeds) na rede ou o cliente ainda nao localizou os pares via DHT.
- **Solucao:** Aguarde entre 5 e 15 segundos para a conexao com os peers ou selecione outra versao de stream disponivel na tela de detalhes.

### A pasta de downloads nao salva no disco correto
- **Causa:** Caminho inexistente ou permissao negada no Windows.
- **Solucao:** Acesse a tela de Perfil (`http://localhost:8080/#!/mypreferencesmenu`), clique em "Alterar pasta" e defina um caminho valido existente (ex.: `D:\filmes`).

### Erro de conexao com o servico na porta 8085
- **Causa:** O processo `node server.js` nao foi iniciado ou outra aplicacao esta ocupando a porta 8085.
- **Solucao:** Verifique se o processo do Node.js esta em execucao atraves do comando `curl http://localhost:8085/api/status`. Se necessario, encerre o processo conflitante e reinicie o servico.

---

## 9. Atalhos de Teclado, Guia TV Remote e Recursos Avancados

O MatheusFlix oferece suporte de primeira classe para operacao por controle remoto de Smart TV (D-Pad), teclados fisicos e controles multimidia sem necessidade de mouse.

### 9.1. Tabela de Mapeamento de Teclas

| Tecla / Botao | Contexto | Acao Executada |
|---|---|---|
| Setas Direcionais / D-Pad | Global | Navegacao espacial entre cards, botoes, trilhos e menus |
| Enter / OK | Global | Confirmar selecao, abrir detalhes ou reproduzir midia |
| Backspace / ESC / Voltar | Modais / Telas | Fechar modal aberto, encerrar player ou voltar tela |
| Espaco | Player | Alternar entre pausar e retomar a reproducao do video |
| Seta Esquerda | Player | Retroceder 10 segundos na linha do tempo |
| Seta Direita | Player | Avancar 10 segundos na linha do tempo |
| Seta Cima / Baixo | Player | Aumentar ou diminuir volume em degraus de 10% |
| M | Player | Alternar mudo (silenciar e restaurar volume) |
| F | Player | Alternar modo de tela cheia (Fullscreen) |
| S | Player | Ciclar entre faixas de legendas e trilhas de audio |
| C | Player | Ciclar velocidade de reproducao (0.75x, 1.0x, 1.25x, 1.5x) |
| P | Player | Ativar modo Miniplayer flutuante (Picture-in-Picture) |
| / (Barra) | Global | Focar instantaneamente no campo de busca de torrents |
| ? ou H | Global / Player | Exibir modal de guia de atalhos e controle remoto |

### 9.2. Recursos Avancados de Reproducao
- **Ciclo de Velocidade Dinamica:** Permite ajustar a cadencia do filme em 0.75x, 1.0x, 1.25x e 1.5x com exibicao de feedback visual temporario no canto superior da tela.
- **Miniplayer Picture-in-Picture (PiP):** Permite continuar acompanhando o conteudo em janela flutuante no sistema enquanto navega em outras aplicacoes.
- **Filtro de Lançamentos em Tempo Real:** Na tela de detalhes (Cinelar Screen 2), chips permitem filtrar instantaneamente as fontes disponiveis por resolucao (4K UHD, 1080p), idioma dublado (PT-BR) ou maior numero de sementes ativas.
- **Overlay de Guia do Controle Remoto:** Dialogo sob medida com design Cinelar destacando os atalhos de controle remoto e teclado para facil consulta a qualquer momento.

---

## 10. Otimizacao e Compatibilidade com Smart TVs Samsung (Tizen OS)

O MatheusFlix foi otimizado para proporcionar uma experiencia fluida, nitida e nativa em televisores Samsung Smart TV executando o sistema operacional Tizen OS (versoes 3.0, 4.0, 5.0, 5.5, 6.0, 6.5, 7.0 e 8.0+), seja atraves do navegador Samsung Internet ou instalado como aplicativo Web Tizen (WGT).

### 10.1. Deteccao de Plataforma e Ativacao Automatica
- **Identificacao Rigorosa:** A deteccao de hardware identifica os padroes de User-Agent `tizen`, `smart-tv`, `smarttv`, `smarthub`, `maple`, alem da presenca dos objetos globais `window.tizen` e `window.webapis`.
- **Ativacao do Modo 10-Foot (`layout-tv`):** Assim que identificado um televisor Samsung, a interface ativa automaticamente a classe `layout-tv`, ajustando tipografia, proporcoes e regras de controle sem necessidade de configuracao manual. Tambem pode ser forcado via parametro de URL `?tv=1` ou chave de armazenamento local.

### 10.2. Margens Seguras de Transmissao (Safe Area & Overscan)
- **Compensacao de Overscan:** Televisores antigos e modernos frequentemente aplicam corte de bordas (overscan de 2.5% a 5%) quando o modo 'Ajustar a Tela' nao esta configurado. O MatheusFlix define margens de seguranca padronizadas (`--tv-safe-x: 3.5vw; --tv-safe-y: 3.5vh;`), garantindo que nenhum cartaz, cabecalho ou botao fique oculto ou cortado.
- **Escala 4K UHD:** Em telas de ultradefinicao (largura acima de 2500px), a safe area expande proporcionalmente para `4.5vw / 4.5vh`, e o tamanho base da fonte e elevado para 24px.

### 10.3. Otimizacao de GPU e Desativacao de Filtros Pesados
- **60 FPS Constantes:** Processadores embarcados de Smart TVs possuem capacidade limitada de preenchimento grafico (fillrate). Filtros Gaussianos em camadas continuas (`backdrop-filter: blur(...)`) provocam quedas severas de taxa de quadros e engasgos no controle remoto durante rolagem horizontal e vertical.
- **Filtros Desativados na TV:** No modo `layout-tv`, `backdrop-filter` e completamente desativado no cabecalho fixo, menu gaveta e modais, substituido por cores solidas de alta densidade (`rgba(20, 20, 19, 0.98)` e `#1E1D1B`), eliminando 100% dos engasgos e liberando a GPU da TV.
- **Composicao Acelerada por Hardware:** Cartazes e trilhos utilizam aceleracao por hardware (`transform: translateZ(0); will-change: transform;`), mantendo transicoes suaves e responsividade instantanea ao D-Pad.

### 10.4. Registro e Suporte de Hardware para Controle Remoto Samsung
- **Registro de Teclas no Tizen (`tvinputdevice`):** O sistema registra explicitamente atraves da API Samsung `window.tizen.tvinputdevice.registerKey(...)` as teclas multimidia e numericas: `MediaPlay`, `MediaPause`, `MediaPlayPause`, `MediaStop`, `MediaFastForward`, `MediaRewind`, `MediaTrackPrevious`, `MediaTrackNext`, 0 a 9 e teclas coloridas (`ColorF0Red` a `ColorF3Blue`).
- **Tratamento da Tecla Return / Voltar (Keycode 10009):** O botao de retorno do controle remoto Samsung envia o codigo numerico `10009` (ou `461` em WebOS). O sistema intercepta o codigo em todos os modais (Detalhes Stremio, Menu 3 Pontinhos, Guia de Atalhos, Dialogo de Confirmacao e CinemaPlayer), garantindo que o retorno feche o componente atual sem fechar ou deslogar o aplicativo.
- **Controles no Player de Cinema:** O `cinemaPlayer.js` reconhece nativamente os keycodes de Play (`415`), Pause (`19`), PlayPause (`10252`), Stop (`413`), FastForward (`417`), Rewind (`412`) e Return (`10009`).

### 10.5. Ergonomia Visual 10-Foot e Foco de Alto Contraste
- **Anel de Foco Nítido:** Qualquer elemento focado pelo controle remoto exibe um contorno de destaque branco puro `outline: 3px solid #FAF9F5; outline-offset: 3px;` acompanhado de elevacao tridimensional e escala `1.05`, assegurando visibilidade imediata mesmo a 3 ou 4 metros do sofa.
- **Rolagem Automatica ao Focar:** Ao navegar entre cartazes com as setas do controle, o item em foco e centralizado suavemente na janela de visualizacao atraves de `scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })`.
- **Tamanho Minimo de Alvo (44px a 48px):** Todos os botoes, chips e itens do menu de 3 pontinhos atendem ao padrao ergonomico minimo de televisores, prevenindo cliques acidentais e facilitando selecoes rapidas.

---

## 11. Gestao de Series: Navegacao de Episodios, Download de Temporada e Organizacao em Pastas

O MatheusFlix conta com suporte dedicado e completo a series de televisao e streaming, otimizando tanto a navegacao no catalogo quanto o armazenamento local organizado e a continuidade de reproducao.

### 11.1. Navegacao Enriquecida por Temporadas e Episodios
- **Abas de Temporadas em Pilulas (`mf-season-pill-btn`):** Substitui seletores suspensos comuns por abas horizontais com contagem de episodios, indicando claramente qual temporada esta ativa e permitindo alternancia instantanea via clique ou setas do controle remoto.
- **Cards Ricos de Episodio (`mf-episode-card`):** Cada episodio e renderizado em um card independente contendo thumbnail em proporcao 16:9, indicador numerico (ex: `E01`), titulo oficial traduzido, sinopse descritiva e botoes de acao direta ("Assistir" e "Baixar").
- **Barra de Navegacao de Episodios:** Botoes de acao rapida ("Episodio Anterior" e "Proximo Episodio") posicionados no topo da lista facilitam o avanco sequencial com rolagem suave automatica.
- **Deteccao de Episodios Salvos Localmente:** Episodios ja presentes no disco do computador sao destacados com um badge verde "Disponivel Localmente", permitindo reproducao direta sem consumo de internet.

### 11.2. Download de Temporada Completa
- **Botao de Destaque por Temporada (`.mf-btn-download-season`):** Localizado acima do carrossel de episodios, exibe a acao "Baixar Temporada X Completa".
- **Busca Especializada de Season Packs (`/api/series/season-torrents`):** O backend consulta indexadores de torrents e filtra pacotes completos da temporada utilizando algoritmos de deteccao de tamanho (>4 GB) e termos-chave como `completa`, `complete`, `season pack` e `s01-s0x`.
- **Modal de Confirmacao Cinelar TV (`confirmSeasonDownloadModal`):** Antes de iniciar o download, uma janela sob medida apresenta os detalhes da operacao: seletor de Season Pack disponivel, qualidade, tamanho estimado, lista de episodios inclusos e o caminho exato de destino em disco.
- **Fallback para Download em Lote (`/api/series/download-season`):** Quando nao ha um torrent unico contendo a temporada inteira empacotada, o servico enfileira automaticamente todos os episodios individuais da temporada, direcionando todos para a mesma pasta raiz da serie.

### 11.3. Estrutura Rigorosa de Organizacao em Disco
Todos os downloads de series sao rigorosamente agrupados pelo padrao oficial:
```text
D:\Filmes\MatheusFlix\Series\<Nome da Serie>\Temporada XX\<Arquivos de Video>
```
- **Limpeza de Nomes (`cleanDirName`):** Remove caracteres proibidos no Windows (`:`, `*`, `?`, `"`, `<`, `>`, `|`) e normaliza acentuacoes.
- **Numeracao Formatada:** Temporadas sao formatadas com dois digitos (ex: `Temporada 01`, `Temporada 02`).
- **Scanner Local Inteligente (`localScanner.js`):** Quando arquivos estao alocados em subpastas de temporada (`Temporada XX`), o scanner herda automaticamente o nome da serie a partir da pasta pai imediata, consultando metadados de series no Cinemeta (`catalog/series/top`) e agrupando todos os episodios na aba "Series" do Acervo Local.

### 11.4. Continuidade de Reproducao no Player de Cinema (`cinemaPlayer.js`)
- **Botao "Proximo Episodio" (`.mf-btn-next-ep`):** Integrado a barra de controles OSD inferior para transicao direta ao proximo capitulo.
- **Card Flutuante Automático nos Ultimos 45 Segundos:** Quando a reproducao atinge os momentos finais do capitulo, um card flutuante surge no canto inferior direito informando o proximo episodio com contagem regressiva e botao "Assistir Agora".
- **Autoplay ao Terminar:** Ao disparar o evento nativo `ended` do video, o player carrega e inicia o proximo episodio da serie de forma continua.
- **Atalho de Teclado e Controle:** Pressionar `Shift + N` durante a reproducao avanca diretamente para o proximo episodio.
- **Compatibilidade Local:** Ao reproduzir series salvas no computador a partir da aba "Pasta Local", a mesma sequencia de proximo episodio permanece ativa entre os arquivos do disco.
