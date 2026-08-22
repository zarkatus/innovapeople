/* ============================================================================
 * TOPBAR DA CASA — o padrão da InnConta, em peça única para todos os sites do grupo.
 * (InnCorporate fica de fora por decisão do CVO: tem identidade própria e a mantém.)
 *
 * Como usar, em uma linha antes de </body>:
 *   <script src="/topbar.js?v=1" data-topbar='{ ...configuração... }' defer></script>
 *
 * A configuração diz apenas o que muda de casa para casa — marca, cores, links, ação.
 * A estrutura, as proporções, o comportamento ao rolar, o menu do celular e as travas de
 * largura são iguais em todas, porque é isso que faz um padrão.
 *
 * O QUE ELE RESOLVE DE SAÍDA (cicatriz medida na InnConta em 22/08): entre 375 e 389 px o
 * grupo da direita estourava a barra e cortava o botão. Aqui o grupo tem `min-width:0`, o
 * rótulo dos ícones some cedo, e a faixa compacta vai até 409 px — que cobre 360, 375, 390,
 * 393, 402 e 408. Nenhum telefone real corta.
 * ========================================================================== */
(function () {
  'use strict';
  if (document.getElementById('topbarCasa')) return;

  var tag = document.currentScript || document.querySelector('script[data-topbar]');
  var C;
  try { C = JSON.parse((tag && tag.getAttribute('data-topbar')) || '{}'); }
  catch (e) { console.error('topbar: configuração inválida', e); return; }

  var T = {
    marca: C.marca || ['', ''],          /* ['Inn','Conta'] — a segunda metade vai no acento */
    href: C.href || '/',
    fundo: C.fundo || '#17130E',         /* a cor da barra quando ela assenta */
    tinta: C.tinta || '#F1EADC',         /* texto sobre a barra */
    mut: C.mut || 'rgba(241,234,220,.62)',
    acento: C.acento || '#C9A25A',
    acento2: C.acento2 || '#A9863F',
    serif: C.serif || "'Cormorant Garamond',Georgia,serif",
    sans: C.sans || "'Jost',system-ui,-apple-system,'Segoe UI',sans-serif",
    nav: C.nav || [],                    /* [['Rótulo','/url'], ...] */
    acoes: C.acoes || [],                /* [['mail','https://…','Webmail'], ...] */
    cta: C.cta || null,                  /* ['Falar com a casa','/contato'] */
    langs: C.langs || null               /* [['PT','/'],['EN','/en/']] */
  };

  var ICONES = {
    busca: '<circle cx="9" cy="9" r="6"/><path d="M13.5 13.5 18 18"/>',
    mail: '<rect x="2" y="4.5" width="16" height="11" rx="1"/><path d="M2.6 5.2 10 11l7.4-5.8"/>',
    area: '<circle cx="10" cy="7" r="3.1"/><path d="M3.6 17c.7-3.3 3.3-5 6.4-5s5.7 1.7 6.4 5"/>',
    tel: '<path d="M4 3.5h3l1.5 4-2 1.4a11 11 0 0 0 4.6 4.6l1.4-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A14.5 14.5 0 0 1 2.5 5.1 1.5 1.5 0 0 1 4 3.5z"/>',
    doc: '<path d="M5 2.5h6l4 4v11H5z"/><path d="M11 2.5v4h4"/>'
  };

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

  /* ── o traje ────────────────────────────────────────────────────────── */
  var css = [
    '#topbarCasa{position:fixed;inset:0 0 auto;z-index:80;display:flex;align-items:center;',
    ' justify-content:space-between;gap:14px;height:76px;padding:0 clamp(16px,4vw,60px);',
    " font-family:" + T.sans + ";transition:background .45s cubic-bezier(.19,1,.22,1),",
    '  height .45s cubic-bezier(.19,1,.22,1),box-shadow .45s;-webkit-font-smoothing:antialiased}',
    '#topbarCasa.assentado{background:' + T.fundo + 'ef;backdrop-filter:blur(14px);height:62px;',
    ' box-shadow:0 1px 0 ' + T.acento + '22}',
    '#topbarCasa a{text-decoration:none;color:inherit}',
    '#topbarCasa .esq{display:flex;align-items:center;gap:clamp(14px,2.2vw,28px);min-width:0}',
    '#topbarCasa .marca{font-family:' + T.serif + ';font-size:clamp(19px,2vw,23px);line-height:1;',
    ' color:' + T.tinta + ';white-space:nowrap;letter-spacing:.01em}',
    '#topbarCasa .marca em{font-style:normal;color:' + T.acento + '}',
    '#topbarCasa .lang{display:flex;align-items:center;gap:2px}',
    '#topbarCasa .lang a{font-size:10.5px;letter-spacing:.14em;padding:5px 7px;border-radius:999px;',
    ' color:' + T.mut + ';transition:color .3s}',
    '#topbarCasa .lang a:hover,#topbarCasa .lang a[aria-current="page"]{color:' + T.tinta + '}',
    '#topbarCasa nav{display:flex;align-items:center;gap:clamp(12px,1.5vw,22px)}',
    '#topbarCasa nav a{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:' + T.mut + ';',
    ' white-space:nowrap;transition:color .3s}',
    '#topbarCasa nav a:hover{color:' + T.acento + '}',
    '#topbarCasa .dir{display:flex;align-items:center;gap:8px;min-width:0;flex-shrink:1}',
    '#topbarCasa .acao{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;',
    ' color:' + T.mut + ';box-shadow:inset 0 0 0 1px ' + T.acento + '2e;transition:color .3s,box-shadow .3s}',
    '#topbarCasa .acao:hover{color:' + T.tinta + ';box-shadow:inset 0 0 0 1px ' + T.acento + '}',
    '#topbarCasa .acao svg{width:14px;height:14px;flex:0 0 14px;fill:none;stroke:currentColor;stroke-width:1.7;',
    ' stroke-linecap:round;stroke-linejoin:round}',
    '#topbarCasa .acao .rot{font-size:10px;letter-spacing:.14em;text-transform:uppercase}',
    '#topbarCasa .cta{display:inline-flex;align-items:center;gap:9px;padding:11px 18px;border-radius:999px;',
    ' font-size:10px;letter-spacing:.16em;text-transform:uppercase;font-weight:500;white-space:nowrap;',
    ' color:' + (C.ctaTinta || '#17130E') + ';background:linear-gradient(135deg,' + T.acento + ',' + T.acento2 + ');',
    ' transition:transform .3s,filter .3s}',
    '#topbarCasa .cta:hover{transform:translateY(-1px);filter:brightness(1.07)}',
    '#topbarCasa .fogo{display:none;background:none;border:0;cursor:pointer;padding:9px;margin-right:-6px}',
    '#topbarCasa .fogo i{display:block;width:20px;height:1.6px;background:' + T.tinta + ';position:relative;transition:background .3s}',
    '#topbarCasa .fogo i::before,#topbarCasa .fogo i::after{content:"";position:absolute;left:0;width:20px;',
    ' height:1.6px;background:' + T.tinta + ';transition:transform .35s cubic-bezier(.19,1,.22,1),top .3s}',
    '#topbarCasa .fogo i::before{top:-6px}#topbarCasa .fogo i::after{top:6px}',
    '#topbarCasa .fogo.aberto i{background:transparent}',
    '#topbarCasa .fogo.aberto i::before{top:0;transform:rotate(45deg)}',
    '#topbarCasa .fogo.aberto i::after{top:0;transform:rotate(-45deg)}',
    /* a gaveta do celular */
    '#topbarGaveta{position:fixed;inset:0;z-index:79;background:' + T.fundo + ';display:flex;',
    ' flex-direction:column;align-items:center;justify-content:center;gap:clamp(16px,3.4vh,28px);',
    ' transform:translateY(-101%);transition:transform .55s cubic-bezier(.19,1,.22,1);',
    " font-family:" + T.sans + '}',
    '#topbarGaveta.aberta{transform:none}',
    '#topbarGaveta a{font-family:' + T.serif + ';font-size:clamp(21px,5.4vw,30px);color:' + T.tinta + ';',
    ' text-decoration:none;letter-spacing:.01em}',
    '#topbarGaveta a:hover{color:' + T.acento + '}',
    '#topbarGaveta .gl{display:flex;gap:12px;margin-top:8px}',
    '#topbarGaveta .gl a{font-family:' + T.sans + ';font-size:11px;letter-spacing:.2em;color:' + T.mut + '}',
    /* as larguras onde o telefone real vive */
    '@media (max-width:1300px){#topbarCasa nav{display:none}#topbarCasa .fogo{display:block}}',
    '@media (max-width:900px){#topbarCasa .acao .rot{display:none}#topbarCasa .acao{padding:8px 10px}',
    ' #topbarCasa .lang{display:none}#topbarCasa .dir{gap:6px}}',
    '@media (max-width:409px){#topbarCasa{padding:0 14px;gap:8px}',
    ' #topbarCasa .acao{padding:7px 8px}#topbarCasa .acao svg{width:13px;height:13px;flex:0 0 13px}',
    ' #topbarCasa .cta{padding:9px 11px;font-size:8.4px;letter-spacing:.06em;gap:5px}',
    ' #topbarCasa .marca{font-size:18px}#topbarCasa .dir{gap:5px}}',
    '@media (prefers-reduced-motion:reduce){#topbarCasa,#topbarGaveta,#topbarCasa .fogo i,',
    ' #topbarCasa .fogo i::before,#topbarCasa .fogo i::after{transition:none}}'
  ].join('');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* ── a peça ─────────────────────────────────────────────────────────── */
  function linkNav(l) { return '<a href="' + esc(l[1]) + '">' + esc(l[0]) + '</a>'; }
  function acao(a) {
    var ic = ICONES[a[0]] || ICONES.doc;
    var fora = /^https?:/.test(a[1]) ? ' target="_blank" rel="noopener"' : '';
    return '<a class="acao" href="' + esc(a[1]) + '"' + fora + ' aria-label="' + esc(a[2] || '') + '" title="' + esc(a[2] || '') + '">'
      + '<svg viewBox="0 0 20 20" aria-hidden="true">' + ic + '</svg>'
      + (a[2] ? '<span class="rot">' + esc(a[2]) + '</span>' : '') + '</a>';
  }
  var aqui = location.pathname;
  var h = document.createElement('header');
  h.id = 'topbarCasa';
  h.innerHTML =
    '<div class="esq"><a class="marca" href="' + esc(T.href) + '">' + esc(T.marca[0]) + '<em>' + esc(T.marca[1] || '') + '</em></a>'
    /* langs aceita um terceiro item: o seletor do controle ORIGINAL da casa. Onde a troca de
       idioma e feita por JavaScript da propria pagina (InnovaSphere troca uma classe no body),
       o link novo apenas aciona o botao antigo — que continua no DOM, so escondido. Assim o
       padrao visual entra sem levar embora a funcao. */
    + (T.langs ? '<div class="lang">' + T.langs.map(function (l) {
        return '<a href="' + esc(l[2] ? '#' : l[1]) + '"' + (l[2] ? ' data-alvo="' + esc(l[2]) + '"' : '')
          + (aqui === l[1] ? ' aria-current="page"' : '') + '>' + esc(l[0]) + '</a>';
      }).join('') + '</div>' : '')
    + '</div>'
    + '<nav>' + T.nav.map(linkNav).join('') + '</nav>'
    + '<div class="dir">' + T.acoes.map(acao).join('')
    + (T.cta ? '<a class="cta" href="' + esc(T.cta[1]) + '">' + esc(T.cta[0]) + '</a>' : '')
    + '<button class="fogo" aria-label="Menu" aria-expanded="false"><i></i></button></div>';

  var g = document.createElement('div');
  g.id = 'topbarGaveta';
  g.innerHTML = T.nav.map(function (l) { return '<a href="' + esc(l[1]) + '">' + esc(l[0]) + '</a>'; }).join('')
    + (T.langs ? '<div class="gl">' + T.langs.map(function (l) { return '<a href="' + esc(l[1]) + '">' + esc(l[0]) + '</a>'; }).join('') + '</div>' : '');

  /* o cabecalho antigo e ESCONDIDO, nao removido: cada casa tem JavaScript que o procura
     (a IncorpBuilding, por exemplo, chama topbar.classList sem guarda) e remover derrubaria a
     pagina inteira. Escondido, o codigo antigo continua achando o que espera e nao faz nada. */
  /* Nem toda casa usa a tag <header>: InnovaPeople usa <nav class="top">, InnovaSphere e C&S
     usam <nav id="nav">. Quando o padrao nao acha um <header>, a configuracao diz onde esta a
     barra antiga pelo campo `esconder`. Sem isso, as duas barras se sobrepoem — foi o que
     aconteceu na InnovaPeople antes de publicar. */
  var antigo = document.querySelector('header') || (C.esconder ? document.querySelector(C.esconder) : null);
  if (antigo && antigo.id !== 'topbarCasa') {
    antigo.setAttribute('data-substituido', '1');
    antigo.style.display = 'none';
    antigo.setAttribute('aria-hidden', 'true');
  }
  document.body.insertBefore(g, document.body.firstChild);
  document.body.insertBefore(h, document.body.firstChild);

  /* ── comportamento ──────────────────────────────────────────────────── */
  function assenta() { h.classList.toggle('assentado', (window.scrollY || document.documentElement.scrollTop) > 24); }
  addEventListener('scroll', assenta, { passive: true }); assenta();

  var fogo = h.querySelector('.fogo');
  function abre(v) {
    g.classList.toggle('aberta', v); fogo.classList.toggle('aberto', v);
    fogo.setAttribute('aria-expanded', String(v));
    document.documentElement.style.overflow = v ? 'hidden' : '';
  }
  fogo.addEventListener('click', function () { abre(!g.classList.contains('aberta')); });
  /* o link de idioma que aponta para um controle antigo apenas o aciona */
  h.addEventListener('click', function (e) {
    var l = e.target.closest('.lang a[data-alvo]'); if (!l) return;
    e.preventDefault();
    var o = document.querySelector(l.getAttribute('data-alvo'));
    if (o) { o.click(); h.querySelectorAll('.lang a').forEach(function (x) { x.removeAttribute('aria-current'); }); l.setAttribute('aria-current', 'page'); }
  });
  g.addEventListener('click', function (e) { if (e.target.closest('a')) abre(false); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') abre(false); });
})();
