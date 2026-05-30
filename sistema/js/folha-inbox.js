// IpFolha — Clientes Ativos + inbox de Folha de Pagamento por cliente (InnovaPeople).
// Camada 1: lista de clientes (ip_clientes) — seleciona o cliente.
// Camada 2: inbox de folha daquele cliente (ip_folha_pagamento_inbox), pipeline
// intra-banco plat_folha_pagamento --fn_folha_encaminhar_ip--> inbox.
// Organismo RapheiceOS. API: window.IpFolha.open(container) | IpFolha.boot()
(function(){
  'use strict';
  if(window.IpFolha) return;
  const sb=()=>window.__IP_SB||window.sb;
  const T=window.TB||{esc:s=>String(s==null?'':s),fmtRel:s=>s,safe:async(f,fb)=>{try{return await f()}catch(e){return fb}},toast:m=>alert(m)};
  const esc=T.esc;
  const fmtBRL=v=>v==null?'—':('R$ '+Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}));
  const fmtComp=c=>{if(!c)return'—';const m=String(c).match(/(\d{4})-?(\d{2})/);if(!m)return esc(c);const mes=['','jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][parseInt(m[2],10)]||m[2];return mes+'/'+m[1];};
  let _s={root:null,view:'clientes',clientes:[],folhaCount:{},clienteSel:null,rows:[],aberta:null,_esc:null};

  async function open(container){
    _s.root=container;
    container.innerHTML='<div id="fl-root"><div class="fl-empty">Carregando clientes ativos&hellip;</div></div>';
    await reloadClientes();
    renderClientes();
  }
  function boot(){ const h=document.getElementById('folha-host'); if(h) open(h); }

  async function reloadClientes(){
    const [cli,fol]=await Promise.all([
      T.safe(()=>sb().from('ip_clientes').select('*').eq('ativo',true).order('ordem',{ascending:true}),{data:[]}),
      T.safe(()=>sb().from('ip_folha_pagamento_inbox').select('cliente'),{data:[]}),
    ]);
    _s.clientes=cli.data||[];
    _s.folhaCount={};
    (fol.data||[]).forEach(r=>{_s.folhaCount[r.cliente]=(_s.folhaCount[r.cliente]||0)+1;});
  }

  async function reload(){
    let q=sb().from('ip_folha_pagamento_inbox').select('*').order('competencia',{ascending:false}).order('recebido_em',{ascending:false}).limit(200);
    if(_s.clienteSel) q=q.eq('cliente',_s.clienteSel.nome);
    const {data}=await T.safe(()=>q,{data:[]});
    _s.rows=data||[];
  }

  function _selCliente(id){
    _s.clienteSel=_s.clientes.find(c=>c.id===id)||null;
    _s.view='folha';
    reload().then(render);
  }
  function _voltarClientes(){ _s.view='clientes'; _s.clienteSel=null; reloadClientes().then(renderClientes); }

  function estadoTag(e){
    const map={recebida:'info',pendente:'warn',processada:'ok',enviada_cs:'ok',erro:'danger'};
    const cls=map[e]||'muted';
    return '<span class="fl-tag '+cls+'">'+esc(e||'recebida')+'</span>';
  }

  // ===== CAMADA 1: Clientes Ativos =====
  function renderClientes(){
    const root=_s.root.querySelector('#fl-root'); if(!root)return;
    const cs=_s.clientes;
    const nCli=cs.filter(c=>c.tipo==='cliente').length;
    const nGrupo=cs.filter(c=>c.tipo==='grupo').length;
    const comFolha=cs.filter(c=>(_s.folhaCount[c.nome]||0)>0).length;
    const prop=cs.filter(c=>c.proprietaria_ip).map(c=>esc(c.nome)).join(', ')||'—';
    let html='<div class="fl-kpis">'
      +'<div class="fl-kpi hero"><div class="lab">Clientes ativos</div><div class="val">'+cs.length+'</div><div class="note">'+nCli+' cliente(s) &middot; '+nGrupo+' do grupo</div></div>'
      +'<div class="fl-kpi"><div class="lab">Com folha recebida</div><div class="val">'+comFolha+'</div><div class="note">empresas com inbox ativo</div></div>'
      +'<div class="fl-kpi"><div class="lab">Propriet&aacute;ria InnovaPeople</div><div class="val" style="font-size:20px">'+prop+'</div><div class="note">controle societ&aacute;rio</div></div>'
      +'</div>';
    html+='<div class="fl-banner"><div class="fl-banner-ico">&#9670;</div><div><div class="fl-banner-lab">Clientes Ativos &middot; Folha de Pagamento</div><div class="fl-banner-txt">Selecione o cliente para ver o inbox de folhas dele. C&amp;S Engenharia &eacute; o primeiro cliente ativo; as demais s&atilde;o empresas do grupo (InnCorporate &eacute; a propriet&aacute;ria da InnovaPeople).</div></div></div>';
    const grpCliente=cs.filter(c=>c.tipo==='cliente');
    const grpGrupo=cs.filter(c=>c.tipo==='grupo');
    if(grpCliente.length){ html+='<div class="fl-sec-h">Clientes</div><div class="fl-cli-grid">'+grpCliente.map(cardCliente).join('')+'</div>'; }
    if(grpGrupo.length){ html+='<div class="fl-sec-h" style="margin-top:20px">Empresas do grupo</div><div class="fl-cli-grid">'+grpGrupo.map(cardCliente).join('')+'</div>'; }
    if(!cs.length) html+='<div class="fl-empty">Nenhum cliente cadastrado.</div>';
    root.innerHTML=html;
  }

  function cardCliente(c){
    const n=_s.folhaCount[c.nome]||0;
    const ini=(c.nome||'?').replace(/[^A-Za-z&]/g,'').slice(0,2).toUpperCase();
    return '<div class="fl-cli" onclick="IpFolha._selCliente(\''+esc(c.id)+'\')">'
      +'<div class="fl-cli-ini">'+esc(ini)+'</div>'
      +'<div class="fl-cli-body">'
        +'<div class="fl-cli-nome">'+esc(c.nome)+(c.proprietaria_ip?'<span class="fl-badge prop" title="Proprietária da InnovaPeople">proprietária IP</span>':'')+'</div>'
        +'<div class="fl-cli-meta">'+(c.tipo==='cliente'?'Cliente':'Grupo')+(c.setor?' &middot; '+esc(c.setor):'')+(c.consome_folha?' &middot; folha ativa':'')+'</div>'
      +'</div>'
      +'<div class="fl-cli-side">'+(n>0?'<span class="fl-tag ok">'+n+' folha(s)</span>':'<span class="fl-tag muted">sem folha</span>')+'<span class="fl-cli-arrow">&#8250;</span></div>'
    +'</div>';
  }

  // ===== CAMADA 2: Inbox de folha do cliente =====
  function render(){
    const root=_s.root.querySelector('#fl-root'); if(!root)return;
    const rows=_s.rows; const cli=_s.clienteSel;
    const comps=[...new Set(rows.map(r=>r.competencia))].length;
    const ult=rows[0];
    const totBruto=rows.reduce((a,r)=>a+(Number(r.total_bruto)||0),0);
    const pend=rows.filter(r=>!r.processado_em).length;
    let html='<div class="fl-crumb"><button class="fl-back" onclick="IpFolha._voltarClientes()">&#8249; Clientes Ativos</button><span class="fl-crumb-sep">/</span><span class="fl-crumb-cur">'+esc(cli?cli.nome:'—')+'</span></div>';
    html+='<div class="fl-kpis">'
      +'<div class="fl-kpi hero"><div class="lab">Folhas recebidas</div><div class="val">'+rows.length+'</div><div class="note">'+comps+' compet&ecirc;ncia(s)</div></div>'
      +'<div class="fl-kpi"><div class="lab">A processar</div><div class="val" style="'+(pend?'color:var(--warn,#E1A754)':'')+'">'+pend+'</div><div class="note">pendentes de tratamento</div></div>'
      +'<div class="fl-kpi"><div class="lab">Total bruto acumulado</div><div class="val" style="font-size:22px">'+fmtBRL(totBruto)+'</div><div class="note">todas as compet&ecirc;ncias</div></div>'
      +'<div class="fl-kpi"><div class="lab">&Uacute;ltima compet&ecirc;ncia</div><div class="val" style="font-size:22px">'+(ult?fmtComp(ult.competencia):'—')+'</div><div class="note">'+(ult?(ult.n_colaboradores||0)+' colaboradores':'sem dados')+'</div></div>'
      +'</div>';
    html+='<div class="fl-banner"><div class="fl-banner-ico">&#9670;</div><div><div class="fl-banner-lab">'+esc(cli?cli.nome:'')+' &middot; pipeline intra-banco</div><div class="fl-banner-txt">As folhas chegam do canteiro via InnovaSphere (extra&ccedil;&atilde;o IA), s&atilde;o tratadas e encaminhadas automaticamente para este inbox. Aqui voc&ecirc; revisa, processa e libera para o grupo Financeiro.</div></div></div>';
    html+='<div class="fl-sec-h">Folhas no inbox</div>';
    if(!rows.length){
      html+='<div class="fl-empty">Nenhuma folha recebida para '+esc(cli?cli.nome:'este cliente')+' ainda. Quando uma folha for tratada e encaminhada na InnovaSphere (canteiro), aparece aqui automaticamente.</div>';
    }else{
      html+='<div class="fl-list">'+rows.map(cardFolha).join('')+'</div>';
    }
    root.innerHTML=html;
  }

  function cardFolha(r){
    const proc=!!r.processado_em;
    return '<div class="fl-card'+(proc?' proc':'')+'" onclick="IpFolha._abrir(\''+esc(r.id)+'\')">'
      +'<div class="fl-card-main">'
        +'<div class="fl-card-comp">'+fmtComp(r.competencia)+'</div>'
        +'<div class="fl-card-meta"><strong>'+esc(r.cliente||'')+'</strong>'+(r.origem_canteiro?' &middot; '+esc(r.origem_canteiro):'')+'</div>'
      +'</div>'
      +'<div class="fl-card-nums">'
        +'<div class="fl-num"><span class="k">Bruto</span><span class="v">'+fmtBRL(r.total_bruto)+'</span></div>'
        +'<div class="fl-num"><span class="k">L&iacute;quido</span><span class="v">'+fmtBRL(r.total_liquido)+'</span></div>'
        +'<div class="fl-num"><span class="k">Colab.</span><span class="v">'+(r.n_colaboradores||0)+'</span></div>'
      +'</div>'
      +'<div class="fl-card-side">'+estadoTag(r.estado)+(proc?'<span class="fl-mini">processada</span>':'<span class="fl-mini" style="color:var(--warn,#E1A754)">a processar</span>')+'</div>'
    +'</div>';
  }

  // ===== Drawer detalhe =====
  function _abrir(id){
    const r=_s.rows.find(x=>x.id===id); if(!r)return;
    _s.aberta=r;
    const dados=r.dados||{};
    const colabs=Array.isArray(dados.colaboradores)?dados.colaboradores:(Array.isArray(dados.itens)?dados.itens:(Array.isArray(dados)?dados:[]));
    let body='';
    if(colabs.length){
      body='<table class="fl-tbl"><thead><tr><th>Colaborador</th><th>Cargo</th><th style="text-align:right">Bruto</th><th style="text-align:right">L&iacute;quido</th></tr></thead><tbody>'
        +colabs.map(c=>{
          const nome=c.nome||c.name||c.colaborador||'—';
          const cargo=c.cargo||c.funcao||c.role||'—';
          const bruto=c.bruto!=null?c.bruto:(c.total_bruto!=null?c.total_bruto:(c.salario_bruto!=null?c.salario_bruto:c.valor_bruto));
          const liq=c.liquido!=null?c.liquido:(c.total_liquido!=null?c.total_liquido:(c.salario_liquido!=null?c.salario_liquido:c.valor_liquido));
          return '<tr><td>'+esc(nome)+'</td><td>'+esc(cargo)+'</td><td style="text-align:right;font-family:var(--mono)">'+fmtBRL(bruto)+'</td><td style="text-align:right;font-family:var(--mono)">'+fmtBRL(liq)+'</td></tr>';
        }).join('')
        +'</tbody></table>';
    }else{
      body='<div class="fl-empty" style="padding:18px">Dados detalhados n&atilde;o estruturados como lista. Conte&uacute;do extra&iacute;do:<pre style="text-align:left;white-space:pre-wrap;font-family:var(--mono);font-size:11px;color:var(--ink2,#D6CDB8);margin-top:10px;max-height:260px;overflow:auto">'+esc(JSON.stringify(dados,null,2).slice(0,4000))+'</pre></div>';
    }
    const proc=!!r.processado_em;
    const ov=document.createElement('div'); ov.className='fl-drawer-bg'; ov.id='fl-drawer';
    ov.innerHTML='<div class="fl-drawer" role="dialog" aria-modal="true" aria-labelledby="fl-dh">'
      +'<div class="fl-drawer-h"><div><div class="fl-drawer-comp" id="fl-dh">'+fmtComp(r.competencia)+'</div><div class="fl-drawer-sub">'+esc(r.cliente||'')+(r.origem_canteiro?' &middot; '+esc(r.origem_canteiro):'')+' &middot; '+estadoTag(r.estado)+'</div></div><button class="fl-x" onclick="IpFolha._fechar()">&times;</button></div>'
      +'<div class="fl-drawer-nums">'
        +'<div class="fl-num"><span class="k">Bruto</span><span class="v">'+fmtBRL(r.total_bruto)+'</span></div>'
        +'<div class="fl-num"><span class="k">L&iacute;quido</span><span class="v">'+fmtBRL(r.total_liquido)+'</span></div>'
        +'<div class="fl-num"><span class="k">Colaboradores</span><span class="v">'+(r.n_colaboradores||0)+'</span></div>'
        +'<div class="fl-num"><span class="k">Recebida</span><span class="v" style="font-size:13px">'+esc(T.fmtRel?T.fmtRel(r.recebido_em):(r.recebido_em||'').slice(0,10))+'</span></div>'
      +'</div>'
      +'<div class="fl-drawer-body">'+body+'</div>'
      +'<div class="fl-drawer-foot">'
        +(proc?'<span class="fl-mini" style="color:var(--ok,#6BAE82)">&#10003; Processada em '+esc((r.processado_em||'').slice(0,10))+'</span>':'<button class="fl-btn" onclick="IpFolha._processar(\''+esc(r.id)+'\')">Marcar como processada</button>')
        +'<button class="fl-btn ghost" onclick="IpFolha._prepararEnvioCS(\''+esc(r.id)+'\')">Preparar envio ao grupo Financeiro</button>'
      +'</div>'
    +'</div>';
    ov.onclick=e=>{if(e.target===ov)_fechar();};
    document.body.appendChild(ov);
    _s._esc=ev=>{if(ev.key==='Escape')_fechar();};
    document.addEventListener('keydown',_s._esc);
  }
  function _fechar(){const d=document.getElementById('fl-drawer');if(d){if(_s._esc)document.removeEventListener('keydown',_s._esc);d.remove();}}

  async function _processar(id){
    try{
      const {error}=await sb().from('ip_folha_pagamento_inbox').update({estado:'processada',processado_em:new Date().toISOString()}).eq('id',id);
      if(error)throw error;
      T.toast('Folha marcada como processada');
      _fechar(); await reload(); render();
    }catch(e){T.toast('Erro: '+(e.message||e))}
  }

  function _prepararEnvioCS(id){
    const r=_s.rows.find(x=>x.id===id); if(!r)return;
    const resumo='Folha '+fmtComp(r.competencia)+' · '+(r.cliente||'')+(r.origem_canteiro?' · '+r.origem_canteiro:'')
      +'\nBruto '+fmtBRL(r.total_bruto)+' · Líquido '+fmtBRL(r.total_liquido)+' · '+(r.n_colaboradores||0)+' colaboradores';
    T.toast('Resumo pronto (copiado). O disparo ao grupo exige sua ordem explicita (governanca WhatsApp).');
    try{ navigator.clipboard.writeText(resumo); }catch(_){}
    console.log('[folha] resumo p/ grupo Financeiro (copiado):\n'+resumo);
  }

  function injCSS(){
    if(document.getElementById('fl-csslink'))return;
    var l=document.createElement('link');
    l.id='fl-csslink'; l.rel='stylesheet'; l.href='/sistema/js/folha-inbox.css';
    document.head.appendChild(l);
  }
  injCSS();

  window.IpFolha={open,boot,_selCliente,_voltarClientes,_abrir,_fechar,_processar,_prepararEnvioCS};
})();
