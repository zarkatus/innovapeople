// ═══════════════════════════════════════════════════════════════════
// IpMattering — FERRAMENTA real de pulso 6D (não template). Modular.
// Diretiva CVO 29/05: tudo é ferramenta + modularizar.
// Schema real: ip_pulsos (6 dims: proposito/autonomia/competencia/
// pertencimento/clareza/seguranca + risco_saida + score), ip_pulse_tokens.
// RPCs: fn_ip_pulso_token_gerar, fn_ip_pulso_submit, fn_ip_agent_mattering_coach.
// API: window.IpMattering.open(container)
// ═══════════════════════════════════════════════════════════════════
(function(){
  'use strict';
  if(window.IpMattering) return;
  const sb=()=>window.__IP_SB||window.sb;
  const T=window.TB||{esc:s=>String(s??''),fmtRel:s=>s,safe:async(f,fb)=>{try{return await f()}catch(e){return fb}},toast:m=>alert(m)};

  const DIMS=[
    {k:'r_proposito',n:'Propósito',q:'Meu trabalho tem sentido e contribui para algo maior'},
    {k:'r_autonomia',n:'Autonomia',q:'Tenho liberdade para decidir como faço meu trabalho'},
    {k:'r_competencia',n:'Competência',q:'Uso e desenvolvo minhas melhores capacidades aqui'},
    {k:'r_pertencimento',n:'Pertencimento',q:'Sinto que pertenço e sou aceito por quem sou'},
    {k:'r_clareza',n:'Clareza',q:'Sei o que se espera de mim e para onde vamos'},
    {k:'r_seguranca',n:'Segurança',q:'Posso falar, discordar e errar sem medo de retaliação'},
  ];
  const K_MIN=3; // anonimato

  let _state={tab:'resultados',mandato:null,mandatos:[]};

  async function open(container){
    _state.root=container;
    container.innerHTML=`<div id="mt-root">
      <div class="mt-tabs">
        <button class="mt-tab" data-t="resultados">Resultados</button>
        <button class="mt-tab" data-t="disparar">Disparar pulso</button>
        <button class="mt-tab" data-t="tokens">Links pendentes</button>
      </div>
      <div id="mt-body"><div class="empty-skeleton"><div class="bar w85"></div><div class="bar w70"></div><div class="bar w50"></div></div></div>
    </div>`;
    container.querySelectorAll('.mt-tab').forEach(b=>b.onclick=()=>go(b.dataset.t));
    // carrega mandatos pro seletor
    const {data}=await T.safe(()=>sb().from('v_ip_mandatos_overview').select('id,empresa,setor,status').order('created_at',{ascending:false}).limit(50),{data:[]});
    _state.mandatos=(data||[]).filter(m=>m.status==='ativo'||!m.status);
    _state.mandatos=_filtroEscopo(_state.mandatos);
    _state.mandato=_state.mandatos[0]?.id||null;
    go('resultados');
    // reescopo organizacional: ao trocar o nó na árvore, restringe a lista de empresas à subárvore (1×)
    if(window.IpOrg&&IpOrg.scope&&IpOrg.scope.onChange&&!_state._scoped){_state._scoped=true;
      IpOrg.scope.onChange(function(){
        var ms=(data||[]).filter(m=>m.status==='ativo'||!m.status); _state.mandatos=_filtroEscopo(ms);
        if(!_state.mandatos.find(m=>m.id===_state.mandato))_state.mandato=_state.mandatos[0]?.id||null;
        go(_state.tab||'resultados');
      });
    }
  }
  // restringe a lista de mandatos à subárvore do nó corrente (IpScope); sem nó -> lista cheia (comportamento atual)
  function _filtroEscopo(arr){
    var ids=(window.IpOrg&&IpOrg.scope&&IpOrg.scope.mandatoIds)?IpOrg.scope.mandatoIds():null;
    if(ids&&ids.length){var set=new Set(ids);return arr.filter(m=>set.has(m.id));}
    return arr;
  }

  function go(tab){
    _state.tab=tab;
    _state.root.querySelectorAll('.mt-tab').forEach(b=>b.classList.toggle('on',b.dataset.t===tab));
    if(tab==='resultados')renderResultados();
    else if(tab==='disparar')renderDisparar();
    else renderTokens();
  }

  function mandatoSelect(){
    if(!_state.mandatos.length) return `<div class="mt-warn">Nenhum trabalho ativo. Crie um trabalho (curadoria) no <a href="/sistema/" style="color:var(--acento)">Dashboard</a> antes de disparar pulso.</div>`;
    return `<select id="mt-mandato" onchange="IpMattering._setMandato(this.value)" class="mt-select">
      ${_state.mandatos.map(m=>`<option value="${T.esc(m.id)}" ${m.id===_state.mandato?'selected':''}>${T.esc(m.empresa||'(sem nome)')} · ${T.esc(m.setor||'—')}</option>`).join('')}
    </select>`;
  }

  // ─── RESULTADOS (agregação 6D real, k≥3) ───
  function _orgCfg(diagHTML){
    return {
      chave:'mattering', mandato:_state.mandato, rotulo:'Mattering',
      diagnosticoHTML:diagHTML,
      fontesEvento:['ip_pulsos','ip_agent_sugestoes','ip_plano_acoes'],
      consumidores:[
        {nome:'Skill Map', porque:'queda de pertencimento aciona reconversao e revisao de papeis'},
        {nome:'Agentes Vigia', porque:'Mattering Coach e Critic-Org leem o pulso para abrir sugestoes'},
        {nome:'CHRO / Sala de Guerra', porque:'risco de saida sobe na priorizacao IREU consolidada'}
      ]
    };
  }

  async function renderResultados(){
    const body=document.getElementById('mt-body');
    body.innerHTML='<div class="empty-skeleton"><div class="bar w85"></div><div class="bar w70"></div></div>';
    let qy=sb().from('ip_pulsos').select('equipe,rotulo_papel,r_proposito,r_autonomia,r_competencia,r_pertencimento,r_clareza,r_seguranca,risco_saida,score,comentario,created_at');
    if(_state.mandato) qy=qy.eq('mandato_id',_state.mandato);
    const {data}=await T.safe(()=>qy.order('created_at',{ascending:false}).limit(500),{data:[]});
    const arr=data||[];
    let diag;
    if(arr.length<K_MIN){
      diag=`<div style="margin-bottom:14px">${mandatoSelect()}</div><div class="mt-empty">
        <div style="font-family:var(--serif);font-style:italic;font-size:18px;color:var(--cream);margin-bottom:8px">Anonimato protegido &middot; k&ge;${K_MIN}</div>
        <p>Ha <strong>${arr.length}</strong> resposta${arr.length===1?'':'s'} &mdash; o agregado so aparece com pelo menos <strong>${K_MIN}</strong>, para garantir anonimato. Mesmo assim, a trilha de proximos passos e o diagnostico de IA ja operam abaixo.</p>
      </div>`;
    } else {
      const avg=k=>{const vs=arr.map(r=>r[k]).filter(v=>v!=null);return vs.length?vs.reduce((a,b)=>a+b,0)/vs.length:null;};
      const dimVals=DIMS.map(d=>({...d,v:avg(d.k)}));
      const _vd=dimVals.filter(d=>d.v!=null);const geral=_vd.length?_vd.reduce((a,d)=>a+d.v,0)/_vd.length:null;
      const risco=avg('risco_saida');
      const last30=arr.filter(r=>new Date(r.created_at).getTime()>Date.now()-30*86400e3).length;
      const farol=v=>v>=4?'no-alvo':(v>=3?'atencao':'fora');
      diag=`
      <div style="margin-bottom:16px">${mandatoSelect()}</div>
      <div class="kpis" style="padding:0;margin:0 0 18px;grid-template-columns:repeat(3,1fr)">
        <div class="kpi hero"><div class="lab">Mattering geral</div><div class="val">${geral==null?'—':geral.toFixed(1)}<span class="un">/5</span></div><span class="farol ${geral==null?'sem-meta':farol(geral)}">${geral==null?'sem dados':(farol(geral)==='no-alvo'?'saudavel':(farol(geral)==='atencao'?'atencao':'critico'))}</span></div>
        <div class="kpi"><div class="lab">Risco de saida</div><div class="val" style="${risco!=null&&risco>=3.5?'color:var(--danger,#d87575)':''}">${risco==null?'—':risco.toFixed(1)}<span class="un">/5</span></div><div class="note">media percebida</div></div>
        <div class="kpi"><div class="lab">Respostas</div><div class="val">${arr.length}</div><div class="note">${last30} nos ultimos 30d &middot; anonimo</div></div>
      </div>
      <div style="font-family:var(--mono);font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--acento-deep,#A8461A);font-weight:700;margin-bottom:10px">6 Dimensoes &middot; media agregada</div>
      ${dimVals.map(d=>{
        const pct=d.v==null?0:Math.round(d.v/5*100);
        const col=d.v==null?'var(--cream-dim)':(d.v>=4?'var(--ok,#6bae82)':(d.v>=3?'var(--warn,#E0763A)':'var(--danger,#d87575)'));
        return `<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px"><span style="font-size:13px;color:var(--cream);font-weight:500">${d.n}</span><span style="font-family:var(--serif);font-style:italic;font-size:17px;color:${col}">${d.v==null?'—':d.v.toFixed(1)}</span></div><div class="pbar"><span style="width:${pct}%;background:linear-gradient(90deg,${col},var(--acento))"></span></div></div>`;
      }).join('')}
      <div style="margin-top:14px"><button class="mt-btn-ghost" onclick="IpMattering._rodarAgente()">Rodar Mattering Coach (detector)</button></div>`;
    }
    if(window.IpFerramenta){ await IpFerramenta.organismo(body,_orgCfg(diag)); }
    else { body.innerHTML=diag; }
  }

  // --- DISPARAR (gera tokens reais) ---
  async function renderDisparar(){
    const body=document.getElementById('mt-body');
    body.innerHTML=`
      <div style="max-width:520px">
        <div style="font-family:var(--serif);font-style:italic;color:var(--cream-muted);font-size:14px;margin-bottom:16px">Gere links anônimos de pulso. Cada link responde uma vez, sem identificar a pessoa. Resultados agregam com k≥${K_MIN}.</div>
        ${mandatoSelect()}
        <div class="mt-field"><label>Equipe / área</label><input id="mt-eq" type="text" placeholder="ex.: Engenharia, Comercial, Toda a casa"></div>
        <div class="mt-field"><label>Papel (opcional)</label><input id="mt-papel" type="text" placeholder="ex.: liderança, individual contributor"></div>
        <div class="mt-field"><label>Quantos links gerar</label><input id="mt-qtd" type="number" min="1" max="50" value="5"></div>
        <button class="mt-btn" onclick="IpMattering._gerar()" id="mt-gerar-btn">Gerar links de pulso</button>
        <div id="mt-links"></div>
      </div>`;
  }

  async function _gerar(){
    const mandato=_state.mandato;
    if(!mandato){T.toast('Selecione um trabalho primeiro');return}
    const eq=(document.getElementById('mt-eq')?.value||'').trim();
    const papel=(document.getElementById('mt-papel')?.value||'').trim()||null;
    const qtd=Math.max(1,Math.min(50,parseInt(document.getElementById('mt-qtd')?.value||'5',10)));
    if(!eq){T.toast('Informe a equipe/área');return}
    const btn=document.getElementById('mt-gerar-btn');btn.disabled=true;btn.textContent='Gerando…';
    try{
      const {data,error}=await sb().rpc('fn_ip_pulso_token_gerar',{p_mandato_id:mandato,p_equipe:eq,p_papel:papel,p_qtd:qtd});
      if(error)throw error;
      const tokens=(data||[]).map(r=>typeof r==='string'?r:(r.fn_ip_pulso_token_gerar||r.token||r));
      const base=location.origin+'/sistema/pulso/?t=';
      document.getElementById('mt-links').innerHTML=`
        <div style="margin-top:18px;font-family:var(--mono);font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--acento-deep,#A8461A);font-weight:700;margin-bottom:8px">${tokens.length} links gerados · ${T.esc(eq)}</div>
        <div style="display:flex;flex-direction:column;gap:6px">${tokens.map((t,i)=>`<div class="mt-link"><span>#${i+1}</span><code>${base}${T.esc(t)}</code><button onclick="navigator.clipboard.writeText('${base}${T.esc(t)}');IpMattering._toast('Link copiado')">copiar</button></div>`).join('')}</div>
        <button class="mt-btn-ghost" style="margin-top:10px" onclick="navigator.clipboard.writeText('${tokens.map(t=>base+t).join('\\n')}');IpMattering._toast('Todos os links copiados')">Copiar todos</button>`;
      T.toast(tokens.length+' links gerados');
    }catch(e){T.toast('Erro: '+(e.message||e))}
    finally{btn.disabled=false;btn.textContent='Gerar links de pulso'}
  }

  // ─── TOKENS pendentes ───
  async function renderTokens(){
    const body=document.getElementById('mt-body');
    body.innerHTML='<div class="empty-skeleton"><div class="bar w85"></div><div class="bar w70"></div></div>';
    let qy=sb().from('ip_pulse_tokens').select('token,equipe,papel,created_at,expires_at,used_at');
    if(_state.mandato)qy=qy.eq('mandato_id',_state.mandato);
    const {data}=await T.safe(()=>qy.order('created_at',{ascending:false}).limit(60),{data:[]});
    const arr=data||[];
    const pend=arr.filter(t=>!t.used_at);
    body.innerHTML=`<div style="margin-bottom:14px">${mandatoSelect()}</div>
      <div style="font-family:var(--mono);font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--acento-deep,#A8461A);font-weight:700;margin-bottom:10px">${pend.length} pendentes · ${arr.length-pend.length} respondidos</div>
      ${arr.length?arr.map(t=>{
        const used=!!t.used_at;
        const exp=t.expires_at&&new Date(t.expires_at)<new Date();
        return `<div class="row-item"><div class="body"><div class="nm" style="font-size:12.5px">${T.esc(t.equipe||'—')} ${t.papel?'· '+T.esc(t.papel):''}</div><div class="desc"><code style="font-size:10px">${T.esc(String(t.token).slice(0,8))}…</code></div></div>${used?'<span class="tag ok">respondido</span>':(exp?'<span class="tag muted">expirado</span>':'<span class="tag warn">pendente</span>')}<div class="time">${T.fmtRel(t.created_at)}</div></div>`;
      }).join(''):'<div class="mt-empty">Nenhum link gerado ainda. Vá em "Disparar pulso".</div>'}`;
  }

  async function _rodarAgente(){
    if(!_state.mandato){T.toast('Selecione um trabalho');return}
    T.toast('Rodando Mattering Coach…');
    try{
      const {error}=await sb().rpc('fn_ip_agent_mattering_coach',{p_mandato_id:_state.mandato});
      if(error)throw error;
      T.toast('Mattering Coach concluído, veja sugestões em Inteligência/CHRO');
    }catch(e){T.toast('Erro: '+(e.message||e))}
  }

  function _setMandato(id){_state.mandato=id;go(_state.tab)}

  // CSS escopado
  const CSS=`
  #mt-root .mt-tabs{display:flex;gap:4px;margin-bottom:18px;border-bottom:1px solid var(--rule)}
  #mt-root .mt-tab{padding:9px 16px;background:none;border:none;border-bottom:2px solid transparent;color:var(--cream-dim);font-family:var(--sans);font-size:12.5px;font-weight:500;letter-spacing:.04em;cursor:pointer;transition:all .18s}
  #mt-root .mt-tab:hover{color:var(--cream)}
  #mt-root .mt-tab.on{color:var(--acento);border-bottom-color:var(--acento)}
  #mt-root .mt-select{width:100%;max-width:420px;padding:10px 14px;background:var(--navy-raised);border:1px solid var(--rule-strong);border-radius:7px;color:var(--cream);font-family:var(--sans);font-size:13px;margin-bottom:14px}
  #mt-root .mt-field{margin-bottom:14px}
  #mt-root .mt-field label{display:block;font-family:var(--mono);font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--cream-dim);font-weight:600;margin-bottom:6px}
  #mt-root .mt-field input{width:100%;padding:11px 14px;background:var(--navy-raised);border:1px solid var(--rule-strong);border-radius:7px;color:var(--cream);font-family:var(--sans);font-size:13.5px}
  #mt-root .mt-field input:focus{outline:none;border-color:var(--acento)}
  #mt-root .mt-btn{padding:12px 22px;border:none;border-radius:8px;background:linear-gradient(135deg,var(--acento-glow,#F0B48A),var(--acento));color:#2A1A3B;font-family:var(--sans);font-weight:600;font-size:13px;letter-spacing:.04em;cursor:pointer;transition:all .2s;margin-top:6px}
  #mt-root .mt-btn:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(200,89,36,.3)}
  #mt-root .mt-btn:disabled{opacity:.5;cursor:not-allowed}
  #mt-root .mt-btn-ghost{padding:9px 16px;border:1px solid var(--rule-strong);border-radius:7px;background:transparent;color:var(--acento);font-family:var(--sans);font-size:12px;font-weight:500;cursor:pointer;transition:all .2s}
  #mt-root .mt-btn-ghost:hover{background:rgba(200,89,36,.1);border-color:var(--acento)}
  #mt-root .mt-empty{text-align:center;padding:32px 16px;color:var(--cream-dim);font-style:italic;font-family:var(--serif);font-size:15px;line-height:1.5}
  #mt-root .mt-warn{padding:14px 18px;background:rgba(224,118,58,.1);border-left:2px solid var(--warn,#E0763A);border-radius:6px;color:var(--cream-muted);font-size:13px;font-style:italic;font-family:var(--serif);margin-bottom:14px}
  #mt-root .mt-link{display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--navy-raised);border:1px solid var(--rule);border-radius:6px;font-size:12px}
  #mt-root .mt-link span{font-family:var(--mono);font-size:10px;color:var(--acento);flex-shrink:0}
  #mt-root .mt-link code{flex:1;font-family:var(--mono);font-size:10.5px;color:var(--cream-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #mt-root .mt-link button{background:none;border:1px solid var(--rule-strong);border-radius:4px;color:var(--acento);font-size:10px;padding:3px 8px;cursor:pointer;flex-shrink:0}
  #mt-root .mt-link button:hover{background:rgba(200,89,36,.1)}`;
  function _injectCSS(){if(document.getElementById('mt-css'))return;const s=document.createElement('style');s.id='mt-css';s.textContent=CSS;document.head.appendChild(s)}
  _injectCSS();

  window.IpMattering={open,go,_gerar,_setMandato,_rodarAgente,_toast:(m)=>T.toast(m)};
})();
