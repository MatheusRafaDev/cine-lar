# DESIGN.md — Design System Visual (streaming estilo Netflix)

Guia visual da interface: cores, tipografia, espaçamento, botões, cards, navegação, player e estados. Pensado para TV, web e mobile.

---

## 1. Princípios

1. **O conteúdo é o herói.** A interface fica escura e quieta para as capas e os trailers brilharem.
2. **Uma cor de ação.** O vermelho é reservado para o que é principal (assistir, assinar). Nada mais disputa atenção.
3. **Foco sempre visível.** Em TV e teclado, o item selecionado cresce e ganha contorno. Quem navega com controle remoto nunca se perde.
4. **Movimento só quando responde a uma ação.** Hover, foco e abertura de card animam. Nada se mexe sozinho, exceto o trailer do destaque.
5. **Texto curto, verbos claros.** "Assistir", "Minha lista", "Mais informações".

---

## 2. Cores

### Base

| Token | Hex | Uso |
|---|---|---|
| `--bg-0` | `#141414` | Fundo da página |
| `--bg-1` | `#1F1F1F` | Cards, menus, modais |
| `--bg-2` | `#2A2A2A` | Campos, hover de superfícies |
| `--line` | `#3A3A3A` | Divisores e bordas |

### Texto

| Token | Hex | Uso |
|---|---|---|
| `--text-1` | `#FFFFFF` | Títulos e texto principal |
| `--text-2` | `#B3B3B3` | Texto secundário, metadados |
| `--text-3` | `#808080` | Desabilitado, dicas |

### Marca e estados

| Token | Hex | Uso |
|---|---|---|
| `--brand` | `#E50914` | Botão principal, barra de progresso, logo |
| `--brand-hover` | `#F6121D` | Hover do botão principal |
| `--brand-press` | `#B20710` | Botão pressionado |
| `--success` | `#46D369` | Porcentagem de afinidade, confirmações |
| `--warning` | `#F5A623` | Avisos |
| `--danger` | `#FF4D4F` | Erros (distinto do vermelho de marca) |

### Regras
- Contraste mínimo de 4,5:1 para texto (WCAG AA). `--text-2` sobre `--bg-0` passa; `--text-3` só para itens desabilitados.
- Sobre imagens, usar **gradiente de proteção** (preto 0% → 80% de baixo para cima) em vez de caixas sólidas.
- Erros usam `--danger`, nunca `--brand`, para não confundir com ações principais.

---

## 3. Tipografia

**Família:** `"Netflix Sans", "Helvetica Neue", Helvetica, Arial, sans-serif`
(alternativa livre: **Inter** ou **Figtree**)

| Estilo | Tamanho / Linha | Peso | Uso |
|---|---|---|---|
| Display | 56 / 60 | 700 | Título do destaque (hero) |
| H1 | 36 / 42 | 700 | Título de página |
| H2 | 24 / 30 | 600 | Título de fileira (carrossel) |
| H3 | 18 / 24 | 600 | Título de card expandido |
| Body | 16 / 24 | 400 | Sinopses e textos |
| Small | 14 / 20 | 400 | Metadados (ano, classificação, duração) |
| Caption | 12 / 16 | 400 | Rótulos e legendas de UI |

Regras:
- Linhas de texto corrido com no máximo 70 caracteres.
- Tamanhos em `rem`, com escala maior em TV (base 20 px a 24 px).
- Sentence case em tudo. Sem CAIXA ALTA em rótulos.

---

## 4. Espaçamento, grid e raios

**Escala (base 4 px):** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64

**Margem lateral da página:** 16 px (mobile) · 32 px (tablet) · 56 px (desktop) · 4% (TV)

**Raios**

| Elemento | Raio |
|---|---|
| Botões | 4 px |
| Cards de capa | 6 px |
| Modais | 8 px |
| Avatares de perfil | 4 px (quadrado arredondado, como no original) |
| Campos | 4 px |

**Sombras:** só em elementos que flutuam (card expandido, menus, modais).
`--shadow-float: 0 12px 32px rgba(0,0,0,.6)`

---

## 5. Botões

Altura padrão: **44 px** (mínimo de toque). Padding horizontal: 24 px. Fonte 16/600. Ícone + texto com 8 px de espaço.

### Primário
- Fundo `--brand`, texto branco.
- Hover `--brand-hover` · Pressionado `--brand-press`.
- Uso: **Assistir**, **Assinar**, **Continuar**. Máximo de um por área.

### Secundário (no hero)
- Fundo `rgba(109,109,110,.7)`, texto branco, com blur de fundo.
- Hover: opacidade 0,5.
- Uso: **Mais informações**.

### Branco (alto destaque sobre imagem)
- Fundo `#FFFFFF`, texto `#141414`.
- Hover: `#E6E6E6`.
- Uso: **Assistir** dentro do hero e do card expandido.

### Contorno
- Fundo transparente, borda 1 px `--line`, texto branco.
- Hover: borda branca.
- Uso: **Cancelar**, **Gerenciar perfis**.

