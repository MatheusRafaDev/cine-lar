# Cine Lar TV - Plataforma Cinematográfica para Smart TV e Web

**Cine Lar** é uma solução completa de entretenimento cinematográfico residencial para Smart TVs (Samsung Tizen, WebOS, Android TV) e navegadores. O sistema combina uma interface de TV profissional de 10 pés (10-foot UI) desenvolvida em **React 18 + Vite** com um motor backend de streaming sob demanda via WebTorrent, indexação de biblioteca física local (`D:\Filmes`) e suporte a nuvem (Google Drive).

---

## 🌟 Principais Recursos

- **Interface Nativa de Smart TV (10-Foot UI):** Desenvolvida sob o design system Cinelar Dark, otimizada para controle remoto (D-Pad), com estados de foco fluidos, zero reflow e aceleração por hardware.
- **Transmissão Instantânea Sob Demanda:** Assista a torrents e filmes locais sequencialmente com buffer inteligente e suporte a HTTP Range 206 e remux MKV->MP4 sob demanda.
- **Servidor Web Estático Embutido:** O backend na porta `8085` serve a aplicação web com compressão Gzip e cache inteligente para qualquer aparelho na rede (TV, smartphone, notebook, tablet).
- **Legendas Automáticas:** Detecção automática de legendas locais `.srt` / `.vtt` com conversão instantânea para WebVTT e controle liga/desliga no controle remoto.
- **Nuvem Google Drive:** Streaming direto de filmes salvos no Google Drive sem necessidade de manter o computador ligado.
- **Biblioteca Local e Franquias:** Organização automática de sagas e franquias (Marvel, Harry Potter, Star Wars, etc.) e filmes avulsos do disco.
- **Zero Fricção de Contas:** Histórico de reprodução, progresso salvo e lista de favoritos sincronizados no SQLite local sem exigir login.

---

## 🏗️ Arquitetura do Sistema

```
+-------------------------------------------------------------------------+
|                  Cine Lar TV Frontend (React 18 + Vite)                 |
|  - Empacotado para Samsung Smart TV (Cinelar-signed.wgt ~696 KB)        |
|  - Servido diretamente pelo backend em http://localhost:8085            |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|              Backend: Torrent & Streaming Service (Porta 8085)           |
|  - Engine WebTorrent (Downloads sequenciais e streaming de vídeo)       |
|  - Servidor de Arquivos Estáticos com compressão Gzip                   |
|  - Endpoint de Legendas SRT -> WebVTT em tempo real                     |
|  - Scanner Local (D:\Filmes) e organizador de Franquias                 |
|  - Banco de Dados SQLite de alta velocidade (WAL mode)                  |
|  - Integração com Google Drive (Nuvem Cinelar)                          |
+-------------------------------------------------------------------------+
                                     |
              +----------------------+----------------------+
              |                                             |
              v                                             v
+---------------------------+                 +---------------------------+
| Armazenamento Local       |                 | Google Drive (Nuvem)      |
| (Ex.: D:\Filmes\Cinelar)  |                 | (Streaming direto na TV)  |
+---------------------------+                 +---------------------------+
```

---

## 🚀 Como Executar

### 1. Inicialização Rápida (Recomendado)
Basta dar dois cliques no arquivo:
```cmd
iniciar-cinelar.bat
```
O script verifica o ambiente, compila a interface caso necessário, inicia o backend de streaming e abre o Cine Lar no navegador em `http://localhost:8085`.

### 2. Acesso em Qualquer Dispositivo na Rede
Na Smart TV (pelo aplicativo Navegador de Internet), no celular ou tablet conectados ao mesmo Wi-Fi, acesse:
```
http://<IP_DO_COMPUTADOR>:8085
```
*Dica:* No navegador da TV, clique nos 3 pontinhos e selecione "Adicionar à Barra de Aplicativos" para ter o Cine Lar como app direto na tela inicial da TV.

### 3. Instalação Nativa na Samsung Smart TV (Tizen)
Para instalar o aplicativo nativo (`.wgt`):
```powershell
.\build-tv.ps1 -TvIp "192.168.15.5:26101"
```
O script compila o React TV App, empacota com o perfil Matheus e instala diretamente na TV Samsung via SDB.

---

## 🎮 Controles no Teclado e Controle Remoto

| Tecla / Botão | Ação |
|---|---|
| **D-Pad / Setas** | Navegação espacial entre cards, abas e controles |
| **Enter / OK** | Selecionar item, iniciar reprodução ou abrir modal |
| **Voltar / ESC / Backspace** | Fechar modal, fechar player ou subir para o menu superior |
| **Play/Pause / Espaço** | Alternar entre pausar e reproduzir vídeo |
| **Seta Esquerda / Direita (Player)** | Retroceder / Avançar 10s (com aceleração progressiva) |
| **Seta Cima / Baixo (Player)** | Ajustar volume do vídeo (+/- 10%) |
| **S (no Player)** | Alternar legendas (Ativar / Desativar legenda em PT-BR) |
| **Segurar OK (Cards)** | Abrir Menu de Ações Rápidas (Favoritar, Excluir do disco, Detalhes) |

---

## 📁 Estrutura de Pastas

```
cine-lar/
├── react-tv-app/          # Interface React 18 moderna para Smart TV
│   ├── src/components/    # Header, HeroBanner, CinemaPlayer, MovieDetailsModal, etc.
│   ├── src/views/         # HomeView, MoviesView, SeriesView, DownloadsView, LocalFolderView
│   └── src/services/api.js# Cliente API com cache em memória e sincronização offline
├── torrent-service/       # Backend Node.js de alta velocidade
│   ├── server.js          # API REST + Servidor Web estático + Conversor WebVTT
│   ├── localScanner.js    # Varredura inteligente de D:\Filmes e mediainfo
│   ├── db.js              # SQLite com PRAGMA WAL e índices otimizados
│   └── organizer.js       # Agrupamento automático de franquias e séries
├── tizen-package/         # Pacote de build para Tizen Samsung TV
├── build-tv.ps1           # Script PowerShell de build e deploy para TV
├── iniciar-cinelar.bat    # Inicializador unificado do Cine Lar
└── instalar-na-tv.bat     # Assistente de instalação na Smart TV
```

---

## 📄 Licença
Uso pessoal e desenvolvimento livre. Desenvolvido para a melhor experiência de cinema em casa.
