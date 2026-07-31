// IpSalaGuerra - Sala de Guerra: diagnostico final de TODAS as ferramentas.
// Consolida os proximos passos (ip_plano_acoes) de todos os trabalhos num unico
// quadro priorizado por IREU + sintese executiva macro por IA (EF consolidado).
// API: IpSalaGuerra.open(hostEl)
(function(){
  'use strict';
  if(window.IpSalaGuerra) return;
  const sb=()=>window.__IP_SB||window.sb;
  const T=window.TB||{esc:s=>String(s==null?'':s),safe:async(f,fb)=>{try{return await f()}catch(e){return fb}},toast:m=>alert(m)};
  const esc=T.esc;
  let _host=null,_data=null;
  async function _efErro(error){let m=(error&&error.message)||String(error);try{const b=(error&&error.context&&error.context.json)?await error.context.json():null;if(b&&b.erro)m=b.erro;}catch(_){}return new Error(m);}

  // escopo por mandato_id (tabelas com a coluna); _escopoMand por id (ip_mandatos = tabela-mãe, PK 'id')
  function _escopo(q){var ids=(window.IpOrg&&IpOrg.scope&&IpOrg.scope.mandatoIds)?IpOrg.scope.mandatoIds():null;if(ids&&ids.length)return q.in('mandato_id',ids);return q;}
  function _escopoMand(q){var ids=(window.IpOrg&&IpOrg.scope&&IpOrg.scope.mandatoIds)?IpOrg.scope.mandatoIds():null;if(ids&&ids.length)return q.in('id',ids);return q;}

  async function open(host){
    _host=host;
    host.innerHTML='<div id="sg-root"><div class="sg-empty">Consolidando o quadro de comando&hellip;</div></div>';
    if(window.IpOrg)IpOrg.init();
    await carregar();
    render();
    // reescopo organizacional: ao trocar o nó na árvore, reconsolida o quadro pela subárvore (1×)
    if(window.IpOrg&&IpOrg.scope&&IpOrg.scope.onChange&&!host._sgScoped){host._sgScoped=true;
      IpOrg.scope.onChange(async function(){ await carregar(); render(); });
    }
  }

  async function carregar(){
    const since=new Date(Date.now()-30*864e5).toISOString();
    const [plano,mand,sug,pulsos]=await Promise.all([
      T.safe(()=>_escopo(sb().from('ip_plano_acoes').select('id,titulo,descricao,ireu_score,impacto,relevancia,efeito_borboleta,urgencia,frente,origem,prazo,status,mandato_id,ip_mandatos(empresa)')).eq('status','pendente').order('ireu_score',{ascending:false,nullsFirst:false}).limit(300),{data:[]}),
      T.safe(()=>_escopoMand(sb().from('ip_mandatos').select('id,empresa,estagio,status')).eq('status','ativo').limit(100),{data:[]}),
      T.safe(()=>_escopo(sb().from('ip_agent_sugestoes').select('severidade')).eq('status','pendente').limit(500),{data:[]}),
      T.safe(()=>_escopo(sb().from('ip_pulsos').select('risco_saida')).gte('created_at',since).limit(2000),{data:[]}),
    ]);
    _data={plano:plano.data||[],mand:mand.data||[],sug:sug.data||[],pulsos:pulsos.data||[]};
  }

  function render(){
    const d=_data,root=_host.querySelector('#sg-root');
    const open=d.plano;
    const t1=open.filter(a=>(a.ireu_score||0)>=200).length;
    const rv=d.pulsos.map(p=>p.risco_saida).filter(x=>typeof x==='number');
    const risco=rv.length?(rv.reduce((a,b)=>a+b,0)/rv.length):null;
    root.innerHTML=`
      <div id="sg-sintese" class="sg-sec"></div>
      <div class="sg-kpis">
        <div class="sg-kpi hero"><div class="lab">Ações abertas</div><div class="val">${open.length}</div></div>
        <div class="sg-kpi"><div class="lab">Tier 1 · agir já</div><div class="val" style="${t1?'color:var(--danger)':''}">${t1}</div></div>
        <div class="sg-kpi"><div class="lab">Trabalhos ativos</div><div class="val">${d.mand.length}</div></div>
        <div class="sg-kpi"><div class="lab">Sugestões pendentes</div><div class="val">${d.sug.length}</div></div>
        <div class="sg-kpi"><div class="lab">Risco saída médio</div><div class="val">${risco==null?'—':risco.toFixed(1)+'<span class="un">/5</span>'}</div></div>
      </div>
      <div id="sg-board" class="sg-sec"></div>`;
    renderSintese();
    renderBoard();
  }

  function renderSintese(){
    const el=_host.querySelector('#sg-sintese');
    el.innerHTML=`<div class="sg-banner">
      <div class="sg-banner-ico">&#9670;</div>
      <div class="sg-banner-body">
        <div class="sg-banner-lab">Diagnóstico final &middot; IA</div>
        <div class="sg-banner-txt" id="sg-sint-txt">Gere a síntese executiva macro: a IA cruza todos os trabalhos, pulsos e ações abertas para apontar onde está o maior efeito borboleta agora.</div>
      </div>
      <button class="sg-ia-btn" id="sg-ia-btn" onclick="IpSalaGuerra._diag(this)">Diagnóstico final IA</button>
    </div><div id="sg-ia-out"></div>`;
  }

  async function _diag(btn){
    btn.disabled=true;const old=btn.textContent;btn.innerHTML='<span class="sg-spin"></span>Analisando&hellip;';
    try{
      // COGNITIVO: o Concierge (tool-use real) cruza programas+pessoas+pulso+sinais+ações lendo
      // os dados vivos e escreve a leitura unificada. Fallback p/ a EF consolidada antiga.
      if(window.IpConcierge){
        const t=_host.querySelector('#sg-sint-txt');
        const res=await window.IpConcierge.sintese({ onStep:(s)=>{ if(t&&s.tipo==='tool') t.textContent='Cruzando dados: '+s.nome+'…'; } });
        if(res.ok){
          if(t) t.textContent=res.text;
          const out=_host.querySelector('#sg-ia-out');
          out.innerHTML=`<div class="sg-ia-card"><div class="sg-ia-b"><span class="sg-ia-h">Leitura unificada · Concierge cognitivo</span><p style="white-space:pre-wrap">${esc(res.text)}</p></div>${res.steps&&res.steps.length?`<div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--ink3);text-transform:uppercase;margin-top:8px">leu: ${esc(res.steps.join(' · '))}</div>`:''}</div>`;
          T.toast('Síntese cognitiva gerada'); btn.disabled=false;btn.textContent=old; return;
        }
        // se o motor falhar, cai no fallback abaixo
      }
      const {data,error}=await sb().functions.invoke('ip-agent-claude',{body:{ferramenta:'consolidado',persistir:false}});
      if(error)throw await _efErro(error); if(data&&data.erro)throw new Error(data.erro);
      const t=_host.querySelector('#sg-sint-txt'); if(t&&data.sintese)t.textContent=data.sintese;
      const ps=Array.isArray(data.proximos_passos)?data.proximos_passos:[];
      const out=_host.querySelector('#sg-ia-out');
      out.innerHTML=`<div class="sg-ia-card">
        ${data.diagnostico?`<div class="sg-ia-b"><span class="sg-ia-h">Diagnóstico macro</span><p>${esc(data.diagnostico)}</p></div>`:''}
        ${data.risco_principal?`<div class="sg-ia-b risco"><span class="sg-ia-h">Risco principal</span><p>${esc(data.risco_principal)}</p></div>`:''}
        ${ps.length?`<div class="sg-ia-b"><span class="sg-ia-h">${ps.length} movimentos macro sugeridos</span>${ps.map(p=>{const s=(Math.min(5,Math.max(1,p.impacto||3)))*(Math.min(5,Math.max(1,p.relevancia||3)))*(Math.min(5,Math.max(1,p.efeito_borboleta||3)))*(Math.min(5,Math.max(1,p.urgencia||3)));return `<div class="sg-macro"><span class="sg-macro-ireu">${s}</span><div><strong>${esc(p.titulo)}</strong><div class="sg-macro-pq">${esc(p.porque||'')}</div></div></div>`;}).join('')}</div>`:''}
      </div>`;
      T.toast('Diagnóstico final gerado');
    }catch(e){T.toast('Erro IA: '+(e.message||e))}
    finally{btn.disabled=false;btn.textContent=old}
  }

  function rowCard(a){
    const orig={gerado_template:'curado',sugestao_agente:'agente',agente_claude:'IA',manual:'manual',raio_x:'raio-x'}[a.origem]||a.origem||'-';
    const emp=(a.ip_mandatos&&a.ip_mandatos.empresa)||'—';
    return `<div class="sg-row"><div class="sg-row-ireu">${a.ireu_score||0}</div><div class="sg-row-body"><div class="sg-row-tit">${esc(a.titulo)}</div><div class="sg-row-meta"><span class="sg-chip work">${esc(emp)}</span>${a.frente?`<span class="sg-chip">${esc(a.frente)}</span>`:''}<span class="sg-chip muted">${esc(orig)}</span>${a.prazo?`<span class="sg-chip prazo">até ${esc(a.prazo)}</span>`:''}<span class="sg-mini">I${a.impacto||'-'} R${a.relevancia||'-'} E${a.efeito_borboleta||'-'} U${a.urgencia||'-'}</span></div></div></div>`;
  }

  function renderBoard(){
    const el=_host.querySelector('#sg-board'); const open=_data.plano;
    if(!open.length){el.innerHTML='<div class="sg-empty">Nenhuma ação aberta em nenhum trabalho. Quando as ferramentas gerarem próximos passos, eles aparecem aqui consolidados e priorizados.</div>';return;}
    const bucket={t1:[],t2:[],t3:[],t4:[]};
    open.forEach(a=>{const s=a.ireu_score||0;bucket[s>=200?'t1':s>=100?'t2':s>=50?'t3':'t4'].push(a);});
    const groups=[{k:'t1',l:'Tier 1 · agir já'},{k:'t2',l:'Tier 2 · próxima sprint'},{k:'t3',l:'Tier 3 · backlog'},{k:'t4',l:'Monitorar'}];
    let html=`<div class="sg-sec-h"><span class="sg-sec-t">Quadro priorizado &middot; todas as ações próximas (IREU)</span></div>`;
    groups.forEach(g=>{const rows=bucket[g.k];if(!rows.length)return;html+=`<div class="sg-group"><div class="sg-group-h ${g.k}">${g.l}<span>${rows.length}</span></div>${rows.map(rowCard).join('')}</div>`;});
    el.innerHTML=html;
  }

  const CSS=`
  #sg-root .sg-sec{margin-top:20px}
  #sg-root .sg-banner{display:flex;align-items:center;gap:16px;padding:18px 20px;border-radius:14px;background:linear-gradient(135deg,rgba(200,89,36,.13),rgba(51,71,92,.11));border:1px solid var(--navy-edge,rgba(200,89,36,.25))}
  #sg-root .sg-banner-ico{font-size:22px;color:var(--acento)}
  #sg-root .sg-banner-body{flex:1;min-width:0}
  #sg-root .sg-banner-lab{font-family:var(--mono);font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--acento-deep, var(--ip-accent-strong));font-weight:700;margin-bottom:5px}
  #sg-root .sg-banner-txt{font-family:var(--serif);font-style:italic;font-size:16px;line-height:1.45;color:var(--cream)}
  #sg-root .sg-ia-btn{flex-shrink:0;padding:12px 20px;border:none;border-radius:9px;background:linear-gradient(135deg,var(--acento-glow, var(--ip-accent-light)),var(--acento));color:#2A1A3B;font-family:var(--sans);font-weight:700;font-size:13px;cursor:pointer;transition:all .2s;white-space:nowrap}
  #sg-root .sg-ia-btn:hover{transform:translateY(-1px);box-shadow:0 10px 26px rgba(200,89,36,.35)}
  #sg-root .sg-ia-btn:disabled{opacity:.6;cursor:wait}
  #sg-root .sg-spin{display:inline-block;width:12px;height:12px;border:2px solid rgba(42,26,59,.3);border-top-color:#2A1A3B;border-radius:50%;animation:sgspin .8s linear infinite;vertical-align:middle;margin-right:7px}
  @keyframes sgspin{to{transform:rotate(360deg)}}
  #sg-root .sg-ia-card{margin-top:12px;display:flex;flex-direction:column;gap:10px}
  #sg-root .sg-ia-b{padding:13px 16px;border-radius:10px;background:var(--navy-raised);border:1px solid var(--rule)}
  #sg-root .sg-ia-b.risco{border-left:3px solid var(--danger)}
  #sg-root .sg-ia-h{display:block;font-family:var(--mono);font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--acento-deep, var(--ip-accent-strong));font-weight:700;margin-bottom:6px}
  #sg-root .sg-ia-b p{margin:0;font-size:13.5px;line-height:1.55;color:var(--cream-muted)}
  #sg-root .sg-macro{display:flex;gap:12px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--rule)}
  #sg-root .sg-macro:first-of-type{border-top:none}
  #sg-root .sg-macro-ireu{flex-shrink:0;font-family:var(--serif);font-style:italic;font-size:19px;color:var(--acento);min-width:38px}
  #sg-root .sg-macro strong{font-size:13.5px;color:var(--cream)}
  #sg-root .sg-macro-pq{font-size:12px;color:var(--cream-dim);line-height:1.45;margin-top:2px}
  #sg-root .sg-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:18px}
  #sg-root .sg-kpi{padding:14px 16px;border-radius:12px;background:var(--navy-raised);border:1px solid var(--rule)}
  #sg-root .sg-kpi.hero{background:linear-gradient(135deg,rgba(200,89,36,.1),transparent);border-color:var(--navy-edge,rgba(200,89,36,.3))}
  #sg-root .sg-kpi .lab{font-family:var(--mono);font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--cream-dim);font-weight:600}
  #sg-root .sg-kpi .val{font-family:var(--serif);font-style:italic;font-size:30px;color:var(--cream);margin-top:6px;line-height:1}
  #sg-root .sg-kpi .val .un{font-size:13px;color:var(--cream-dim);font-style:normal}
  #sg-root .sg-sec-h{margin-bottom:12px}
  #sg-root .sg-sec-t{font-family:var(--mono);font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--acento-deep, var(--ip-accent-strong));font-weight:700}
  #sg-root .sg-group{margin-bottom:18px}
  #sg-root .sg-group-h{display:flex;align-items:center;gap:8px;font-family:var(--sans);font-size:12.5px;font-weight:600;color:var(--cream);padding:6px 0;border-bottom:1px solid var(--rule-strong);margin-bottom:8px}
  #sg-root .sg-group-h span{font-family:var(--mono);font-size:10px;color:var(--cream-dim)}
  #sg-root .sg-group-h.t1{color:var(--danger)} #sg-root .sg-group-h.t2{color:var(--acento)} #sg-root .sg-group-h.t3{color:var(--info)}
  #sg-root .sg-row{display:flex;gap:14px;align-items:flex-start;padding:11px 14px;border-radius:10px;background:var(--navy-raised);border:1px solid var(--rule);margin-bottom:7px}
  #sg-root .sg-row-ireu{flex-shrink:0;font-family:var(--serif);font-style:italic;font-size:22px;font-weight:600;color:var(--acento);min-width:42px;text-align:right}
  #sg-root .sg-row-body{flex:1;min-width:0}
  #sg-root .sg-row-tit{font-size:14px;font-weight:600;color:var(--cream);line-height:1.35}
  #sg-root .sg-row-meta{margin-top:7px;display:flex;flex-wrap:wrap;gap:7px;align-items:center}
  #sg-root .sg-chip{font-family:var(--sans);font-size:10.5px;padding:3px 9px;border-radius:20px;background:rgba(200,89,36,.12);color:var(--acento)}
  #sg-root .sg-chip.work{background:rgba(51,71,92,.18);color:var(--cream)}
  #sg-root .sg-chip.muted{background:var(--navy-edge,rgba(255,255,255,.05));color:var(--cream-dim)}
  #sg-root .sg-chip.prazo{background:rgba(123,165,216,.14);color:var(--info)}
  #sg-root .sg-mini{font-family:var(--mono);font-size:10px;color:var(--cream-dim)}
  #sg-root .sg-empty{text-align:center;padding:30px 16px;color:var(--cream-dim);font-style:italic;font-family:var(--serif);font-size:15px}
  @media(max-width:780px){#sg-root .sg-kpis{grid-template-columns:repeat(2,1fr)}}`;
  function injectCSS(){if(document.getElementById('sg-css'))return;const s=document.createElement('style');s.id='sg-css';s.textContent=CSS;document.head.appendChild(s);}
  injectCSS();

  window.IpSalaGuerra={open,_diag};
})();
