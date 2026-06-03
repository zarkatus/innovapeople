// InnovaPeople · Pessoas (BPO de Gente) — consome a entidade canonica core_colaborador.
// Habilitacao IS x IP · Fase A (P3) + Fase B (P4 afastamento · P5 SST · P6 desligamento ·
// P7 handoff contabil · P8 alocacao · P12 auditoria/MFA). Charter ratificado CVO 30/05/2026.
// window.IpPessoas. Tema RapheiceOS. IpPersist em toda escrita. Realtime. shim-safe.
// Guardrails: contabilidade FORA (handoff so exporta) · SST REGISTRA (nao emite) ·
// LGPD (CID nunca em evento; minimizado) · atos sensiveis auditados + AAL best-effort.
(function(){
  'use strict';
  if(window.IpPessoas && !window.IpPessoas._isShim) return;

  const SB = ()=> window.__IP_SB || window.sb;
  const T  = window.TB || { toast:(m)=>{ try{console.log(m)}catch(_){}} };
  const esc = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const money = v => (v==null||v==='') ? '—' : 'R$ '+Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2});
  const dt = d => { if(!d) return '—'; try{ return new Date(String(d).slice(0,10)+'T00:00:00').toLocaleDateString('pt-BR'); }catch(_){ return esc(d); } };
  const today = ()=> new Date().toISOString().slice(0,10);
  const cpfMask = c => { c=String(c||'').replace(/\D/g,''); return c.length===11 ? c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4') : esc(c||'—'); };
  const me = ()=> (window.__IP_USER_EMAIL)||'innovapeople';

  const ST = {
    ativo:    { l:'Ativo',     c:'var(--ip-ok)', bg:'rgba(46,139,87,.16)' },
    afastado: { l:'Afastado',  c:'var(--ip-gold-lum)', bg:'rgba(210,174,100,.16)' },
    desligado:{ l:'Desligado', c:'var(--ip-danger)', bg:'rgba(199,125,125,.16)' }
  };
  const TIPO_AFAST=[['atestado','Atestado médico'],['inss','Afastamento INSS'],['acidente_trabalho','Acidente de trabalho'],['licenca_maternidade','Licença maternidade'],['licenca_paternidade','Licença paternidade'],['ferias','Férias'],['suspensao','Suspensão'],['outro','Outro']];
  const TIPO_ASO=[['admissional','Admissional'],['periodico','Periódico'],['demissional','Demissional'],['retorno_trabalho','Retorno ao trabalho'],['mudanca_funcao','Mudança de função']];
  const RES_ASO=[['apto','Apto'],['apto_com_restricao','Apto com restrição'],['inapto','Inapto']];
  const TIPO_DESL=[['sem_justa_causa','Sem justa causa'],['pedido_demissao','Pedido de demissão'],['justa_causa','Justa causa'],['termino_contrato','Término de contrato'],['acordo','Acordo (484-A)'],['aposentadoria','Aposentadoria']];
  const AVISO=[['trabalhado','Trabalhado'],['indenizado','Indenizado'],['dispensado','Dispensado']];

  let _rows=[], _filtro={ q:'', status:'todos' }, _el=null, _chans=[], _tab='resumo';
  let _sub={ afast:[], aso:[], desl:null, okr:[], checkin:[] }; // satelites do colaborador aberto
  let _aal='aal1';

  // ---------- AAL / MFA best-effort (P12) ----------
  async function refreshAal(){
    try{
      const sb=SB(); if(!sb||!sb.auth||!sb.auth.mfa) return;
      const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      if(data&&data.currentLevel) _aal=data.currentLevel;
    }catch(_){}
  }
  function aalBadge(){
    const ok=_aal==='aal2';
    return `<span title="${ok?'Sessão com 2º fator (AAL2)':'Sessão de 1 fator (AAL1) — ato é auditado; ative MFA para AAL2'}" style="font:600 10px/1 system-ui;padding:4px 9px;border-radius:20px;color:${ok?'var(--ip-ok)':'var(--ip-gold-lum)'};background:${ok?'rgba(46,139,87,.14)':'rgba(210,174,100,.12)'};border:1px solid ${ok?'var(--ip-ok-deep)55':'var(--ip-gold)55'}">${ok?'MFA · AAL2':'sessão AAL1'}</span>`;
  }
  async function audit(ato, colaborador_id, detalhe){
    try{ await SB().from('core_ato_sensivel').insert({ ato, colaborador_id:colaborador_id||null, ator_email:me(), aal:_aal, detalhe:detalhe||{} }); }catch(_){}
  }
  // P12 real · garante AAL2 antes de ato sensivel; auto-enrollment TOTP se nao houver fator.
  // Retorna true se a sessao atingiu aal2; false se o usuario cancelou/falhou (ato NAO prossegue).
  async function ensureAal2(){
    const sb=SB();
    if(!sb||!sb.auth||!sb.auth.mfa){ return true; } // ambiente sem mfa: nao bloqueia (degrada p/ auditoria)
    try{
      let lvl=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      if(lvl&&lvl.data&&lvl.data.currentLevel==='aal2'){ _aal='aal2'; return true; }
      // tem fator TOTP verificado? se nao, oferece enrollment
      const { data:fl } = await sb.auth.mfa.listFactors();
      let totp=(fl&&fl.totp&&fl.totp[0])||null;
      if(!totp){
        if(!confirm('Este ato exige verificação em 2 fatores (MFA). Deseja ativar o autenticador (TOTP) agora?')) return false;
        const { data:en, error:ee } = await sb.auth.mfa.enroll({ factorType:'totp', friendlyName:'InnovaPeople '+Date.now() });
        if(ee){ T.toast('Falha ao iniciar MFA: '+(ee.message||'')); return false; }
        const uri=en&&en.totp&&(en.totp.uri||en.totp.qr_code)||'';
        window.open('data:text/html,'+encodeURIComponent('<body style="font-family:system-ui;padding:24px;background:var(--ip-bg);color:var(--ip-gold-lum)"><h3>Configurar autenticador</h3><p>Abra seu app (Google Authenticator, Authy) e escaneie/insira:</p><p style="word-break:break-all;background:var(--ip-bg-deep);padding:12px;border-radius:8px">'+esc(uri)+'</p><p>Depois volte e digite o código de 6 dígitos.</p></body>'),'_blank');
        totp={ id:en.id };
      }
      const code=prompt('Digite o código de 6 dígitos do seu autenticador:');
      if(!code) return false;
      const { data:ch, error:ce } = await sb.auth.mfa.challenge({ factorId:totp.id });
      if(ce){ T.toast('Falha no desafio MFA: '+(ce.message||'')); return false; }
      const { error:ve } = await sb.auth.mfa.verify({ factorId:totp.id, challengeId:ch.id, code:code.trim() });
      if(ve){ T.toast('Código inválido: '+(ve.message||'')); return false; }
      lvl=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      _aal=(lvl&&lvl.data&&lvl.data.currentLevel)||_aal;
      return _aal==='aal2';
    }catch(e){ T.toast('MFA indisponível: '+(e.message||e)); return false; }
  }

  // ---------- dados ----------
  async function reload(){
    const sb=SB(); if(!sb) return;
    // tenta a view 360 (flags); cai para tabela base se a view nao existir
    let r = await sb.from('v_core_colaborador_360').select('*').order('status').order('nome');
    if(r.error){ r = await sb.from('core_colaborador').select('*').order('status').order('nome'); }
    if(r.error){ T.toast('Erro ao carregar colaboradores: '+(r.error.message||'')); _rows=[]; return; }
    _rows = r.data||[];
  }
  async function loadSatelites(colabId){
    const sb=SB(); _sub={ afast:[], aso:[], desl:null, okr:[], checkin:[] };
    const [a,s,d,o,ck]=await Promise.all([
      sb.from('core_afastamento').select('*').eq('colaborador_id',colabId).order('data_inicio',{ascending:false}),
      sb.from('core_aso').select('*').eq('colaborador_id',colabId).order('data_exame',{ascending:false}),
      sb.from('core_desligamento').select('*').eq('colaborador_id',colabId).order('created_at',{ascending:false}).limit(1),
      sb.from('core_okr').select('*').eq('colaborador_id',colabId).order('ciclo',{ascending:false}),
      sb.from('core_checkin').select('*').eq('colaborador_id',colabId).order('data',{ascending:false}).limit(8)
    ]);
    _sub.afast=(a&&a.data)||[]; _sub.aso=(s&&s.data)||[]; _sub.desl=(d&&d.data&&d.data[0])||null;
    _sub.okr=(o&&o.data)||[]; _sub.checkin=(ck&&ck.data)||[];
  }
  function filtrados(){
    const q=(_filtro.q||'').toLowerCase().trim();
    return _rows.filter(r=>{
      if(_filtro.status!=='todos' && r.status!==_filtro.status) return false;
      if(!q) return true;
      return (r.nome||'').toLowerCase().includes(q) || (r.cargo||'').toLowerCase().includes(q) || (r.project_id||'').toLowerCase().includes(q);
    });
  }

  // ---------- diagnostico + proximos passos (camada disruptiva) ----------
  function diagnostico(){
    const ativos=_rows.filter(r=>r.status==='ativo'), passos=[];
    const semCargo=ativos.filter(r=>!r.cargo).length;
    const semAdm=ativos.filter(r=>!r.data_admissao).length;
    const asoVenc=_rows.filter(r=>r.aso_proximo_venc && new Date(r.aso_proximo_venc) < new Date(Date.now()+30*864e5)).length;
    const semAso=ativos.filter(r=>'aso_proximo_venc' in r && !r.aso_proximo_venc).length;
    if(!_rows.length) passos.push('Nenhum colaborador ainda — admita o primeiro ou sincronize as admissões da obra.');
    if(semCargo) passos.push(semCargo+' ativo(s) sem cargo — completar para folha/handoff.');
    if(semAdm)   passos.push(semAdm+' sem data de admissão — necessária para vínculo e SST.');
    if(asoVenc)  passos.push(asoVenc+' colaborador(es) com ASO vencendo em 30 dias — agendar exame periódico.');
    if(semAso)   passos.push(semAso+' ativo(s) sem ASO registrado — anexar admissional/periódico.');
    return { passos };
  }

  // ---------- componentes ----------
  function kpi(label,val,cor){
    return `<div style="flex:1;min-width:118px;background:var(--ip-bg-card);border:1px solid rgba(210,174,100,.18);border-radius:14px;padding:14px 16px;box-shadow:0 6px 18px rgba(0,0,0,.25)">
      <div style="font:600 11px/1 system-ui;letter-spacing:.08em;text-transform:uppercase;color:var(--ip-ink-3)">${esc(label)}</div>
      <div style="font:700 italic 26px Georgia;color:${cor||'var(--ip-gold-lum)'};margin-top:6px">${val}</div></div>`;
  }
  function badge(st){ const s=ST[st]||ST.ativo; return `<span style="font:600 11px/1 system-ui;padding:5px 10px;border-radius:20px;color:${s.c};background:${s.bg};border:1px solid ${s.c}55">${s.l}</span>`; }
  function tag(txt,cor){ return `<span style="font:600 10.5px/1 system-ui;padding:4px 9px;border-radius:20px;color:${cor};background:${cor}1f;border:1px solid ${cor}44">${esc(txt)}</span>`; }
  function btn(id,txt,kind){
    const base='font:600 13px/1 system-ui;padding:11px 18px;border-radius:11px;cursor:pointer;border:1px solid;transition:.15s';
    if(kind==='primary') return `<button id="${id}" style="${base};background:var(--ip-gold);color:var(--ip-bg-deep);border-color:var(--ip-gold-lum)">${txt}</button>`;
    if(kind==='danger')  return `<button id="${id}" style="${base};background:rgba(199,125,125,.14);color:var(--ip-danger);border-color:var(--ip-danger-2)66">${txt}</button>`;
    return `<button id="${id}" style="${base};background:transparent;color:var(--ip-gold-lum);border-color:rgba(210,174,100,.4)">${txt}</button>`;
  }
  function field(label,id,val,type,ph){
    return `<label style="display:block;margin-bottom:13px"><span style="display:block;font:600 11px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-ink-3);margin-bottom:6px">${esc(label)}</span>
      <input id="${id}" type="${type||'text'}" value="${val==null?'':esc(val)}" placeholder="${esc(ph||'')}" style="width:100%;background:var(--ip-bg-deep);border:1px solid rgba(210,174,100,.25);border-radius:10px;padding:10px 13px;color:var(--ip-cream);font-size:14px"/></label>`;
  }
  function selectField(label,id,val,opts){
    return `<label style="display:block;margin-bottom:13px"><span style="display:block;font:600 11px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-ink-3);margin-bottom:6px">${esc(label)}</span>
      <select id="${id}" style="width:100%;background:var(--ip-bg-deep);border:1px solid rgba(210,174,100,.25);border-radius:10px;padding:10px 13px;color:var(--ip-cream);font-size:14px">
      ${opts.map(o=>`<option value="${esc(o[0])}"${String(val)===String(o[0])?' selected':''}>${esc(o[1])}</option>`).join('')}</select></label>`;
  }
  const labelOf=(arr,v)=>{ const f=arr.find(o=>o[0]===v); return f?f[1]:(v||'—'); };

  // ---------- render principal ----------
  function render(el){
    _el=el||_el; if(!_el) return; el=_el;
    const list=filtrados(), dg=diagnostico();
    const counts={ativo:0,afastado:0,desligado:0};
    _rows.forEach(r=>{ counts[r.status]=(counts[r.status]||0)+1; });
    el.innerHTML=`
    <div style="max-width:1180px;margin:0 auto;padding:28px 32px">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:6px">
        <h1 style="font:700 italic 27px Georgia;color:var(--ip-gold-lum);margin:0;flex:1">Pessoas · BPO de Gente</h1>
        ${aalBadge()}
        ${btn('px-eng','◷ Engajamento','ghost')}
        ${btn('px-aloc','▦ Alocação','ghost')}
        ${btn('px-exp','⤓ Handoff contábil','ghost')}
        ${btn('px-sync','↻ Sincronizar obra','ghost')}
        ${btn('px-novo','+ Admitir','primary')}
      </div>
      <div style="color:var(--ip-ink-3);font-size:13px;margin-bottom:22px">Ciclo de vida unificado (obra ↔ gente): admissão · ponto/afastamento · SST · desligamento. A origem do dado é preservada e propaga em tempo real.</div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:22px">
        ${kpi('Ativos',counts.ativo,'var(--ip-ok)')}${kpi('Afastados',counts.afastado,'var(--ip-gold-lum)')}${kpi('Desligados',counts.desligado,'var(--ip-danger)')}${kpi('Total',_rows.length,'var(--ip-cream)')}
      </div>
      ${dg.passos.length?`<div style="background:linear-gradient(180deg,var(--ip-bg-card),var(--ip-bg));border:1px solid rgba(210,174,100,.22);border-left:3px solid var(--ip-gold);border-radius:14px;padding:16px 18px;margin-bottom:22px">
        <div style="font:600 12px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-gold);margin-bottom:10px">Diagnóstico · próximos passos</div>
        <ul style="margin:0;padding-left:18px;color:var(--ip-ink);font-size:13px;line-height:1.7">${dg.passos.map(p=>`<li>${esc(p)}</li>`).join('')}</ul></div>`:''}
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
        <input id="px-q" placeholder="Buscar por nome, cargo, projeto…" value="${esc(_filtro.q)}" style="flex:1;min-width:220px;background:var(--ip-bg);border:1px solid rgba(210,174,100,.25);border-radius:11px;padding:11px 14px;color:var(--ip-cream);font-size:14px"/>
        <select id="px-st" style="background:var(--ip-bg);border:1px solid rgba(210,174,100,.25);border-radius:11px;padding:11px 14px;color:var(--ip-cream);font-size:14px">
          <option value="todos"${_filtro.status==='todos'?' selected':''}>Todos os status</option>
          <option value="ativo"${_filtro.status==='ativo'?' selected':''}>Ativos</option>
          <option value="afastado"${_filtro.status==='afastado'?' selected':''}>Afastados</option>
          <option value="desligado"${_filtro.status==='desligado'?' selected':''}>Desligados</option>
        </select>
      </div>
      <div id="px-list">${ list.length ? list.map(cardRow).join('') : (window.IpUI && _filtro.q==='' && _filtro.status==='todos' ? window.IpUI.emptyState({icon:'☶',eyebrow:'Sem colaboradores',title:'Nenhum colaborador ainda',description:'Admita o primeiro pelo botão acima, ou sincronize as admissões que já existem na obra.'}) : `<div style="padding:48px;text-align:center;color:var(--ip-ink-4);border:1px dashed rgba(210,174,100,.2);border-radius:14px">Nenhum colaborador para o filtro atual.</div>`) }</div>
    </div>
    <div id="px-drawer"></div>`;
    el.querySelector('#px-novo').onclick=()=>openForm();
    el.querySelector('#px-sync').onclick=syncObra;
    el.querySelector('#px-aloc').onclick=openAlocacao;
    el.querySelector('#px-eng').onclick=openEngajamento;
    el.querySelector('#px-exp').onclick=openExport;
    const q=el.querySelector('#px-q');
    q.oninput=()=>{ _filtro.q=q.value; const lst=el.querySelector('#px-list'); const f=filtrados(); lst.innerHTML=f.length?f.map(cardRow).join(''):`<div style="padding:48px;text-align:center;color:var(--ip-ink-4)">Nenhum colaborador para o filtro atual.</div>`; bindRows(el); };
    el.querySelector('#px-st').onchange=(e)=>{ _filtro.status=e.target.value; render(el); };
    bindRows(el);
  }
  function cardRow(r){
    const flag = r.tem_afastamento_ativo ? tag('afastado ativo','var(--ip-gold-lum)') : '';
    const asoFlag = (r.aso_proximo_venc && new Date(r.aso_proximo_venc) < new Date(Date.now()+30*864e5)) ? tag('ASO vencendo','var(--ip-danger)') : '';
    return `<div class="px-card" data-id="${r.id}" style="display:flex;align-items:center;gap:14px;background:var(--ip-bg-card);border:1px solid rgba(210,174,100,.14);border-radius:13px;padding:14px 16px;margin-bottom:10px;cursor:pointer;transition:.15s">
      <div style="width:42px;height:42px;border-radius:50%;background:rgba(210,174,100,.14);display:flex;align-items:center;justify-content:center;font:700 16px Georgia;color:var(--ip-gold-lum)">${esc((r.nome||'?').trim().charAt(0).toUpperCase())}</div>
      <div style="flex:1;min-width:0">
        <div style="color:var(--ip-cream);font-weight:600;font-size:15px">${esc(r.nome)} ${flag} ${asoFlag}</div>
        <div style="color:var(--ip-ink-3);font-size:12.5px;margin-top:2px">${esc(r.cargo||'sem cargo')} · ${esc(r.project_id||r.mandato_id||'—')} · ${esc(r.modelo_contrato||'—')}</div>
      </div>
      <div style="text-align:right">${badge(r.status)}<div style="color:var(--ip-ink-4);font-size:11px;margin-top:5px">${r.origem==='innovasphere'?'da obra':'IP'}</div></div>
    </div>`;
  }
  function bindRows(el){ el.querySelectorAll('.px-card').forEach(c=>{ c.onclick=()=>{ const r=_rows.find(x=>x.id===c.dataset.id); if(r) openDetail(r); }; c.onmouseenter=()=>c.style.borderColor='rgba(210,174,100,.4)'; c.onmouseleave=()=>c.style.borderColor='rgba(210,174,100,.14)'; }); }

  // ---------- drawer base ----------
  function drawer(html){
    const d=document.getElementById('px-drawer');
    d.innerHTML=`<div id="px-ov" style="position:fixed;inset:0;background:rgba(3,7,12,.66);z-index:9000;display:flex;justify-content:flex-end">
      <div style="width:min(560px,100%);height:100%;background:var(--ip-bg);border-left:1px solid rgba(210,174,100,.25);box-shadow:-12px 0 40px rgba(0,0,0,.5);overflow-y:auto;padding:26px 28px">${html}</div></div>`;
    d.querySelector('#px-ov').onclick=(e)=>{ if(e.target.id==='px-ov') close(); };
  }
  function close(){ const d=document.getElementById('px-drawer'); if(d) d.innerHTML=''; }

  // ---------- admitir ----------
  function openForm(){
    drawer(`<div style="display:flex;align-items:center;gap:12px;margin-bottom:18px"><h2 style="font:700 italic 22px Georgia;color:var(--ip-gold-lum);margin:0;flex:1">Admitir colaborador</h2>${btn('px-x','✕ Fechar','ghost')}</div>
      <div style="background:rgba(210,174,100,.08);border:1px solid rgba(210,174,100,.2);border-radius:10px;padding:10px 12px;color:var(--ip-gold-soft);font-size:12px;margin-bottom:18px">Admissão é ato sensível — registrada em auditoria (${esc(_aal)}).</div>
      ${field('CPF *','f-cpf','','text','000.000.000-00')}
      ${field('Nome completo *','f-nome','','text','Nome do colaborador')}
      ${field('Projeto / Obra *','f-proj','','text','ex.: horigens, ph')}
      ${field('Cargo','f-cargo','','text','ex.: Pedreiro')}
      ${selectField('Modelo de contrato','f-mod','CLT',[['CLT','CLT'],['PJ','PJ'],['Temporário','Temporário'],['Estágio','Estágio'],['Aprendiz','Aprendiz']])}
      ${field('Data de admissão','f-adm','','date')}
      ${field('E-mail institucional','f-mail','','email','nome@empresa.com.br')}
      ${field('WhatsApp (E.164)','f-wa','','text','+5547999999999')}
      <div style="margin-top:8px">${btn('px-save','Confirmar admissão','primary')}</div>`);
    const d=document.getElementById('px-drawer');
    d.querySelector('#px-x').onclick=close;
    d.querySelector('#px-save').onclick=salvarAdmissao;
  }
  async function salvarAdmissao(){
    const g=id=>document.getElementById(id);
    const cpf=(g('f-cpf').value||'').replace(/\D/g,''), nome=(g('f-nome').value||'').trim(), proj=(g('f-proj').value||'').trim();
    if(cpf.length!==11){ T.toast('CPF inválido (11 dígitos).'); return; }
    if(!nome){ T.toast('Informe o nome.'); return; }
    if(!proj){ T.toast('Informe o projeto/obra.'); return; }
    if(_rows.some(r=>String(r.cpf).replace(/\D/g,'')===cpf)){ T.toast('Já existe colaborador com este CPF.'); return; }
    const payload={ cpf, nome, project_id:proj,
      cargo:(g('f-cargo').value||'').trim()||null, modelo_contrato:g('f-mod').value||null,
      data_admissao:g('f-adm').value||null, email_institucional:(g('f-mail').value||'').trim()||null,
      whatsapp_e164:(g('f-wa').value||'').trim()||null, status:'ativo', origem:'innovapeople', criado_por:me() };
    const sv=g('px-save'); sv.disabled=true; sv.textContent='Salvando…';
    const r=await window.IpPersist.write(
      ()=> SB().from('core_colaborador').insert(payload).select(),
      { label:'Admissão', offline:{ op:'insert', table:'core_colaborador', payload } });
    if(r.ok){ audit('admissao', (r.data&&r.data[0]&&r.data[0].id)||null, {cpf:'***',project_id:proj}); if(window.IspCelebra) try{window.IspCelebra()}catch(_){}; close(); await reload(); render(_el); }
    else { sv.disabled=false; sv.textContent='Confirmar admissão'; }
  }

  // ---------- detalhe com abas ----------
  async function openDetail(r){
    _tab='resumo';
    await loadSatelites(r.id);
    paintDetail(r);
  }
  function tabBtn(id,txt){ const on=_tab===id; return `<button data-tab="${id}" style="font:600 12px/1 system-ui;padding:9px 13px;border-radius:9px;cursor:pointer;border:1px solid ${on?'var(--ip-gold-lum)':'rgba(210,174,100,.25)'};background:${on?'rgba(210,174,100,.16)':'transparent'};color:${on?'var(--ip-cream)':'var(--ip-ink-2)'}">${txt}</button>`; }
  function paintDetail(r){
    const desligado=r.status==='desligado';
    let body='';
    if(_tab==='resumo') body=tabResumo(r,desligado);
    else if(_tab==='afast') body=tabAfast(r,desligado);
    else if(_tab==='sst') body=tabSst(r,desligado);
    else if(_tab==='okr') body=tabOkr(r,desligado);
    else if(_tab==='desl') body=tabDesl(r,desligado);
    drawer(`<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px"><h2 style="font:700 italic 22px Georgia;color:var(--ip-gold-lum);margin:0;flex:1">${esc(r.nome)}</h2>${btn('px-x','✕','ghost')}</div>
      <div style="margin-bottom:14px">${badge(r.status)} <span style="color:var(--ip-ink-4);font-size:12px;margin-left:6px">${r.origem==='innovasphere'?'origem: obra (InnovaSphere)':'origem: InnovaPeople'}</span></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">${tabBtn('resumo','Resumo')}${tabBtn('afast','Afastamentos'+(_sub.afast.length?' ('+_sub.afast.length+')':''))}${tabBtn('sst','SST'+(_sub.aso.length?' ('+_sub.aso.length+')':''))}${tabBtn('okr','OKR & Check-in'+(_sub.okr.length?' ('+_sub.okr.length+')':''))}${tabBtn('desl','Desligamento')}</div>
      <div id="px-tabbody">${body}</div>`);
    const d=document.getElementById('px-drawer');
    d.querySelector('#px-x').onclick=close;
    d.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{ _tab=b.dataset.tab; paintDetail(r); });
    wireTab(r,desligado);
  }

  function tabResumo(r,desligado){
    return `<div style="background:var(--ip-bg-card);border:1px solid rgba(210,174,100,.16);border-radius:12px;padding:14px 16px;margin-bottom:16px;font-size:13.5px;line-height:1.9;color:var(--ip-ink)">
        <div><span style="color:var(--ip-ink-3)">CPF:</span> ${cpfMask(r.cpf)}</div>
        <div><span style="color:var(--ip-ink-3)">Projeto/Obra:</span> ${esc(r.project_id||'—')}</div>
        <div><span style="color:var(--ip-ink-3)">Cargo:</span> ${esc(r.cargo||'—')} · ${esc(r.modelo_contrato||'—')}</div>
        <div><span style="color:var(--ip-ink-3)">Admissão:</span> ${dt(r.data_admissao)}</div>
        <div><span style="color:var(--ip-ink-3)">E-mail:</span> ${esc(r.email_institucional||'—')}</div>
        <div><span style="color:var(--ip-ink-3)">Remuneração:</span> ${money(r.remuneracao)} <span style="color:var(--ip-ink-4);font-size:11px">(armazenada p/ handoff; plataforma não calcula tributo)</span></div>
        ${desligado?`<div><span style="color:var(--ip-ink-3)">Desligamento:</span> ${dt(r.data_desligamento)}</div>`:''}
      </div>
      ${desligado?'<div style="color:var(--ip-ink-3);font-size:12.5px">Colaborador desligado — edição bloqueada. Veja a aba Desligamento.</div>':`
      <div style="font:600 11px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-ink-3);margin:0 0 12px">Editar</div>
      ${field('Cargo','e-cargo',r.cargo,'text')}
      ${field('Centro de custo','e-cc',r.centro_custo,'text')}
      ${field('Remuneração (armazena p/ handoff)','e-rem',r.remuneracao,'number')}
      ${selectField('Status','e-st',r.status==='desligado'?'ativo':r.status,[['ativo','Ativo'],['afastado','Afastado']])}
      <div style="margin-top:6px">${btn('px-upd','Salvar alterações','primary')}</div>`}`;
  }
  function tabAfast(r,desligado){
    const list=_sub.afast.map(a=>{
      const aberto=a.status==='ativo';
      return `<div style="background:var(--ip-bg-card);border:1px solid rgba(210,174,100,.14);border-radius:11px;padding:12px 14px;margin-bottom:9px">
        <div style="display:flex;align-items:center;gap:8px"><strong style="color:var(--ip-cream);font-size:13.5px">${esc(labelOf(TIPO_AFAST,a.tipo))}</strong>${aberto?tag('em aberto','var(--ip-gold-lum)'):tag('encerrado','var(--ip-ok)')}</div>
        <div style="color:var(--ip-ink-3);font-size:12px;margin-top:4px">${dt(a.data_inicio)} → ${a.data_fim?dt(a.data_fim):'—'}${a.cid?' · CID registrado':''}</div>
        ${a.observacoes?`<div style="color:var(--ip-ink-2);font-size:12px;margin-top:4px">${esc(a.observacoes)}</div>`:''}
        ${aberto&&!desligado?`<div style="margin-top:8px">${btn('af-end-'+a.id,'Encerrar afastamento','ghost')}</div>`:''}
      </div>`;
    }).join('')||'<div style="color:var(--ip-ink-4);font-size:13px;padding:14px 0">Sem afastamentos registrados.</div>';
    return `${list}${desligado?'':`<div style="border-top:1px solid rgba(210,174,100,.15);margin-top:14px;padding-top:16px">
      <div style="font:600 11px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-ink-3);margin-bottom:12px">Registrar afastamento</div>
      ${selectField('Tipo','af-tipo','atestado',TIPO_AFAST)}
      ${field('Início','af-ini',today(),'date')}
      ${field('Fim (deixe vazio se em aberto)','af-fim','','date')}
      ${field('CID (opcional · dado de saúde · não vai a evento)','af-cid','','text','ex.: M54.5')}
      ${field('Observações','af-obs','','text')}
      <div style="margin-top:6px">${btn('af-add','Registrar afastamento','primary')}</div>
      <div style="color:var(--ip-ink-4);font-size:11px;margin-top:8px">Registrar afastamento move o colaborador para status "afastado". CID é minimizado (LGPD).</div></div>`}`;
  }
  function tabSst(r,desligado){
    const list=_sub.aso.map(s=>{
      const venc = s.data_vencimento && new Date(s.data_vencimento) < new Date();
      const prox = s.data_vencimento && !venc && new Date(s.data_vencimento) < new Date(Date.now()+30*864e5);
      return `<div style="background:var(--ip-bg-card);border:1px solid rgba(210,174,100,.14);border-radius:11px;padding:12px 14px;margin-bottom:9px">
        <div style="display:flex;align-items:center;gap:8px"><strong style="color:var(--ip-cream);font-size:13.5px">ASO ${esc(labelOf(TIPO_ASO,s.tipo))}</strong>${s.resultado?tag(labelOf(RES_ASO,s.resultado), s.resultado==='inapto'?'var(--ip-danger)':(s.resultado==='apto'?'var(--ip-ok)':'var(--ip-gold-lum)')):''}${venc?tag('vencido','var(--ip-danger)'):(prox?tag('vence em breve','var(--ip-gold-lum)'):'')}</div>
        <div style="color:var(--ip-ink-3);font-size:12px;margin-top:4px">Exame: ${dt(s.data_exame)} · Vence: ${dt(s.data_vencimento)}${s.medico_nome?' · Dr(a). '+esc(s.medico_nome):''}${s.medico_crm?' (CRM '+esc(s.medico_crm)+')':''}</div>
        ${s.anexo_path?`<div style="color:var(--ip-ink-2);font-size:11.5px;margin-top:4px">Anexo: ${esc(s.anexo_path)}</div>`:''}
      </div>`;
    }).join('')||'<div style="color:var(--ip-ink-4);font-size:13px;padding:14px 0">Sem ASO registrado.</div>';
    return `<div style="background:rgba(210,174,100,.06);border:1px solid rgba(210,174,100,.18);border-radius:10px;padding:10px 12px;color:var(--ip-gold-soft);font-size:12px;margin-bottom:14px">A plataforma <strong>registra</strong> o ASO emitido pelo médico do trabalho — não emite laudo nem substitui PCMSO/PGR.</div>
      ${list}${desligado?'':`<div style="border-top:1px solid rgba(210,174,100,.15);margin-top:14px;padding-top:16px">
      <div style="font:600 11px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-ink-3);margin-bottom:12px">Registrar ASO</div>
      ${selectField('Tipo','as-tipo','periodico',TIPO_ASO)}
      ${selectField('Resultado','as-res','apto',RES_ASO)}
      ${field('Data do exame','as-ex',today(),'date')}
      ${field('Vencimento','as-venc','','date')}
      ${field('Médico (nome)','as-med','','text')}
      ${field('CRM','as-crm','','text')}
      ${field('Anexo (caminho/URL do ASO digitalizado)','as-anx','','text')}
      <div style="margin-top:6px">${btn('as-add','Registrar ASO','primary')}</div></div>`}`;
  }
  function tabOkr(r,desligado){
    const okrs=_sub.okr.map(o=>{
      const krs=Array.isArray(o.key_results)?o.key_results:[];
      return `<div style="background:var(--ip-bg-card);border:1px solid rgba(210,174,100,.14);border-radius:11px;padding:13px 15px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font:600 10.5px/1 system-ui;color:var(--ip-ink-3)">${esc(o.ciclo)}</span>${o.status!=='ativo'?tag(o.status,o.status==='concluido'?'var(--ip-ok)':'var(--ip-ink-2)'):''}</div>
        <div style="color:var(--ip-cream);font-weight:600;font-size:14px">${esc(o.objetivo)}</div>
        ${krs.length?`<ul style="margin:8px 0 0;padding-left:16px;color:var(--ip-ink-2);font-size:12.5px;line-height:1.6">${krs.map(k=>`<li>${esc(k.kr||k.descricao||'')}${k.atual!=null||k.meta!=null?` <span style="color:var(--ip-ink-4)">(${esc(k.atual??'—')}/${esc(k.meta??'—')}${k.unidade?' '+esc(k.unidade):''})</span>`:''}</li>`).join('')}</ul>`:''}
        <div style="height:7px;border-radius:5px;background:var(--ip-bg-deep);margin:9px 0 4px;overflow:hidden"><div style="width:${Math.max(0,Math.min(100,Number(o.progresso)||0))}%;height:100%;background:linear-gradient(90deg,var(--ip-gold),var(--ip-gold-lum))"></div></div>
        <div style="display:flex;justify-content:space-between;align-items:center"><span style="color:var(--ip-ink-3);font-size:11.5px">${Number(o.progresso)||0}% concluído</span>${desligado?'':`<button data-okr-prog="${o.id}" style="font:600 11px/1 system-ui;padding:5px 10px;border-radius:8px;cursor:pointer;border:1px solid rgba(210,174,100,.35);background:transparent;color:var(--ip-gold-lum)">Atualizar progresso</button>`}</div>
      </div>`;
    }).join('')||'<div style="color:var(--ip-ink-4);font-size:13px;padding:8px 0">Sem OKR neste colaborador.</div>';
    const checks=_sub.checkin.map(c=>`<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid rgba(210,174,100,.08)">
        <span style="font-size:16px">${['','😟','😕','😐','🙂','😄'][c.humor||0]||'·'}</span>
        <div style="flex:1"><div style="color:var(--ip-ink-2);font-size:11px">${dt(c.data)}</div>${c.progresso_nota?`<div style="color:var(--ip-ink);font-size:12.5px">${esc(c.progresso_nota)}</div>`:''}${c.bloqueios?`<div style="color:var(--ip-danger);font-size:12px">⚠ ${esc(c.bloqueios)}</div>`:''}</div>
      </div>`).join('')||'<div style="color:var(--ip-ink-4);font-size:12.5px;padding:6px 0">Sem check-ins.</div>';
    return `<div style="font:600 11px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-ink-3);margin-bottom:10px">Objetivos & Resultados-chave</div>
      ${okrs}
      ${desligado?'':`<div style="border-top:1px solid rgba(210,174,100,.15);margin-top:12px;padding-top:14px">
        ${field('Ciclo','ok-ciclo','2026-T2','text','ex.: 2026-T2')}
        ${field('Objetivo','ok-obj','','text','O que se quer alcançar')}
        ${field('Key results (1 por linha: descrição | meta | unidade)','ok-krs','','text','Ex.: Reduzir retrabalho | 10 | %')}
        <div style="margin-top:4px">${btn('ok-add','Criar OKR','primary')}</div></div>`}
      <div style="font:600 11px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-ink-3);margin:20px 0 10px">Check-ins recentes</div>
      ${checks}
      ${desligado?'':`<div style="border-top:1px solid rgba(210,174,100,.15);margin-top:12px;padding-top:14px">
        ${selectField('Humor','ck-humor','3',[['5','😄 Ótimo'],['4','🙂 Bem'],['3','😐 Neutro'],['2','😕 Difícil'],['1','😟 Ruim']])}
        ${field('Progresso (o que andou)','ck-prog','','text')}
        ${field('Bloqueios','ck-bloq','','text')}
        <div style="margin-top:4px">${btn('ck-add','Registrar check-in','ghost')}</div></div>`}`;
  }
  function tabDesl(r,desligado){
    if(_sub.desl){ const d=_sub.desl;
      return `<div style="background:var(--ip-bg-card);border:1px solid rgba(210,174,100,.16);border-radius:12px;padding:14px 16px;font-size:13.5px;line-height:1.9;color:var(--ip-ink)">
        <div><span style="color:var(--ip-ink-3)">Tipo:</span> ${esc(labelOf(TIPO_DESL,d.tipo))}</div>
        <div><span style="color:var(--ip-ink-3)">Aviso prévio:</span> ${esc(labelOf(AVISO,d.aviso_previo))}</div>
        <div><span style="color:var(--ip-ink-3)">Data do aviso:</span> ${dt(d.data_aviso)}</div>
        <div><span style="color:var(--ip-ink-3)">Desligamento:</span> ${dt(d.data_desligamento)}</div>
        <div><span style="color:var(--ip-ink-3)">Homologação:</span> ${esc(d.homologacao_status)}${d.homologacao_data?' · '+dt(d.homologacao_data):''}</div>
        ${d.motivo?`<div><span style="color:var(--ip-ink-3)">Motivo:</span> ${esc(d.motivo)}</div>`:''}
      </div><div style="color:var(--ip-ink-4);font-size:12px;margin-top:12px">Rescisão e verbas são calculadas pela contabilidade (fora da plataforma). Use o Handoff contábil para exportar.</div>`;
    }
    if(desligado) return '<div style="color:var(--ip-ink-3);font-size:13px">Colaborador desligado, sem detalhe de rescisão registrado.</div>';
    return `<div style="background:rgba(199,125,125,.08);border:1px solid rgba(199,125,125,.25);border-radius:10px;padding:10px 12px;color:var(--ip-danger);font-size:12px;margin-bottom:14px">Zona sensível. O desligamento emite <code>pessoa:desligada</code>, registra o detalhe de rescisão e move o status. Ato auditado (sessão ${esc(_aal)}).</div>
      ${selectField('Tipo de desligamento','dl-tipo','sem_justa_causa',TIPO_DESL)}
      ${selectField('Aviso prévio','dl-aviso','indenizado',AVISO)}
      ${field('Data do aviso','dl-aviso-data',today(),'date')}
      ${field('Data do desligamento','dl-data',today(),'date')}
      ${field('Motivo / observações','dl-motivo','','text')}
      ${field('Digite DESLIGAR para confirmar','dl-conf','','text')}
      <div style="margin-top:6px">${btn('dl-go','Desligar colaborador','danger')}</div>`;
  }
  function wireTab(r,desligado){
    const d=document.getElementById('px-drawer'); if(!d) return;
    if(_tab==='resumo' && !desligado){ const u=d.querySelector('#px-upd'); if(u) u.onclick=()=>salvarAlteracao(r); }
    if(_tab==='afast' && !desligado){
      const add=d.querySelector('#af-add'); if(add) add.onclick=()=>addAfastamento(r);
      _sub.afast.filter(a=>a.status==='ativo').forEach(a=>{ const b=d.querySelector('#af-end-'+a.id); if(b) b.onclick=()=>encerrarAfast(r,a); });
    }
    if(_tab==='sst' && !desligado){ const add=d.querySelector('#as-add'); if(add) add.onclick=()=>addAso(r); }
    if(_tab==='okr' && !desligado){
      const ao=d.querySelector('#ok-add'); if(ao) ao.onclick=()=>addOkr(r);
      const ck=d.querySelector('#ck-add'); if(ck) ck.onclick=()=>addCheckin(r);
      _sub.okr.forEach(o=>{ const b=d.querySelector('[data-okr-prog="'+o.id+'"]'); if(b) b.onclick=()=>atualizarProgresso(r,o); });
    }
    if(_tab==='desl' && !desligado && !_sub.desl){ const go=d.querySelector('#dl-go'); if(go) go.onclick=()=>desligar(r); }
  }
  // ---------- acoes: OKR / check-in (P11) ----------
  function parseKrs(txt){
    return (txt||'').split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{
      const p=l.split('|').map(x=>x.trim());
      return { kr:p[0]||l, meta:p[1]!=null&&p[1]!==''?(isNaN(Number(p[1]))?p[1]:Number(p[1])):null, unidade:p[2]||null, atual:null };
    });
  }
  async function addOkr(r){
    const g=id=>document.getElementById(id);
    const obj=(g('ok-obj').value||'').trim(); const ciclo=(g('ok-ciclo').value||'').trim();
    if(!obj){ T.toast('Informe o objetivo.'); return; }
    if(!ciclo){ T.toast('Informe o ciclo.'); return; }
    const payload={ colaborador_id:r.id, ciclo, objetivo:obj, key_results:parseKrs(g('ok-krs').value), progresso:0, status:'ativo', criado_por:me() };
    const b=g('ok-add'); b.disabled=true; b.textContent='Salvando…';
    const res=await window.IpPersist.write(
      ()=> SB().from('core_okr').insert(payload).select(),
      { label:'OKR', offline:{ op:'insert', table:'core_okr', payload } });
    if(!res.ok){ b.disabled=false; b.textContent='Criar OKR'; return; }
    await loadSatelites(r.id); paintDetail(_rows.find(x=>x.id===r.id)||r);
  }
  async function atualizarProgresso(r,o){
    const atual=prompt('Progresso de "'+o.objetivo+'" (0–100):', String(o.progresso||0));
    if(atual==null) return; const n=Math.max(0,Math.min(100,Number(atual)||0));
    const patch={ progresso:n, status: n>=100?'concluido':'ativo' };
    const res=await window.IpPersist.write(
      ()=> SB().from('core_okr').update(patch).eq('id',o.id).select(),
      { label:'Progresso OKR', offline:{ op:'update', table:'core_okr', payload:patch, match:[['id',o.id]] } });
    if(res.ok){ await loadSatelites(r.id); paintDetail(_rows.find(x=>x.id===r.id)||r); }
  }
  async function addCheckin(r){
    const g=id=>document.getElementById(id);
    const payload={ colaborador_id:r.id, humor:Number(g('ck-humor').value)||3,
      progresso_nota:(g('ck-prog').value||'').trim()||null, bloqueios:(g('ck-bloq').value||'').trim()||null,
      okr_id:(_sub.okr[0]&&_sub.okr[0].id)||null, criado_por:me() };
    const b=g('ck-add'); b.disabled=true; b.textContent='Salvando…';
    const res=await window.IpPersist.write(
      ()=> SB().from('core_checkin').insert(payload).select(),
      { label:'Check-in', offline:{ op:'insert', table:'core_checkin', payload } });
    if(!res.ok){ b.disabled=false; b.textContent='Registrar check-in'; return; }
    await loadSatelites(r.id); paintDetail(_rows.find(x=>x.id===r.id)||r);
  }

  // ---------- acoes: colaborador ----------
  async function salvarAlteracao(r){
    const g=id=>document.getElementById(id);
    const rem=g('e-rem').value; const patch={ cargo:(g('e-cargo').value||'').trim()||null, centro_custo:(g('e-cc').value||'').trim()||null, remuneracao:rem===''?null:Number(rem), status:g('e-st').value };
    const b=g('px-upd'); b.disabled=true; b.textContent='Salvando…';
    const res=await window.IpPersist.write(
      ()=> SB().from('core_colaborador').update(patch).eq('id',r.id).select(),
      { label:'Alteração', offline:{ op:'update', table:'core_colaborador', payload:patch, match:[['id',r.id]] } });
    if(res.ok){ audit('alteracao', r.id, {campos:Object.keys(patch)}); close(); await reload(); render(_el); } else { b.disabled=false; b.textContent='Salvar alterações'; }
  }
  async function desligar(r){
    const g=id=>document.getElementById(id);
    if((g('dl-conf').value||'').trim().toUpperCase()!=='DESLIGAR'){ T.toast('Confirme digitando DESLIGAR.'); return; }
    if(!(await ensureAal2())){ T.toast('Desligamento cancelado — verificação MFA não concluída.'); return; }
    const dataDesl=g('dl-data').value||today();
    const detalhe={ colaborador_id:r.id, tipo:g('dl-tipo').value, aviso_previo:g('dl-aviso').value,
      data_aviso:g('dl-aviso-data').value||null, data_desligamento:dataDesl, motivo:(g('dl-motivo').value||'').trim()||null, criado_por:me() };
    const b=g('dl-go'); b.disabled=true; b.textContent='Processando…';
    // 1) detalhe de rescisao
    const r1=await window.IpPersist.write(
      ()=> SB().from('core_desligamento').insert(detalhe).select(),
      { label:'Rescisão', offline:{ op:'insert', table:'core_desligamento', payload:detalhe } });
    if(!r1.ok){ b.disabled=false; b.textContent='Desligar colaborador'; return; }
    // 2) status do colaborador (dispara pessoa:desligada)
    const patch={ status:'desligado', data_desligamento:dataDesl };
    const r2=await window.IpPersist.write(
      ()=> SB().from('core_colaborador').update(patch).eq('id',r.id).select(),
      { label:'Desligamento', offline:{ op:'update', table:'core_colaborador', payload:patch, match:[['id',r.id]] } });
    if(r2.ok){ audit('desligamento', r.id, {tipo:detalhe.tipo}); close(); await reload(); render(_el); } else { b.disabled=false; b.textContent='Desligar colaborador'; }
  }

  // ---------- acoes: afastamento ----------
  async function addAfastamento(r){
    const g=id=>document.getElementById(id);
    const payload={ colaborador_id:r.id, tipo:g('af-tipo').value, data_inicio:g('af-ini').value||today(),
      data_fim:g('af-fim').value||null, cid:(g('af-cid').value||'').trim()||null,
      status: g('af-fim').value ? 'encerrado':'ativo', observacoes:(g('af-obs').value||'').trim()||null, criado_por:me() };
    const b=g('af-add'); b.disabled=true; b.textContent='Salvando…';
    const res=await window.IpPersist.write(
      ()=> SB().from('core_afastamento').insert(payload).select(),
      { label:'Afastamento', offline:{ op:'insert', table:'core_afastamento', payload } });
    if(!res.ok){ b.disabled=false; b.textContent='Registrar afastamento'; return; }
    audit('afastamento', r.id, {tipo:payload.tipo});
    // se em aberto, move colaborador p/ afastado
    if(payload.status==='ativo' && r.status==='ativo'){
      await window.IpPersist.write(()=> SB().from('core_colaborador').update({status:'afastado'}).eq('id',r.id).select(),
        { label:'Status', offline:{ op:'update', table:'core_colaborador', payload:{status:'afastado'}, match:[['id',r.id]] } });
    }
    await loadSatelites(r.id); await reload(); const nr=_rows.find(x=>x.id===r.id)||r; paintDetail(nr);
  }
  async function encerrarAfast(r,a){
    const patch={ status:'encerrado', data_fim:today() };
    const res=await window.IpPersist.write(
      ()=> SB().from('core_afastamento').update(patch).eq('id',a.id).select(),
      { label:'Encerrar afastamento', offline:{ op:'update', table:'core_afastamento', payload:patch, match:[['id',a.id]] } });
    if(!res.ok) return;
    // se nao restam afastamentos ativos, devolve colaborador a ativo
    await loadSatelites(r.id);
    if(!_sub.afast.some(x=>x.status==='ativo') && r.status==='afastado'){
      await window.IpPersist.write(()=> SB().from('core_colaborador').update({status:'ativo'}).eq('id',r.id).select(),
        { label:'Status', offline:{ op:'update', table:'core_colaborador', payload:{status:'ativo'}, match:[['id',r.id]] } });
    }
    await reload(); const nr=_rows.find(x=>x.id===r.id)||r; paintDetail(nr);
  }

  // ---------- acoes: ASO ----------
  async function addAso(r){
    const g=id=>document.getElementById(id);
    const payload={ colaborador_id:r.id, tipo:g('as-tipo').value, resultado:g('as-res').value,
      data_exame:g('as-ex').value||today(), data_vencimento:g('as-venc').value||null,
      medico_nome:(g('as-med').value||'').trim()||null, medico_crm:(g('as-crm').value||'').trim()||null,
      anexo_path:(g('as-anx').value||'').trim()||null, criado_por:me() };
    const b=g('as-add'); b.disabled=true; b.textContent='Salvando…';
    const res=await window.IpPersist.write(
      ()=> SB().from('core_aso').insert(payload).select(),
      { label:'ASO', offline:{ op:'insert', table:'core_aso', payload } });
    if(!res.ok){ b.disabled=false; b.textContent='Registrar ASO'; return; }
    audit('aso', r.id, {tipo:payload.tipo,resultado:payload.resultado});
    await loadSatelites(r.id); paintDetail(_rows.find(x=>x.id===r.id)||r);
  }

  // ---------- P8 · painel de alocacao ----------
  async function openAlocacao(){
    const sb=SB();
    let rows=[]; const v=await sb.from('v_core_alocacao').select('*').order('project_id');
    if(!v.error) rows=v.data||[];
    const max=Math.max(1,...rows.map(x=>x.total));
    drawer(`<div style="display:flex;align-items:center;gap:12px;margin-bottom:18px"><h2 style="font:700 italic 22px Georgia;color:var(--ip-gold-lum);margin:0;flex:1">Alocação por obra</h2>${btn('px-x','✕','ghost')}</div>
      <div style="color:var(--ip-ink-3);font-size:12.5px;margin-bottom:16px">Headcount por projeto, em tempo real (core_colaborador).</div>
      ${rows.length?rows.map(x=>`<div style="background:var(--ip-bg-card);border:1px solid rgba(210,174,100,.14);border-radius:11px;padding:13px 15px;margin-bottom:9px">
        <div style="display:flex;justify-content:space-between;align-items:baseline"><strong style="color:var(--ip-cream)">${esc(x.project_id)}</strong><span style="color:var(--ip-gold-lum);font:700 italic 18px Georgia">${x.total}</span></div>
        <div style="height:7px;border-radius:5px;background:var(--ip-bg-deep);margin:8px 0;overflow:hidden;display:flex">
          <div style="width:${x.ativos/max*100}%;background:var(--ip-ok-deep)"></div><div style="width:${x.afastados/max*100}%;background:var(--ip-gold)"></div><div style="width:${x.desligados/max*100}%;background:var(--ip-danger-3)"></div></div>
        <div style="color:var(--ip-ink-3);font-size:11.5px">${x.ativos} ativos · ${x.afastados} afastados · ${x.desligados} desligados</div>
      </div>`).join(''):'<div style="color:var(--ip-ink-4);padding:20px 0">Sem dados de alocação.</div>'}`);
    document.getElementById('px-drawer').querySelector('#px-x').onclick=close;
  }

  // ---------- P10 · painel de engajamento (clima anonimo por equipe + benchmark N>=5) ----------
  async function openEngajamento(){
    const sb=SB();
    const [cl,bm]=await Promise.all([
      sb.from('v_core_clima_pulso').select('*').order('respostas',{ascending:false}),
      sb.rpc('fn_core_benchmark_engajamento')
    ]);
    const clima=(cl&&cl.data)||[];
    const bench=(bm&&bm.data)||null;
    const dimRow=(d)=>{ const pct=Math.max(0,Math.min(100,(Number(d.media)||0)/5*100));
      return `<div style="margin-bottom:9px"><div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--ip-ink)"><span>${esc(d.dimensao)}</span><span style="color:var(--ip-gold-lum)">${d.media} <span style="color:var(--ip-ink-4)">(n=${d.n})</span></span></div>
        <div style="height:6px;border-radius:4px;background:var(--ip-bg-deep);margin-top:4px;overflow:hidden"><div style="width:${pct}%;height:100%;background:linear-gradient(90deg,var(--ip-gold),var(--ip-gold-lum))"></div></div></div>`; };
    const benchHtml = bench && bench.dimensoes ? (bench.dimensoes.length ? bench.dimensoes.map(dimRow).join('') : '<div style="color:var(--ip-ink-4);font-size:12.5px">Sem dimensões com amostra suficiente.</div>') : '<div style="color:var(--ip-ink-4);font-size:12.5px">Indisponível.</div>';
    drawer(`<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px"><h2 style="font:700 italic 22px Georgia;color:var(--ip-gold-lum);margin:0;flex:1">Engajamento</h2>${btn('px-x','✕','ghost')}</div>
      <div style="background:rgba(210,174,100,.06);border:1px solid rgba(210,174,100,.18);border-radius:10px;padding:10px 12px;color:var(--ip-gold-soft);font-size:12px;margin-bottom:18px">O Pulso é <strong>anônimo por desenho</strong>. Aqui você vê o clima agregado — grupos com menos de 5 respostas são suprimidos (LGPD); nunca o indivíduo.</div>
      <div style="font:600 11px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-ink-3);margin-bottom:12px">Benchmark por dimensão (6D · anônimo)</div>
      ${benchHtml}
      ${bench&&bench.suprimidas?`<div style="color:var(--ip-ink-4);font-size:11px;margin-top:6px">${bench.suprimidas} dimensão(ões) suprimida(s) por amostra &lt; 5.</div>`:''}
      <div style="font:600 11px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-ink-3);margin:22px 0 12px">Clima por equipe</div>
      ${clima.length?clima.map(c=>`<div style="background:var(--ip-bg-card);border:1px solid rgba(210,174,100,.14);border-radius:11px;padding:12px 14px;margin-bottom:9px">
        <div style="display:flex;justify-content:space-between;align-items:baseline"><strong style="color:var(--ip-cream);font-size:13.5px">${esc(c.equipe)}</strong><span style="color:var(--ip-ink-3);font-size:11.5px">${c.respostas} resposta(s)</span></div>
        ${c.suprimido_privacidade?'<div style="color:var(--ip-ink-4);font-size:12px;margin-top:4px">Score oculto — menos de 5 respostas (privacidade).</div>':`<div style="color:var(--ip-gold-lum);font:700 italic 17px Georgia;margin-top:4px">${c.score_medio} <span style="color:var(--ip-ink-4);font-size:12px;font-style:normal">score médio</span></div>`}
      </div>`).join(''):'<div style="color:var(--ip-ink-4);padding:14px 0">Sem dados de Pulso ainda.</div>'}`);
    document.getElementById('px-drawer').querySelector('#px-x').onclick=close;
  }

  // ---------- P7 · handoff contabil (export estruturado; NAO calcula tributo) ----------
  async function openExport(){
    drawer(`<div style="display:flex;align-items:center;gap:12px;margin-bottom:18px"><h2 style="font:700 italic 22px Georgia;color:var(--ip-gold-lum);margin:0;flex:1">Handoff contábil</h2>${btn('px-x','✕','ghost')}</div>
      <div style="background:rgba(210,174,100,.06);border:1px solid rgba(210,174,100,.18);border-radius:10px;padding:11px 13px;color:var(--ip-gold-soft);font-size:12.5px;margin-bottom:18px">Exporta o cadastro de pessoas em formato estruturado para a contabilidade. A plataforma <strong>não calcula tributo, folha líquida nem eSocial</strong> — apenas entrega o dado-fonte para quem faz o cálculo.</div>
      ${selectField('Escopo','xp-scope','ativos',[['ativos','Somente ativos'],['todos','Todos os status']])}
      ${selectField('Formato','xp-fmt','csv',[['csv','CSV (planilha)'],['json','JSON']])}
      <div style="margin-top:8px">${btn('xp-go','Gerar e baixar','primary')}</div>
      <div style="color:var(--ip-ink-4);font-size:11px;margin-top:10px">A exportação é registrada em auditoria (sessão ${esc(_aal)}).</div>`);
    const d=document.getElementById('px-drawer');
    d.querySelector('#px-x').onclick=close;
    d.querySelector('#xp-go').onclick=fazerExport;
  }
  async function fazerExport(){
    if(!(await ensureAal2())){ T.toast('Exportação cancelada — verificação MFA não concluída.'); return; }
    const scope=document.getElementById('xp-scope').value, fmt=document.getElementById('xp-fmt').value;
    const src=_rows.filter(r=> scope==='todos' ? true : r.status==='ativo');
    const cols=['cpf','matricula','nome','project_id','centro_custo','cargo','modelo_contrato','data_admissao','data_desligamento','status','remuneracao','email_institucional'];
    let blob, fname;
    if(fmt==='json'){
      blob=new Blob([JSON.stringify(src.map(r=>{const o={};cols.forEach(c=>o[c]=r[c]??null);return o;}),null,2)],{type:'application/json'});
      fname='handoff-pessoas-'+today()+'.json';
    } else {
      const head=cols.join(';');
      const lines=src.map(r=>cols.map(c=>{ let v=r[c]==null?'':String(r[c]); if(/[;"\n]/.test(v))v='"'+v.replace(/"/g,'""')+'"'; return v; }).join(';'));
      blob=new Blob(['﻿'+head+'\n'+lines.join('\n')],{type:'text/csv;charset=utf-8'});
      fname='handoff-pessoas-'+today()+'.csv';
    }
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=fname; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),2000);
    audit('export_handoff', null, {scope, fmt, n:src.length});
    T.toast('Handoff gerado ('+src.length+' colaboradores). Sem cálculo de tributo — dado-fonte para a contabilidade.');
  }

  // ---------- sync da obra ----------
  async function syncObra(){
    const sb=SB(); if(!sb) return;
    T.toast('Sincronizando admissões da obra…');
    const { data, error } = await sb.rpc('fn_core_seed_from_onboarding');
    if(error){ T.toast('Falha na sincronização: '+(error.message||'')); return; }
    const n=(data&&data.linhas_afetadas!=null)?data.linhas_afetadas:'?';
    T.toast('Sincronização concluída ('+n+' linha[s]).');
    await reload(); render(_el);
  }

  // ---------- realtime ----------
  function subscribe(){
    const sb=SB(); if(!sb||!sb.channel) return;
    try{ _chans.forEach(c=>sb.removeChannel(c)); }catch(_){}
    _chans=[];
    ['core_colaborador','core_afastamento','core_aso'].forEach(tbl=>{
      _chans.push(sb.channel('rt_'+tbl).on('postgres_changes',{event:'*',schema:'public',table:tbl},async()=>{ await reload(); if(_el) render(_el); }).subscribe());
    });
  }

  function mount(el){ _el=el; if(window.IpUI&&el) el.innerHTML='<div style="max-width:1180px;margin:0 auto;padding:28px 32px">'+window.IpUI.skeleton(6)+'</div>'; refreshAal(); reload().then(()=>{ render(el); subscribe(); }); }
  window.IpPessoas={ mount, _isShim:false };
})();
