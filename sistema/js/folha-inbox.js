// IpFolha — Tela InnovaPeople do inbox de Folha de Pagamento C&S Engenharia.
// Consome ip_folha_pagamento_inbox (pipeline intra-banco: plat_folha_pagamento
// --fn_folha_encaminhar_ip--> ip_folha_pagamento_inbox). RLS socios_all.
// Organismo RapheiceOS: KPIs + lista por competencia + detalhe colaboradores +
// marcar processado + preparar envio ao grupo C&S (WhatsApp, exige ordem CVO).
// API: window.IpFolha.open(container) | IpFolha.boot()
(function(){
  'use strict';
  if(window.IpFolha) return;
  const sb=()=>window.__IP_SB||window.sb;
  const T=window.TB||{esc:s=>String(s==null?'':s),fmtRel:s=>s,safe:async(f,fb)=>{try{return await f()}catch(e){return fb}},toast:m=>alert(m)};
  const esc=T.esc;
  const fmtBRL=v=>v==null?'—':('R$ '+Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}));
  const fmtComp=c=>{if(!c)return'—';const m=String(c).match(/(\d{4})-?(\d{2})/);if(!m)return esc(c);const mes=['','jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][parseInt(m[2],10)]||m[2];return mes+'/'+m[1];};
  let _s={root:null,rows:[],aberta:null};

  async function open(container){
    _s.root=container;
    container.innerHTML='<div id="fl-root"><div class="fl-empty">Carregando folhas recebidas&hellip;</div></div>';
    await reload();
    render();
  }
  function boot(){ const h=document.getElementById('folha-host'); if(h) open(h); }

  async function reload(){
    const {data}=await T.safe(()=>sb().from('ip_folha_pagamento_inbox').select('*').order('competencia',{ascending:false}).order('recebido_em',{ascending:false}).limit(200),{data:[]});
    _s.rows=data||[];
  }

  function estadoTag(e){
    const map={recebida:'info',pendente:'warn',processada:'ok',enviada_cs:'ok',erro:'danger'};
    const cls=map[e]||'muted';
    return '<span class="fl-tag '+cls+'">'+esc(e||'recebida')+'</span>';
  }

  function render(){
    const root=_s.root.querySelector('#fl-root'); if(!root)return;
    const rows=_s.rows;
    // KPIs
    const comps=[...new Set(rows.map(r=>r.competencia))].length;
    const ult=rows[0];
    const totBruto=rows.reduce((a,r)=>a+(Number(r.total_bruto)||0),0);
    const pend=rows.filter(r=>!r.processado_em).length;
    let html='<div class="fl-kpis">'
      +'<div class="fl-kpi hero"><div class="lab">Folhas recebidas</div><div class="val">'+rows.length+'</div><div class="note">'+comps+' compet&ecirc;ncia(s)</div></div>'
      +'<div class="fl-kpi"><div class="lab">A processar</div><div class="val" style="'+(pend?'color:var(--warn,#E1A754)':'')+'">'+pend+'</div><div class="note">pendentes de tratamento</div></div>'
      +'<div class="fl-kpi"><div class="lab">Total bruto acumulado</div><div class="val" style="font-size:22px">'+fmtBRL(totBruto)+'</div><div class="note">todas as compet&ecirc;ncias</div></div>'
      +'<div class="fl-kpi"><div class="lab">&Uacute;ltima compet&ecirc;ncia</div><div class="val" style="font-size:22px">'+(ult?fmtComp(ult.competencia):'—')+'</div><div class="note">'+(ult?(ult.n_colaboradores||0)+' colaboradores':'sem dados')+'</div></div>'
      +'</div>';
    // sintese
    html+='<div class="fl-banner"><div class="fl-banner-ico">&#9670;</div><div><div class="fl-banner-lab">Pipeline C&amp;S Engenharia &middot; intra-banco</div><div class="fl-banner-txt">As folhas chegam do canteiro via InnovaSphere (extra&ccedil;&atilde;o IA), s&atilde;o tratadas e encaminhadas automaticamente para este inbox. Aqui voc&ecirc; revisa, processa e libera para o grupo Financeiro C&amp;S.</div></div></div>';
    // lista
    html+='<div class="fl-sec-h">Folhas no inbox</div>';
    if(!rows.length){
      html+='<div class="fl-empty">Nenhuma folha recebida ainda. Quando uma folha for tratada e encaminhada na InnovaSphere (canteiro), ela aparece aqui automaticamente.</div>';
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
        +'<div class="fl-card-meta"><strong>'+esc(r.cliente||'C&S Engenharia')+'</strong>'+(r.origem_canteiro?' &middot; '+esc(r.origem_canteiro):'')+'</div>'
      +'</div>'
      +'<div class="fl-card-nums">'
        +'<div class="fl-num"><span class="k">Bruto</span><span class="v">'+fmtBRL(r.total_bruto)+'</span></div>'
        +'<div class="fl-num"><span class="k">L&iacute;quido</span><span class="v">'+fmtBRL(r.total_liquido)+'</span></div>'
        +'<div class="fl-num"><span class="k">Colab.</span><span class="v">'+(r.n_colaboradores||0)+'</span></div>'
      +'</div>'
      +'<div class="fl-card-side">'+estadoTag(r.estado)+(proc?'<span class="fl-mini">processada</span>':'<span class="fl-mini" style="color:var(--warn,#E1A754)">a processar</span>')+'</div>'
    +'</div>';
  }

  // detalhe (drawer) — colaboradores do jsonb 'dados'
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
          const bruto=c.bruto??c.total_bruto??c.salario_bruto??c.valor_bruto;
          const liq=c.liquido??c.total_liquido??c.salario_liquido??c.valor_liquido;
          return '<tr><td>'+esc(nome)+'</td><td>'+esc(cargo)+'</td><td style="text-align:right;font-family:var(--mono)">'+fmtBRL(bruto)+'</td><td style="text-align:right;font-family:var(--mono)">'+fmtBRL(liq)+'</td></tr>';
        }).join('')
        +'</tbody></table>';
    }else{
      body='<div class="fl-empty" style="padding:18px">Dados detalhados n&atilde;o estruturados como lista de colaboradores. Conte&uacute;do bruto extra&iacute;do:<pre style="text-align:left;white-space:pre-wrap;font-family:var(--mono);font-size:11px;color:var(--cream-muted,#D6CDB8);margin-top:10px;max-height:260px;overflow:auto">'+esc(JSON.stringify(dados,null,2).slice(0,4000))+'</pre></div>';
    }
    const proc=!!r.processado_em;
    const ov=document.createElement('div'); ov.className='fl-drawer-bg'; ov.id='fl-drawer';
    ov.innerHTML='<div class="fl-drawer" role="dialog" aria-modal="true">'
      +'<div class="fl-drawer-h"><div><div class="fl-drawer-comp">'+fmtComp(r.competencia)+'</div><div class="fl-drawer-sub">'+esc(r.cliente||'C&S Engenharia')+(r.origem_canteiro?' &middot; '+esc(r.origem_canteiro):'')+' &middot; '+estadoTag(r.estado)+'</div></div><button class="fl-x" onclick="IpFolha._fechar()">&times;</button></div>'
      +'<div class="fl-drawer-nums">'
        +'<div class="fl-num"><span class="k">Bruto</span><span class="v">'+fmtBRL(r.total_bruto)+'</span></div>'
        +'<div class="fl-num"><span class="k">L&iacute;quido</span><span class="v">'+fmtBRL(r.total_liquido)+'</span></div>'
        +'<div class="fl-num"><span class="k">Colaboradores</span><span class="v">'+(r.n_colaboradores||0)+'</span></div>'
        +'<div class="fl-num"><span class="k">Recebida</span><span class="v" style="font-size:13px">'+esc(T.fmtRel?T.fmtRel(r.recebido_em):(r.recebido_em||'').slice(0,10))+'</span></div>'
      +'</div>'
      +'<div class="fl-drawer-body">'+body+'</div>'
      +'<div class="fl-drawer-foot">'
        +(proc?'<span class="fl-mini" style="color:var(--ok,#6BAE82)">&#10003; Processada em '+esc((r.processado_em||'').slice(0,10))+'</span>':'<button class="fl-btn" onclick="IpFolha._processar(\''+esc(r.id)+'\')">Marcar como processada</button>')
        +'<button class="fl-btn ghost" onclick="IpFolha._prepararEnvioCS(\''+esc(r.id)+'\')">Preparar envio ao grupo C&amp;S</button>'
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
    const resumo='Folha '+fmtComp(r.competencia)+' · '+(r.cliente||'C&S Engenharia')+(r.origem_canteiro?' · '+r.origem_canteiro:'')
      +'\nBruto '+fmtBRL(r.total_bruto)+' · Líquido '+fmtBRL(r.total_liquido)+' · '+(r.n_colaboradores||0)+' colaboradores';
    T.toast('Resumo pronto. O disparo ao grupo C&S exige sua ordem explicita (governanca WhatsApp).');
    try{ navigator.clipboard.writeText(resumo); }catch(_){}
    console.log('[folha] resumo p/ grupo C&S (copiado):\n'+resumo);
  }

  const CSS=`
  #fl-root .fl-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
  #fl-root .fl-kpi{padding:16px 18px;border-radius:12px;background:var(--navy-raised,var(--cream2,#140D22));border:1px solid var(--rule,var(--border,rgba(245,221,165,.12)))}
  #fl-root .fl-kpi.hero{background:linear-gradient(135deg,rgba(196,163,90,.12),transparent);border-color:rgba(196,163,90,.3)}
  #fl-root .fl-kpi .lab{font-family:var(--mono);font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3,#A99E86);font-weight:600}
  #fl-root .fl-kpi .val{font-family:var(--serif);font-style:italic;font-size:30px;color:var(--ink,#F7F3EC);margin:6px 0 2px;line-height:1}
  #fl-root .fl-kpi .note{font-size:11px;color:var(--ink3,#A99E86)}
  #fl-root .fl-banner{display:flex;gap:14px;align-items:center;padding:16px 20px;border-radius:14px;background:linear-gradient(135deg,rgba(196,163,90,.1),rgba(123,90,168,.08));border:1px solid rgba(196,163,90,.25);margin-bottom:22px}
  #fl-root .fl-banner-ico{font-size:20px;color:var(--gold,#C4A35A)}
  #fl-root .fl-banner-lab{font-family:var(--mono);font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold-deep,#9C7E3B);font-weight:700;margin-bottom:4px}
  #fl-root .fl-banner-txt{font-family:var(--serif);font-style:italic;font-size:15px;color:var(--ink2,#D6CDB8);line-height:1.45}
  #fl-root .fl-sec-h{font-family:var(--mono);font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold-deep,#9C7E3B);font-weight:700;margin-bottom:12px}
  #fl-root .fl-empty{text-align:center;padding:30px 16px;color:var(--ink3,#A99E86);font-style:italic;font-family:var(--serif);font-size:15px}
  #fl-root .fl-list{display:flex;flex-direction:column;gap:8px}
  #fl-root .fl-card{display:flex;align-items:center;gap:18px;padding:14px 18px;border-radius:11px;background:var(--navy-raised,var(--cream2,#140D22));border:1px solid var(--rule,var(--border,rgba(245,221,165,.12)));border-left:3px solid var(--warn,#E1A754);cursor:pointer;transition:all .18s}
  #fl-root .fl-card:hover{border-color:var(--gold,#C4A35A);transform:translateX(2px)}
  #fl-root .fl-card.proc{border-left-color:var(--ok,#6BAE82);opacity:.82}
  #fl-root .fl-card-main{min-width:150px}
  #fl-root .fl-card-comp{font-family:var(--serif);font-style:italic;font-size:21px;color:var(--gold,#C4A35A);text-transform:capitalize}
  #fl-root .fl-card-meta{font-size:12px;color:var(--ink2,#D6CDB8);margin-top:2px}
  #fl-root .fl-card-nums{display:flex;gap:20px;flex:1}
  #fl-root .fl-num{display:flex;flex-direction:column}
  #fl-root .fl-num .k{font-family:var(--mono);font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3,#A99E86)}
  #fl-root .fl-num .v{font-size:14px;color:var(--ink,#F7F3EC);font-weight:500;margin-top:2px}
  #fl-root .fl-card-side{display:flex;flex-direction:column;align-items:flex-end;gap:5px}
  #fl-root .fl-mini{font-family:var(--mono);font-size:9.5px;color:var(--ink3,#A99E86)}
  #fl-root .fl-tag{font-size:10px;padding:3px 9px;border-radius:11px;letter-spacing:.04em;font-family:var(--sans)}
  #fl-root .fl-tag.info{background:rgba(123,165,216,.16);color:var(--blue,#7BA5D8)}
  #fl-root .fl-tag.warn{background:rgba(225,167,84,.16);color:var(--warn,#E1A754)}
  #fl-root .fl-tag.ok{background:rgba(107,174,130,.16);color:var(--ok,#6BAE82)}
  #fl-root .fl-tag.danger{background:rgba(216,117,117,.16);color:var(--red,#D87575)}
  #fl-root .fl-tag.muted{background:rgba(255,255,255,.05);color:var(--ink3,#A99E86)}
  .fl-drawer-bg{position:fixed;inset:0;background:rgba(8,5,15,.66);z-index:1000;display:flex;justify-content:flex-end;backdrop-filter:blur(3px)}
  .fl-drawer{width:min(640px,94vw);height:100%;overflow-y:auto;background:var(--cream,#0C0816);border-left:1px solid rgba(196,163,90,.25);padding:24px 26px;animation:flslide .25s ease}
  @keyframes flslide{from{transform:translateX(30px);opacity:.6}to{transform:none;opacity:1}}
  .fl-drawer-h{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:18px}
  .fl-drawer-comp{font-family:var(--serif);font-style:italic;font-size:26px;color:var(--gold,#C4A35A);text-transform:capitalize}
  .fl-drawer-sub{font-size:12.5px;color:var(--ink2,#D6CDB8);margin-top:4px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .fl-x{background:none;border:none;color:var(--ink3,#A99E86);font-size:26px;cursor:pointer;line-height:1}
  .fl-drawer-nums{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:14px;background:var(--cream2,#140D22);border-radius:10px;margin-bottom:18px}
  .fl-drawer-body{margin-bottom:18px}
  .fl-tbl{width:100%;border-collapse:collapse;font-size:13px}
  .fl-tbl th{text-align:left;padding:9px 10px;font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold-deep,#9C7E3B);border-bottom:1px solid rgba(245,221,165,.16)}
  .fl-tbl td{padding:9px 10px;border-bottom:1px solid rgba(245,221,165,.07);color:var(--ink2,#D6CDB8)}
  .fl-drawer-foot{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding-top:14px;border-top:1px solid rgba(245,221,165,.1)}
  .fl-btn{padding:11px 20px;border:none;border-radius:9px;background:linear-gradient(135deg,var(--gold-glow,#F5DDA5),var(--gold,#C4A35A));color:#2A1A3B;font-family:var(--sans);font-weight:600;font-size:13px;cursor:pointer;transition:all .2s}
  .fl-btn:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(196,163,90,.3)}
  .fl-btn.ghost{background:transparent;border:1px solid rgba(245,221,165,.25);color:var(--gold,#C4A35A)}
  .fl-btn.ghost:hover{background:rgba(196,163,90,.1)}
  @media(max-width:820px){#fl-root .fl-kpis{grid-template-columns:repeat(2,1fr)}#fl-root .fl-card{flex-wrap:wrap}}`;
  function injCSS(){if(document.getElementById('fl-css'))return;const s=document.createElement('style');s.id='fl-css';s.textContent=CSS;document.head.appendChild(s);}
  injCSS();

  window.IpFolha={open,boot,_abrir,_fechar,_processar,_prepararEnvioCS};
})();
