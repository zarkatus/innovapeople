// InnovaPeople · Consentimento DD-PF (client) · PQV-01 04/06
// O entregável central da diretiva CVO: capturar o consentimento da pessoa ANTES de qualquer
// busca avançada de CPF — termo versionado, por FINALIDADE individual, com hash auditável.
// API: window.IpDdConsent.abrir({ doc, nome, project_id, contexto_origem, onSuccess })
//      window.IpDdConsent.status(doc, finalidade) -> Promise<{valido,...}>
(function(){
  'use strict';
  if(window.IpDdConsent) return;
  var SB=function(){ return window.__IP_SB||window.sb; };
  var esc=function(s){ return (window.IpUI&&IpUI.esc)?IpUI.esc(s):String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); };
  var VERSAO='dd-pf-v1-2026-06';

  // finalidades (granular). dado_sensivel marca art.11 (bloco destacado).
  var FINS=[
    {k:'situacao_cadastral', n:'Situação cadastral do CPF na Receita', fonte:'Receita Federal / provedor credenciado', sens:false},
    {k:'certidoes',          n:'Certidões negativas públicas (débitos federais/PGFN)', fonte:'órgãos públicos / agregador', sens:false},
    {k:'pep_sancoes',        n:'Pessoa exposta politicamente (PEP) e listas de sanções', fonte:'Portal da Transparência', sens:false},
    {k:'credito_score',      n:'Indicadores de crédito e restritivos (score, negativações)', fonte:'bureau de crédito', sens:false},
    {k:'processos',          n:'Existência de processos judiciais', fonte:'tribunais / agregador', sens:false},
    {k:'kyc_biometria',      n:'Verificação de identidade por biometria (selfie/documento)', fonte:'provedor de KYC', sens:true},
    {k:'vinculos_renda',     n:'Comprovação de renda (você compartilha CNIS/IRPF via Gov.br)', fonte:'você, via Gov.br/e-CAC', sens:true}
  ];

  function termoTexto(ctx, projeto){
    var ctxLabel = {onboarding:'admissão',candidato:'formalização de vínculo',socio_vinculado:'verificação de sócio',cliente_curadoria:'relacionamento de curadoria comercial'}[ctx]||'verificação';
    return 'TERMO DE CONSENTIMENTO PARA VERIFICAÇÃO CADASTRAL E DE IDONEIDADE (DD-PF) — Versão '+VERSAO+'. '
      +'A InnCorporate / InnovaSphere solicita seu consentimento livre, informado, específico e inequívoco para realizar verificações de natureza cadastral e de idoneidade a seu respeito, com a finalidade exclusiva de '+ctxLabel+', no âmbito do projeto '+(projeto||'InnovaPeople')+'. '
      +'Esta verificação integra nosso dever de diligência e compliance. Não há decisão automatizada com efeitos sobre você sem revisão humana (art. 20 LGPD). '
      +'Você autoriza ITEM A ITEM apenas o que marcar abaixo. Seus direitos (acesso, correção, revogação a qualquer tempo) estão garantidos pela LGPD; a revogação interrompe novas consultas. '
      +'Os dados serão usados estritamente para a finalidade declarada, com retenção mínima e acesso restrito. Consentimento válido por 90 dias (pontual) ou 12 meses (relacional), renovável.';
  }

  function status(doc, finalidade){
    var sb=SB(); if(!sb) return Promise.resolve({valido:false});
    return sb.rpc('fn_dd_consentimento_status',{p_doc:String(doc||'').replace(/\D/g,''), p_finalidade:finalidade})
      .then(function(r){ return r.data||{valido:false}; }).catch(function(){ return {valido:false}; });
  }

  function _modalCss(){
    if(document.getElementById('ddc-css'))return;
    var st=document.createElement('style'); st.id='ddc-css';
    st.textContent=
      '.ddc-ov{position:fixed;inset:0;background:rgba(3,7,12,.7);z-index:9100;display:flex;align-items:center;justify-content:center;padding:20px}'
     +'.ddc-box{width:min(560px,100%);max-height:90vh;overflow-y:auto;background:var(--ip-bg,#0A1320);border:1px solid rgba(210,174,100,.25);border-radius:16px;padding:24px 26px}'
     +'.ddc-h{font:700 italic 20px Georgia;color:var(--ip-gold-lum,#E9A578);margin-bottom:6px}'
     +'.ddc-termo{font-size:12px;line-height:1.6;color:var(--ip-ink-2,#9FB0C5);background:var(--ip-bg-deep,#070D15);border:1px solid rgba(210,174,100,.1);border-radius:10px;padding:14px 16px;max-height:160px;overflow-y:auto;margin:12px 0}'
     +'.ddc-fin{display:flex;gap:11px;align-items:flex-start;padding:11px 12px;border:1px solid rgba(210,174,100,.1);border-radius:10px;margin-bottom:8px;cursor:pointer;transition:.15s}'
     +'.ddc-fin:hover{border-color:rgba(210,174,100,.3)}'
     +'.ddc-fin input{margin-top:3px;width:17px;height:17px;flex:0 0 auto;accent-color:var(--ip-gold-lum,#E9A578)}'
     +'.ddc-fin .nm{font-size:13px;color:var(--ip-cream,#F7F3EC)}.ddc-fin .fo{font-size:10.5px;color:var(--ip-ink-4,#6B7A90);margin-top:2px}'
     +'.ddc-sens{border-color:rgba(232,166,166,.3)!important;background:rgba(232,166,166,.05)}'
     +'.ddc-sens-tag{font:600 8.5px/1 system-ui;letter-spacing:.1em;text-transform:uppercase;color:var(--ip-danger,#E8A6A6);background:rgba(232,166,166,.16);padding:3px 7px;border-radius:7px;margin-left:6px}'
     +'.ddc-art11{font-size:10.5px;color:var(--ip-danger,#E8A6A6);margin:6px 0 12px;font-style:italic}'
     +'.ddc-foot{display:flex;gap:10px;margin-top:16px}'
     +'.ddc-btn{flex:1;padding:13px;border-radius:11px;font:600 13px/1 system-ui;cursor:pointer;border:1px solid}'
     +'.ddc-ok{background:var(--ip-gold-lum,#E9A578);color:#1a1205;border-color:var(--ip-gold-lum)}'
     +'.ddc-cancel{background:transparent;color:var(--ip-ink-2,#9FB0C5);border-color:rgba(210,174,100,.2)}'
     +'.ddc-res{font-size:12.5px;margin-top:10px}';
    (document.head||document.documentElement).appendChild(st);
  }

  function abrir(opts){
    opts=opts||{}; _modalCss();
    var doc=String(opts.doc||'').replace(/\D/g,'');
    var ctx=opts.contexto_origem||'cliente_curadoria';
    var snapshotTermo=termoTexto(ctx, opts.project_id);
    var ov=document.createElement('div'); ov.className='ddc-ov';
    var temSens = FINS.some(function(f){return f.sens;});
    ov.innerHTML='<div class="ddc-box" role="dialog" aria-modal="true">'
      +'<div class="ddc-h">Consentimento para pesquisa avançada</div>'
      +'<div style="font-size:12.5px;color:var(--ip-ink-3,#8FA0B5)">'+esc(opts.nome||('CPF '+doc.slice(0,3)+'***'))+' — autorize item a item o que pode ser consultado.</div>'
      +'<div class="ddc-termo">'+esc(snapshotTermo)+'</div>'
      +'<div id="ddc-fins">'+FINS.map(function(f){
          return '<label class="ddc-fin'+(f.sens?' ddc-sens':'')+'"><input type="checkbox" data-fin="'+f.k+'" data-sens="'+(f.sens?1:0)+'">'
            +'<div><div class="nm">'+esc(f.n)+(f.sens?'<span class="ddc-sens-tag">dado sensível</span>':'')+'</div><div class="fo">Fonte: '+esc(f.fonte)+'</div></div></label>';
        }).join('')+'</div>'
      +(temSens?'<div class="ddc-art11">Itens marcados como “dado sensível” (art. 11 LGPD) exigem aceite específico e destacado — só serão consultados se você marcá-los expressamente.</div>':'')
      +'<div id="ddc-res" class="ddc-res"></div>'
      +'<div class="ddc-foot"><button class="ddc-btn ddc-cancel" id="ddc-cancel">Agora não</button><button class="ddc-btn ddc-ok" id="ddc-ok">Consentir o que marquei</button></div>'
      +'</div>';
    document.body.appendChild(ov);
    function close(){ ov.remove(); }
    ov.addEventListener('click',function(e){ if(e.target===ov) close(); });
    ov.querySelector('#ddc-cancel').onclick=close;
    ov.querySelector('#ddc-ok').onclick=async function(){
      var marcadas=[].slice.call(ov.querySelectorAll('input[data-fin]:checked')).map(function(i){ return { finalidade:i.getAttribute('data-fin'), dado_sensivel:i.getAttribute('data-sens')==='1', aceito_em:new Date().toISOString() }; });
      var res=ov.querySelector('#ddc-res');
      if(!marcadas.length){ res.innerHTML='<span style="color:var(--ip-danger,#E8A6A6)">Marque ao menos uma finalidade para consentir.</span>'; return; }
      var btn=ov.querySelector('#ddc-ok'); btn.disabled=true; res.innerHTML='<span style="color:var(--ip-ink-3)">Registrando consentimento…</span>';
      try{
        var sb=SB();
        var r=await sb.rpc('fn_dd_consentimento_registrar',{
          p_snapshot:snapshotTermo, p_doc:doc, p_project:opts.project_id||'ip', p_contexto:ctx,
          p_finalidades:marcadas, p_nome:opts.nome||null, p_tipo_finalidade: ctx==='cliente_curadoria'?'relacional':'pontual',
          p_escopo_apis:marcadas.map(function(m){return m.finalidade;}),
          p_onboarding:opts.onboarding_id||null, p_candidato:opts.candidato_id||null, p_mandato:opts.mandato_id||null });
        if(r.error)throw r.error; if(!r.data||!r.data.ok)throw new Error((r.data&&r.data.error)||'falha');
        res.innerHTML='<span style="color:var(--ip-ok,#7BD3A0)">✓ Consentimento registrado ('+marcadas.length+' finalidade(s), hash '+esc((r.data.hash||'').slice(0,10))+'…). As pesquisas autorizadas já estão liberadas.</span>';
        if(opts.onSuccess) try{ opts.onSuccess(r.data, marcadas); }catch(_){}
        setTimeout(close, 1800);
      }catch(e){ res.innerHTML='<span style="color:var(--ip-danger,#E8A6A6)">Erro: '+esc(e.message||e)+'</span>'; btn.disabled=false; }
    };
  }

  window.IpDdConsent = { abrir:abrir, status:status, FINALIDADES:FINS, VERSAO:VERSAO };
})();