### Ícone circular
- 40 px, borda 2 px `rgba(255,255,255,.5)`, fundo `rgba(42,42,42,.6)`.
- Hover: borda branca.
- Uso: **+ Minha lista**, **Gostei**, **Som**, **Seta para baixo**.

### Texto / link
- Sem fundo, sublinhado no hover, cor `--text-2`.

### Estados comuns
| Estado | Aparência |
|---|---|
| Foco | Contorno branco de 3 px com 2 px de afastamento |
| Desabilitado | Opacidade 0,4, sem hover |
| Carregando | Spinner de 16 px no lugar do texto, largura mantida |

---

## 6. Cards

### 6.1 Card de capa (carrossel)
- Proporção **16:9** (horizontal) ou **2:3** (pôster, para "Top 10").
- Largura: 5 por tela no desktop, 3 no tablet, 2,3 no mobile (a próxima capa aparece cortada para indicar rolagem).
- Espaço entre capas: 8 px.
- Contém só a imagem. Título aparece no hover/foco.
- Barra de progresso (se em andamento): 3 px no rodapé da imagem, trilho `rgba(255,255,255,.3)`, preenchimento `--brand`.

### 6.2 Card expandido (hover/foco)
- Após 400 ms de hover, cresce para **1,3x** com `--shadow-float`.
- Fundo `--bg-1`, raio 6 px, anima em 200 ms (`ease-out`).
- Estrutura de cima para baixo:
  1. Prévia (imagem ou trailer mudo)
  2. Linha de ações: ▶ Assistir · + Lista · 👍 Gostei · ⌄ Mais
  3. Metadados: `98% relevante` (verde) · classificação · duração · qualidade
  4. Gêneros em texto pequeno, separados por vírgula
- No mobile não há hover: toque abre a página de detalhes.

### 6.3 Card de episódio
- Linha horizontal: número (24 px, cinza) · miniatura 16:9 de 130 px · título + duração · sinopse em 2 linhas.
- Episódio atual com fundo `--bg-2`.

### 6.4 Card de perfil
- Avatar quadrado de 120 px (80 px no mobile), nome abaixo em `--text-2`.
- Hover/foco: nome fica branco e o avatar ganha borda branca de 3 px.
- Último card: "Adicionar perfil" com ícone +.

### 6.5 Card "Top 10"
- Pôster 2:3 com o **número gigante** (cor `--bg-0`, contorno claro de 4 px) sobreposto à esquerda do pôster.

### 6.6 Selos nos cards
| Selo | Visual |
|---|---|
| Novo episódio | Faixa `--brand` no rodapé, texto branco, 12/600 |
| Estreia | Mesmo estilo, texto "Estreia" |
| Top 10 | Ícone do selo no canto superior direito |
| Classificação | Quadrado colorido com idade (L, 10, 12, 14, 16, 18) |

---

## 7. Layout das telas

### 7.1 Home
```
┌──────────────────────────────────────────────────────────┐
│ LOGO  Início  Séries  Filmes  Minha lista     🔍  🔔  👤 │  ← Header transparente → sólido ao rolar
├──────────────────────────────────────────────────────────┤
│                                                          │
│   [ HERO: trailer/imagem em tela cheia ]                 │
│   Título (Display)                                       │
│   Sinopse curta (2 linhas)                               │
│   [ ▶ Assistir ]  [ ⓘ Mais informações ]                 │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ Continuar assistindo                                     │
│ [card][card][card][card][card]▸                          │
│ Em alta no Brasil                                        │
│ [card][card][card][card][card]▸                          │
└──────────────────────────────────────────────────────────┘
```
- Alinhamento à esquerda em tudo. Hero ocupa 70–80% da altura da tela.
- Título de fileira em H2, 12 px acima das capas.

### 7.2 Header
- Altura 68 px, fundo `linear-gradient(180deg, rgba(0,0,0,.7), transparent)`.
- Após rolar 10 px: fundo `--bg-0` sólido, transição de 300 ms.
- Item ativo: texto branco, peso 600. Inativos: `--text-2`.
- Mobile: barra inferior fixa com 4 ícones (Início, Buscar, Novidades, Perfil).

### 7.3 Detalhes do título (modal)
- Largura máxima 850 px, fundo `--bg-1`, raio 8 px, overlay `rgba(0,0,0,.7)`.
- Topo: imagem 16:9 com gradiente, título e botões sobre ela.
- Corpo em 2 colunas: sinopse (2/3) · elenco, gêneros e tags (1/3).
- Abaixo: lista de episódios, depois "Títulos semelhantes" em grade.

### 7.4 Busca
- Campo no header expande de 40 px para 280 px em 250 ms.
- Resultados em grade de capas 16:9, sem texto até o hover.

---

## 8. Player

