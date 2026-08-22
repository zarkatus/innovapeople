/* O CELULAR FLUTUANTE DA CASA — o menu do site dentro de um aparelho (CVO 22/08).
 *
 * "Quero o celular flutuante com o menu em TODOS os nossos sites, inclusive o inncorporate. Da
 *  mesma forma que está no innconta: só aparece ao rolar a página e aparece pequeno, podendo
 *  expandir ao clicar."
 *
 * Este arquivo é UM só, servido igual em todas as casas. O que muda entre elas vem de um JSON no
 * próprio <script>, como já acontece no topbar:
 *
 *   <script src="/casa-fone.js?v=1" data-fone='{"marca":["Innova","Sphere"],...}' defer></script>
 *
 * TRÊS REGRAS QUE VIERAM DE CICATRIZ, não de gosto:
 *
 * 1. SOBRE A ABERTURA, ELE NÃO EXISTE. Catálogo em cima da imagem inicial é agressão à promessa
 *    (CVO 21/08). O aparelho entra depois que a pessoa rola e recua se ela voltar ao topo.
 * 2. ALVO DESCONECTADO NÃO É TOQUE FORA. Tocar num item que re-renderiza a lista tira o alvo do
 *    DOM antes de o clique chegar ao documento; `contains()` falha e o aparelho se recolhe
 *    sozinho. Por isso o `isConnected` antes de qualquer coisa.
 * 3. NÃO DISPUTA ESPAÇO COM APARELHO GRANDE. Onde a página já mostra um celular em tamanho de
 *    peça, este some — dois celulares na mesma tela estragam os dois.
 */
