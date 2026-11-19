# Como Instalar o MatheusFlix na Smart TV

Este guia explica como instalar e rodar o **MatheusFlix** na sua Smart TV (Samsung Tizen e Android TV).

---

## 1. Pacote Instalavel Gerado

O arquivo instalavel oficial para Samsung Smart TV foi compilado com todas as customizacoes do MatheusFlix (Cinelar TV, Stremio Details, Cinema Player, Quick Connect e Auto-login):

- **Arquivo:** `MatheusFlix.wgt`
- **Tamanho:** 36.53 MB
- **Localizacao no PC:** `c:\Users\rafae\Documents\GitHub\matheus-flix\MatheusFlix.wgt`
- **Link de Download na Rede Local:** `http://192.168.15.9:8085/download/MatheusFlix.wgt`

---

## 2. Metodos de Instalacao

### Metodo A: Navegador da TV (Mais Rapido e 100% Funcional)
Se voce quer usar o MatheusFlix na TV agora mesmo sem precisar configurar o Modo Desenvolvedor do Tizen Studio:

1. Na sua Smart TV Samsung, abra o aplicativo **Internet** (navegador oficial da TV).
2. Na barra de enderecos do navegador, digite:
   ```text
   http://192.168.15.9:8096
   ```
3. O MatheusFlix abrira instantaneamente com toda a interface, tema cinematografico, navegacao fluida e player.
4. **Fixar na barra da TV:** No menu de opcoes do navegador da TV (icone de estrela ou tres pontinhos), clique em **"Adicionar a Tela Inicial"** (ou "Favoritar").
5. O icone do MatheusFlix ficara salvo na barra principal de aplicativos da sua televisao, como se fosse um app nativo.

---

### Metodo B: Instalacao Nativa (.wgt) via Modo Desenvolvedor Samsung
Para instalar o arquivo `MatheusFlix.wgt` diretamente no sistema da Smart TV Samsung:

#### Passo 1: Habilitar o Modo Desenvolvedor na TV
1. No controle remoto da TV, pressione o botao **Home** e va para **Apps**.
2. No menu de Apps, aperte os botoes numericos no controle: `1` `2` `3` `4` `5`.
3. A janela **Developer Mode** aparecera na tela:
   - Alterne a opcao para **ON**.
   - No campo **Host PC IP**, digite o IP do seu computador: `192.168.15.9`.
4. Pressione **OK**.
5. Reinicie a TV (mantenha o botao Power do controle pressionado por 5 segundos ate a TV desligar e religar exibindo o logotipo da Samsung).
6. Ao abrir a tela de Apps, voce vera a indicacao "Developer Mode" ativa.

#### Passo 2: Enviar o Pacote pelo PC
Com o Tizen Studio ou o utilitario SDB instalado no computador:
```bash
# Conectar na TV via rede
sdb connect 192.168.15.5

# Verificar se a TV foi reconhecida
sdb devices

# Instalar o pacote
tizen install -n MatheusFlix.wgt -t <NOME_DO_DISPOSITIVO>
```

Ou execute o script interativo:
`c:\Users\rafae\Documents\GitHub\matheus-flix\instalar-na-tv.bat`

---

### Metodo C: Android TV / Fire TV Stick / TV Box
Se voce tambem tiver aparelhos Android TV (Mi Box, Fire TV Stick, Chromecast com Google TV):
1. Instale o app oficial do Jellyfin pela Google Play Store da TV.
2. Ao abrir o aplicativo, digite o endereco do servidor:
   ```text
   http://192.168.15.9:8096
   ```
3. Faca login com a conta `rafael` (senha `10092004`) ou use o **Quick Connect**.
