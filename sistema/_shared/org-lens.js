// InnovaPeople · LENTES por nível de nó (org-lens.js) · PQV-01 04/06
// A tela troca de "lente" conforme o tipo do nó corrente na Espinha Organizacional:
//   • AGREGAÇÃO (grupo/holding/unidade/segmento/fundo) → visão de COMANDO consolidada (IpOrgPainel)
//   • EMPRESA (folha) → lente da PRÓPRIA empresa: programas/EVM + gente + clima + DD dela
//   • FRENTE/ATIVO/VEÍCULO → lente de EXECUÇÃO (quando existirem; hoje cai no fallback compacto)
// Antes, o painel SUMIA ao descer para uma empresa (buraco de UX). Agora cada nível mostra a sua lente.
// MODULAR: window.OrgLens.render(hostEl) — lê o nó corrente de IpOrg.scope; reusa os rollups server-side.
// Os rollups (fn_ip_org_*_rollup) já consolidam por SUBÁRVORE: uma empresa-folha é a subárvore de si mesma.
(function(){
  'use strict';
  if(window.OrgLens) return;
  var SB=function(){ return window.__IP_SB||window.sb; };
  var U=function(){ return window.IpUI; };
  var esc=function(s){ return (window.IpUI&&IpUI.esc)?IpUI.esc(s):String(s==null?'':s); };
  function brl(n){ if(n==null||isNaN(n))return '—'; return (+n).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}); }
  async function _rpc(fn, id){ var r=await SB().rpc(fn,{p_node_id:id}); return r.error?null:r.data; }

  var AGREGACAO=['grupo','holding','unidade_negocio','segmento','fundo'];
  var EXECUCAO=['frente','ativo','veiculo'];

  function _injectCss(){
    if(document.getElementById('orglens-css'))return;
    var st=document.createElement('style'); st.id='orglens-css';
    st.textContent=
      '.olns{background:linear-gradient(135deg,#0C1626,#0A1320);border:1px solid rgba(210,174,100,.18);border-radius:16px;padding:22px 24px;margin-bottom:18px}'
     +'.olns-h{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:4px}'
     +'.olns-h h2{font-family:Georgia,serif;font-style:italic;font-weight:400;font-size:20px;color:var(--ip-gold-lum,#E5C77E)}'
     +'.olns-lente{font:700 9px/1 system-ui;letter-spacing:.14em;text-transform:uppercase;color:var(--ip-bg-deep,#070D15);background:var(--ip-gold-lum,#E5C77E);padding:5px 9px;border-radius:20px}'
     +'.olns-sub{font-size:11.5px;color:var(--ip-ink-3,#8FA0B5);margin-bottom:16px}'
     +'.olns-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px;margin-bottom:16px}'
     +'.olns-kpi{background:var(--ip-bg-deep,#070D15);border:1px solid rgba(210,174,100,.1);border-radius:13px;padding:14px 16px}'
     +'.olns-sec{font:600 10px/1 system-ui;letter-spacing:.14em;text-transform:uppercase;color:var(--ip-ink-3,#8FA0B5);margin:14px 0 6px}'
     +'.olns-dd{display:flex;gap:8px;flex-wrap:wrap}'
     +'.olns-pill{font:700 11px/1 system-ui;padding:7px 12px;border-radius:18px}'
     +'.olns-ok{background:rgba(123,211,160,.14);color:var(--ip-ok,#7BD3A0)}.olns-cau{background:rgba(229,199,126,.14);color:var(--ip-gold-lum,#E5C77E)}.olns-no{background:rgba(232,166,166,.14);color:var(--ip-danger,#E8A6A6)}'
     +'.olns-empty{font-size:11.5px;color:var(--ip-ink-4,#6B7A90);font-style:italic;margin-top:6px}';
    (document.head||document.documentElement).appendChild(st);
  }

  // ── LENTE DA EMPRESA (folha): a operação da própria empresa, não a soma do grupo ──
  async function _lenteEmpresa(host, node){
    host.style.display='block';
    host.innerHTML='<div class="olns">'+(U()&&U().skeleton?U().skeleton(3):'Carregando empresa…')+'</div>';
    // rollups por subárvore: para uma folha, a subárvore é só ela → KPIs da própria empresa
    var res=await Promise.all([_rpc('fn_ip_org_evm_rollup',node.id),_rpc('fn_ip_org_pessoas_rollup',node.id),_rpc('fn_ip_org_clima_rollup',node.id),_rpc('fn_ip_org_dd_rollup',node.id)]);
    var evm=res[0]||{}, pes=res[1]||{}, cli=res[2]||{}, dd=res[3]||{};
    var cnpj = node.metadata && node.metadata.cnpj;
    var ddNode = node.metadata && node.metadata.dd;

    var kpis='<div class="olns-kpis">'
      +'<div class="olns-kpi">'+U().statBig((evm.programas||0),'Programas',{sub:(evm.avanco_pct!=null?evm.avanco_pct+'% avanço':'—'),color:'var(--ip-gold-lum)'})+'</div>'
      +'<div class="olns-kpi">'+U().statBig((pes.ativos||0),'Colaboradores',{sub:(pes.sinais_pendentes||0)+' sinais · '+(pes.acoes_tier1||0)+' T1'})+'</div>'
      +'<div class="olns-kpi">'+U().statBig((evm.ev!=null?brl(evm.ev):'—'),'Valor agregado',{sub:'PV '+brl(evm.pv),color:'var(--ip-ok)'})+'</div>'
      +'<div class="olns-kpi">'+U().statBig((cli.equipes_visiveis||0),'Equipes c/ clima',{sub:cli.risco_saida_medio!=null?('risco médio '+cli.risco_saida_medio+'/5'):'—'})+'</div>'
      +'</div>';

    var gauges='';
    if(U().gauge && (evm.cpi!=null||evm.spi!=null)){
      gauges='<div style="display:flex;gap:14px;justify-content:center;margin:6px 0 14px">'+U().gauge(evm.cpi,{label:'CPI · custo',max:2,alvo:1})+U().gauge(evm.spi,{label:'SPI · prazo',max:2,alvo:1})+'</div>';
    }

    // DD da própria empresa (do metadata do nó) ou aviso p/ inserir CNPJ
    var ddHtml='';
    if(ddNode && ddNode.veredicto){
      var cls=ddNode.veredicto==='ENTRAR'?'olns-ok':ddNode.veredicto==='EVITAR'?'olns-no':'olns-cau';
      ddHtml='<div class="olns-dd"><span class="olns-pill '+cls+'">Due diligence: '+esc(ddNode.veredicto)+(ddNode.risco_score!=null?(' · score '+esc(ddNode.risco_score)):'')+'</span>'
        +(cnpj?'<span class="olns-pill" style="background:rgba(143,160,181,.12);color:var(--ip-ink-2,#9FB0C5)">CNPJ '+esc(cnpj)+'</span>':'')+'</div>';
    } else if(cnpj){
      ddHtml='<div class="olns-empty">CNPJ '+esc(cnpj)+' cadastrado, due diligence ainda não rodada para esta empresa.</div>';
    } else {
      ddHtml='<div class="olns-empty">Sem CNPJ cadastrado. Insira o CNPJ desta empresa (menu ⋯ na árvore) para due diligence automática.</div>';
    }

    host.innerHTML='<div class="olns">'
      +'<div class="olns-h"><h2>'+esc(node.nome)+'</h2><span class="olns-lente">lente · empresa</span></div>'
      +'<div class="olns-sub">A operação desta empresa. Suba no grupo (breadcrumb) para ver o consolidado.</div>'
      + kpis + gauges
      +'<div class="olns-sec">Idoneidade · due diligence</div>' + ddHtml
      +'</div>';
  }

  // ── LENTE DE EXECUÇÃO (frente/ativo): compacta, só o avanço da frente ──
  async function _lenteExecucao(host, node){
    host.style.display='block';
    var evm=await _rpc('fn_ip_org_evm_rollup',node.id)||{};
    host.innerHTML='<div class="olns">'
      +'<div class="olns-h"><h2>'+esc(node.nome)+'</h2><span class="olns-lente">lente · '+esc(node.tipo_no)+'</span></div>'
      +'<div class="olns-sub">Execução desta frente.</div>'
      +'<div class="olns-kpis">'
      +'<div class="olns-kpi">'+U().statBig((evm.avanco_pct!=null?evm.avanco_pct+'%':'—'),'Avanço',{color:'var(--ip-ok)'})+'</div>'
      +'<div class="olns-kpi">'+U().statBig((evm.programas||0),'Programas',{})+'</div>'
      +'</div></div>';
  }

  // ── ROTEADOR DE LENTE: lê o tipo do nó e delega ──
  async function render(host){
    if(!host) return; _injectCss();
    var node = (window.IpOrg && IpOrg.scope && IpOrg.scope.node) ? IpOrg.scope.node() : null;
    if(!node){ host.innerHTML=''; host.style.display='none'; return; }
    try{
      if(AGREGACAO.indexOf(node.tipo_no)>=0){
        // lente de COMANDO consolidada — delega ao painel do grupo já existente (não reimplementa)
        if(window.IpOrgPainel && IpOrgPainel.render){ return IpOrgPainel.render(host); }
        host.style.display='none'; host.innerHTML=''; return;
      }
      if(node.tipo_no==='empresa'){ return _lenteEmpresa(host, node); }
      if(EXECUCAO.indexOf(node.tipo_no)>=0){ return _lenteExecucao(host, node); }
      // tipos sem lente dedicada: esconde (comportamento conservador)
      host.style.display='none'; host.innerHTML='';
    }catch(e){ host.style.display='none'; host.innerHTML=''; }
  }

  window.OrgLens = { render: render };
})();
