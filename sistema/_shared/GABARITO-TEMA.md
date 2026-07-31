# Gabarito · converter uma tela do sistema para o contrato de tema

CVO 31/07: *"o sistema está extremamente escuro, traga uma versão light"*.

O escuro nunca foi um tema. Estava assado no `:root` de cada tela (`cream = fundo escuro`), e por
isso o botão claro/escuro do sidebar alternava um atributo que a maioria das telas ignorava. Este
documento é a receita para converter as telas restantes, uma a uma.

**Tela-piloto já convertida:** `sistema/pulso/index.html`. Use-a como referência viva.

---

## A receita, em quatro passos

**1. Carregue o contrato**, como primeira folha de estilo da página:

```html
<link rel="stylesheet" href="/sistema/_shared/tokens.css">
<style> … o CSS da tela … </style>
```

**2. Aponte o `:root` local para o contrato.** Não renomeie as variáveis da tela nem reescreva regra
por regra: só troque os valores por `var(--ip-*)`. A tela inteira passa a responder ao tema com o
menor diff possível.

```css
/* ANTES — cor assada, escuro para sempre */
:root{--bg:#0B1119;--bg2:#101821;--cream:#F7F3EC;--acento:#C85924;--rule:rgba(240,180,138,.14)}

/* DEPOIS — a tela mantém os nomes que já usa; o valor vem do contrato */
:root{
  --bg:var(--ip-surface); --bg2:var(--ip-surface-2); --bg3:var(--ip-surface-card);
  --cream:var(--ip-text); --cream-muted:var(--ip-text-muted); --cream-dim:var(--ip-text-faint);
  --acento:var(--ip-accent); --acento-glow:var(--ip-accent-light);
  --rule:var(--ip-line);
}
```

**3. Cor crua no CSS ou em template-string de JS também sai.** Procure `#RRGGBB` e `rgba(...)` no
arquivo inteiro, inclusive dentro de `<script>`, e troque pelo token equivalente. Ao final, a tela
não pode ter nenhuma cor de marca escrita à mão.

**4. Verifique nos dois modos.** Não confie em ler o código:

```js
// com a página aberta, nos dois valores de data-theme
document.documentElement.setAttribute('data-theme','light')  // e depois 'dark'
getComputedStyle(document.documentElement).getPropertyValue('--ip-surface')
```

Pronto = as duas versões abrem, o texto lê em ambas, e nenhum bloco fica com fundo de um tema e
texto do outro.

---

## Como escolher o token

O nome diz **o que a cor faz**, nunca como ela é. `gold` e `cream` descrevem a aparência antiga e
mentem no outro tema.

| Uso na tela | Token |
|---|---|
| fundo da página | `--ip-surface` |
| faixa/painel sobre o fundo | `--ip-surface-2` |
| cartão | `--ip-surface-card` |
| campo, área rebaixada | `--ip-surface-sunken` |
| véu atrás de modal | `--ip-overlay` |
| título, texto forte | `--ip-text` |
| corpo | `--ip-text-body` |
| secundário, legenda | `--ip-text-muted` |
| rótulo, placeholder | `--ip-text-faint` |
| texto sobre botão laranja | `--ip-text-on-accent` |
| ação, acento | `--ip-accent` |
| ação pressionada | `--ip-accent-strong` |
| gradiente, realce | `--ip-accent-light` |
| chip/destaque suave | `--ip-accent-wash` |
| painel escuro da marca | `--ip-brand-deep` |
| divisória | `--ip-line` / `--ip-line-strong` |
| anel de foco | `--ip-focus` |
| sucesso / atenção / erro / informação | `--ip-ok` · `--ip-warn` · `--ip-danger` · `--ip-info` (+ `-wash`) |

**Faltou token?** Ele nasce em `_shared/tokens.css`, **nos dois modos**, nunca na tela.

---

## Três coisas que NÃO se toca

1. **Verde, azul e vermelho de estado** (sucesso, erro, Google, WhatsApp). São semântica, não marca.
2. **O travessão `—` usado como campo vazio** (`olá, —`). É convenção de dado, não pontuação.
3. **`whatsapp-innovasphere/`**. É ferramenta da outra casa e veste a identidade dela.

---

## Ordem sugerida

Pelo que a pessoa vê primeiro, e pelo tamanho da dívida escura de cada uma:

1. `index.html` (dashboard) — já é sensível ao tema; conferir contraste no claro
2. `chro/index.html` e `chro/cockpit/` — centro de comando, o uso diário
3. `toolbox/` (6 telas + `_shared/toolbox.css`)
4. `whatsapp/` (4 telas)
5. `bastidores/`, `mandato.html`, `calendar.html`, `agentes.html`, `documentos/`, `comunicacao/`
6. `js/*.js` com cor em template-string (`pessoas.js`, `organograma.js`, `skillmap.js`, `mattering.js`)
