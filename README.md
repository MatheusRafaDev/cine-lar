# MatheusFlix - Plataforma de Streaming Cinematografico e Hub de Midia

MatheusFlix e uma solucao integrada de entretenimento residencial e streaming sob demanda desenvolvida sob a filosofia de design Cinelar TV. O sistema une a robustez do ecossistema Jellyfin a um motor dedicado de descoberta, indexacao e transmissao sequencial de torrents via WebTorrent em tempo real, proporcionando uma experiencia fluida de navegacao em TVs e monitores de alta resolucao.

---

## Indice

- [Visao Geral](#visao-geral)
- [Arquitetura do Sistema](#arquitetura-do-sistema)
- [Telas e Modulos](#telas-e-modulos)
- [Design System Cinelar TV](#design-system-cinelar-tv)
- [Requisitos do Sistema](#requisitos-do-sistema)
- [Instalacao e Execucao](#instalacao-e-execucao)
- [Variaveis de Ambiente](#variaveis-de-ambiente)
- [API de Servicos](#api-de-servicos)
- [Atalhos de Teclado e Controle Remoto](#atalhos-de-teclado-e-controle-remoto)
- [Licenca](#licenca)

---

## Visao Geral

O MatheusFlix transforma a reproducao de midia local e distribuida em uma experiencia cinematografica premium. Com interface adaptada para navegacao D-Pad (10-foot UI) e foco absoluto na usabilidade:

- **Transmissao Instantanea de Torrents:** Permite assistir a filmes e series enquanto o download e realizado em segundo plano, utilizando buffer sequencial inteligente.
- **Indexacao Local Inteligente:** Monitora pastas locais (ex.: `D:\filmes`), categorizando automaticamente franquias, sagas e arquivos de alta definicao.
- **Catalogo Integrado:** Exibe titulos em alta, sinopses oficiais, classificacoes IMDb e versoes disponiveis (Dublado PT-BR, Legendado, 1080p, 4K UHD).
- **Sem Friccao de Contas:** Operacao local direta sem barreiras desnecessarias de autenticacao para o uso domestico.

---

## Arquitetura do Sistema

A solucao e composta por tres modulos principais desacoplados que operam de forma orquestrada:

```
+-------------------------------------------------------------------+
|                   MatheusFlix Frontend (Porta 8080)               |
|      Jellyfin Web Customizado + React + TypeScript + SCSS         |
|                     Design System Cinelar TV                      |
+---------------------------------+---------------------------------+
                                  |
            +---------------------+---------------------+
            |                                           |
            v                                           v
+-----------------------+                   +-----------------------+
|  Torrent & Discovery  |                   |    Jellyfin Server    |
|  Service (Porta 8085) |                   |      (Porta 8096)     |
|   Node.js + Express   |                   | Servidor de Midia e   |
|   WebTorrent Engine   |                   | Transcodificacao Base |
|   SQLite (movies.db)  |                   +-----------------------+
+-----------------------+
            |
            v
+-----------------------+
| Armazenamento Local   |
| (Ex.: D:\filmes)      |
+-----------------------+
```

1. **Frontend (`jellyfin-web`):**
   - Servidor Webpack Dev Server na porta 8080.
   - Camada visual baseada no Jellyfin Web com tema customizado Cinelar Dark.
   - Navegacao nativa por abas globais, modais cinematograficos e player OSD dedicado.

2. **Backend de Streaming e Descoberta (`torrent-service`):**
   - Servico Node.js assincrono na porta 8085.
   - Gerencia downloads sequenciais, endpoints HTTP Range para reproducao de video, gravacao em disco e indexacao SQLite.

3. **Servidor Jellyfin Base (`jellyfin.exe`):**
   - Executado na porta 8096 para gestao estrutural de usuarios, metadados complementares e biblioteca nativa.

---

## Telas e Modulos

O sistema implementa com fidelidade as 8 telas especificadas no design Cinelar TV:

| Tela | Modulo | Descricao |
|---|---|---|
| 1. Inicio | `homeSectionsEmbed.js` | Banner hero em destaque, fileiras de recomendacoes, ultimos lancamentos e acesso rapido. |
| 2. Hub de Torrents | `streamingView.js` | Catalogo de buscas, integracao com addons de streaming e filtros em pilula por categoria. |
| 3. Pasta Local | `localFolderView.js` | Biblioteca de arquivos locais organizados em colecoes e franquias para reproducao direta. |
| 4. Downloads | `downloadsView.js` | Painel de progresso de downloads com medicao de velocidade, sementes e estado do disco. |
| 5. Detalhes | `stremioDetail.js` | Ficha tecnica completa com sinopse, pontuacao IMDb, generos e selecao de versoes e qualidades. |
| 6. Player | `cinemaPlayer.js` | Player cinematografico com suporte a D-Pad, barra de progresso em tempo real e selecao de faixas. |
| 7. Perfil | `user/settings/index.tsx` | Informacoes do perfil ativo, preferencias de audio/legendas e selecao da pasta de armazenamento. |
| 8. Cabecalho | `libraryMenu.js` | Topbar persistente com logotipo, navegacao estruturada e indicador de foco contextualmente respeitado. |

---

## Design System Cinelar TV

Construido para telas grandes e televisores, priorizando legibilidade a 3 metros de distancia e ausencia de polution visual.

- **Paleta de Cores:**
  - Base de Fundo: `#141413`
  - Superficie de Cards: `#1E1D1B`
  - Borda Sutil: `rgba(250, 249, 245, 0.1)`
  - Destaque Ativo / Marca: `#E50914`
  - Texto Principal: `#FAF9F5`
  - Texto Secundario / Muted: `#A8A59C`
- **Foco TV (D-Pad):**
  - Contorno de foco: `outline: 3px solid #FAF9F5; outline-offset: 3px; transform: scale(1.04);`
- **Tipografia:**
  - Newsreader / Georgia para titulos editoriais e secoes de destaque.
  - Inter para metadados, informacoes tecnicas e controles.

---

## Requisitos do Sistema

- **Sistema Operacional:** Windows 10/11 (ou Linux/macOS com adaptacao de caminhos).
- **Node.js:** Versao 18.0.0 ou superior (recomendado Node.js 20 LTS).
- **NPM:** Versao 9.0.0 ou superior.
- **Jellyfin Server:** Instalacao local do Jellyfin Server (padrao em `C:\Program Files\Jellyfin\Server\`).
- **Armazenamento:** Minimo de 20 GB livres para cache e downloads (padrao em `D:\filmes`).

---

## Instalacao e Execucao

### 1. Clonar o Repositorio

```bash
git clone https://github.com/MatheusRafaDev/matheus-flix.git
cd matheus-flix
```

### 2. Instalar Dependencias

Instalar as dependencias do servico backend:
```bash
cd torrent-service
npm install
cd ..
```

Instalar as dependencias da interface web:
```bash
cd jellyfin-web
npm install
cd ..
```

### 3. Inicializacao Rapida (Windows)

Execute o arquivo de lote fornecido na raiz:
```bash
iniciar-matheusflix.bat
```

Este script inicia em segundo plano:
1. Jellyfin Server (`http://localhost:8096`)
2. Backend Torrent Service (`http://localhost:8085`)
3. MatheusFlix Web UI (`http://localhost:8080`)

### 4. Inicializacao Manual por Modulo

Se desejar iniciar cada servico separadamente:

**Terminal 1 - Backend Torrent:**
```bash
cd torrent-service
node server.js
```

**Terminal 2 - Frontend:**
```bash
cd jellyfin-web
npm start
```

Acesse a interface no navegador ou Smart TV em: `http://localhost:8080`.

---

## Variaveis de Ambiente

O servico backend pode ser configurado por meio do arquivo `torrent-service/.env` ou `config.json`:

| Variavel | Padrao | Descricao |
|---|---|---|
| `PORT` | `8085` | Porta HTTP do servico de torrent e streaming |
| `SAVE_PATH` | `D:\filmes` | Diretorio padrao para armazenamento dos arquivos |
| `JELLYFIN_URL` | `http://localhost:8096` | Endereco do servidor Jellyfin local |
| `JELLYFIN_USER` | `usuario` | Usuario administrativo padrao do Jellyfin |
| `JELLYFIN_PW` | `10092004` | Senha padrao do usuario Jellyfin |

---

## API de Servicos

O backend expoe endpoints REST para integracao completa com o frontend:

### Status e Configuracoes
- `GET /api/status` - Verifica conectividade dos servicos e espaco em disco.
- `GET /api/settings/save-path` - Retorna a pasta de downloads configurada.
- `POST /api/settings/save-path` - Atualiza a pasta de downloads no servidor.

### Catalogo e Streaming
- `GET /api/movies` - Retorna o catalogo de filmes indexados no banco SQLite.
- `GET /api/movies/trending` - Retorna lista de titulos em alta no momento.
- `GET /api/torrents/search?q={termo}` - Busca torrents com suporte a streams dublados e legendados.
- `GET /api/stream/:infoHash` - Transmite o video sequencial com suporte a HTTP Range (206 Partial Content).
- `GET /api/stream/:infoHash/status` - Retorna porcentagem de buffer, velocidade e conexoes ativas.

### Gerenciador de Downloads
- `GET /api/downloads` - Lista todos os downloads ativos e concluidos.
- `POST /api/downloads/start` - Inicia um novo download via magnet link.
- `DELETE /api/downloads/:infoHash` - Cancela o download e opcionalmente remove arquivos locais.

### Midia Local
- `GET /api/local-movies` - Lista todos os filmes e series encontrados na pasta local.
- `POST /api/local-movies/rescan` - Dispara uma nova varredura completa no disco.
- `DELETE /api/local/file` - Exclui um arquivo do disco permanentemente.

---

## Atalhos de Teclado e Controle Remoto

A interface foi projetada para utilizacao total por controle remoto TV (D-Pad) ou teclado convencional:

| Tecla / Botao | Acao |
|---|---|
| Setas Direcionais / D-Pad | Navegacao entre cards, menus e controles de tela |
| Enter / OK | Selecionar item, iniciar reproducao ou abrir detalhes |
| Backspace / ESC / Voltar | Fechar modal, fechar player ou retornar a tela anterior |
| Espaco | Pausar ou retomar reproducao de video |
| Seta Esquerda (no Player) | Retroceder 10 segundos no video |
| Seta Direita (no Player) | Avancar 10 segundos no video |
| Seta Cima / Baixo (no Player) | Ajustar volume do video em tempo real (+/- 10%) |
| M | Ativar ou desativar o mudo (silenciar) |
| F | Alternar modo tela cheia (Fullscreen) |
| S | Alternar faixas de legendas e idioma de audio |
| C | Ciclar velocidade de reproducao (0.75x, 1.0x, 1.25x, 1.5x) |
| P | Modo Miniplayer flutuante (Picture-in-Picture) |
| / (Barra) | Acesso direto a barra de busca de torrents |
| ? ou H | Abrir guia de atalhos e controle remoto em overlay |

---

## Licenca

Projeto desenvolvido para uso pessoal e customizacao open-source sob os termos da licenca do Jellyfin Web (GNU General Public License v2.0).
