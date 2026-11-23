# Como Instalar e Usar o Cine Lar na Smart TV 📺

Este guia explica passo a passo como instalar e rodar o **Cine Lar TV** na sua Smart TV (Samsung Tizen, LG WebOS, Android TV e navegadores de TV).

---

## 1. Pacote Instalável Oficial Gerado

O pacote oficial para Samsung Smart TV foi compilado com todas as otimizações do Cine Lar TV (interface em React 18, aceleração por hardware, Stremio Details, Cinema Player OSD e auto-reconexão):

- **Arquivo:** `Cinelar-signed.wgt`
- **Tamanho:** ~696 KB (ultraleve)
- **Localização no PC:** `Cinelar-signed.wgt` (na raiz do projeto)
- **Link de Download Direto na Rede:** `http://<IP_DO_COMPUTADOR>:8085/download/Cinelar.wgt`

---

## 2. Métodos de Instalação e Acesso

### Método A: Navegador da TV (Mais Rápido e Sem Instalar Nada)
*Recomendado para uso imediato em 100% das Smart TVs (Samsung, LG, Philips, TCL, Android TV, Fire TV).*

1. No computador, execute o `iniciar-cinelar.bat` e observe o IP da máquina exibido no console (exemplo: `192.168.15.2`).
2. Na sua Smart TV, abra o aplicativo **Internet** (navegador web padrão da TV).
3. Na barra de endereços do navegador da TV, digite:
   ```text
   http://192.168.15.2:8085
   ```
   *(Substitua pelo IP exibido no terminal do seu PC).*
4. O Cine Lar carregará instantaneamente com toda a interface adaptada para controle remoto, reprodução fluida e design escuro cinematográfico.
5. **Dica de Ouro:** No menu do navegador da TV (ícone de três pontinhos ou estrela), clique em **"Adicionar à Tela Inicial"** ou **"Fixar na barra de aplicativos"**. Um atalho do Cine Lar ficará salvo diretamente na barra principal da sua televisão!

---

### Método B: Instalação Nativa (.wgt) via Modo Desenvolvedor Samsung
*Para instalar o Cine Lar diretamente no menu oficial de aplicativos do sistema Tizen da Samsung.*

#### Passo 1: Habilitar o Modo Desenvolvedor na TV
1. No controle remoto da Smart TV Samsung, abra a tela de **Apps**.
2. Na tela de Apps, aperte os botões numéricos na sequência: `1` `2` `3` `4` `5`.
3. A janela **Developer Mode** aparecerá:
   - Alterne a opção para **ON**.
   - No campo **Host PC IP**, digite o IP do seu computador (exemplo: `192.168.15.2`).
4. Pressione **OK**.
5. Reinicie a televisão: mantenha o botão **Power** do controle pressionado por 5 segundos até a TV desligar e religar exibindo o logo da Samsung.

#### Passo 2: Enviar e Instalar com 1 Comando
No PowerShell do computador, execute:
```powershell
.\build-tv.ps1 -TvIp "192.168.15.5:26101"
```
*(Substitua `192.168.15.5` pelo IP da sua TV Samsung, visível no menu de Rede da televisão).*

O script irá automaticamente:
1. Compilar os arquivos mais recentes do React TV App.
2. Gerar o pacote assinado `Cinelar-signed.wgt`.
3. Conectar na TV via SDB.
4. Instalar e abrir o Cine Lar na tela da TV!

---

### Método C: Android TV / TV Box / Fire TV Stick
Em aparelhos com Android TV ou Google TV:
1. Abra o navegador web da TV (ex: **Puffin TV-Browser**, **Chrome**, **Downloader** ou **JioPages**).
2. Digite o endereço do servidor:
   ```text
   http://<IP_DO_COMPUTADOR>:8085
   ```
3. Navegue livremente usando o controle remoto com suporte total a D-Pad.

---

## 3. Resumo de Teclas no Controle Remoto da TV

| Tecla / Botão | Ação |
|---|---|
| **Setas / D-Pad** | Navegar entre cards, categorias e menus |
| **Enter / OK** | Abrir detalhes ou reproduzir filme/série |
| **Segurar OK (400ms)** | Menu de ações rápidas (Favoritar, Excluir do disco) |
| **Voltar (Back)** | Fechar modais, fechar player ou subir para o menu superior |
| **Play / Pause** | Pausar ou despausar o filme |
| **Esquerda / Direita no Player** | Retroceder ou avançar 10s no vídeo |
| **Cima / Baixo no Player** | Aumentar ou diminuir o volume da TV |
| **Tecla S** | Ligar ou desligar legendas |
