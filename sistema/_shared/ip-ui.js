// InnovaPeople · Biblioteca de UI reutilizável (IP-3 + IP-4 · PQV-01 03/06)
// Primitivos vanilla que hoje são reinventados ad-hoc em cada tela (kpi/badge/btn/field
// existem 3× diferentes em pessoas/resultado/folha). Centraliza + adiciona ARIA + usa os
// tokens var(--ip-*). NÃO reescreve as telas existentes (já verificadas) — é para USO
// INCREMENTAL: telas novas e refactors usam window.IpUI.*. Inclui EmptyState e Skeleton (IP-4).
// API: window.IpUI = { esc, kpi, badge, btn, field, select, emptyState, skeleton, toast, modal }
(function(){
  'use strict';
  if(window.IpUI) return;
  var esc = function(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); };

  // ---- KPI (tom via token) ----
  function kpi(label,val,opts){
    opts=opts||{}; var cor=opts.color||'var(--ip-gold-lum)';
    return '<div role="group" aria-label="'+esc(label)+'" style="flex:1;min-width:118px;background:var(--ip-bg-card);border:1px solid rgba(210,174,100,.18);border-radius:14px;padding:14px 16px;box-shadow:0 6px 18px rgba(0,0,0,.25)">'
      +'<div style="font:600 11px/1 system-ui;letter-spacing:.08em;text-transform:uppercase;color:var(--ip-ink-3)">'+esc(label)+'</div>'
      +'<div style="font:700 italic 26px Georgia;color:'+cor+';margin-top:6px">'+(val==null?'—':val)+'</div></div>';
  }
  // ---- Badge ----
  function badge(txt,cor){ cor=cor||'var(--ip-gold-lum)'; return '<span style="font:600 11px/1 system-ui;padding:5px 10px;border-radius:20px;color:'+cor+';background:color-mix(in srgb,'+cor+' 16%,transparent);border:1px solid color-mix(in srgb,'+cor+' 40%,transparent)">'+esc(txt)+'</span>'; }
  // ---- Button ----
  function btn(id,txt,kind){
    var base='font:600 13px/1 system-ui;padding:11px 18px;border-radius:11px;cursor:pointer;border:1px solid;transition:.15s';
    if(kind==='primary') return '<button id="'+id+'" style="'+base+';background:var(--ip-gold);color:var(--ip-bg-deep);border-color:var(--ip-gold-lum)">'+txt+'</button>';
    if(kind==='danger')  return '<button id="'+id+'" style="'+base+';background:color-mix(in srgb,var(--ip-danger-2) 18%,transparent);color:var(--ip-danger);border-color:color-mix(in srgb,var(--ip-danger-2) 45%,transparent)">'+txt+'</button>';
    return '<button id="'+id+'" style="'+base+';background:transparent;color:var(--ip-gold-lum);border-color:rgba(210,174,100,.4)">'+txt+'</button>';
  }
  // ---- Field / Select (com label + aria) ----
  function field(label,id,val,type,ph){
    return '<label style="display:block;margin-bottom:13px"><span style="display:block;font:600 11px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-ink-3);margin-bottom:6px">'+esc(label)+'</span>'
      +'<input id="'+id+'" type="'+(type||'text')+'" value="'+(val==null?'':esc(val))+'" placeholder="'+esc(ph||'')+'" aria-label="'+esc(label)+'" style="width:100%;background:var(--ip-bg-deep);border:1px solid rgba(210,174,100,.25);border-radius:10px;padding:10px 13px;color:var(--ip-cream);font-size:14px"/></label>';
  }
  function select(label,id,val,opts){
    return '<label style="display:block;margin-bottom:13px"><span style="display:block;font:600 11px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-ink-3);margin-bottom:6px">'+esc(label)+'</span>'
      +'<select id="'+id+'" aria-label="'+esc(label)+'" style="width:100%;background:var(--ip-bg-deep);border:1px solid rgba(210,174,100,.25);border-radius:10px;padding:10px 13px;color:var(--ip-cream);font-size:14px">'
      +opts.map(function(o){return '<option value="'+esc(o[0])+'"'+(String(val)===String(o[0])?' selected':'')+'>'+esc(o[1])+'</option>';}).join('')+'</select></label>';
  }
  // ---- EmptyState (IP-4) ----
  function emptyState(o){
    o=o||{};
    return '<div role="status" style="padding:44px 28px;text-align:center;border:1px dashed rgba(210,174,100,.2);border-radius:14px">'
      +(o.icon?'<div style="font-size:34px;margin-bottom:10px;opacity:.8">'+o.icon+'</div>':'')
      +(o.eyebrow?'<div style="font:600 10.5px/1 system-ui;letter-spacing:.12em;text-transform:uppercase;color:var(--ip-gold);margin-bottom:8px">'+esc(o.eyebrow)+'</div>':'')
      +'<div style="font:600 italic 18px Georgia;color:var(--ip-cream);margin-bottom:6px">'+esc(o.title||'Nada por aqui ainda')+'</div>'
      +(o.description?'<div style="color:var(--ip-ink-3);font-size:13px;max-width:380px;margin:0 auto 14px">'+esc(o.description)+'</div>':'')
      +(o.actionHtml||'')+'</div>';
  }
  // ---- Skeleton loader (IP-4) ----
  function skeleton(rows){
    rows=rows||3; var bars='';
    for(var i=0;i<rows;i++){ var w=60+Math.round(((i*37)%35)); bars+='<div class="ip-sk" style="height:14px;width:'+w+'%;border-radius:7px;margin:10px 0"></div>'; }
    return '<div aria-busy="true" aria-label="Carregando" style="padding:18px 4px">'+bars+'</div>';
  }
  // injeta a animação do skeleton 1×
  (function injectSkeletonCss(){
    if(document.getElementById('ip-ui-css')) return;
    var st=document.createElement('style'); st.id='ip-ui-css';
    st.textContent='.ip-sk{background:linear-gradient(90deg,rgba(210,174,100,.06),rgba(210,174,100,.16),rgba(210,174,100,.06));background-size:200% 100%;animation:ipSk 1.3s ease-in-out infinite}@keyframes ipSk{0%{background-position:200% 0}100%{background-position:-200% 0}}@media (prefers-reduced-motion:reduce){.ip-sk{animation:none}}';
    (document.head||document.documentElement).appendChild(st);
  })();
  // ---- Toast (usa TB.toast se existir; senão cria efêmero acessível) ----
  function toast(msg,opts){
    if(window.TB && window.TB.toast){ try{ return window.TB.toast(msg); }catch(_){}}
    var t=document.createElement('div'); t.setAttribute('role','status'); t.setAttribute('aria-live','polite');
    t.style.cssText='position:fixed;bottom:22px;left:50%;transform:translateX(-50%);z-index:2147483600;background:var(--ip-bg-card);color:var(--ip-cream);border:1px solid rgba(210,174,100,.35);border-radius:10px;padding:11px 16px;font:500 13px/1.3 system-ui;box-shadow:0 8px 24px rgba(0,0,0,.4);max-width:80vw';
    t.textContent=msg; document.body.appendChild(t);
    setTimeout(function(){ t.style.transition='opacity .4s'; t.style.opacity='0'; setTimeout(function(){t.remove();},400); }, (opts&&opts.ms)||4200);
  }
  // ---- Modal acessível (Escape, backdrop click, aria-modal, foco) ----
  function modal(html,opts){
    opts=opts||{};
    var ov=document.createElement('div'); ov.className='ip-modal-ov';
    ov.style.cssText='position:fixed;inset:0;background:rgba(3,7,12,.66);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px';
    var box=document.createElement('div'); box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true');
    if(opts.label) box.setAttribute('aria-label',opts.label);
    box.style.cssText='width:'+(opts.width||'min(520px,100%)')+';max-height:90vh;overflow-y:auto;background:var(--ip-bg);border:1px solid rgba(210,174,100,.25);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.5);padding:24px 26px';
    box.innerHTML=html; ov.appendChild(box); document.body.appendChild(ov);
    function close(){ document.removeEventListener('keydown',onKey); ov.remove(); if(opts.onClose)opts.onClose(); }
    function onKey(e){ if(e.key==='Escape') close(); }
    ov.addEventListener('click',function(e){ if(e.target===ov && opts.dismissable!==false) close(); });
    document.addEventListener('keydown',onKey);
    var f=box.querySelector('input,select,textarea,button'); if(f) try{f.focus();}catch(_){}
    return { close:close, box:box };
  }

  // ---- Gráficos SVG vanilla (IP←IS-5 · portado de notas-fiscais.js, tokens --ip-*) ----
  // doughnut(slices[{l,v,c}], altura) — rosca com legenda e total no centro. Sem libs.
  function doughnut(slices, alturaPx){
    alturaPx = alturaPx || 220;
    slices = slices || [];
    var total = slices.reduce(function(s,x){return s+(Number(x.v)||0);},0);
    if(total<=0) return emptyState({icon:'🍩',title:'Sem composição',description:'Quando houver dados, o gráfico aparece aqui.'});
    var cx=120, cy=120, rOut=100, rIn=62, ang0=-Math.PI/2, paths='';
    slices.forEach(function(s){
      var frac=(Number(s.v)||0)/total; if(frac<=0) return;
      var ang1=ang0+frac*Math.PI*2, large=frac>0.5?1:0;
      var x0=cx+rOut*Math.cos(ang0), y0=cy+rOut*Math.sin(ang0);
      var x1=cx+rOut*Math.cos(ang1), y1=cy+rOut*Math.sin(ang1);
      var xi0=cx+rIn*Math.cos(ang1), yi0=cy+rIn*Math.sin(ang1);
      var xi1=cx+rIn*Math.cos(ang0), yi1=cy+rIn*Math.sin(ang0);
      paths+='<path d="M'+x0+','+y0+' A'+rOut+','+rOut+' 0 '+large+' 1 '+x1+','+y1+' L'+xi0+','+yi0+' A'+rIn+','+rIn+' 0 '+large+' 0 '+xi1+','+yi1+' Z" fill="'+(s.c||'var(--ip-gold)')+'"/>';
      ang0=ang1;
    });
    var legend=slices.filter(function(s){return (Number(s.v)||0)>0;}).map(function(s){
      var pct=((Number(s.v)||0)/total*100).toFixed(0)+'%';
      return '<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ip-ink-2);margin-bottom:5px"><span style="width:10px;height:10px;border-radius:2px;background:'+(s.c||'var(--ip-gold)')+'"></span><span style="flex:1">'+esc(s.l)+'</span><span style="color:var(--ip-cream);font-variant-numeric:tabular-nums">'+pct+'</span></div>';
    }).join('');
    return '<div role="img" aria-label="Gráfico de composição" style="display:grid;grid-template-columns:auto 1fr;gap:24px;align-items:center">'
      +'<svg viewBox="0 0 240 240" width="200" height="200" aria-hidden="true">'+paths
      +'<text x="120" y="116" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="32" fill="var(--ip-cream)">'+total+'</text>'
      +'<text x="120" y="138" text-anchor="middle" font-size="9" letter-spacing="3" fill="var(--ip-ink-3)">TOTAL</text></svg>'
      +'<div>'+legend+'</div></div>';
  }
  // barras(itens[{l,v}], formato) — ranking horizontal. formato:'moeda'|undefined.
  function barras(itens, formato){
    itens = itens || [];
    if(!itens.length) return emptyState({icon:'📊',title:'Sem ranking',description:'Sem dados para exibir.'});
    var max=Math.max.apply(null, itens.map(function(i){return Number(i.v)||0;}));
    if(max<=0) return emptyState({icon:'📊',title:'Sem valores'});
    var money=function(v){ return 'R$ '+Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:0}); };
    var rows=itens.map(function(it,idx){
      var w=((Number(it.v)||0)/max*100).toFixed(1);
      var cor=idx===0?'var(--ip-gold-lum)':idx<3?'var(--ip-gold)':'var(--ip-ink-3)';
      var val=formato==='moeda'?money(it.v):String(it.v);
      return '<div style="display:grid;grid-template-columns:160px 1fr 90px;gap:12px;align-items:center;margin-bottom:8px">'
        +'<div style="font-size:12.5px;color:var(--ip-ink-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(it.l)+'">'+esc(it.l)+'</div>'
        +'<div style="height:18px;background:rgba(210,174,100,.06);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+w+'%;background:'+cor+';border-radius:3px"></div></div>'
        +'<div style="text-align:right;font-size:12.5px;color:var(--ip-cream);font-variant-numeric:tabular-nums">'+esc(val)+'</div></div>';
    }).join('');
    return '<div role="img" aria-label="Gráfico de ranking">'+rows+'</div>';
  }

  // ---- Gauge semicircular (indice tipo CPI/SPI, semaforo) · 0..max, alvo 1 ----
  function gauge(valor, opts){
    opts=opts||{}; var max=opts.max||2, label=opts.label||'', alvo=opts.alvo!=null?opts.alvo:1;
    var v = valor==null ? null : Math.max(0, Math.min(max, +valor));
    var frac = v==null ? 0 : v/max;
    // semaforo: <0.9 vermelho, 0.9-1.1 dourado, >1.1 verde
    var cor = v==null ? 'var(--ip-ink-4)' : v<alvo*0.9 ? 'var(--ip-danger)' : v>alvo*1.1 ? 'var(--ip-ok)' : 'var(--ip-gold-lum)';
    var R=52, cx=60, cy=60, ang0=Math.PI, ang1=Math.PI-frac*Math.PI; // semicirculo de 180deg
    var x0=cx+R*Math.cos(Math.PI), y0=cy+R*Math.sin(Math.PI);
    var bx=cx+R*Math.cos(0), by=cy+R*Math.sin(0);
    var px=cx+R*Math.cos(ang1), py=cy+R*Math.sin(ang1);
    var large = frac>0.5?1:0;
    var arcBg='M'+x0+','+y0+' A'+R+','+R+' 0 0 1 '+bx+','+by;
    var arcFg = v==null?'' : 'M'+x0+','+y0+' A'+R+','+R+' 0 '+large+' 1 '+px+','+py;
    return '<div role="img" aria-label="'+esc(label)+': '+(v==null?'sem dado':v.toFixed(2))+'" style="text-align:center">'
      +'<svg viewBox="0 0 120 72" width="120" height="72" aria-hidden="true">'
      +'<path d="'+arcBg+'" fill="none" stroke="rgba(210,174,100,.12)" stroke-width="9" stroke-linecap="round"/>'
      +(arcFg?'<path d="'+arcFg+'" fill="none" stroke="'+cor+'" stroke-width="9" stroke-linecap="round"/>':'')
      +'<text x="60" y="56" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="22" fill="'+cor+'">'+(v==null?'—':v.toFixed(2))+'</text></svg>'
      +'<div style="font:600 9px/1 system-ui;letter-spacing:.12em;text-transform:uppercase;color:var(--ip-ink-3);margin-top:2px">'+esc(label)+'</div></div>';
  }
  // ---- Sparkline (tendencia, serie de numeros) ----
  function sparkline(serie, opts){
    opts=opts||{}; serie=(serie||[]).map(Number).filter(function(x){return !isNaN(x);});
    var w=opts.width||120, h=opts.height||32, cor=opts.color||'var(--ip-gold-lum)';
    if(serie.length<2) return '<div style="height:'+h+'px;display:flex;align-items:center;color:var(--ip-ink-4);font-size:10px">sem tendência</div>';
    var mn=Math.min.apply(null,serie), mx=Math.max.apply(null,serie), rng=(mx-mn)||1;
    var pts=serie.map(function(v,i){ var x=(i/(serie.length-1))*w; var y=h-((v-mn)/rng)*(h-4)-2; return x.toFixed(1)+','+y.toFixed(1); }).join(' ');
    var last=serie[serie.length-1], first=serie[0], up=last>=first;
    var lx=w, ly=h-((last-mn)/rng)*(h-4)-2;
    return '<svg viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'" aria-hidden="true" style="display:block">'
      +'<polyline points="'+pts+'" fill="none" stroke="'+cor+'" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>'
      +'<circle cx="'+lx.toFixed(1)+'" cy="'+ly.toFixed(1)+'" r="2.5" fill="'+(up?'var(--ip-ok)':'var(--ip-danger)')+'"/></svg>';
  }
  // ---- statBig (numero-heroi com label, delta opcional, cor) ----
  function statBig(val, label, opts){
    opts=opts||{};
    var deltaHtml='';
    if(opts.delta!=null){ var d=+opts.delta, c=d>0?'var(--ip-ok)':d<0?'var(--ip-danger)':'var(--ip-ink-3)', a=d>0?'↑':d<0?'↓':'→';
      deltaHtml='<span style="color:'+c+';font-size:12px;margin-left:6px">'+a+' '+Math.abs(d)+(opts.deltaSuffix||'')+'</span>'; }
    return '<div style="text-align:'+(opts.align||'left')+'">'
      +'<div style="font:600 10px/1 system-ui;letter-spacing:.1em;text-transform:uppercase;color:var(--ip-ink-3);margin-bottom:6px">'+esc(label)+'</div>'
      +'<div style="font:700 italic 30px Georgia;color:'+(opts.color||'var(--ip-cream)')+';line-height:1">'+(val==null?'—':val)+deltaHtml+'</div>'
      +(opts.sub?'<div style="font-size:11px;color:var(--ip-ink-4);margin-top:4px">'+esc(opts.sub)+'</div>':'')+'</div>';
  }

  window.IpUI = { esc:esc, kpi:kpi, badge:badge, btn:btn, field:field, select:select, emptyState:emptyState, skeleton:skeleton, toast:toast, modal:modal, doughnut:doughnut, barras:barras, gauge:gauge, sparkline:sparkline, statBig:statBig };
})();