(function () {
  'use strict';
  if (document.getElementById('cfone')) return;                 /* já montado */

  var tag = document.currentScript ||
            document.querySelector('script[src*="casa-fone.js"]');
  var C = {};
  try { C = JSON.parse((tag && tag.getAttribute('data-fone')) || '{}'); } catch (e) { C = {}; }

  var marca   = C.marca   || ['', ''];
  var fundo   = C.fundo   || '#15120E';
  var tinta   = C.tinta   || '#EFE9DC';
  var mut     = C.mut     || 'rgba(239,233,220,.56)';
  var acento  = C.acento  || '#C9A25A';
  var acento2 = C.acento2 || '#8A6B34';
  var ctaTin  = C.ctaTinta|| '#15120E';
  var serif   = C.serif   || "'Cormorant Garamond',Georgia,serif";
  var sans    = C.sans    || "'Jost',system-ui,'Segoe UI',sans-serif";
  var nav     = C.nav     || [];
  var acoes   = C.acoes   || [];
  var cta     = C.cta     || null;
  var pe      = C.rodape  || '';
  var evitar  = C.evitar  || '';        /* seletor de aparelho grande da própria página */

  var MOVEL = window.matchMedia('(max-width:900px)');
  var QUIETO = window.matchMedia('(prefers-reduced-motion:reduce)');

  /* ── o traje ────────────────────────────────────────────────────────── */
  var css = [
    '#cfone{position:fixed;right:max(16px,env(safe-area-inset-right));',
    ' bottom:max(16px,env(safe-area-inset-bottom));z-index:88;font-family:' + sans + ';',
    ' -webkit-font-smoothing:antialiased;transition:opacity .5s ease,transform .5s ease,visibility .5s}',
    '#cfone.cf-oculto{display:none}',
    '#cfone.cf-antes{opacity:0;visibility:hidden;transform:translateY(14px);pointer-events:none}',
    '@media(prefers-reduced-motion:reduce){#cfone,#cfone .cf-ap,#cfone .cf-pil{transition:none}}',
    /* o aparelho */
    '#cfone .cf-ap{position:relative;width:188px;border-radius:29px;padding:7px;',
    ' background:linear-gradient(158deg,#3A332A,' + fundo + ' 42%,#2A241C);',
    ' box-shadow:0 22px 56px rgba(0,0,0,.48),0 0 0 1px rgba(255,255,255,.07),',
    '  inset 0 1px 0 rgba(255,255,255,.09);transform-origin:100% 100%;',
    ' transition:transform .32s cubic-bezier(.22,.75,.25,1),opacity .32s}',
    /* botões físicos: é o detalhe que faz parecer aparelho, e não retângulo */
    '#cfone .cf-ap::before{content:"";position:absolute;left:-2px;top:22%;width:2.5px;height:52px;',
    ' border-radius:2px;background:linear-gradient(#463D31,#241F18 44%,transparent 44%,',
    '  transparent 56%,#463D31 56%,#241F18)}',
    '#cfone .cf-ap::after{content:"";position:absolute;right:-2px;top:29%;width:2.5px;height:32px;',
    ' border-radius:2px;background:linear-gradient(#463D31,#241F18)}',
    '#cfone .cf-tela{position:relative;border-radius:23px;overflow:hidden;background:' + fundo + ';',
    ' border:1px solid rgba(255,255,255,.07);aspect-ratio:9/18.4;display:flex;flex-direction:column}',
    '#cfone .cf-ilha{position:absolute;top:7px;left:50%;transform:translateX(-50%);width:44px;',
    ' height:11px;border-radius:999px;background:rgba(0,0,0,.72);z-index:4}',
    '#cfone .cf-varre{position:absolute;inset:0;z-index:3;pointer-events:none;',
    ' background:linear-gradient(115deg,transparent 42%,' + hexa(acento, .05) + ' 50%,transparent 58%);',
    ' background-size:280% 100%;animation:cfvarre 7s linear infinite}',
    '@keyframes cfvarre{from{background-position:120% 0}to{background-position:-160% 0}}',
    '@media(prefers-reduced-motion:reduce){#cfone .cf-varre{display:none}}',
    /* barra de status */
    '#cfone .cf-st{display:flex;align-items:center;justify-content:space-between;',
    ' padding:9px 12px 3px;font-size:7.5px;color:' + mut + ';letter-spacing:.08em}',
    '#cfone .cf-sin{display:flex;align-items:flex-end;gap:2.5px}',
    '#cfone .cf-sin i{display:block;width:2px;background:' + mut + ';border-radius:1px}',
    /* cabeçalho com a marca */
    '#cfone .cf-cab{padding:7px 12px 8px;border-bottom:1px solid rgba(255,255,255,.06);',
    ' background:linear-gradient(180deg,' + hexa(acento, .12) + ',transparent);',
    ' display:flex;align-items:center;justify-content:space-between;gap:8px}',
    '#cfone .cf-mk{font-family:' + serif + ';font-size:13px;color:' + tinta + ';line-height:1}',
    '#cfone .cf-mk em{font-style:normal;color:' + acento + '}',
    '#cfone .cf-x{background:none;border:0;color:' + mut + ';font-size:15px;line-height:1;',
    ' cursor:pointer;padding:2px 3px;border-radius:4px}',
    '#cfone .cf-x:hover{color:' + tinta + '}',
    '#cfone .cf-x:focus-visible{outline:1px solid ' + acento + ';outline-offset:2px}',
    /* o menu */
    '#cfone .cf-scr{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;',
    ' scrollbar-width:none;padding:6px 7px}',
    '#cfone .cf-scr::-webkit-scrollbar{display:none}',
    '#cfone .cf-it{display:flex;align-items:center;justify-content:space-between;gap:8px;',
    ' padding:8px 9px;border-radius:8px;text-decoration:none;color:' + tinta + ';font-size:11px;',
    ' letter-spacing:.01em;transition:background .2s}',
    '#cfone .cf-it:hover,#cfone .cf-it:focus-visible{background:' + hexa(acento, .13) + ';outline:none}',
    '#cfone .cf-it b{font-weight:400}',
    '#cfone .cf-it span{color:' + acento + ';font-size:12px;line-height:1}',
    '#cfone .cf-sep{height:1px;background:rgba(255,255,255,.07);margin:6px 4px}',
    '#cfone .cf-rot{padding:3px 9px 5px;font-size:7.5px;letter-spacing:.2em;text-transform:uppercase;',
    ' color:' + mut + '}',
    /* rodapé com o CTA */
    '#cfone .cf-pe{padding:8px;border-top:1px solid rgba(255,255,255,.06)}',
    '#cfone .cf-cta{display:block;text-align:center;text-decoration:none;border-radius:9px;',
    ' padding:9px 8px;font-size:10.5px;letter-spacing:.06em;color:' + ctaTin + ';',
    ' background:linear-gradient(180deg,' + acento + ',' + acento2 + ')}',
    '#cfone .cf-cta:focus-visible{outline:2px solid ' + acento + ';outline-offset:2px}',
    '#cfone .cf-nota{margin-top:6px;text-align:center;font-size:7.5px;color:' + mut + ';',
    ' letter-spacing:.05em}',
    /* a pílula: é assim que ele aparece — pequeno */
    '#cfone .cf-pil{display:none;position:relative;width:40px;height:64px;border-radius:13px;',
    ' padding:3px;border:0;cursor:pointer;background:linear-gradient(158deg,#3A332A,' + fundo + ');',
    ' box-shadow:0 12px 26px rgba(0,0,0,.4),0 0 0 1px rgba(255,255,255,.08);',
    ' transition:transform .22s ease}',
    '#cfone .cf-pil:hover{transform:translateY(-2px)}',
    '#cfone .cf-pil:focus-visible{outline:2px solid ' + acento + ';outline-offset:3px}',
    '#cfone .cf-pil i{display:block;height:100%;border-radius:10px;background:' + fundo + ';',
    ' position:relative;border:1px solid rgba(255,255,255,.07)}',
    '#cfone .cf-pil i::before{content:"";position:absolute;top:4px;left:50%;',
    ' transform:translateX(-50%);width:14px;height:3px;border-radius:2px;background:rgba(0,0,0,.6)}',
    /* três traços: é o que todo mundo reconhece como menu (CVO 22/08) */
    '#cfone .cf-pil i::after{content:"";position:absolute;left:9px;right:9px;top:20px;height:2px;',
    ' background:' + acento + ';border-radius:1px;',
    ' box-shadow:0 6px 0 ' + acento + ',0 12px 0 ' + acento + '}',
    '#cfone[data-estado="recolhido"] .cf-pil{display:block}',
    '#cfone[data-estado="recolhido"] .cf-ap{display:none}',
    '#cfone[data-estado="aberto"] .cf-pil{display:none}'
  ].join('');

  function hexa(h, a) {
    var m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(String(h).replace('#', '#'));
    if (!m) return 'rgba(201,162,90,' + a + ')';
    return 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + a + ')';
  }

  var est = document.createElement('style');
  est.textContent = css;
  document.head.appendChild(est);

  /* ── o corpo ────────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  var itens = nav.map(function (n) {
    return '<a class="cf-it" href="' + esc(n[1]) + '"><b>' + esc(n[0]) + '</b><span>&rsaquo;</span></a>';
  }).join('');
  var extras = acoes.map(function (a) {
    var fora = /^https?:/i.test(a[1]) ? ' target="_blank" rel="noopener"' : '';
    return '<a class="cf-it" href="' + esc(a[1]) + '"' + fora + '><b>' + esc(a[2] || a[0]) +
           '</b><span>&rsaquo;</span></a>';
  }).join('');

  var raiz = document.createElement('div');
  raiz.id = 'cfone';
  raiz.className = 'cf-antes';
  raiz.innerHTML =
    '<button class="cf-pil" type="button" aria-label="Abrir o menu"><i></i></button>' +
    '<div class="cf-ap" role="dialog" aria-label="Menu de ' + esc(marca.join('')) + '">' +
      '<div class="cf-tela">' +
        '<span class="cf-ilha"></span><span class="cf-varre"></span>' +
        '<div class="cf-st"><span>' + relogio() + '</span>' +
          '<span class="cf-sin"><i style="height:3px"></i><i style="height:5px"></i>' +
          '<i style="height:7px"></i><i style="height:9px"></i></span></div>' +
        '<div class="cf-cab"><div class="cf-mk">' + esc(marca[0]) + '<em>' + esc(marca[1] || '') +
          '</em></div><button class="cf-x" type="button" aria-label="Recolher">&times;</button></div>' +
        '<div class="cf-scr">' + itens +
          (extras ? '<div class="cf-sep"></div><div class="cf-rot">Acesso</div>' + extras : '') +
        '</div>' +
        (cta ? '<div class="cf-pe"><a class="cf-cta" href="' + esc(cta[1]) + '">' + esc(cta[0]) +
               '</a>' + (pe ? '<div class="cf-nota">' + esc(pe) + '</div>' : '') + '</div>' : '') +
      '</div></div>';
  document.body.appendChild(raiz);

  function relogio() {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  /* ── aberto ou recolhido ────────────────────────────────────────────── */
  function estado(v, guarda) {
    raiz.setAttribute('data-estado', v);
    if (guarda && !MOVEL.matches) {
      try { localStorage.setItem('cfone', v); } catch (e) { /* janela privada: segue sem memória */ }
    }
  }
  var lembrado = null;
  try { lembrado = localStorage.getItem('cfone'); } catch (e) { }
  /* no celular ele nasce recolhido: aparelho aberto sobre uma tela pequena prende a leitura */
  estado(MOVEL.matches ? 'recolhido' : (lembrado || 'recolhido'), false);

  raiz.querySelector('.cf-pil').addEventListener('click', function () { estado('aberto', true); });
  raiz.querySelector('.cf-x').addEventListener('click', function () { estado('recolhido', true); });

  document.addEventListener('click', function (e) {
    /* alvo desconectado = veio de dentro e a lista re-renderizou; não é toque fora */
    if (!e.target || !e.target.isConnected) return;
    if (raiz.getAttribute('data-estado') === 'aberto' && !raiz.contains(e.target))
      estado('recolhido', false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && raiz.getAttribute('data-estado') === 'aberto')
      estado('recolhido', false);
  });

  /* ── só depois da abertura ──────────────────────────────────────────── */
  function limiar() {
    var h = document.querySelector('#hero,.hero,header + section,main > section');
    var alt = h ? h.getBoundingClientRect().height : 0;
    return Math.max(320, Math.min(alt || innerHeight, innerHeight) * 0.72);
  }
  function naPrimeira() {
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    raiz.classList.toggle('cf-antes', y < limiar());
  }
  addEventListener('scroll', naPrimeira, { passive: true });
  addEventListener('resize', naPrimeira, { passive: true });
  naPrimeira();

  /* ── não disputa espaço com aparelho grande da própria página ───────── */
  var grandes = [];
  if (evitar) grandes = [].slice.call(document.querySelectorAll(evitar));
  if (grandes.length && 'IntersectionObserver' in window) {
    var aVista = new Set();
    var obs = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.isIntersecting ? aVista.add(e.target) : aVista.delete(e.target); });
      raiz.classList.toggle('cf-oculto', aVista.size > 0);
    }, { threshold: 0.05 });
    grandes.forEach(function (g) { obs.observe(g); });
  }
})();
