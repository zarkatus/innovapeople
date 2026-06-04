// InnovaPeople · EVM People (client) · Sprint #5 item 3 · PQV-01 04/06
// Elimina o stub "Ver demonstração" do Centro de Comando: aqui o EVM é REAL, sobre os
// programas de gente vivos (ip_programas + fn_ip_evm_resumo + ip_programa_marcos).
// Curva-S por marcos (PV/EV/AC acumulados), gauges CPI/SPI (semáforo), EVM por marco e
// diagnóstico IA que raciocina. MODULAR: window.IpEvm.render(hostEl, {programa?}).
// Reusa ip-ui.js (gauge/sparkline/statBig). Honesto sobre dados ausentes (PQV-01).
(function(){
  'use strict';
  if(window.IpEvm) return;
  var SB=function(){ return window.__IP_SB||window.sb; };
  var U=function(){ return window.IpUI; };
  var esc=function(s){ return (window.IpUI&&IpUI.esc)?IpUI.esc(s):String(s==null?'':s); };
  var MODEL='claude-haiku-4-5-20251001';
  function brl(n){ if(n==null||isNaN(n))return '—'; return (+n).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}); }

  async function _programas(){
    var q=SB().from('ip_programas').select('id,nome,tipo,status,pv_total,ev_total,ac_total,mandato_id').neq('status','cancelado').order('nome');
    var ids = (window.IpOrg && IpOrg.scope && IpOrg.scope.mandatoIds) ? IpOrg.scope.mandatoIds() : null;
    if(ids && ids.length) q=q.in('mandato_id', ids); // reescopo pela subárvore do nó corrente
    var r=await q;
    return r.error?[]:(r.data||[]);
  }
  async function _evm(pid){
    var r=await SB().rpc('fn_ip_evm_resumo',{p_programa_id:pid});
    return r.error?null:r.data;
  }
  async function _marcos(pid){
    var r=await SB().from('ip_programa_marcos').select('ordem,titulo,pv,ev,ac,status,data_planejada,data_real').eq('programa_id',pid).order('ordem');
    return r.error?[]:(r.data||[]);
  }

  // curva-S por marcos: acumulados PV/EV/AC ao longo da sequência (dado real, sem depender de série temporal)
  function _curvaS(marcos){
    var pv=0,ev=0,ac=0, sPV=[],sEV=[],sAC=[];
    marcos.forEach(function(m){ pv+=+m.pv||0; ev+=+m.ev||0; ac+=+m.ac||0; sPV.push(pv); sEV.push(ev); sAC.push(ac); });
    return { sPV:sPV, sEV:sEV, sAC:sAC, pv:pv, ev:ev, ac:ac };
  }
  // SVG curva-S de 3 linhas (PV cinza tracejado, EV dourado, AC vermelho/verde) — vanilla, tokens
  function _svgCurva(c, w, h){
    w=w||520; h=h||200; var pad=8;
    var all=c.sPV.concat(c.sEV,c.sAC).filter(function(x){return !isNaN(x);});
    if(!all.length || c.sPV.length<2) return '<div style="color:var(--ip-ink-4);font-style:italic;padding:20px 0">Curva-S exige ao menos 2 marcos.</div>';
    var mx=Math.max.apply(null,all)||1, n=c.sPV.length;
    function path(serie, dash){
      var d=serie.map(function(v,i){ var x=pad+(i/(n-1))*(w-2*pad); var y=h-pad-((v/mx)*(h-2*pad)); return (i?'L':'M')+x.toFixed(1)+','+y.toFixed(1); }).join(' ');
      return d;
    }
    return '<svg viewBox="0 0 '+w+' '+h+'" width="100%" height="'+h+'" role="img" aria-label="Curva-S PV EV AC" style="display:block">'
      +'<path d="'+path(c.sPV)+'" fill="none" stroke="var(--ip-ink-3)" stroke-width="1.6" stroke-dasharray="4 4"/>'
      +'<path d="'+path(c.sAC)+'" fill="none" stroke="'+(c.ac>c.ev?'var(--ip-danger-2)':'var(--ip-ok-deep)')+'" stroke-width="2"/>'
      +'<path d="'+path(c.sEV)+'" fill="none" stroke="var(--ip-gold-lum)" stroke-width="2.4"/>'
      +'</svg>'
      +'<div style="display:flex;gap:16px;margin-top:8px;font-size:11px;color:var(--ip-ink-3)">'
      +'<span><b style="color:var(--ip-ink-3)">┄</b> PV planejado</span>'
      +'<span><b style="color:var(--ip-gold-lum)">─</b> EV entregue</span>'
      +'<span><b style="color:'+(c.ac>c.ev?'var(--ip-danger)':'var(--ip-ok)')+'">─</b> AC custo</span></div>';
  }

  function _statusBadge(st){ var c=st==='concluido'?'var(--ip-ok)':st==='em_andamento'?'var(--ip-gold-lum)':'var(--ip-ink-3)'; return '<span style="font:600 9.5px/1 system-ui;padding:3px 8px;border-radius:8px;color:'+c+';background:color-mix(in srgb,'+c+' 16%,transparent)">'+esc(st||'—')+'</span>'; }

  async function _diagIA(evm, marcos, host){
    var out=host.querySelector('#evm-ia-out'); if(!out) return;
    // leitura determinística via módulo reutilizável IpDiag (sempre disponível, sem IA)
    var dd = window.IpDiag ? IpDiag.evm(evm, marcos) : {leitura:'',acao:''};
    var regras = (dd.leitura||'') + (dd.acao?(' Ação: '+dd.acao):'');
    out.innerHTML='<div style="color:var(--ip-ink-3);font-style:italic">Lendo o EVM e raciocinando…</div>';
    var resumo='Programa "'+evm.programa+'" ('+evm.tipo+'): PV '+evm.pv+', EV '+evm.ev+', AC '+evm.ac+', CPI '+(evm.cpi||0).toFixed(2)+', SPI '+(evm.spi||0).toFixed(2)+'. Marcos: '+marcos.map(function(m){return m.titulo+' ['+m.status+', pv '+m.pv+'/ev '+m.ev+'/ac '+m.ac+']';}).join('; ')+'.';
    var prompt='Você é o analista de EVM (gestão de valor agregado) da InnovaPeople, aplicado a programas de desenvolvimento de gente. '+resumo+' '
      +'Em até 4 frases, português executivo, sem markdown: leia a saúde (CPI<1=acima do custo, SPI<1=atrasado), aponte o marco que mais pesa, e dê UMA ação concreta. Cite os números.';
    function fallback(nota){ out.innerHTML='<div style="font-size:14px;line-height:1.6;color:var(--ip-cream)">'+esc(regras)+'</div>'+(nota?'<div style="font-size:11px;color:var(--ip-ink-4);margin-top:8px;font-style:italic">'+esc(nota)+'</div>':''); }
    try{
      var r=await SB().functions.invoke('ai-proxy',{body:{model:MODEL,max_tokens:380,messages:[{role:'user',content:prompt}]}});
      if(r.error){ fallback('Leitura por regras (copiloto IA indisponível — verificar créditos da API).'); return; }
      var txt=(r.data&&r.data.content&&r.data.content.filter(function(x){return x.type==='text';}).map(function(x){return x.text;}).join('\n'))||'';
      if(txt) out.innerHTML='<div style="font-size:14px;line-height:1.6;color:var(--ip-cream);white-space:pre-wrap">'+esc(txt)+'</div>';
      else fallback('Leitura por regras.');
    }catch(e){ fallback('Leitura por regras (copiloto IA indisponível).'); }
  }

  function _injectCss(){
    if(document.getElementById('ip-evm-css'))return;
    var st=document.createElement('style'); st.id='ip-evm-css';
    st.textContent=
      '.evm-sel{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}'
     +'.evm-pill{padding:8px 14px;border-radius:20px;border:1px solid rgba(210,174,100,.2);background:transparent;color:var(--ip-ink-2);font-size:12.5px;cursor:pointer;transition:.15s}'
     +'.evm-pill:hover{border-color:var(--ip-gold-lum);color:var(--ip-cream)}'
     +'.evm-pill.on{background:color-mix(in srgb,var(--ip-gold-lum) 16%,transparent);border-color:var(--ip-gold-lum);color:var(--ip-gold-lum);font-weight:600}'
     +'.evm-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:16px;margin-bottom:18px}'
     +'@media(max-width:760px){.evm-grid{grid-template-columns:1fr}}'
     +'.evm-card{background:var(--ip-bg-card);border:1px solid rgba(210,174,100,.1);border-radius:14px;padding:18px 20px}'
     +'.evm-card h3{font-family:Georgia,serif;font-style:italic;font-weight:400;font-size:16px;color:var(--ip-gold-lum);margin-bottom:12px}'
     +'.evm-gauges{display:flex;gap:10px;justify-content:space-around}'
     +'.evm-mk{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid rgba(210,174,100,.06);font-size:12.5px}'
     +'.evm-mk:last-child{border-bottom:none}.evm-mk .nm{color:var(--ip-cream)}.evm-mk .vals{font-family:ui-monospace,monospace;font-size:11px;color:var(--ip-ink-2)}'
     +'.evm-ia{background:linear-gradient(135deg,#0C1626,#0A1320);border:1px solid rgba(210,174,100,.16);border-radius:14px;padding:18px 20px;margin-top:4px}'
     +'.evm-ia-lbl{font:600 10px/1 system-ui;letter-spacing:.16em;text-transform:uppercase;color:var(--ip-gold-lum);margin-bottom:10px}'
     +'.evm-chainwrap{display:flex;flex-direction:column;gap:0}'
     +'.evm-chain{display:flex;gap:12px;align-items:flex-start;padding:10px 0 14px;position:relative}'
     +'.evm-chain:not(:last-child)::after{content:"";position:absolute;left:13px;top:30px;bottom:-2px;width:2px;background:rgba(210,174,100,.14)}'
     +'.evm-chain-dot{width:28px;height:28px;border-radius:50%;flex:0 0 auto;display:flex;align-items:center;justify-content:center;font:700 12px/1 system-ui;color:var(--ip-bg-deep,#070D15);z-index:1}'
     +'.evm-chain.gargalo .evm-chain-dot{box-shadow:0 0 0 4px color-mix(in srgb,var(--ip-gold-lum) 22%,transparent)}'
     +'.evm-chain-nm{font-size:13.5px;color:var(--ip-cream);font-weight:500}'
     +'.evm-chain-tag{font:600 8.5px/1 system-ui;letter-spacing:.1em;text-transform:uppercase;color:var(--ip-gold-lum);background:color-mix(in srgb,var(--ip-gold-lum) 16%,transparent);padding:3px 7px;border-radius:7px;margin-left:6px}'
     +'.evm-chain-meta{font-size:11px;color:var(--ip-ink-3);margin-top:4px}';
    (document.head||document.documentElement).appendChild(st);
  }

  var _progs=[], _sel=null;
  async function _renderProg(host, pid){
    _sel=pid;
    host.querySelectorAll('.evm-pill').forEach(function(p){ p.classList.toggle('on', p.dataset.pid===pid); });
    var body=host.querySelector('#evm-body');
    body.innerHTML = U().skeleton ? U().skeleton(4) : 'Carregando…';
    var res=await Promise.all([_evm(pid), _marcos(pid)]);
    var evm=res[0], marcos=res[1];
    if(!evm){ body.innerHTML='<div style="color:var(--ip-ink-4);font-style:italic;padding:24px">Sem EVM para este programa.</div>'; return; }
    var c=_curvaS(marcos);
    var avancoPct = evm.pv>0 ? Math.round(evm.ev/evm.pv*100) : 0;
    body.innerHTML =
      '<div class="evm-grid">'
        +'<div class="evm-card"><h3>Curva de valor agregado</h3>'+_svgCurva(c)+'</div>'
        +'<div class="evm-card"><h3>Índices de desempenho</h3>'
          +'<div class="evm-gauges">'+U().gauge(evm.cpi,{label:'CPI · custo',max:2,alvo:1})+U().gauge(evm.spi,{label:'SPI · prazo',max:2,alvo:1})+'</div>'
          +'<div style="margin-top:14px;display:flex;justify-content:space-around;text-align:center">'
            +'<div>'+U().statBig(brl(evm.ev),'Entregue (EV)',{align:'center',color:'var(--ip-gold-lum)'})+'</div>'
            +'<div>'+U().statBig(avancoPct+'%','Avanço',{align:'center',color:'var(--ip-ok)'})+'</div></div>'
        +'</div>'
      +'</div>'
      +'<div class="evm-card" style="margin-bottom:18px"><h3>EVM por marco</h3>'
        +(marcos.length?marcos.map(function(m){
          return '<div class="evm-mk"><span class="nm">'+esc(m.titulo)+'</span>'
            +'<span class="vals">PV '+brl(m.pv)+' · EV '+brl(m.ev)+' · AC '+brl(m.ac)+'</span>'+_statusBadge(m.status)+'</div>';
        }).join(''):'<div style="color:var(--ip-ink-4);font-style:italic">Sem marcos cadastrados.</div>')
      +'</div>'
      +'<div class="evm-ia"><div class="evm-ia-lbl">◆ Diagnóstico EVM · IA</div><div id="evm-ia-out"><div style="color:var(--ip-ink-3);font-style:italic">Lendo…</div></div></div>';
    _diagIA(evm, marcos, host);
  }

  async function render(host, opts){
    opts=opts||{}; if(!host) return; _injectCss();
    if(!window.IpUI || !SB()){ setTimeout(function(){render(host,opts);},150); return; }
    host.innerHTML = '<div class="evm-sel" id="evm-sel"></div><div id="evm-body">'+(U().skeleton?U().skeleton(3):'…')+'</div>';
    _progs=await _programas();
    var sel=host.querySelector('#evm-sel');
    if(!_progs.length){ host.querySelector('#evm-body').innerHTML='<div style="color:var(--ip-ink-4);font-style:italic;padding:24px">Nenhum programa de gente cadastrado ainda. Crie um no Centro de Comando para acompanhar o EVM.</div>'; sel.innerHTML=''; return; }
    sel.innerHTML=_progs.map(function(p){ return '<button class="evm-pill" data-pid="'+esc(p.id)+'">'+esc(p.nome)+'</button>'; }).join('');
    sel.querySelectorAll('.evm-pill').forEach(function(b){ b.onclick=function(){ _renderProg(host, b.dataset.pid); }; });
    _renderProg(host, opts.programa || _progs[0].id);
    // reescopo: ao trocar o nó na árvore, recarrega os programas da subárvore (1×)
    if(window.IpOrg && IpOrg.scope && IpOrg.scope.onChange && !host._ipEvmScoped){
      host._ipEvmScoped = true;
      IpOrg.scope.onChange(function(){ render(host, opts); });
    }
  }

  // ── CPM por SEQUÊNCIA (sem datas/dependências fictícias — honesto sobre os dados reais) ──
  // Mostra a cadeia ordenada de marcos, o elo que trava, o peso EVM de cada um, e o avanço.
  async function _renderSeqProg(host, pid){
    _sel=pid;
    host.querySelectorAll('.evm-pill').forEach(function(p){ p.classList.toggle('on', p.dataset.pid===pid); });
    var body=host.querySelector('#evm-body');
    body.innerHTML = U().skeleton ? U().skeleton(4) : 'Carregando…';
    var marcos=await _marcos(pid);
    if(!marcos.length){ body.innerHTML='<div style="color:var(--ip-ink-4);font-style:italic;padding:24px">Este programa ainda não tem marcos cadastrados.</div>'; return; }
    var gargaloIdx=marcos.findIndex(function(m){return m.status!=='concluido';});
    var chain=marcos.map(function(m,i){
      var done=m.status==='concluido', isGargalo=i===gargaloIdx;
      var cor=done?'var(--ip-ok)':isGargalo?'var(--ip-gold-lum)':'var(--ip-ink-3)';
      var gap=(+m.ac||0)-(+m.ev||0);
      return '<div class="evm-chain'+(isGargalo?' gargalo':'')+'">'
        +'<div class="evm-chain-dot" style="background:'+cor+'">'+(done?'✓':i+1)+'</div>'
        +'<div class="evm-chain-body"><div class="evm-chain-nm">'+esc(m.titulo)+(isGargalo?' <span class="evm-chain-tag">elo atual</span>':'')+'</div>'
        +'<div class="evm-chain-meta">'+_statusBadge(m.status)+' · PV '+brl(m.pv)+' · EV '+brl(m.ev)+' · AC '+brl(m.ac)+(gap>0?' · <span style="color:var(--ip-danger)">+'+brl(gap)+' acima</span>':'')+'</div></div></div>';
    }).join('');
    var diag = window.IpDiag ? IpDiag.card(IpDiag.sequencia(marcos),{semIA:true}) : '';
    body.innerHTML='<div class="evm-card" style="margin-bottom:16px"><h3>Cadeia de marcos · o que segura o avanço</h3>'
      +'<div style="font-size:11.5px;color:var(--ip-ink-3);margin-bottom:14px">Sequência ordenada dos marcos. O <b style="color:var(--ip-gold-lum)">elo atual</b> é o primeiro não concluído — destravá-lo libera os seguintes. (Datas e dependências entram quando cadastradas.)</div>'
      +'<div class="evm-chainwrap">'+chain+'</div></div>'+diag;
  }
  async function renderSequencia(host, opts){
    opts=opts||{}; if(!host) return; _injectCss();
    if(!window.IpUI || !SB()){ setTimeout(function(){renderSequencia(host,opts);},150); return; }
    host.innerHTML = '<div class="evm-sel" id="evm-sel"></div><div id="evm-body">'+(U().skeleton?U().skeleton(3):'…')+'</div>';
    _progs=await _programas();
    var sel=host.querySelector('#evm-sel');
    if(!_progs.length){ host.querySelector('#evm-body').innerHTML='<div style="color:var(--ip-ink-4);font-style:italic;padding:24px">Nenhum programa cadastrado.</div>'; return; }
    sel.innerHTML=_progs.map(function(p){ return '<button class="evm-pill" data-pid="'+esc(p.id)+'">'+esc(p.nome)+'</button>'; }).join('');
    sel.querySelectorAll('.evm-pill').forEach(function(b){ b.onclick=function(){ _renderSeqProg(host, b.dataset.pid); }; });
    _renderSeqProg(host, opts.programa || _progs[0].id);
  }

  window.IpEvm={ render:render, renderSequencia:renderSequencia };
})();
