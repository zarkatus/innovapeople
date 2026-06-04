// InnovaPeople · Resultado por Obra (participação) — P9 Habilitacao IS x IP.
// Consome fn_plat_apurar_resultado (receita informada pelo gestor - custos reais - cascata waterfall)
// e v_plat_resultado_obra. NAO calcula tributo (handoff contabil cuida disso). window.IpResultado.
// Decisao CVO 30/05: receita informada pelo gestor; painel no IP primeiro.
(function(){
  'use strict';
  if(window.IpResultado && !window.IpResultado._isShim) return;
  const SB=()=>window.__IP_SB||window.sb;
  const T=window.TB||{toast:m=>{try{console.log(m)}catch(_){}}};
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const money=v=>(v==null||v==='')?'—':'R$ '+Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2});
  let _el=null, _obras=[], _sel=null, _ap=null;

  async function reload(){
    const sb=SB(); if(!sb) return;
    const r=await sb.from('v_plat_resultado_obra').select('*').order('project_id');
    let obras=(r&&r.data)||[];
    // reescopo organizacional: SÓ filtra quando o nó corrente declara projetos vinculados
    // (metadata.project_ids). Sem vínculo, mostra todas (não esconde obras indevidamente — honesto).
    try{
      const node=(window.IpOrg&&IpOrg.scope&&IpOrg.scope.node)?IpOrg.scope.node():null;
      const pids=node&&node.metadata&&node.metadata.project_ids;
      if(Array.isArray(pids)&&pids.length){ const set=new Set(pids); obras=obras.filter(o=>set.has(o.project_id)); }
    }catch(_){}
    _obras=obras;
  }
  function kpi(l,v,c){ return `<div style="flex:1;min-width:150px;background:var(--ip-bg-card);border:1px solid rgba(210,174,100,.18);border-radius:14px;padding:14px 16px;box-shadow:0 6px 18px rgba(0,0,0,.25)"><div style="font:600 11px/1 system-ui;letter-spacing:.08em;text-transform:uppercase;color:var(--ip-ink-3)">${esc(l)}</div><div style="font:700 italic 22px Georgia;color:${c||'var(--ip-gold-lum)'};margin-top:6px">${v}</div></div>`; }
  function btn(id,txt,kind){ const b='font:600 13px/1 system-ui;padding:11px 18px;border-radius:11px;cursor:pointer;border:1px solid;transition:.15s'; return kind==='primary'?`<button id="${id}" style="${b};background:var(--ip-gold);color:var(--ip-bg-deep);border-color:var(--ip-gold-lum)">${txt}</button>`:`<button id="${id}" style="${b};background:transparent;color:var(--ip-gold-lum);border-color:rgba(210,174,100,.4)">${txt}</button>`; }

  function render(el){
    _el=el||_el; if(!_el) return; el=_el;
    el.innerHTML=`<div style="max-width:1080px;margin:0 auto;padding:28px 32px">
      <h1 style="font:700 italic 27px Georgia;color:var(--ip-gold-lum);margin:0 0 6px">Resultado por Obra</h1>
      <div style="color:var(--ip-ink-3);font-size:13px;margin-bottom:22px">Apuração da participação: <strong>receita informada − custos reais − cascata do waterfall</strong>. A plataforma não calcula tributo (use o Handoff contábil). Selecione a obra.</div>
      <div id="ro-list">${_obras.length?_obras.map(cardObra).join(''):(window.IpUI?window.IpUI.emptyState({icon:'⚖',eyebrow:'Sem obras',title:'Nenhum empreendimento cadastrado',description:'Quando houver obra com estrutura de participação (sócios + waterfall), ela aparece aqui para apuração.'}):'<div style="padding:40px;text-align:center;color:var(--ip-ink-4);border:1px dashed rgba(210,174,100,.2);border-radius:14px">Nenhum empreendimento cadastrado.</div>')}</div>
    </div><div id="ro-drawer"></div>`;
    el.querySelectorAll('.ro-card').forEach(c=>c.onclick=()=>openObra(c.dataset.id));
  }
  function cardObra(o){
    return `<div class="ro-card" data-id="${esc(o.project_id)}" style="background:var(--ip-bg-card);border:1px solid rgba(210,174,100,.14);border-radius:13px;padding:16px 18px;margin-bottom:10px;cursor:pointer;transition:.15s">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><strong style="color:var(--ip-cream);font-size:16px">${esc(o.empreendimento||o.project_id)}</strong><span style="color:var(--ip-ink-4);font-size:12px">${o.n_socios} sócios · ${o.n_camadas_waterfall} camadas</span></div>
      <div style="color:var(--ip-ink-3);font-size:12.5px;margin-top:6px">Orçamento ${money(o.orcamento_total)} · Custo lançado ${money(o.custo_obra_lancado)} · Pessoal ${money(o.custo_pessoal_total)} · NF obra ${money(o.custo_nf_obra)}</div>
    </div>`;
  }

  async function openObra(pid){
    _sel=_obras.find(o=>o.project_id===pid); _ap=null;
    paintDrawer();
  }
  function paintDrawer(){
    const o=_sel; if(!o) return;
    const d=document.getElementById('ro-drawer');
    const casc=_ap&&_ap.cascata?_ap.cascata:null;
    d.innerHTML=`<div id="ro-ov" style="position:fixed;inset:0;background:rgba(3,7,12,.66);z-index:9000;display:flex;justify-content:flex-end">
      <div style="width:min(620px,100%);height:100%;background:var(--ip-bg);border-left:1px solid rgba(210,174,100,.25);box-shadow:-12px 0 40px rgba(0,0,0,.5);overflow-y:auto;padding:26px 28px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px"><h2 style="font:700 italic 22px Georgia;color:var(--ip-gold-lum);margin:0;flex:1">${esc(o.empreendimento||o.project_id)}</h2>${btn('ro-x','✕','ghost')}</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">${kpi('Orçamento',money(o.orcamento_total))}${kpi('Custo lançado',money(o.custo_obra_lancado),'var(--ip-danger)')}${kpi('Pessoal',money(o.custo_pessoal_total),'var(--ip-danger)')}</div>
      <div style="background:rgba(210,174,100,.06);border:1px solid rgba(210,174,100,.18);border-radius:10px;padding:12px 14px;margin-bottom:18px">
        <div style="font:600 11px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-gold);margin-bottom:10px">Apurar resultado</div>
        <label style="display:block;margin-bottom:12px"><span style="display:block;font:600 11px/1 system-ui;color:var(--ip-ink-3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Receita / VGV apurado (informe)</span>
          <input id="ro-rec" type="number" placeholder="0,00" style="width:100%;background:var(--ip-bg-deep);border:1px solid rgba(210,174,100,.25);border-radius:10px;padding:11px 13px;color:var(--ip-cream);font-size:15px"/></label>
        <div style="margin-top:4px">${btn('ro-calc','Calcular cascata','primary')}</div>
      </div>
      <div id="ro-result">${casc?renderCascata():'<div style="color:var(--ip-ink-4);font-size:13px;padding:10px 0">Informe a receita e calcule para ver a cascata do waterfall e o resultado líquido distribuível.</div>'}</div>
      <div id="ro-hist" style="margin-top:24px"></div>
      </div></div>`;
    d.querySelector('#ro-x').onclick=()=>{ d.innerHTML=''; };
    d.querySelector('#ro-ov').onclick=(e)=>{ if(e.target.id==='ro-ov') d.innerHTML=''; };
    d.querySelector('#ro-calc').onclick=calcular;
    if(casc){ const sv=d.querySelector('#ro-save'); if(sv) sv.onclick=salvar; }
    _renderHistorico();
  }
  // camada TEMPORAL: histórico de apurações desta obra (sparkline + diagnóstico de desvio)
  async function _renderHistorico(){
    const host=document.getElementById('ro-hist'); if(!host||!_sel) return;
    const r=await SB().from('plat_resultado_apuracao').select('competencia,receita_vgv,resultado_liquido,created_at').eq('project_id',_sel.project_id).order('created_at',{ascending:true}).limit(24);
    const aps=(r.error||!r.data)?[]:r.data;
    if(!aps.length){ host.innerHTML='<div style="font:600 11px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-ink-3);margin-bottom:8px">Histórico de apurações</div><div style="color:var(--ip-ink-4);font-size:12.5px;font-style:italic">Ainda sem apurações salvas para esta obra. Cada apuração que você salvar entra aqui — formando a curva do resultado ao longo do tempo e propagando para a linha do tempo da operação.</div>'; return; }
    const serie=aps.map(a=>Number(a.resultado_liquido)||0);
    const ultimo=serie[serie.length-1], penult=serie.length>1?serie[serie.length-2]:null;
    const spark=(window.IpUI&&serie.length>=2)?window.IpUI.sparkline(serie,{width:260,height:44,color: ultimo>=0?'var(--ip-ok)':'var(--ip-danger)'}):'';
    // diagnóstico de desvio determinístico
    let diag='';
    if(penult!=null){ const dv=ultimo-penult, pct=penult!==0?Math.round(dv/Math.abs(penult)*100):0;
      const cor=dv>=0?'var(--ip-ok)':'var(--ip-danger)';
      diag='<div style="font-size:12.5px;color:var(--ip-ink-2);margin-top:8px">Variação vs. apuração anterior: <b style="color:'+cor+'">'+(dv>=0?'+':'')+money(dv)+' ('+(pct>=0?'+':'')+pct+'%)</b>.'+(pct<=-10?' <span style="color:var(--ip-danger)">Queda relevante — revisar custos e cascata.</span>':pct>=10?' Trajetória positiva.':'')+'</div>'; }
    const rows=aps.slice().reverse().slice(0,6).map(a=>{ const rl=Number(a.resultado_liquido)||0;
      return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(210,174,100,.06);font-size:12.5px"><span style="color:var(--ip-ink-2)">'+esc(a.competencia||(a.created_at||'').slice(0,10))+'</span><span style="color:'+(rl>=0?'var(--ip-ok)':'var(--ip-danger)')+';font-family:monospace">'+money(rl)+'</span></div>'; }).join('');
    host.innerHTML='<div style="font:600 11px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-ink-3);margin-bottom:10px">Histórico de apurações · '+aps.length+'</div>'
      +(spark?'<div style="background:var(--ip-bg-card);border:1px solid rgba(210,174,100,.14);border-radius:12px;padding:14px 16px;margin-bottom:10px">'+spark+'<div style="font-size:11px;color:var(--ip-ink-4);margin-top:6px">Resultado líquido ao longo das apurações</div></div>':'')
      +diag+'<div style="margin-top:10px">'+rows+'</div>';
  }
  function renderCascata(){
    const a=_ap; if(!a||!a.cascata) return '';
    const rows=a.cascata.map(l=>`<tr style="border-bottom:1px solid rgba(210,174,100,.08)">
      <td style="padding:8px 6px;color:var(--ip-ink);font-size:13px">${esc(l.camada)}${l.requer_informe?' <span style="color:var(--ip-danger);font-size:11px">(informe necessário)</span>':''}<div style="color:var(--ip-ink-4);font-size:11px">${esc(l.beneficiario||'')} · ${esc(l.base||'')}</div></td>
      <td style="padding:8px 6px;text-align:right;color:var(--ip-gold-lum);font-family:monospace;font-size:13px;white-space:nowrap">${money(l.valor)}</td>
      <td style="padding:8px 6px;text-align:right;color:var(--ip-ink-3);font-family:monospace;font-size:12px;white-space:nowrap">${money(l.saldo_apos)}</td></tr>`).join('');
    const cd=a.custos_detalhe||{};
    const compSlices=[
      {l:'Obra lançada',v:Number(cd.custo_obra_lancado)||0,c:'var(--ip-gold)'},
      {l:'Folha bruto',v:Number(cd.custo_folha_bruto)||0,c:'var(--ip-gold-lum)'},
      {l:'Encargos',v:Number(cd.custo_folha_encargos)||0,c:'var(--ip-gold-soft)'},
      {l:'NF obra',v:Number(cd.custo_nf_obra)||0,c:'var(--ip-ink-2)'},
      {l:'NF suprim.',v:Number(cd.custo_nf_suprimentos)||0,c:'var(--ip-ink-3)'}
    ].filter(s=>s.v>0);
    const compHtml = (window.IpUI && compSlices.length) ? `<div style="font:600 11px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-ink-3);margin-bottom:10px">Composição do custo real</div><div style="background:var(--ip-bg-card);border:1px solid rgba(210,174,100,.14);border-radius:12px;padding:16px;margin-bottom:18px">${window.IpUI.doughnut(compSlices)}</div>` : '';
    return `${compHtml}<div style="font:600 11px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-ink-3);margin-bottom:8px">Cascata do waterfall</div>
      <table style="width:100%;border-collapse:collapse"><thead><tr style="color:var(--ip-ink-4);font-size:10.5px;text-transform:uppercase"><th style="text-align:left;padding:4px 6px">Camada</th><th style="text-align:right;padding:4px 6px">Valor</th><th style="text-align:right;padding:4px 6px">Saldo após</th></tr></thead><tbody>${rows}</tbody></table>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding:14px 16px;background:var(--ip-bg-card);border:1px solid rgba(210,174,100,.25);border-radius:12px">
        <span style="color:var(--ip-ink-3);font:600 12px/1 system-ui;text-transform:uppercase;letter-spacing:.05em">Resultado líquido distribuível</span>
        <span style="color:var(--ip-ok);font:700 italic 22px Georgia">${money(a.resultado_liquido)}</span></div>
      <div style="color:var(--ip-ink-4);font-size:11px;margin-top:8px">${esc(a.nota||'')}</div>
      <div style="margin-top:14px">${btn('ro-save','Salvar apuração','primary')}</div>`;
  }
  async function calcular(){
    const rec=Number(document.getElementById('ro-rec').value)||0;
    if(rec<=0){ T.toast('Informe a receita apurada.'); return; }
    const sb=SB(); const b=document.getElementById('ro-calc'); b.disabled=true; b.textContent='Calculando…';
    const { data, error } = await sb.rpc('fn_plat_apurar_resultado',{ p_project_id:_sel.project_id, p_receita:rec, p_extras:{} });
    b.disabled=false; b.textContent='Calcular cascata';
    if(error){ T.toast('Erro: '+(error.message||'')); return; }
    if(data&&data.erro){ T.toast(data.erro); return; }
    _ap=data; paintDrawer();
  }
  async function salvar(){
    if(!_ap) return;
    const rec=Number(document.getElementById('ro-rec').value)||_ap.receita_informada||0;
    const payload={ project_id:_sel.project_id, competencia:new Date().toISOString().slice(0,7),
      receita_vgv:rec, custos_snapshot:_ap.custos_detalhe, breakdown:_ap.cascata,
      resultado_liquido:_ap.resultado_liquido, status:'rascunho',
      criado_por:(window.__IP_USER_EMAIL)||'innovapeople' };
    const r=await window.IpPersist.write(
      ()=> SB().from('plat_resultado_apuracao').insert(payload).select(),
      { label:'Apuração', offline:{ op:'insert', table:'plat_resultado_apuracao', payload } });
    if(r.ok){ if(window.IspCelebra) try{window.IspCelebra()}catch(_){}; T.toast('Apuração salva (rascunho).'); }
  }

  function mount(el){
    _el=el; if(window.IpUI&&el) el.innerHTML='<div style="max-width:1080px;margin:0 auto;padding:28px 32px">'+window.IpUI.skeleton(5)+'</div>';
    try{ if(window.IpOrg){ IpOrg.init(); if(IpOrg.scope&&IpOrg.scope.onChange&&!_scoped){ _scoped=true; IpOrg.scope.onChange(function(){ reload().then(()=>render(_el)); }); } } }catch(_){}
    reload().then(()=>render(el));
  }
  let _scoped=false;
  window.IpResultado={ mount, _isShim:false };
})();
