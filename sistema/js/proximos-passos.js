// IpProximosPassos - Cockpit central "Proximos passos" (5a camada do padrao).
// Le ip_agent_sugestoes pendentes (deteccao), mostra ai_insight enriquecido
// per sinal (enriquecimento cognitivo via EF ip-enrich-ia), oferece deep-link
// "Resolver em [ferramenta]", botao "Ja tratei" (status=revisada) e
// "Reavaliar agora" (re-roda agentes + enrich). Modular.
// API: IpProximosPassos.open(host) + IpProximosPassos.bloco(host, sourceTables[, opts])
(function(){
  'use strict';
  if(window.IpProximosPassos) return;
  const sb=()=>window.__IP_SB||window.sb;
  const T=window.TB||{esc:s=>String(s==null?'':s),safe:async(f,fb)=>{try{return await f()}catch(e){return fb}},toast:m=>alert(m),fmtRel:s=>s};
  const esc=T.esc;
  let _host=null,_data=null;
  const SEV_RANK={critica:5,alta:4,media:3,normal:3,baixa:2,info:1};
  const AGENTE_PARA_FERRAMENTA={
    pulse_anomaly_detector:{nm:'Mattering',href:'/sistema/toolbox/gente/'},
    mattering_coach:{nm:'Mattering',href:'/sistema/toolbox/gente/'},
    knowledge_retention_watchdog:{nm:'Skill Map',href:'/sistema/toolbox/gente/'},
    clock_drift_detector:{nm:'Decisoes',href:'/sistema/chro/'},
    critic_org_designer:{nm:'CHRO',href:'/sistema/chro/'},
    claude_diagnostico:{nm:'Sala de Guerra',href:'/sistema/toolbox/sala-de-guerra/'},
  };
  function alvo(agente){return AGENTE_PARA_FERRAMENTA[agente]||{nm:'Sala de Guerra',href:'/sistema/toolbox/sala-de-guerra/'};}

  async function open(host){
    _host=host;
    host.innerHTML='<div id="pp-root"><div class="pp-empty">Consolidando proximos passos&hellip;</div></div>';
    await carregar();
    render();
  }

  async function carregar(){
    const [mand, sug, run]=await Promise.all([
      T.safe(()=>sb().from('ip_mandatos').select('id,empresa,status').eq('status','ativo').order('empresa').limit(100),{data:[]}),
      T.safe(()=>sb().from('ip_agent_sugestoes').select('id,created_at,mandato_id,agente,severidade,titulo,sugestao,ai_insight,evidencias').eq('status','pendente').order('created_at',{ascending:false}).limit(200),{data:[]}),
      T.safe(()=>sb().from('ip_agent_runs').select('payload,concluido_em').eq('agente','claude_diagnostico').eq('status','concluido').order('concluido_em',{ascending:false}).limit(1),{data:[]}),
    ]);
    _data={mandatos:mand.data||[],sugestoes:sug.data||[],lastDiag:(run.data||[])[0]||null,mandato:null};
  }

  function filtradas(){
    let arr=_data.sugestoes.slice();
    if(_data.mandato)arr=arr.filter(s=>s.mandato_id===_data.mandato);
    arr.sort((a,b)=>{const da=SEV_RANK[a.severidade]||3,db=SEV_RANK[b.severidade]||3;if(db!==da)return db-da;return new Date(b.created_at)-new Date(a.created_at);});
    return arr;
  }

  function badge(sev){const r=SEV_RANK[sev]||3;const cls=r>=5?'cr':r>=4?'al':r>=3?'no':r>=2?'ba':'in';return '<span class="pp-sev pp-sev-'+cls+'">'+esc(sev||'normal')+'</span>';}

  function render(){
    const root=_host.querySelector('#pp-root');
    const arr=filtradas();
    const sint=_data.lastDiag&&_data.lastDiag.payload&&_data.lastDiag.payload.sintese;
    const sintTxt=sint?esc(sint):'Sem diagnostico cruzado recente. Clique em <strong>Diagnostico cruzado IA</strong> para a IA dizer por onde comecar.';
    let html='';
    html+='<div class="pp-hero"><div class="pp-eyebrow">5 camadas &middot; trilha acionavel</div><h1>Proximos <em>passos</em></h1><div class="pp-tag">Cada sinal detectado pelos agentes vem enriquecido por IA (causa + acao especifica). Voce decide a ordem, ou pede o diagnostico cruzado. Tudo o que <strong>ja foi tratado</strong> some daqui, fechando o loop.</div></div>';
    html+='<div class="pp-bar">';
    html+='<select class="pp-select" onchange="IpProximosPassos._setMandato(this.value||null)"><option value="">Todos os trabalhos</option>';
    _data.mandatos.forEach(m=>{html+='<option value="'+esc(m.id)+'"'+(_data.mandato===m.id?' selected':'')+'>'+esc(m.empresa||'(sem nome)')+'</option>';});
    html+='</select>';
    html+='<button class="pp-btn ghost" onclick="IpProximosPassos._reavaliar(this)">&#10227; Reavaliar agora</button>';
    html+='<button class="pp-btn" onclick="IpProximosPassos._diag(this)">Diagnostico cruzado IA</button>';
    html+='</div>';
    html+='<div class="pp-diag"><span class="pp-diag-ico">&#9670;</span><div class="pp-diag-body"><div class="pp-diag-lab">Diagnostico cruzado &middot; sequencia recomendada</div><div class="pp-diag-txt" id="pp-diag-txt">'+sintTxt+'</div></div></div>';
    html+='<div class="pp-sec-h">'+arr.length+' sinal'+(arr.length===1?'':'is')+' pendente'+(arr.length===1?'':'s')+'</div>';
    if(!arr.length){html+='<div class="pp-empty">Nada pendente neste recorte. Os agentes rodam diariamente as 07:30 UTC ou clique <strong>Reavaliar agora</strong>.</div>';}
    else{ html+='<div class="pp-list">'+arr.map(cardSinal).join('')+'</div>'; }
    root.innerHTML=html;
  }

  function cardSinal(s){
    const al=alvo(s.agente);
    const insight=s.ai_insight?'<div class="pp-insight"><span class="pp-insight-ico">&#128161;</span>'+esc(s.ai_insight)+'</div>':'<div class="pp-insight pp-no-insight">Sem leitura cognitiva ainda &mdash; clique em "Reavaliar agora" para o agente IA escrever a frase de causa+acao.</div>';
    return '<div class="pp-item">'+
      '<div class="pp-item-top">'+badge(s.severidade)+'<span class="pp-agente">'+esc(s.agente||'-')+'</span><span class="pp-time">'+esc(T.fmtRel(s.created_at)||'-')+'</span></div>'+
      '<div class="pp-titulo">'+esc(s.titulo||'(sem titulo)')+'</div>'+
      (s.sugestao?'<div class="pp-sugestao">'+esc(s.sugestao)+'</div>':'')+
      insight+
      '<div class="pp-actions">'+
      '<a class="pp-btn ghost" href="'+esc(al.href)+'">Resolver em '+esc(al.nm)+' &rarr;</a>'+
      '<button class="pp-btn ghost ok" onclick="IpProximosPassos._jaTratei(this,\''+esc(s.id)+'\')">&#10003; Ja tratei</button>'+
      '</div></div>';
  }

  function _setMandato(id){_data.mandato=id||null;render();}

  async function _reavaliar(btn){
    btn.disabled=true;const old=btn.innerHTML;btn.innerHTML='<span class="pp-spin"></span>Re-rodando agentes&hellip;';
    try{
      const det=await sb().rpc(_data.mandato?'fn_ip_agentes_rodar_todos':'fn_ip_agentes_rodar_todos',_data.mandato?{p_mandato_id:_data.mandato}:{});
      if(det.error)console.warn('agentes:',det.error);
      const body={limit:30}; if(_data.mandato)body.mandato_id=_data.mandato;
      const {data,error}=await sb().functions.invoke('ip-enrich-ia',{body});
      if(error)throw error; if(data&&data.erro)throw new Error(data.erro);
      T.toast('Reavaliacao: '+((data&&data.found)||0)+' sinais lidos, '+((data&&data.enriched)||0)+' enriquecidos');
      await carregar();render();
    }catch(e){T.toast('Erro: '+(e.message||e))}
    finally{btn.disabled=false;btn.innerHTML=old}
  }

  async function _diag(btn){
    btn.disabled=true;const old=btn.innerHTML;btn.innerHTML='<span class="pp-spin"></span>Cruzando&hellip;';
    try{
      const body=_data.mandato?{mandato_id:_data.mandato,ferramenta:'mattering',persistir:false}:{ferramenta:'consolidado',persistir:false};
      const {data,error}=await sb().functions.invoke('ip-agent-claude',{body});
      if(error)throw error; if(data&&data.erro)throw new Error(data.erro);
      const txt=document.getElementById('pp-diag-txt');
      if(txt)txt.innerHTML=esc(data.sintese||data.diagnostico||'(sem leitura)');
      T.toast('Diagnostico cruzado atualizado');
    }catch(e){T.toast('Erro IA: '+(e.message||e))}
    finally{btn.disabled=false;btn.innerHTML=old}
  }

  async function _jaTratei(btn,id){
    btn.disabled=true;
    try{
      const {error}=await sb().from('ip_agent_sugestoes').update({status:'revisada',revisada_em:new Date().toISOString(),revisada_por:window.__IP_USER_EMAIL||null}).eq('id',id);
      if(error)throw error;
      const card=btn.closest('.pp-item'); if(card){card.style.opacity='.3';card.style.textDecoration='line-through';setTimeout(()=>{card.remove(); _data.sugestoes=_data.sugestoes.filter(x=>x.id!==id);},420);}
      T.toast('Tratado');
    }catch(e){btn.disabled=false;T.toast('Erro: '+(e.message||e))}
  }

  async function bloco(host, sourceTables, opts){
    opts=opts||{};
    const lim=opts.limit||5;
    let qy=sb().from('ip_agent_sugestoes').select('id,agente,severidade,titulo,sugestao,ai_insight,created_at').eq('status','pendente').order('created_at',{ascending:false}).limit(lim);
    if(opts.mandato)qy=qy.eq('mandato_id',opts.mandato);
    const {data}=await T.safe(()=>qy,{data:[]});
    let arr=data||[];
    if(sourceTables&&sourceTables.length){
      const agSet=new Set();
      Object.entries(AGENTE_PARA_FERRAMENTA).forEach(([k,v])=>{ if(sourceTables.includes(v.nm)||sourceTables.includes(v.href)||sourceTables.some(t=>k.includes(t)))agSet.add(k); });
      if(agSet.size)arr=arr.filter(s=>agSet.has(s.agente));
    }
    if(!arr.length){ host.innerHTML=''; return; }
    host.innerHTML='<div class="pp-bloco"><div class="pp-bloco-h">Proximos passos relacionados &middot; '+arr.length+'</div>'+arr.map(cardSinal).join('')+'</div>';
  }

  const CSS=`
  #pp-root .pp-hero{padding:22px 0 16px;border-bottom:1px solid var(--rule,rgba(196,163,90,.15));margin-bottom:18px}
  #pp-root .pp-eyebrow{font-family:var(--mono);font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold-deep,#9a7b3a);font-weight:600;margin-bottom:8px}
  #pp-root h1{font-family:var(--serif);font-size:36px;font-weight:400;color:var(--cream);line-height:1.1;margin:0}
  #pp-root h1 em{font-style:italic;color:var(--gold)}
  #pp-root .pp-tag{margin-top:10px;font-family:var(--serif);font-style:italic;font-size:15px;color:var(--cream-muted);line-height:1.5;max-width:760px}
  #pp-root .pp-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px}
  #pp-root .pp-select{padding:9px 13px;background:var(--navy-raised);border:1px solid var(--rule-strong);border-radius:7px;color:var(--cream);font-family:var(--sans);font-size:13px;min-width:200px}
  #pp-root .pp-btn{padding:9px 16px;border:none;border-radius:7px;background:linear-gradient(135deg,var(--gold-glow,#F5DDA5),var(--gold));color:#2A1A3B;font-family:var(--sans);font-weight:600;font-size:12.5px;cursor:pointer;transition:all .2s;text-decoration:none;display:inline-flex;align-items:center;gap:6px}
  #pp-root .pp-btn:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(196,163,90,.3)}
  #pp-root .pp-btn.ghost{background:transparent;color:var(--gold);border:1px solid var(--rule-strong)}
  #pp-root .pp-btn.ghost.ok{color:var(--ok,#6BAE82);border-color:var(--rule-strong)}
  #pp-root .pp-btn.ghost.ok:hover{border-color:var(--ok,#6BAE82);background:rgba(107,174,130,.08)}
  #pp-root .pp-btn:disabled{opacity:.6;cursor:wait}
  #pp-root .pp-spin{display:inline-block;width:11px;height:11px;border:2px solid rgba(42,26,59,.25);border-top-color:#2A1A3B;border-radius:50%;animation:ppspin .8s linear infinite}
  #pp-root .pp-btn.ghost .pp-spin{border-color:rgba(196,163,90,.25);border-top-color:var(--gold)}
  @keyframes ppspin{to{transform:rotate(360deg)}}
  #pp-root .pp-diag{display:flex;gap:14px;align-items:flex-start;padding:14px 18px;border-radius:10px;background:linear-gradient(135deg,rgba(196,163,90,.08),rgba(123,90,168,.06));border:1px solid var(--navy-edge,rgba(196,163,90,.2));margin-bottom:18px}
  #pp-root .pp-diag-ico{font-size:18px;color:var(--gold)}
  #pp-root .pp-diag-lab{font-family:var(--mono);font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold-deep,#9a7b3a);font-weight:700;margin-bottom:4px}
  #pp-root .pp-diag-txt{font-family:var(--serif);font-style:italic;font-size:15px;color:var(--cream);line-height:1.5}
  #pp-root .pp-sec-h{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold-deep,#9a7b3a);font-weight:700;margin-bottom:10px}
  #pp-root .pp-list{display:flex;flex-direction:column;gap:10px}
  #pp-root .pp-item{padding:14px 16px;border-radius:11px;background:var(--navy-raised);border:1px solid var(--rule);transition:opacity .4s,transform .4s}
  #pp-root .pp-item-top{display:flex;gap:10px;align-items:center;font-size:11px}
  #pp-root .pp-sev{padding:2px 8px;border-radius:10px;font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:lowercase}
  #pp-root .pp-sev-cr{background:rgba(216,117,117,.2);color:var(--danger,#D87575)}
  #pp-root .pp-sev-al{background:rgba(225,167,84,.2);color:var(--warn,#E1A754)}
  #pp-root .pp-sev-no{background:rgba(196,163,90,.16);color:var(--gold)}
  #pp-root .pp-sev-ba,.pp-sev-in{background:rgba(123,165,216,.14);color:var(--info,#7BA5D8)}
  #pp-root .pp-agente{font-family:var(--mono);font-size:10px;color:var(--cream-dim)}
  #pp-root .pp-time{margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--cream-dim)}
  #pp-root .pp-titulo{margin-top:8px;font-size:15px;font-weight:600;color:var(--cream);line-height:1.35}
  #pp-root .pp-sugestao{margin-top:6px;font-size:13px;color:var(--cream-muted);line-height:1.5}
  #pp-root .pp-insight{margin-top:10px;padding:10px 12px;border-radius:8px;background:rgba(196,163,90,.08);border-left:3px solid var(--gold);font-family:var(--serif);font-style:italic;font-size:13.5px;color:var(--cream);line-height:1.5;display:flex;gap:8px;align-items:flex-start}
  #pp-root .pp-insight-ico{flex-shrink:0;font-size:14px;font-style:normal}
  #pp-root .pp-insight.pp-no-insight{font-style:normal;color:var(--cream-dim);font-size:12px;border-left-color:var(--rule-strong);background:rgba(255,255,255,.02)}
  #pp-root .pp-actions{margin-top:12px;display:flex;gap:8px;flex-wrap:wrap}
  #pp-root .pp-empty{text-align:center;padding:30px 16px;color:var(--cream-dim);font-style:italic;font-family:var(--serif);font-size:15px}
  .pp-bloco{margin-top:14px;padding:14px 16px;border-radius:11px;background:var(--navy-raised);border:1px solid var(--rule)}
  .pp-bloco .pp-bloco-h{font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold-deep,#9a7b3a);font-weight:700;margin-bottom:10px}
  .pp-bloco .pp-item{padding:10px 12px;border-radius:8px;margin-bottom:8px}`;
  function injectCSS(){if(document.getElementById('pp-css'))return;const s=document.createElement('style');s.id='pp-css';s.textContent=CSS;document.head.appendChild(s);}
  injectCSS();
  window.IpProximosPassos={open,bloco,_setMandato,_reavaliar,_diag,_jaTratei};
})();
