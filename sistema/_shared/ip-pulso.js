// InnovaPeople · Pulso Analytics (client) · Sprint #5 item 2 · PQV-01 04/06
// Fecha o loop INPUT->OUTPUT do Pulso: o formulário só coletava; aqui o gestor LÊ e DECIDE.
// 6D (Propósito/Autonomia/Competência/Pertencimento/Clareza/Segurança) + risco de saída,
// por equipe, com supressão N<5 (LGPD) já feita nas VIEWS server-side. Diagnóstico IA real.
// MODULAR: window.IpPulso.render(hostEl, {mandato}) — a página só importa e chama.
// Reusa ip-ui.js (gauge/sparkline/barras), v_core_clima_pulso, v_ip_pulso_tendencia,
// v_ip_pulso_comentarios, e o concierge (ai-proxy) para o diagnóstico que RACIOCINA.
(function(){
  'use strict';
  if(window.IpPulso) return;
  var SB=function(){ return window.__IP_SB||window.sb; };
  var U=function(){ return window.IpUI; };
  var esc=function(s){ return (window.IpUI&&IpUI.esc)?IpUI.esc(s):String(s==null?'':s); };
  var MODEL='claude-haiku-4-5-20251001';

  var DIMS=[
    {k:'proposito',n:'Propósito'},{k:'autonomia',n:'Autonomia'},{k:'competencia',n:'Competência'},
    {k:'pertencimento',n:'Pertencimento'},{k:'clareza',n:'Clareza'},{k:'seguranca',n:'Segurança psi.'}
  ];

  async function _clima(mandato){
    var q=SB().from('v_core_clima_pulso').select('equipe,respostas,score_medio,proposito,autonomia,competencia,pertencimento,clareza,seguranca,risco_saida,suprimido_privacidade,ultimo_pulso');
    if(mandato) q=q.eq('mandato_id',mandato);
    var r=await q.order('respostas',{ascending:false}); return r.error?[]:(r.data||[]);
  }
  async function _tend(mandato){
    var q=SB().from('v_ip_pulso_tendencia').select('equipe,mes,respostas,score_medio,risco_medio,suprimido');
    if(mandato) q=q.eq('mandato_id',mandato);
    var r=await q.order('mes',{ascending:true}); return r.error?[]:(r.data||[]);
  }
  async function _coment(mandato){
    var q=SB().from('v_ip_pulso_comentarios').select('equipe,created_at,risco_saida,score,comentario');
    if(mandato) q=q.eq('mandato_id',mandato);
    var r=await q.order('created_at',{ascending:false}).limit(12); return r.error?[]:(r.data||[]);
  }

  function corDim(v){ if(v==null)return 'var(--ip-ink-4)'; return v>=4?'var(--ip-ok)': v>=3?'var(--ip-gold-lum)':'var(--ip-danger)'; }
  function corRisco(v){ if(v==null)return 'var(--ip-ink-4)'; return v>=3.5?'var(--ip-danger)': v>=2.5?'var(--ip-gold-lum)':'var(--ip-ok)'; }

  // heatmap 6D × equipe (célula = nota, cor semáforo; supressão = cadeado)
  function _heat(clima){
    var head='<th style="text-align:left">Equipe</th>'+DIMS.map(function(d){return '<th>'+esc(d.n)+'</th>';}).join('')+'<th>Risco saída</th><th>N</th>';
    var rows=clima.map(function(c){
      if(c.suprimido_privacidade){
        return '<tr><td>'+esc(c.equipe)+'</td><td colspan="7" style="color:var(--ip-ink-4);font-style:italic">🔒 menos de 5 respostas — oculto por privacidade</td><td>'+c.respostas+'</td></tr>';
      }
      var cells=DIMS.map(function(d){ var v=c[d.k]; var cor=corDim(v);
        return '<td><span class="pz-cell" style="background:color-mix(in srgb,'+cor+' 20%,transparent);color:'+cor+'">'+(v==null?'—':v)+'</span></td>'; }).join('');
      var rc=corRisco(c.risco_saida);
      return '<tr><td><strong>'+esc(c.equipe)+'</strong></td>'+cells
        +'<td><span class="pz-cell" style="background:color-mix(in srgb,'+rc+' 22%,transparent);color:'+rc+'">'+(c.risco_saida==null?'—':c.risco_saida)+'</span></td>'
        +'<td style="color:var(--ip-ink-3)">'+c.respostas+'</td></tr>';
    }).join('');
    return '<table class="pz-heat"><thead><tr>'+head+'</tr></thead><tbody>'+rows+'</tbody></table>';
  }

  // sparkline de score por equipe ao longo dos meses
  function _trends(tend){
    var byEq={}; tend.forEach(function(t){ (byEq[t.equipe]=byEq[t.equipe]||[]).push(t); });
    var keys=Object.keys(byEq); if(!keys.length) return '';
    return '<div class="pz-trends">'+keys.map(function(eq){
      var serie=byEq[eq].map(function(x){return x.score_medio==null?null:+x.score_medio;}).filter(function(x){return x!=null;});
      var spark = serie.length>=2 && U().sparkline ? U().sparkline(serie,{width:120,height:30}) : '<span class="pz-nosp">série curta</span>';
      var last=serie.length?serie[serie.length-1]:null;
      return '<div class="pz-trend"><div class="pz-trend-h"><span>'+esc(eq)+'</span><b>'+(last!=null?last+'/100':'—')+'</b></div>'+spark+'</div>';
    }).join('')+'</div>';
  }

  function _comentarios(coment){
    if(!coment.length) return '<div class="pz-empty">Sem comentários anônimos ainda.</div>';
    return coment.map(function(c){
      var rc=corRisco(c.risco_saida);
      return '<div class="pz-com"><div class="pz-com-bar" style="background:'+rc+'"></div>'
        +'<div class="pz-com-body"><div class="pz-com-tx">"'+esc(c.comentario)+'"</div>'
        +'<div class="pz-com-meta">'+esc(c.equipe)+' · risco '+(c.risco_saida||'—')+'/5</div></div></div>';
    }).join('');
  }

  // diagnóstico IA que RACIOCINA sobre os agregados (não snapshot fixo)
  async function _diagnosticoIA(clima, host){
    var out=host.querySelector('#pz-ia-out'); if(out) out.innerHTML='<div class="pz-ia-load">Lendo o clima e raciocinando…</div>';
    var visiveis=clima.filter(function(c){return !c.suprimido_privacidade;});
    if(!visiveis.length){ if(out)out.innerHTML='<div class="pz-empty">Sem equipes com N≥5 — colete mais respostas para o diagnóstico (privacidade).</div>'; return; }
    var resumo=visiveis.map(function(c){ return c.equipe+': 6D[prop '+c.proposito+', auton '+c.autonomia+', compet '+c.competencia+', perten '+c.pertencimento+', clareza '+c.clareza+', segur '+c.seguranca+'], risco_saida '+c.risco_saida+'/5 (N='+c.respostas+')'; }).join(' | ');
    var prompt='Você é o analista de clima organizacional da InnovaPeople. Eis o Pulso 6D anônimo por equipe (escala 1-5; risco_saida 1-5, quanto maior pior): '+resumo+'. '
      +'Em até 4 frases, em português, tom executivo e humano: aponte a equipe e a dimensão de MAIOR risco, explique o que o padrão sugere, e dê UMA ação concreta priorizada. Sem markdown. Seja específico (cite os números).';
    // leitura determinística (sempre disponível, sem crédito de IA) via módulo central
    var dd = window.IpDiag ? IpDiag.clima(clima) : {leitura:'',acao:''};
    var regras = (dd.leitura||'') + (dd.acao?(' Ação: '+dd.acao):'');
    function fallback(nota){ if(out) out.innerHTML='<div class="pz-ia-txt">'+esc(regras)+'</div>'+(nota?'<div style="font-size:11px;color:var(--ip-ink-4);margin-top:8px;font-style:italic">'+esc(nota)+'</div>':''); }
    try{
      var r=await SB().functions.invoke('ai-proxy',{body:{model:MODEL,max_tokens:400,messages:[{role:'user',content:prompt}]}});
      if(r.error){ fallback('Leitura por regras — copiloto IA indisponível (verificar créditos da API).'); return; }
      var txt=(r.data&&r.data.content&&r.data.content.filter(function(x){return x.type==='text';}).map(function(x){return x.text;}).join('\n'))||'';
      if(txt && out) out.innerHTML='<div class="pz-ia-txt">'+esc(txt)+'</div>';
      else fallback('Leitura por regras.');
    }catch(e){ fallback('Leitura por regras — copiloto IA indisponível.'); }
  }

  function _injectCss(){
    if(document.getElementById('ip-pulso-css'))return;
    var st=document.createElement('style'); st.id='ip-pulso-css';
    st.textContent=
      '.pz-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:20px}'
     +'.pz-heat{width:100%;border-collapse:separate;border-spacing:4px;font-size:12.5px}'
     +'.pz-heat th{font:600 9.5px/1.2 system-ui;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-ink-3);padding:6px 4px;text-align:center}'
     +'.pz-heat td{text-align:center;padding:2px}'
     +'.pz-cell{display:inline-block;min-width:38px;padding:7px 6px;border-radius:8px;font-variant-numeric:tabular-nums;font-weight:600}'
     +'.pz-trends{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px}'
     +'.pz-trend{background:var(--ip-bg-deep);border:1px solid rgba(210,174,100,.09);border-radius:11px;padding:12px 14px}'
     +'.pz-trend-h{display:flex;justify-content:space-between;font-size:12px;color:var(--ip-ink-2);margin-bottom:6px}.pz-trend-h b{color:var(--ip-cream)}'
     +'.pz-nosp{font-size:10px;color:var(--ip-ink-4)}'
     +'.pz-com{display:flex;gap:10px;background:var(--ip-bg-deep);border:1px solid rgba(210,174,100,.07);border-radius:10px;padding:11px 12px;margin-bottom:9px}'
     +'.pz-com-bar{width:3px;border-radius:3px;flex:0 0 auto}.pz-com-tx{font-size:13px;color:var(--ip-cream);line-height:1.45;font-style:italic}'
     +'.pz-com-meta{font-size:10.5px;color:var(--ip-ink-4);margin-top:5px;font-family:ui-monospace,monospace}'
     +'.pz-ia{background:linear-gradient(135deg,#0C1626,#0A1320);border:1px solid rgba(210,174,100,.16);border-radius:14px;padding:18px 20px;margin-top:8px}'
     +'.pz-ia-lbl{font:600 10px/1 system-ui;letter-spacing:.16em;text-transform:uppercase;color:var(--ip-gold-lum);margin-bottom:10px}'
     +'.pz-ia-txt{font-size:14.5px;line-height:1.6;color:var(--ip-cream);white-space:pre-wrap}'
     +'.pz-ia-load,.pz-empty{color:var(--ip-ink-3);font-style:italic;padding:8px 0}'
     +'.pz-ia-btn{margin-top:12px;background:var(--ip-gold-lum);color:#1a1205;font-weight:600;font-size:12.5px;padding:9px 16px;border-radius:10px;border:none;cursor:pointer}';
    (document.head||document.documentElement).appendChild(st);
  }

  async function render(host, opts){
    opts=opts||{}; if(!host) return; _injectCss();
    if(!window.IpUI || !SB()){ setTimeout(function(){render(host,opts);},150); return; }
    host.innerHTML = U().skeleton ? U().skeleton(5) : 'Carregando…';
    var res=await Promise.all([_clima(opts.mandato),_tend(opts.mandato),_coment(opts.mandato)]);
    var clima=res[0], tend=res[1], coment=res[2];
    // robustez: se a sessão ainda não estava pronta (clima vazio mas há comentários), re-tenta 1×
    if(!clima.length && !coment.length && !(opts._retry)){ setTimeout(function(){ render(host, Object.assign({},opts,{_retry:true})); }, 400); return; }

    var totalResp=clima.reduce(function(a,c){return a+(c.respostas||0);},0);
    var visiveis=clima.filter(function(c){return !c.suprimido_privacidade;});
    var risco=visiveis.filter(function(c){return c.risco_saida!=null;});
    var riscoMax=risco.length?risco.reduce(function(a,c){return c.risco_saida>a.risco_saida?c:a;}):null;

    var kpis='<div class="pz-kpis">'
      +'<div class="panel">'+U().statBig(totalResp,'Respostas',{sub:clima.length+' equipe(s)'})+'</div>'
      +'<div class="panel">'+U().statBig(visiveis.length,'Equipes visíveis',{sub:(clima.length-visiveis.length)+' ocultas N<5',color:'var(--ip-gold-lum)'})+'</div>'
      +'<div class="panel">'+U().statBig(riscoMax?riscoMax.risco_saida+'/5':'—','Maior risco de saída',{sub:riscoMax?riscoMax.equipe:'—',color:riscoMax&&riscoMax.risco_saida>=3.5?'var(--ip-danger)':'var(--ip-cream)'})+'</div>'
      +'</div>';

    host.innerHTML = kpis
      +'<div class="panel" style="margin-bottom:18px"><h2 style="font-family:Georgia;font-style:italic;color:var(--ip-gold-lum);font-weight:400;font-size:18px;margin-bottom:4px">Mapa de calor · 6 dimensões</h2>'
      +'<div style="font-size:11.5px;color:var(--ip-ink-3);margin-bottom:14px">Propósito, Autonomia, Competência, Pertencimento, Clareza e Segurança psicológica por equipe. Verde ≥4 · dourado ≥3 · vermelho &lt;3. Supressão N&lt;5 (LGPD).</div>'
      + _heat(clima)+'</div>'
      +'<div class="panel" style="margin-bottom:18px"><h2 style="font-family:Georgia;font-style:italic;color:var(--ip-gold-lum);font-weight:400;font-size:18px;margin-bottom:14px">Tendência do score por equipe</h2>'+ (_trends(tend)||'<div class="pz-empty">Série temporal curta ainda.</div>') +'</div>'
      +'<div class="pz-ia"><div class="pz-ia-lbl">◆ Diagnóstico de clima · IA</div><div id="pz-ia-out"><div class="pz-ia-load">Pronto para ler o clima.</div></div><button class="pz-ia-btn" id="pz-ia-btn">Gerar diagnóstico</button></div>'
      +'<div class="panel" style="margin-top:18px"><h2 style="font-family:Georgia;font-style:italic;color:var(--ip-gold-lum);font-weight:400;font-size:18px;margin-bottom:14px">Vozes anônimas</h2>'+ _comentarios(coment) +'</div>';

    var btn=host.querySelector('#pz-ia-btn');
    if(btn) btn.onclick=function(){ _diagnosticoIA(clima, host); };
    // auto-roda o diagnóstico se há equipes visíveis (loop input->output completo)
    if(visiveis.length) _diagnosticoIA(clima, host);
  }

  window.IpPulso={ render:render };
})();
