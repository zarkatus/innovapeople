// InnovaPeople · Painel Consolidado do Grupo (client) · PQV-01 04/06
// Quando o nó corrente é um GRUPO/HOLDING/UNIDADE (não folha-empresa), mostra a visão de COMANDO
// do conglomerado: consolida gente + programas (EVM) + clima + sinais + os pareceres de DD dos
// nós com CNPJ da subárvore. Reusa os rollups server-side (fn_ip_org_*_rollup) + ip-ui.js.
// MODULAR: window.IpOrgPainel.render(hostEl) — lê o nó corrente de IpOrg.scope; some em folha.
(function(){
  'use strict';
  if(window.IpOrgPainel) return;
  var SB=function(){ return window.__IP_SB||window.sb; };
  var U=function(){ return window.IpUI; };
  var esc=function(s){ return (window.IpUI&&IpUI.esc)?IpUI.esc(s):String(s==null?'':s); };
  function brl(n){ if(n==null||isNaN(n))return '—'; return (+n).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}); }

  async function _rpc(fn, id){ var r=await SB().rpc(fn,{p_node_id:id}); return r.error?null:r.data; }

  function _injectCss(){
    if(document.getElementById('ipgp-css'))return;
    var st=document.createElement('style'); st.id='ipgp-css';
    st.textContent=
      '.ipgp{background:linear-gradient(135deg,#0C1626,#0A1320);border:1px solid rgba(210,174,100,.18);border-radius:16px;padding:22px 24px;margin-bottom:18px}'
     +'.ipgp-h{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:4px}'
     +'.ipgp-h h2{font-family:Georgia,serif;font-style:italic;font-weight:400;font-size:20px;color:var(--ip-gold-lum,#E5C77E)}'
     +'.ipgp-h .tag{font:600 9px/1 system-ui;letter-spacing:.14em;text-transform:uppercase;color:var(--ip-ink-3,#8FA0B5)}'
     +'.ipgp-sub{font-size:11.5px;color:var(--ip-ink-3,#8FA0B5);margin-bottom:16px}'
     +'.ipgp-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px;margin-bottom:16px}'
     +'.ipgp-kpi{background:var(--ip-bg-deep,#070D15);border:1px solid rgba(210,174,100,.1);border-radius:13px;padding:14px 16px}'
     +'.ipgp-dd{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}'
     +'.ipgp-pill{font:700 11px/1 system-ui;padding:7px 12px;border-radius:18px;display:flex;align-items:center;gap:6px}'
     +'.ipgp-pill .n{font-size:14px}'
     +'.ipgp-ok{background:rgba(123,211,160,.14);color:var(--ip-ok,#7BD3A0)}.ipgp-cau{background:rgba(229,199,126,.14);color:var(--ip-gold-lum,#E5C77E)}.ipgp-no{background:rgba(232,166,166,.14);color:var(--ip-danger,#E8A6A6)}.ipgp-pend{background:rgba(143,160,181,.12);color:var(--ip-ink-2,#9FB0C5)}'
     +'.ipgp-alerta{margin-top:12px;font-size:12.5px;color:var(--ip-danger,#E8A6A6);background:rgba(232,166,166,.07);border-radius:9px;padding:10px 13px}';
    (document.head||document.documentElement).appendChild(st);
  }

  async function render(host){
    if(!host) return; _injectCss();
    var node = (window.IpOrg && IpOrg.scope && IpOrg.scope.node) ? IpOrg.scope.node() : null;
    // só aparece em nó de AGREGAÇÃO (grupo/holding/unidade/segmento); em folha-empresa, some
    var ehAgregacao = node && ['grupo','holding','unidade_negocio','segmento','fundo'].indexOf(node.tipo_no)>=0;
    if(!ehAgregacao){ host.innerHTML=''; host.style.display='none'; return; }
    host.style.display='block';
    host.innerHTML='<div class="ipgp">'+(U()&&U().skeleton?U().skeleton(3):'Consolidando…')+'</div>';
    var res=await Promise.all([_rpc('fn_ip_org_evm_rollup',node.id),_rpc('fn_ip_org_pessoas_rollup',node.id),_rpc('fn_ip_org_clima_rollup',node.id),_rpc('fn_ip_org_dd_rollup',node.id)]);
    var evm=res[0]||{}, pes=res[1]||{}, cli=res[2]||{}, dd=res[3]||{};

    var kpis='<div class="ipgp-kpis">'
      +'<div class="ipgp-kpi">'+U().statBig((evm.empresas||0),'Empresas no grupo',{sub:(evm.programas||0)+' programas',color:'var(--ip-gold-lum)'})+'</div>'
      +'<div class="ipgp-kpi">'+U().statBig((pes.ativos||0),'Colaboradores',{sub:(pes.sinais_pendentes||0)+' sinais · '+(pes.acoes_tier1||0)+' T1'})+'</div>'
      +'<div class="ipgp-kpi">'+U().statBig((evm.avanco_pct!=null?evm.avanco_pct+'%':'—'),'Avanço consolidado',{sub:'EV '+brl(evm.ev)+' / PV '+brl(evm.pv),color:'var(--ip-ok)'})+'</div>'
      +'<div class="ipgp-kpi">'+U().statBig((cli.equipes_visiveis||0),'Equipes c/ clima',{sub:cli.risco_saida_medio!=null?('risco médio '+cli.risco_saida_medio+'/5'):'—'})+'</div>'
      +'</div>';

    // gauges CPI/SPI consolidados
    var gauges='';
    if(U().gauge && (evm.cpi!=null||evm.spi!=null)){
      gauges='<div style="display:flex;gap:14px;justify-content:center;margin:6px 0 14px">'+U().gauge(evm.cpi,{label:'CPI · custo',max:2,alvo:1})+U().gauge(evm.spi,{label:'SPI · prazo',max:2,alvo:1})+'</div>';
    }

    // rollup de DD (faróis de idoneidade da subárvore)
    var ddHtml='';
    if(dd && (dd.com_cnpj||0) > 0){
      ddHtml='<div class="ipgp-dd">'
        +'<span class="ipgp-pill ipgp-ok"><span class="n">'+(dd.entrar||0)+'</span> entrar</span>'
        +'<span class="ipgp-pill ipgp-cau"><span class="n">'+(dd.cautela||0)+'</span> cautela</span>'
        +'<span class="ipgp-pill ipgp-no"><span class="n">'+(dd.evitar||0)+'</span> evitar</span>'
        +(dd.dd_pendentes?'<span class="ipgp-pill ipgp-pend"><span class="n">'+dd.dd_pendentes+'</span> sem DD</span>':'')
        +'</div>';
      if(dd.pior){ ddHtml+='<div class="ipgp-alerta">⚠ Maior risco no grupo: <b>'+esc(dd.pior.nome)+'</b> — due diligence '+esc(dd.pior.veredicto)+(dd.pior.score!=null?(' (score '+esc(dd.pior.score)+')'):'')+'.</div>'; }
    } else {
      ddHtml='<div style="font-size:11.5px;color:var(--ip-ink-4,#6B7A90);font-style:italic;margin-top:6px">Nenhuma empresa do grupo tem CNPJ com due diligence ainda. Insira o CNPJ nas unidades para acompanhar a idoneidade consolidada.</div>';
    }

    host.innerHTML='<div class="ipgp">'
      +'<div class="ipgp-h"><h2>'+esc(node.nome)+'</h2><span class="tag">visão consolidada · '+esc(node.tipo_no)+'</span></div>'
      +'<div class="ipgp-sub">Tudo das '+(evm.empresas||0)+' empresa(s) abaixo deste nó, somado em tempo real. Clique numa empresa na árvore para descer.</div>'
      + kpis + gauges
      +'<div style="font:600 10px/1 system-ui;letter-spacing:.14em;text-transform:uppercase;color:var(--ip-ink-3,#8FA0B5);margin:6px 0 4px">Idoneidade · due diligence das empresas</div>'
      + ddHtml
      +'</div>';
  }

  window.IpOrgPainel = { render: render };
})();
