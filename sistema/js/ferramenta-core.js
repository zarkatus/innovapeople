// IpFerramenta - Organismo de Decisao (core reutilizavel). Diretiva CVO 29/05:
// ferramentas disruptivas com diagnostico completo, linha do tempo do passado,
// trilha de proximos passos (IREU), propagacao (EventBus) e agente IA de verdade.
// Toda ferramenta injeta seu DIAGNOSTICO e o core acopla: SINTESE IA + PROXIMOS
// PASSOS (ip_plano_acoes) + PASSADO (ip_eventos) + PROPAGACAO.
// API: IpFerramenta.organismo(hostEl, cfg)
//   cfg = { chave, mandato, rotulo, diagnosticoHTML, fontesEvento:[], consumidores:[{nome,porque}] }
(function(){
  'use strict';
  if(window.IpFerramenta) return;
  const sb=()=>window.__IP_SB||window.sb;
  const T=window.TB||{esc:s=>String(s==null?'':s),fmtRel:s=>s,safe:async(f,fb)=>{try{return await f()}catch(e){return fb}},toast:m=>alert(m)};
  const esc=T.esc;
  const fmtRel=T.fmtRel||(s=>s);
  let _active=null;
  async function _efErro(error){let m=(error&&error.message)||String(error);try{const b=(error&&error.context&&error.context.json)?await error.context.json():null;if(b&&b.erro)m=b.erro;}catch(_){}return new Error(m);}

  function ireuTotal(a){ return a.ireu_score || ((a.impacto||0)*(a.relevancia||0)*(a.efeito_borboleta||0)*(a.urgencia||0)); }
  function tier(score){ if(score>=200)return{t:'t1',l:'Tier 1 - agir ja'}; if(score>=100)return{t:'t2',l:'Tier 2 - proxima sprint'}; if(score>=50)return{t:'t3',l:'Tier 3 - backlog'}; return{t:'t4',l:'monitorar'}; }

  async function organismo(host, cfg){
    cfg = cfg || {};
    _active = host; host._fc = cfg;
    host.innerHTML =
      (cfg.diagnosticoHTML||'') +
      '<div id="fc-sintese" class="fc-sec"></div>' +
      '<div id="fc-passos" class="fc-sec"></div>' +
      '<div id="fc-passado" class="fc-sec"></div>' +
      '<div id="fc-propag" class="fc-sec"></div>';
    renderSintese(host);
    await Promise.all([ renderPassos(host), renderPassado(host), renderPropag(host) ]);
  }

  async function renderSintese(host){
    const cfg=host._fc; const el=host.querySelector('#fc-sintese'); if(!el)return;
    const {data}=await T.safe(()=>sb().from('ip_agent_runs').select('payload,concluido_em').eq('agente','claude_diagnostico').eq('mandato_id',cfg.mandato).eq('status','concluido').order('concluido_em',{ascending:false}).limit(1),{data:[]});
    const last=(data||[])[0]; const sint=last&&last.payload&&last.payload.sintese;
    el.innerHTML = `<div class="fc-banner">
      <div class="fc-banner-ico">&#9670;</div>
      <div class="fc-banner-body">
        <div class="fc-banner-lab">Diagnostico do Org Designer &middot; IA</div>
        <div class="fc-banner-txt" id="fc-sint-txt">${sint?esc(sint):'Rode o diagnostico de IA para uma leitura completa do passado, do presente e da trilha de proximos passos pontuada por IREU.'}</div>
        ${last?`<div class="fc-banner-meta">ultima analise ${fmtRel(last.concluido_em)}</div>`:''}
      </div>
      <button class="fc-ia-btn" id="fc-ia-btn" onclick="IpFerramenta._diagnosticarIA(this)">Diagnostico IA</button>
    </div><div id="fc-ia-out"></div>`;
  }

  async function _diagnosticarIA(btn){
    const host=_active; if(!host)return; const cfg=host._fc;
    if(!cfg.mandato){T.toast('Selecione um trabalho primeiro');return}
    btn.disabled=true; const old=btn.textContent; btn.innerHTML='<span class="fc-spin"></span>Analisando&hellip;';
    try{
      const {data,error}=await sb().functions.invoke('ip-agent-claude',{body:{mandato_id:cfg.mandato,ferramenta:cfg.chave||'mattering',persistir:true}});
      if(error)throw await _efErro(error);
      if(data&&data.erro)throw new Error(data.erro);
      renderIAResult(host,data||{});
      await renderPassos(host);
      T.toast('Diagnostico concluido'+(data&&data.persistidos?' - '+data.persistidos+' passos adicionados ao plano':''));
    }catch(e){T.toast('Erro IA: '+(e.message||e))}
    finally{btn.disabled=false;btn.textContent=old}
  }

  function renderIAResult(host,d){
    const out=host.querySelector('#fc-ia-out'); if(!out)return;
    const t=host.querySelector('#fc-sint-txt'); if(t&&d.sintese)t.textContent=d.sintese;
    out.innerHTML = `<div class="fc-ia-card">
      ${d.diagnostico?`<div class="fc-ia-block"><span class="fc-ia-h">Diagnostico</span><p>${esc(d.diagnostico)}</p></div>`:''}
      ${d.risco_principal?`<div class="fc-ia-block fc-risco"><span class="fc-ia-h">Risco principal</span><p>${esc(d.risco_principal)}</p></div>`:''}
      ${(d.proximos_passos&&d.proximos_passos.length)?`<div class="fc-ia-block"><span class="fc-ia-h">${d.proximos_passos.length} proximos passos gerados &mdash; veja a trilha priorizada por IREU abaixo.</span></div>`:''}
    </div>`;
  }

  async function renderPassos(host){
    const cfg=host._fc; const el=host.querySelector('#fc-passos'); if(!el)return;
    let q=sb().from('ip_plano_acoes').select('*');
    if(cfg.mandato)q=q.eq('mandato_id',cfg.mandato);
    const {data}=await T.safe(()=>q.order('ireu_score',{ascending:false,nullsFirst:false}).limit(100),{data:[]});
    const arr=(data||[]).filter(a=>a.status==='pendente'||a.status==='em_andamento');
    const head=`<div class="fc-sec-h"><span class="fc-sec-t">Proximos passos &middot; trilha priorizada (IREU)</span>
      <button class="fc-ghost" onclick="IpFerramenta._gerarRegras(this)">Gerar pelas regras</button></div>`;
    if(!arr.length){ el.innerHTML=head+`<div class="fc-empty">Nenhum passo no plano ainda. Rode o <strong>Diagnostico IA</strong> ou gere pelas regras para montar a trilha do que fazer a partir dos dados.</div>`; return; }
    el.innerHTML=head+arr.map(passoCard).join('');
  }

  function passoCard(a){
    const score=ireuTotal(a); const tr=tier(score);
    const origMap={template:'curado',gerado_template:'curado',sugestao_agente:'agente vigia',agente_claude:'IA'};
    const orig=origMap[a.origem]||a.origem||'-';
    return `<div class="fc-passo ${tr.t}">
      <div class="fc-passo-top">
        <div class="fc-passo-titulo">${esc(a.titulo)}</div>
        <div class="fc-passo-ireu" title="Impacto x Relevancia x Borboleta x Urgencia">${score}</div>
      </div>
      ${a.descricao?`<div class="fc-passo-desc">${esc(a.descricao)}</div>`:''}
      <div class="fc-passo-meta">
        <span class="fc-mini" title="I R E U">I${a.impacto||'-'} R${a.relevancia||'-'} E${a.efeito_borboleta||'-'} U${a.urgencia||'-'}</span>
        <span class="fc-chip ${tr.t}c">${tr.l}</span>
        <span class="fc-chip muted">${esc(orig)}</span>
        ${a.frente?`<span class="fc-chip muted">${esc(a.frente)}</span>`:''}
        ${a.responsavel?`<span class="fc-chip">${esc(a.responsavel)}</span>`:''}
        ${a.prazo?`<span class="fc-chip prazo">ate ${esc(a.prazo)}</span>`:''}
        <button class="fc-done" onclick="IpFerramenta._concluir('${esc(a.id)}',this)">concluir</button>
      </div>
    </div>`;
  }

  async function _concluir(id,btn){
    btn.disabled=true;
    try{
      const {error}=await sb().from('ip_plano_acoes').update({status:'concluida',concluida_em:new Date().toISOString()}).eq('id',id);
      if(error)throw error;
      const card=btn.closest('.fc-passo'); if(card){card.classList.add('done');setTimeout(()=>card.remove(),420);}
      T.toast('Passo concluido');
    }catch(e){btn.disabled=false;T.toast('Erro: '+(e.message||e))}
  }

  async function _gerarRegras(btn){
    const host=_active; if(!host)return; const cfg=host._fc;
    if(!cfg.mandato){T.toast('Selecione um trabalho');return}
    btn.disabled=true; const old=btn.textContent; btn.textContent='Gerando...';
    try{
      const {data,error}=await sb().rpc('fn_ip_plano_gerar',{p_mandato_id:cfg.mandato});
      if(error)throw error;
      await renderPassos(host);
      T.toast('Plano gerado pelas regras'+(Array.isArray(data)?' - '+data.length+' acoes':''));
    }catch(e){T.toast('Erro: '+(e.message||e))}
    finally{btn.disabled=false;btn.textContent=old}
  }

  function srcLabel(t){ return ({ip_pulsos:'Pulso',ip_pulse_tokens:'Link de pulso',ip_plano_acoes:'Plano de acao',ip_agent_sugestoes:'Sugestao de agente',ip_perfil_colaborador:'Colaborador',ip_skill_map:'Skill Map',ip_mandatos:'Trabalho',ip_decisoes:'Decisao',ip_relacionamentos:'Relacionamento'})[t]||t||'evento'; }
  function diffKeys(b,a){ b=b||{}; a=a||{}; const ks=new Set([...Object.keys(b),...Object.keys(a)]); const ch=[]; ks.forEach(k=>{ if(k==='updated_at'||k==='created_at'||k==='id')return; if(JSON.stringify(b[k])!==JSON.stringify(a[k]))ch.push(k); }); return ch; }

  async function renderPassado(host){
    const cfg=host._fc; const el=host.querySelector('#fc-passado'); if(!el)return;
    let q=sb().from('ip_eventos').select('id,ts,source_table,operacao,actor_email,before_payload,after_payload');
    if(cfg.mandato)q=q.eq('mandato_id',cfg.mandato);
    if(cfg.fontesEvento&&cfg.fontesEvento.length)q=q.in('source_table',cfg.fontesEvento);
    const {data}=await T.safe(()=>q.order('ts',{ascending:false}).limit(30),{data:[]});
    const arr=data||[];
    const head=`<div class="fc-sec-h"><span class="fc-sec-t">Linha do tempo &middot; o que aconteceu</span></div>`;
    if(!arr.length){ el.innerHTML=head+`<div class="fc-empty">Ainda sem eventos nesta frente. Cada acao na plataforma passa a aparecer aqui &mdash; trilha forense append-only.</div>`; return; }
    el.innerHTML=head+`<div class="fc-tl">`+arr.map(tlItem).join('')+`</div>`;
  }

  function tlItem(e){
    const op=(e.operacao||'').toUpperCase();
    const ico=op==='INSERT'?'+':(op==='DELETE'?'x':'~');
    const cls=op==='INSERT'?'ins':(op==='DELETE'?'del':'upd');
    let what;
    if(op==='INSERT')what='criado';
    else if(op==='DELETE')what='removido';
    else{ const ch=diffKeys(e.before_payload,e.after_payload); what=ch.length?('alterou '+ch.slice(0,4).join(', ')):'atualizado'; }
    return `<div class="fc-tl-item ${cls}"><div class="fc-tl-dot">${ico}</div><div class="fc-tl-body"><div class="fc-tl-line"><strong>${esc(srcLabel(e.source_table))}</strong> &middot; ${esc(what)}</div><div class="fc-tl-meta">${e.actor_email?esc(e.actor_email)+' &middot; ':''}${fmtRel(e.ts)}</div></div></div>`;
  }

  async function renderPropag(host){
    const cfg=host._fc; const el=host.querySelector('#fc-propag'); if(!el)return;
    let q=sb().from('ip_eventos').select('id',{count:'exact',head:true});
    if(cfg.mandato)q=q.eq('mandato_id',cfg.mandato);
    if(cfg.fontesEvento&&cfg.fontesEvento.length)q=q.in('source_table',cfg.fontesEvento);
    q=q.gte('ts',new Date(Date.now()-7*864e5).toISOString());
    const res=await T.safe(()=>q,{count:0});
    const count=res&&res.count!=null?res.count:0;
    const cons=cfg.consumidores||[];
    el.innerHTML=`<div class="fc-sec-h"><span class="fc-sec-t">Propagacao &middot; efeito borboleta</span><span class="fc-chip">${count} eventos 7d</span></div>
      <div class="fc-propag-grid">${cons.length?cons.map(c=>`<div class="fc-propag-card"><div class="fc-propag-arrow">&rarr;</div><div><div class="fc-propag-nome">${esc(c.nome)}</div><div class="fc-propag-pq">${esc(c.porque)}</div></div></div>`).join(''):'<div class="fc-empty">Sem consumidores mapeados.</div>'}</div>
      <div class="fc-propag-note">Cada movimento desta ferramenta vira evento no EventBus e alimenta as demais &mdash; diagnostico, agentes e Sala de Guerra leem daqui.</div>`;
  }

  const CSS=`
  .fc-sec{margin-top:22px}
  .fc-banner{display:flex;align-items:center;gap:16px;padding:18px 20px;border-radius:14px;background:linear-gradient(135deg,rgba(196,163,90,.12),rgba(123,90,168,.10));border:1px solid var(--navy-edge,rgba(196,163,90,.25))}
  .fc-banner-ico{font-size:22px;color:var(--gold);flex-shrink:0}
  .fc-banner-body{flex:1;min-width:0}
  .fc-banner-lab{font-family:var(--mono);font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold-deep,#9a7b3a);font-weight:700;margin-bottom:5px}
  .fc-banner-txt{font-family:var(--serif);font-style:italic;font-size:16px;line-height:1.45;color:var(--cream)}
  .fc-banner-meta{font-family:var(--mono);font-size:10px;color:var(--cream-dim);margin-top:6px}
  .fc-ia-btn{flex-shrink:0;padding:12px 20px;border:none;border-radius:9px;background:linear-gradient(135deg,var(--gold-glow,#F5DDA5),var(--gold));color:#2A1A3B;font-family:var(--sans);font-weight:700;font-size:13px;cursor:pointer;transition:all .2s;white-space:nowrap}
  .fc-ia-btn:hover{transform:translateY(-1px);box-shadow:0 10px 26px rgba(196,163,90,.35)}
  .fc-ia-btn:disabled{opacity:.6;cursor:wait}
  .fc-spin{display:inline-block;width:12px;height:12px;border:2px solid rgba(42,26,59,.3);border-top-color:#2A1A3B;border-radius:50%;animation:fcspin .8s linear infinite;vertical-align:middle;margin-right:7px}
  @keyframes fcspin{to{transform:rotate(360deg)}}
  .fc-ia-card{margin-top:12px;display:flex;flex-direction:column;gap:10px}
  .fc-ia-block{padding:12px 16px;border-radius:10px;background:var(--navy-raised);border:1px solid var(--rule)}
  .fc-ia-block.fc-risco{border-left:3px solid var(--danger)}
  .fc-ia-h{display:block;font-family:var(--mono);font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold-deep,#9a7b3a);font-weight:700;margin-bottom:5px}
  .fc-ia-block p{margin:0;font-size:13.5px;line-height:1.55;color:var(--cream-muted)}
  .fc-sec-h{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;flex-wrap:wrap}
  .fc-sec-t{font-family:var(--mono);font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold-deep,#9a7b3a);font-weight:700}
  .fc-ghost{padding:8px 14px;border:1px solid var(--rule-strong);border-radius:7px;background:transparent;color:var(--gold);font-family:var(--sans);font-size:11.5px;font-weight:500;cursor:pointer;transition:all .2s}
  .fc-ghost:hover{background:rgba(196,163,90,.1);border-color:var(--gold)}
  .fc-empty{text-align:center;padding:26px 16px;color:var(--cream-dim);font-style:italic;font-family:var(--serif);font-size:14.5px;line-height:1.5}
  .fc-passo{padding:14px 16px;border-radius:11px;background:var(--navy-raised);border:1px solid var(--rule);border-left:3px solid var(--rule-strong);margin-bottom:10px;transition:opacity .4s,transform .4s}
  .fc-passo.t1{border-left-color:var(--danger)}
  .fc-passo.t2{border-left-color:var(--gold)}
  .fc-passo.t3{border-left-color:var(--info)}
  .fc-passo.done{opacity:.3;transform:translateX(12px)}
  .fc-passo-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
  .fc-passo-titulo{font-size:14.5px;font-weight:600;color:var(--cream);line-height:1.35}
  .fc-passo-ireu{flex-shrink:0;font-family:var(--serif);font-style:italic;font-size:22px;font-weight:600;color:var(--gold)}
  .fc-passo-desc{margin-top:6px;font-size:13px;line-height:1.5;color:var(--cream-muted)}
  .fc-passo-meta{margin-top:10px;display:flex;flex-wrap:wrap;gap:7px;align-items:center}
  .fc-mini{font-family:var(--mono);font-size:10px;font-weight:600;color:var(--cream-dim);letter-spacing:.05em}
  .fc-chip{font-family:var(--sans);font-size:10.5px;padding:3px 9px;border-radius:20px;background:rgba(196,163,90,.12);color:var(--gold);border:1px solid transparent}
  .fc-chip.muted{background:var(--navy-edge,rgba(255,255,255,.04));color:var(--cream-dim)}
  .fc-chip.prazo{background:rgba(123,165,216,.14);color:var(--info)}
  .fc-chip.t1c{background:rgba(216,117,117,.16);color:var(--danger)}
  .fc-chip.t2c{background:rgba(196,163,90,.16);color:var(--gold)}
  .fc-done{margin-left:auto;padding:5px 12px;border:1px solid var(--rule-strong);border-radius:6px;background:transparent;color:var(--cream-dim);font-size:10.5px;cursor:pointer;transition:all .18s}
  .fc-done:hover{border-color:var(--ok,#74c08f);color:var(--ok,#74c08f)}
  .fc-tl{position:relative;padding-left:6px}
  .fc-tl-item{display:flex;gap:12px;padding-bottom:14px;position:relative}
  .fc-tl-item:before{content:"";position:absolute;left:9px;top:20px;bottom:0;width:1px;background:var(--rule)}
  .fc-tl-item:last-child:before{display:none}
  .fc-tl-dot{flex-shrink:0;width:19px;height:19px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;font-family:var(--mono);z-index:1}
  .fc-tl-item.ins .fc-tl-dot{background:rgba(116,192,143,.18);color:var(--ok,#74c08f)}
  .fc-tl-item.upd .fc-tl-dot{background:rgba(196,163,90,.18);color:var(--gold)}
  .fc-tl-item.del .fc-tl-dot{background:rgba(216,117,117,.18);color:var(--danger)}
  .fc-tl-line{font-size:13px;color:var(--cream)}
  .fc-tl-meta{font-family:var(--mono);font-size:10px;color:var(--cream-dim);margin-top:2px}
  .fc-propag-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
  .fc-propag-card{display:flex;gap:10px;align-items:center;padding:12px 14px;border-radius:10px;background:var(--navy-raised);border:1px solid var(--rule)}
  .fc-propag-arrow{font-size:18px;color:var(--gold);flex-shrink:0}
  .fc-propag-nome{font-size:13px;font-weight:600;color:var(--cream)}
  .fc-propag-pq{font-size:11.5px;color:var(--cream-dim);line-height:1.4;margin-top:2px}
  .fc-propag-note{margin-top:10px;font-family:var(--serif);font-style:italic;font-size:13px;color:var(--cream-dim)}`;
  function injectCSS(){ if(document.getElementById('fc-css'))return; const s=document.createElement('style'); s.id='fc-css'; s.textContent=CSS; document.head.appendChild(s); }
  injectCSS();

  window.IpFerramenta={ organismo, ireuTotal, _diagnosticarIA, _concluir, _gerarRegras };
})();
