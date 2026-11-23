# Cine Lar TV 🎬
### Plataforma Cinematográfica Residencial para Smart TVs, Web e Dispositivos Conectados

[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0.1-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Samsung Tizen](https://img.shields.io/badge/Samsung-Tizen_TV-1428A0?style=for-the-badge&logo=samsung&logoColor=white)](https://developer.samsung.com/smarttv)
[![WebTorrent](https://img.shields.io/badge/WebTorrent-2.5-E74C3C?style=for-the-badge&logo=bittorrent&logoColor=white)](https://webtorrent.io/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL_Engine-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![Google Drive](https://img.shields.io/badge/Google_Drive-Cloud_Stream-4285F4?style=for-the-badge&logo=googledrive&logoColor=white)](https://drive.google.com/)

O **Cine Lar TV** é uma solução completa de entretenimento residencial cinematográfico desenvolvida especificamente para telas grandes (Smart TVs Samsung Tizen, LG WebOS, Android TV, TV Boxes) e navegadores modernos. 

O sistema integra uma interface fluida no padrão **10-foot UI** (otimizada para controle remoto D-Pad) a um poderoso motor backend em **Node.js** com streaming sob demanda via WebTorrent, indexação automática de pastas locais (`D:\Filmes`), organização inteligente de franquias, legendas em tempo real e integração direta com o Google Drive para streaming sem necessidade de computador ligado.

---

## 📑 Índice

- [1. Visão Geral e Filosofia](#1-visão-geral-e-filosofia)
- [2. Arquitetura Técnica do Sistema](#2-arquitetura-técnica-do-sistema)
- [3. Módulos e Telas da Aplicação](#3-módulos-e-telas-da-aplicação)
- [4. Recursos de Destaque e Performance](#4-recursos-de-destaque-e-performance)
- [5. Requisitos do Sistema](#5-requisitos-do-sistema)
- [6. Instalação e Execução Rápida](#6-instalação-e-execução-rápida)
- [7. Como Instalar e Rodar na Smart TV](#7-como-instalar-e-rodar-na-smart-tv)
  - [Método A: Navegador da TV (Mais Rápido e Sem Instalação)](#método-a-navegador-da-tv-mais-rápido-e-sem-instalação)
  - [Método B: Pacote Nativo (.wgt) para Samsung Smart TV](#método-b-pacote-nativo-wgt-para-samsung-smart-tv)
- [8. Variáveis de Ambiente e Configuração](#8-variáveis-de-ambiente-e-configuração)
- [9. Referência Completa da API REST](#9-referência-completa-da-api-rest)
- [10. Atalhos de Teclado e Controle Remoto TV](#10-atalhos-de-teclado-e-controle-remoto-tv)
- [11. Estrutura de Diretórios](#11-estrutura-de-diretórios)
- [12. Solução de Dúvidas Frequentes (FAQ)](#12-solução-de-dúvidas-frequentes-faq)
- [13. Licença](#13-licença)

---

## 1. Visão Geral e Filosofia

O Cine Lar TV foi projetado para transformar a experiência de assistir filmes e séries em casa:

1. **Zero Fricção de Contas:** Elimina telas de login, senhas e cadastros desnecessários para o ambiente residencial. Favoritos, histórico e progresso são gerenciados localmente com sincronização transparente.
2. **Navegação D-Pad Fluida:** Navegação espacial bidimensional nativa com cálculo de posições em tempo real, memória de foco entre transições e rolagem desacoplada sem gargalos de reflow na TV.
3. **Reprodução Sob Demanda:** Comece a assistir instantaneamente via streaming sequencial HTTP Range enquanto o download é finalizado em segundo plano.
4. **Ecossistema Híbrido:** Reproduza arquivos físicos do seu HD/SSD local (`D:\Filmes`), transmita torrents com sementes ativas ou reproduza arquivos sincronizados na sua pasta do Google Drive.
5. **Servidor Único e Leve:** O backend serve tanto a API quanto a interface web estática com compressão Gzip e cache agressivo na mesma porta (`8085`).

---

## 2. Arquitetura Técnica do Sistema

A solução opera de maneira desacoplada e otimizada:

```
+-----------------------------------------------------------------------------------+
|                        CLIENTES / SMART TV / NAVEGADORES                          |
|   - Samsung Smart TV (App Tizen Nativo Cinelar-signed.wgt ~696 KB)               |
|   - Navegador Smart TV Samsung / WebOS / Android TV (http://<IP_DO_PC>:8085)     |
|   - Computador Desktop / Celular / Tablet (http://<IP_DO_PC>:8085)                |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          | HTTP / REST / Range / WebSocket
                                          v
+-----------------------------------------------------------------------------------+
|               CINE LAR BACKEND & STREAMING SERVICE (PORTA 8085)                   |
|  - Servidor Web Estático Embutido (react-tv-app/dist com compressão Gzip)         |
|  - Engine WebTorrent (Downloads sequenciais e streaming direto de vídeo)          |
|  - Transcoder e Remux MKV->MP4 sob demanda via FFmpeg                             |
|  - Conversor de Legendas SRT -> WebVTT em tempo real (/api/local/subtitle)        |
|  - Scanner Local Inteligente de Vídeos e Metadados TMDB                           |
|  - Organizador de Sagas e Franquias                                               |
|  - Banco de Dados SQLite em modo WAL (movies.db com cache em RAM)                 |
+-----------------------------------------+-----------------------------------------+
                                          |
                +-------------------------+-------------------------+
                |                                                   |
                v                                                   v
+-------------------------------+                   +-------------------------------+
|     ARMAZENAMENTO FÍSICO      |                   |     GOOGLE DRIVE (NUVEM)      |
|    - Pasta Local D:\Filmes    |                   |    - Pasta Cinelar no Drive   |
|    - Pasta de Downloads       |                   |    - Streaming HTTPS Direto   |
|      (D:\Filmes\Cinelar)      |                   |    - Cache Offline Local      |
+-------------------------------+                   +-------------------------------+
```

---

## 3. Módulos e Telas da Aplicação

A interface conta com as seguintes seções estruturadas no Design System Cinelar TV:

| Tela / Módulo | Arquivo Principal | Descrição |
|---|---|---|
| **1. Início (Home)** | `src/views/HomeView.jsx` | Banner Hero em destaque dinâmico, linha "Continuar Assistindo" com tempo restante, "Minha Lista", "Filmes em Alta", "Séries Populares" e catálogo rápido. |
| **2. Filmes** | `src/views/MoviesView.jsx` | Catálogo amplo dividido por gêneros (Ação, Ficção Científica, Animação, Comédia, Terror, etc.) com pre-fetching automático. |
| **3. Séries** | `src/views/SeriesView.jsx` | Catálogo de séries, permitindo explorar temporadas, episódios individuais e download de packs completos. |
| **4. Minha Lista** | `src/views/FavoritesView.jsx` | Grid de 8 colunas com os filmes e séries marcados como favoritos pelo usuário, sincronizados no SQLite e em cache offline. |
| **5. Pasta Local** | `src/views/LocalFolderView.jsx` | Biblioteca de arquivos físicos de `D:\Filmes` com abas para **Pasta Local**, **Nuvem (Google Drive)** e **Franquias Agrupadas** (Marvel, Harry Potter, etc.). |
| **6. Downloads** | `src/views/DownloadsView.jsx` | Painel de controle de downloads ativos e finalizados com velocidade em MB/s, sementes ativas, barra de progresso, botão pausar/retomar e telemetria de espaço livre em disco. |
| **7. Busca** | `src/views/SearchView.jsx` | Teclado virtual adaptado para TV com busca instantânea debounced e recomendações por Inteligência Artificial. |
| **8. Detalhes** | `src/components/MovieDetailsModal.jsx` | Ficha técnica completa, sinopse, classificação etária, backdrop HD, lista de versões/qualidades (Dublado, 1080p, 4K) e seletores de episódios para séries. |
| **9. Player** | `src/components/CinemaPlayer.jsx` | Player OSD profissional com controles de D-Pad, scrubbing progressivo, avanço de 10s/1m/5m, volume em tempo real, suporte a legendas externas (.srt) e memorização de ponto de parada. |
| **10. Ações Rápidas** | `src/components/QuickActionsModal.jsx` | Menu contextual aberto ao segurar o botão OK no controle remoto (Favoritar, Ver Detalhes, Excluir do disco, etc.). |
| **11. Nuvem Drive** | `src/components/DriveConfigModal.jsx` | Modal de configuração do Google Drive (Folder ID e API Key opcional) para streaming direto sem precisar do computador. |

---

## 4. Recursos de Destaque e Performance

* ⚡ **Servidor Web Estático com Gzip Embutido:** O próprio `server.js` na porta 8085 entrega os bundles comprimidos da aplicação com cabeçalhos `Cache-Control: immutable`, dispensando Vite Dev Server ou servidores HTTP secundários.
* 🚀 **Pré-carregamento Inteligente (0ms de Troca de Abas):** Após renderizar a Home, o cliente pré-carrega os catálogos de Filmes e Séries em background durante os ciclos ociosos do navegador. Ao navegar entre as abas pelo controle remoto, a troca é instantânea.
* 🎯 **Zero Reflow Engine no D-Pad:** Ao focar nos cards em carrosséis horizontais, a rolagem utiliza cálculo direto de `offsetLeft` sem disparar múltiplos recálculos de layout (`scrollIntoView` forçado), garantindo 60 FPS estáveis mesmo em processadores ARM de baixo consumo das TVs Samsung.
* 💬 **Conversão Automática de Legendas SRT -> WebVTT:** O backend detecta legendas locais `.srt` ou `.vtt` pareadas com o arquivo de vídeo e as converte em tempo real para WebVTT, injetando uma faixa `<track>` utilizável em qualquer navegador ou Smart TV.
* 📦 **Agrupamento Automático de Franquias:** Varre o disco e detecta padrões de nomes agrupando automaticamente coleções (ex: *Harry Potter*, *John Wick*, *Star Wars*, *Senhor dos Anéis*) em carrosséis exclusivos.
* 💾 **Persistência SQLite WAL:** O banco de dados local utiliza `PRAGMA journal_mode = WAL`, `PRAGMA synchronous = NORMAL` e cache em memória RAM, executando leituras e gravações em menos de 1 milissegundo.

---

## 5. Requisitos do Sistema

- **Sistema Operacional:** Windows 10/11 (ou Linux/macOS com ajustes de caminhos).
- **Node.js:** Versão 18.0.0 ou superior (Node.js 20 LTS recomendado).
- **FFmpeg e FFprobe (Opcional, mas Recomendado):**
  - Utilizado para detecção de codecs e remux MKV->MP4 sob demanda.
  - Reconhecido automaticamente em `C:\ffmpeg\bin\ffmpeg.exe` ou via `PATH` do sistema.
- **Armazenamento:** Mínimo de 10 GB livres recomendados para downloads (pasta padrão configurável em `D:\Filmes`).
- **Smart TV (para instalação nativa .wgt):** Samsung Smart TV modelo 2017 a 2026 com Modo Desenvolvedor ativo e perfil de certificado Tizen configurado.

---

## 6. Instalação e Execução Rápida

### 1. Clonar o Repositório
```bash
git clone https://github.com/MatheusRafaDev/matheus-flix.git cine-lar
cd cine-lar
```

### 2. Instalação de Dependências
Instale as dependências dos dois módulos do projeto:
```bash
# Dependências do Backend
cd torrent-service
npm install

# Dependências do Frontend React TV
cd ../react-tv-app
npm install
cd ..
```

### 3. Inicialização Unificada (Windows)
Basta dar dois cliques no script:
```cmd
iniciar-cinelar.bat
```
Este script:
1. Valida o ambiente Node.js.
2. Compila a interface React TV (`npm run build`) caso a pasta `dist` ainda não exista.
3. Inicia o serviço de torrents e servidor web na porta `8085`.
4. Descobre o endereço IP local da máquina na rede Wi-Fi/Ethernet.
5. Abre o Cine Lar no navegador padrão em `http://localhost:8085`.

---

## 7. Como Instalar e Rodar na Smart TV

Existem dois métodos para desfrutar do Cine Lar na sua televisão:

### Método A: Navegador da TV (Mais Rápido e Sem Instalação)
*Recomendado para uso imediato em qualquer Smart TV (Samsung, LG, Philips, TCL, Android TV, Fire TV, Chromecast).*

1. No computador, certifique-se de que o Cine Lar foi iniciado pelo `iniciar-cinelar.bat`.
2. Anote o IP exibido na janela do terminal (exemplo: `192.168.15.2`).
3. Na sua Smart TV, abra o aplicativo **Internet** (Navegador Web da TV).
4. Na barra de endereços do navegador, digite:
   ```text
   http://192.168.15.2:8085
   ```
5. A interface completa do Cine Lar abrirá imediatamente com suporte ao controle remoto da TV.
6. **Dica de Ouro:** No menu do navegador da TV (ícone de 3 pontinhos), clique em **"Adicionar à Tela Inicial"** ou **"Fixar na barra de aplicativos"**. Um atalho do Cine Lar aparecerá diretamente na tela principal da televisão!

---

### Método B: Pacote Nativo (.wgt) para Samsung Smart TV
*Para quem deseja o aplicativo instalado como app nativo Tizen no sistema operacional da Samsung TV.*

#### Passo 1: Habilitar o Modo Desenvolvedor na TV Samsung
1. No controle remoto da TV, abra a tela de **Apps**.
2. Com a tela de Apps aberta, pressione a sequência numérica no controle: `1` `2` `3` `4` `5`.
3. O popup **Developer Mode** será exibido:
   - Mude o botão para **ON**.
   - No campo **Host PC IP**, digite o endereço IP do seu computador (ex.: `192.168.15.2`).
4. Pressione **OK**.
5. Reinicie a TV segurando o botão Power do controle remoto por 5 segundos até o logotipo da Samsung aparecer na tela.

#### Passo 2: Compilar e Enviar o Pacote com 1 Comando
No PowerShell do computador, execute:
```powershell
.\build-tv.ps1 -TvIp "192.168.15.5:26101"
```
*(Substitua `192.168.15.5` pelo endereço IP da sua televisão).*

O script executará automaticamente:
- A compilação minificada do React TV App.
- O empacotamento assinado do arquivo `Cinelar-signed.wgt` (~696 KB).
- A conexão via SDB e instalação direta na Samsung Smart TV.
- A inicialização automática do app na TV.

---

## 8. Variáveis de Ambiente e Configuração

As configurações podem ser definidas no arquivo `torrent-service/.env` ou através do `torrent-service/config.json`:

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `8085` | Porta HTTP do serviço de backend, API e Web TV |
| `HOST` | `0.0.0.0` | Endereço de escuta da rede |
| `SAVE_PATH` | `D:\Filmes` | Diretório raiz para varredura e download de mídias |
| `TMDB_API_KEY` | *(opcional)* | Chave da API do TheMovieDB para capas e sinopses em PT-BR |
| `MUTATION_API_TOKEN` | *(opcional)* | Token de segurança para operações de renomeação/exclusão |
| `ALLOWED_MUTATION_ORIGINS`| *(opcional)* | Lista de origens permitidas para requisições de alteração |
| `FFMPEG_PATH` | *(auto)* | Caminho customizado para o executável `ffmpeg.exe` |
| `FFPROBE_PATH` | *(auto)* | Caminho customizado para o executável `ffprobe.exe` |

---

## 9. Referência Completa da API REST

O backend expõe uma suíte completa de endpoints REST:

### Status e Plataforma
- `GET /api/status` - Retorna o estado do servidor, espaço livre em disco (GB) e contagem de torrents ativos.
- `GET /api/settings/save-path` - Retorna a pasta de salvamento atual configurada.
- `POST /api/settings/save-path` - Altera a pasta de salvamento e dispara varredura do disco.
- `GET /download/Cinelar.wgt` - Permite baixar o pacote instalável Tizen diretamente pela rede.

### Catálogo e Descoberta
- `GET /api/movies?genre={genero}&limit={qtd}&offset={pos}` - Lista filmes do catálogo SQLite.
- `GET /api/movies/trending` - Retorna os títulos em alta sincronizados com metadados em português.
- `GET /api/genres` - Lista os gêneros disponíveis com contagens.
- `GET /api/movies/search?q={termo}` - Busca títulos por palavra-chave ou termo fonético.
- `GET /api/movies/poster?imdbId={id}&title={titulo}&year={ano}` - Descobre capa oficial de títulos sem poster.
- `POST /api/movies/ai-recommendations` - Consulta assistente inteligente de recomendações.

### Séries e Episódios
- `GET /api/series/meta?imdbId={id}` - Retorna metadados completos da série (temporadas e episódios).
- `GET /api/torrents?imdbId={id}&type=series&season={s}&episode={e}` - Obtém streams para um episódio específico.
- `GET /api/series/season-torrents?imdb={id}&season={s}` - Busca packs completos da temporada inteira.
- `POST /api/series/download-season` - Inicia download organizado de uma temporada inteira.

### Streaming e Legendas
- `GET /api/stream/:infoHash?magnet={uri}` - Transmite o vídeo do torrent via HTTP Range (206 Partial Content).
- `GET /api/stream/:infoHash/status` - Telemetria do stream: velocidade, porcentagem de buffer e peers conectados.
- `POST /api/stream/:infoHash/stop` - Libera recursos do torrent de streaming sob demanda.
- `GET /api/local/stream?file={caminho}` - Transmissão de vídeo local direto ou remux MKV->MP4.
- `GET /api/local/subtitle?file={caminho}` - Lê legenda local (.srt/.vtt) e entrega em formato WebVTT com CORS.

### Gerenciador de Downloads
- `GET /api/downloads` - Lista todos os downloads ativos, pausados e concluídos.
- `POST /api/downloads/start` - Inicia um novo download permanente a partir de magnet link.
- `POST /api/downloads/:id/pause` - Pausa um download ativo.
- `POST /api/downloads/:id/resume` - Retoma um download pausado.
- `DELETE /api/downloads/:infoHash?deleteFiles={true|false}` - Cancela o download com opção de remover arquivos.

### Mídia Local e Franquias
- `GET /api/local-movies` - Retorna a biblioteca física categorizada em franquias, filmes avulsos e séries.
- `POST /api/local-movies/rescan` - Força re-varredura completa do disco rígido.
- `DELETE /api/local/file?path={caminho}` - Exclui um arquivo do computador permanentemente.
- `POST /api/local/rename` - Renomeia arquivos e legendas associadas mantendo organização.

### Usuário e Nuvem (Google Drive)
- `GET /api/user/favorites?userId={id}` - Lista filmes e séries favoritos salvos no SQLite.
- `POST /api/user/favorites/toggle` - Adiciona ou remove item da lista de favoritos.
- `POST /api/user/progress` - Salva posição e progresso de reprodução.
- `GET /api/user/history` - Obtém histórico recente de visualizações.
- `DELETE /api/user/history?movieId={id}` - Remove título do Continuar Assistindo.
- `GET /api/gdrive/files?folderId={id}` - Lista arquivos de vídeo da pasta do Google Drive.

---

## 10. Atalhos de Teclado e Controle Remoto TV

A aplicação foi rigorosamente calibrada para operação completa por controle remoto D-Pad ou teclado de computador:

| Botão / Tecla | Contexto | Ação Realizada |
|---|---|---|
| **D-Pad / Setas Direcionais** | Menus e Telas | Navegação espacial entre abas, botões e cards de filmes |
| **Enter / OK Central** | Cards | Abre o modal de detalhes do filme ou série |
| **Enter / OK Central** | Botões | Confirma a ação em foco (Assistir, Download, Favoritar) |
| **Segurar Enter / OK (400ms)** | Cards | Abre o **Menu de Ações Rápidas** contextual |
| **Voltar / ESC / Backspace** | Modais / Player | Fecha o modal de detalhes, fecha o player ou sobe para o menu superior |
| **Play / Pause / Espaço** | Geral / Player | Alterna entre reprodução e pausa do vídeo |
| **Seta Esquerda / Direita** | No Player | Retrocede ou avança no vídeo (com aceleração de 10s até 3 min) |
| **Seta Cima / Baixo** | No Player | Ajusta o volume do áudio em tempo real (+/- 10%) |
| **Tecla S** | No Player | Ativa ou desativa as legendas em português |
| **Tecla F** | No Player | Alterna modo tela cheia (Fullscreen) |
| **Tecla M** | No Player | Silencia o som (Mudo) |

---

## 11. Estrutura de Diretórios

```
cine-lar/
├── react-tv-app/                     # Interface Web e Smart TV em React 18 + Vite
│   ├── public/
│   │   └── icon.png                  # Ícone oficial do aplicativo na TV
│   ├── src/
│   │   ├── components/               # Componentes modulares
│   │   │   ├── CarouselRow.jsx       # Trilho horizontal com rolagem suave
│   │   │   ├── CinemaPlayer.jsx      # Reprodutor OSD com suporte a legendas e D-Pad
│   │   │   ├── DriveConfigModal.jsx  # Configuração da nuvem Google Drive
│   │   │   ├── Header.jsx            # Barra superior persistente e navegação por abas
│   │   │   ├── HeroBanner.jsx        # Banner de destaque de alta definição
│   │   │   ├── LocalMovieCard.jsx    # Card para vídeos salvos no disco local
│   │   │   ├── MovieCard.jsx         # Card padrão de filme com poster e notas
│   │   │   ├── MovieDetailsModal.jsx # Ficha técnica, seletores de episódios e streams
│   │   │   └── QuickActionsModal.jsx # Menu de contexto de clique longo
│   │   ├── hooks/
│   │   │   └── useSpatialNav.js      # Motor de navegação espacial D-Pad (Zero Reflow)
│   │   ├── services/
│   │   │   └── api.js                # Cliente REST com memória em RAM e offline fallback
│   │   ├── styles/
│   │   │   ├── fonts.css             # Fontes locais Plus Jakarta Sans e Material Icons
│   │   │   └── tv.css                # Folha de estilo completa do Design System Cinelar TV
│   │   ├── views/                    # Visualizações principais do aplicativo
│   │   │   ├── DownloadsView.jsx     # Painel de transferências
│   │   │   ├── FavoritesView.jsx     # Minha Lista em grade de 8 colunas
│   │   │   ├── HomeView.jsx          # Tela inicial
│   │   │   ├── LocalFolderView.jsx   # Pasta local, franquias e nuvem
│   │   │   ├── MoviesView.jsx        # Catálogo de filmes
│   │   │   ├── SearchView.jsx        # Busca com teclado virtual adaptado para TV
│   │   │   └── SeriesView.jsx        # Catálogo de séries
│   │   ├── App.jsx                   # Orquestrador central e gerenciador de estados
│   │   └── main.jsx                  # Ponto de entrada React
│   ├── package.json
│   └── vite.config.js                # Configuração do Vite com suporte a navegadores legados
│
├── torrent-service/                  # Backend Node.js de Streaming e Descoberta
│   ├── aiSearch.js                   # Módulo de sugestões inteligentes de títulos
│   ├── config.json                   # Configurações de pastas e persistência local
│   ├── db.js                         # Gerenciamento SQLite em modo WAL de alta performance
│   ├── localScanner.js               # Leitor recursivo de discos, codecs e legendas
│   ├── organizer.js                  # Agrupador automático de sagas e franquias
│   ├── seeder.js                     # Sincronizador de catálogo inicial
│   ├── server.js                     # Servidor HTTP: API REST, Servidor Web e Conversor VTT
│   ├── tmdbHelper.js                 # Integração com APIs de metadados em português
│   └── package.json
│
├── tizen-package/                    # Estrutura do Pacote Samsung Smart TV (Tizen)
│   ├── config.xml                    # Manifesto de privilégios e permissões de TV
│   ├── icon.png                      # Ícone de exibição no menu de apps da Samsung
│   └── tizen_web_project.yaml        # Configuração do SDK Tizen
│
├── build-tv.ps1                      # Script PowerShell de build e deploy automático na TV
├── iniciar-cinelar.bat               # Inicializador unificado rápido do Cine Lar
├── iniciar-matheusflix.bat           # Atalho compatível para iniciar o Cine Lar
├── iniciar-servidor-tv-sob-demanda.bat# Inicializador dedicado de streaming para TV
├── instalar-na-tv.bat                # Assistente interativo para instalação na Smart TV
├── COMO_INSTALAR_NA_TV.md            # Guia passo a passo ilustrado para televisores
└── README.md                         # Documentação técnica completa
```

---

## 12. Solução de Dúvidas Frequentes (FAQ)

### O navegador da minha Smart TV não abre o endereço `http://<IP>:8085`?
1. Verifique se o computador e a Smart TV estão conectados na mesma rede Wi-Fi ou cabo de rede.
2. Certifique-se de que a rede no Windows está definida como **Rede Privada** (se estiver como Pública, o Firewall do Windows pode bloquear as conexões de entrada na porta 8085).
3. Se necessário, adicione uma regra de permissão no Firewall do Windows para a porta TCP `8085`.

### Como fazer o filme carregar legendas externas automaticamente?
Basta colocar o arquivo de legenda com a extensão `.srt` ou `.vtt` na mesma pasta do vídeo com o mesmo nome base do arquivo.
*Exemplo:*
- `D:\Filmes\Avatar 2 (2022)\Avatar.2.1080p.mkv`
- `D:\Filmes\Avatar 2 (2022)\Avatar.2.1080p.srt`
O Cine Lar detectará a legenda automaticamente e exibirá o botão de legendas no reprodutor.

### Posso usar o Cine Lar no celular ou tablet?
Sim! O Cine Lar é totalmente responsivo. Ao acessar `http://<IP_DO_PC>:8085` no Safari (iOS) ou Chrome (Android), a interface funciona perfeitamente com suporte a toque e modo tela cheia.

### O download continua se eu fechar o navegador da TV?
Sim. Todo o gerenciamento de downloads, buffer e gravação é executado pelo serviço de segundo plano `torrent-service` no computador. Você pode desligar a TV ou fechar o navegador que os downloads continuarão normalmente.

---

## 13. Licença

Este projeto é desenvolvido para uso pessoal e customização livre. Sinta-se à vontade para expandir, sugerir melhorias e criar novas integrações!
