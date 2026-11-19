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
|             jellyfin-web (Porta 8080 - Webpack)              |
|                                                              |
|  - Roteamento e Modulos Cinelar TV                           |
|  - Player de Video com Controles OSD Inteligentes            |
|  - Modais de Detalhes e Gerenciamento de Preferencias        |
+------------------------------+-------------------------------+
                               |
            +------------------+------------------+
            | HTTP / REST                         | HTTP / API
            v                                     v
+-------------------------------+   +--------------------------+
|      SERVICO DE TORRENT       |   |     JELLYFIN SERVER      |
|    torrent-service (Porta 8085) |   |    (Porta 8096)          |
|                               |   |                          |
|  - Engine WebTorrent          |   |  - Servidor de Midia     |
|  - Streaming Sequencial HTTP  |   |  - Transcode Suporte     |
|  - Scanner de Midia Local     |   |  - Autenticacao Base     |
|  - Banco de Dados SQLite      |   +--------------------------+
|  - Organizador de Franquias   |
+---------------+---------------+
                |
                v
+-------------------------------+
|      DISCO LOCAL (STORAGE)    |
|       (Ex.: D:\filmes)        |
+-------------------------------+
```

---

## 3. Modulos do Frontend (`jellyfin-web`)

O frontend reside no diretorio `jellyfin-web/` e e baseado na estrutura do Jellyfin Web, enriquecido com controladores independentes para a experiencia MatheusFlix:

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

---

### 5.4. Biblioteca Local

#### `GET /api/local-movies`
Varre e lista todos os arquivos de video armazenados na pasta configurada.

#### `POST /api/local-movies/rescan`
Forca uma nova varredura completa do disco local.

#### `DELETE /api/local/file`
Exclui um arquivo de video do disco local.
- **Corpo:**
```json
{
  "filePath": "D:\\filmes\\FilmeExemplo.mp4"
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
- **Indicador de Foco TV:** Contorno de alta visibilidade `outline: 3px solid #FAF9F5; outline-offset: 3px; transform: scale(1.04);` em qualquer elemento selecionado via controle remoto.
- **Proporcao de Cartazes:** Cartazes de filmes mantem proporcao rigida `aspect-ratio: 2 / 3` com cantos arredondados em 14px.

### 6.3. Tipografia Editorial
- **Newsreader (Display Serif):** Utilizada em títulos de destaque hero, nomes de obras cinematográficas, cabeçalhos de modais e no wordmark da marca (`MATHEUSFLIX`), conferindo sofisticação editorial e acabamento de cinema.
- **Inter (Interface Sans-serif):** Utilizada em todos os rótulos de navegação, metadados (resolução, ano, duração, sementes), tabelas de downloads, chips e controles funcionais para máxima legibilidade a distância na TV.

### 6.4. Identidade Visual e Favicons
- **Emblema do Sistema:** Insígnia em formato squircle (cantos suavizados) com gradiente vermelho cinematográfico `#E50914` a terracota `#D97757` e monograma 'M' estilizado em corte geométrico.
- **Wordmark da Barra Superior:** Componente `.mf-header-logo` com transição suave, hover dinâmico e foco via D-Pad para retorno instantâneo à página inicial.
- **Favicons e PWA:** Conjunto completo de ícones incluindo `favicon.svg` vetorial, `favicon.ico` multi-resolução (16x16 e 32x32), ícones de toque Apple (180x180, 144x144, 114x114, 72x72) e manifest para Smart TVs e PWA (192x192 e 512x512).

---

## 7. Guia de Instalacao e Implantacao

### 7.1. Pre-requisitos
- Sistema operacional Windows 10/11 ou Linux x64.
- Node.js instalado (versao 18 ou superior).
- Jellyfin Server instalado localmente.

### 7.2. Passo a Passo de Execucao
1. Clone o projeto para o diretorio desejado.
2. No diretorio `torrent-service`, execute `npm install`.
3. No diretorio `jellyfin-web`, execute `npm install`.
4. Execute o script `iniciar-matheusflix.bat` na raiz ou inicialize os terminais individualmente.
5. Abra o navegador ou dispositivo em `http://localhost:8080`.

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