- Controles aparecem ao mover o mouse/tocar e somem após 3 s sem interação.
- Barra inferior com gradiente preto → transparente.
- Linha de progresso: 4 px (cresce para 6 px no hover), trilho `rgba(255,255,255,.3)`, buffer `rgba(255,255,255,.5)`, progresso `--brand`, marcador circular de 14 px.
- Controles, da esquerda para a direita: ▶/⏸ · ⏪10 · ⏩10 · 🔊 | título | Próximo episódio · Episódios · Legendas/Áudio · Velocidade · Tela cheia.
- Botão **Pular abertura**: canto inferior direito, estilo branco, aparece durante a abertura.
- Legendas: branco, sombra preta de 2 px, 4% da altura da tela, fundo opcional.
- Tela de "Próximo episódio": contagem de 5 s em botão com anel de progresso.

---

## 9. Formulários (login e assinatura)

- Fundo da tela: imagem escurecida com gradiente, caixa central `rgba(0,0,0,.75)`, largura 450 px, padding 48 px.
- Campo: altura 50 px, fundo `--bg-2`, sem borda; rótulo flutuante que sobe ao digitar.
- Erro: borda inferior 2 px `--danger` + mensagem abaixo, 13 px, dizendo o que corrigir ("Digite um e-mail válido, como nome@exemplo.com").
- Um botão primário por tela, largura total no mobile.

---

## 10. Estados vazios, carregamento e erro

| Situação | Tratamento |
|---|---|
| Carregando fileira | Capas esqueleto em `--bg-1` com brilho suave de 1,5 s |
| Carregando página | Logo central com animação curta, nunca spinner genérico |
| Minha lista vazia | Texto: "Você ainda não adicionou nada." + botão "Explorar títulos" |
| Sem resultados | "Nada encontrado para *termo*. Tente outro título, gênero ou ator." |
| Sem internet | Faixa no topo: "Sem conexão. Tentando reconectar…" |
| Erro de reprodução | Modal: o que houve + botão "Tentar de novo" + código do erro em texto pequeno |

---

## 11. Movimento

| Ação | Duração | Curva |
|---|---|---|
| Hover/foco em card | 200 ms | `ease-out` |
| Abrir modal | 250 ms (fade + escala 0,96 → 1) | `ease-out` |
| Header ao rolar | 300 ms | `linear` |
| Carrossel (rolagem lateral) | 400 ms | `ease-in-out` |
| Troca de tela | 150 ms (fade) | `ease` |

Respeitar `prefers-reduced-motion`: sem escala nem rolagem animada, só mudança de opacidade.

---

## 12. Acessibilidade

- Foco visível em todo elemento interativo (contorno branco de 3 px).
- Alvos de toque de 44 × 44 px no mínimo.
- Navegação completa por teclado e controle remoto (setas, Enter, Voltar).
- `alt` descritivo nas capas e `aria-label` em botões só com ícone.
- Legendas e audiodescrição acessíveis a partir do player.
- Trailers do hero começam **mudos** e com botão de pausa.

---

## 13. Tokens em CSS

```css
:root {
  /* cores */
  --bg-0: #141414;
  --bg-1: #1f1f1f;
  --bg-2: #2a2a2a;
  --line: #3a3a3a;
  --text-1: #ffffff;
  --text-2: #b3b3b3;
  --text-3: #808080;
  --brand: #e50914;
  --brand-hover: #f6121d;
  --brand-press: #b20710;
  --success: #46d369;
  --warning: #f5a623;
  --danger: #ff4d4f;

  /* tipografia */
  --font: "Netflix Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;

  /* espaçamento */
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px;
  --s5: 24px; --s6: 32px; --s7: 48px; --s8: 64px;

  /* raios e sombras */
  --r-btn: 4px;
  --r-card: 6px;
  --r-modal: 8px;
  --shadow-float: 0 12px 32px rgba(0, 0, 0, 0.6);
}

.btn {
  height: 44px;
  padding: 0 24px;
  border: 0;
  border-radius: var(--r-btn);
  font: 600 16px/1 var(--font);
  cursor: pointer;
}
.btn-primary { background: var(--brand); color: #fff; }
.btn-primary:hover { background: var(--brand-hover); }
.btn-primary:active { background: var(--brand-press); }
.btn:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }

.card {
  border-radius: var(--r-card);
  transition: transform 200ms ease-out, box-shadow 200ms ease-out;
}
.card:hover,
.card:focus-visible {
  transform: scale(1.3);
  box-shadow: var(--shadow-float);
  z-index: 10;
}
@media (prefers-reduced-motion: reduce) {
  .card:hover, .card:focus-visible { transform: none; }
}
```

---

## 14. Checklist de revisão

- [ ] Só existe um botão primário vermelho por área?
- [ ] Todo item interativo tem estado de foco visível?
- [ ] O texto passa em 4,5:1 de contraste?
- [ ] Os cards funcionam sem hover (toque)?
- [ ] Erros dizem o que aconteceu e como resolver?
- [ ] A tela funciona de 360 px até TV 4K?
- [ ] Animações respeitam `prefers-reduced-motion`?
