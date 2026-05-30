// InnovaPeople · Pessoas (BPO de Gente) — consome a entidade canonica core_colaborador.
// Habilitacao IS x IP · Fase A · P3 (Charter ratificado CVO 30/05/2026).
// window.IpPessoas. Tema RapheiceOS. IpPersist em toda escrita. Realtime. shim-safe.
// Ferramenta REAL (nao template): lista + KPIs + diagnostico/proximos-passos +
// admitir/alterar/desligar + sincronizar admissoes da obra (RPC idempotente).
(function(){
  'use strict';
  if(window.IpPessoas && !window.IpPessoas._isShim) return;

  const SB = ()=> window.__IP_SB || window.sb;
  const T  = window.TB || { toast:(m)=>{ try{console.log(m)}catch(_){}} };
  const esc = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const money = v => (v==null||v==='') ? '—' : 'R$ '+Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2});
  const dt = d => { if(!d) return '—'; try{ return new Date(d+'T00:00:00').toLocaleDateString('pt-BR'); }catch(_){ return esc(d); } };
  const cpfMask = c => { c=String(c||'').replace(/\D/g,''); return c.length===11 ? c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4') : esc(c||'—'); };

  const ST = {
    ativo:    { l:'Ativo',     c:'#7BD3A0', bg:'rgba(46,139,87,.16)' },
    afastado: { l:'Afastado',  c:'#E5C77E', bg:'rgba(210,174,100,.16)' },
    desligado:{ l:'Desligado', c:'#E8A6A6', bg:'rgba(199,125,125,.16)' }
  };

  let _rows=[], _filtro={ q:'', status:'todos' }, _el=null, _chan=null;

  // ---------- dados ----------
  async function reload(){
    const sb=SB(); if(!sb) return;
    const { data, error } = await sb.from('core_colaborador').select('*').order('status').order('nome');
    if(error){ T.toast('Erro ao carregar colaboradores: '+(error.message||'')); _rows=[]; return; }
    _rows = data||[];
  }
  function filtrados(){
    const q=(_filtro.q||'').toLowerCase().trim();
    return _rows.filter(r=>{
      if(_filtro.status!=='todos' && r.status!==_filtro.status) return false;
      if(!q) return true;
      return (r.nome||'').toLowerCase().includes(q) || (r.cargo||'').toLowerCase().includes(q) || (r.project_id||'').toLowerCase().includes(q);
    });
  }

  // ---------- camada disruptiva: diagnostico + proximos passos ----------
  function diagnostico(){
    const ativos=_rows.filter(r=>r.status==='ativo');
    const passos=[];
    const semCargo=ativos.filter(r=>!r.cargo).length;
    const semAdm=ativos.filter(r=>!r.data_admissao).length;
    const semMail=ativos.filter(r=>!r.email_institucional).length;
    if(!_rows.length) passos.push('Nenhum colaborador ainda — admita o primeiro ou sincronize as admissões da obra.');
    if(semCargo) passos.push(semCargo+' ativo(s) sem cargo — completar para folha/handoff.');
    if(semAdm)   passos.push(semAdm+' sem data de admissão — necessária para vínculo e SST.');
    if(semMail)  passos.push(semMail+' sem e-mail institucional — bloqueia comunicação/onboarding.');
    return { passos };
  }

  // ---------- componentes ----------
  function kpi(label,val,cor){
    return `<div style="flex:1;min-width:120px;background:#0C1626;border:1px solid rgba(210,174,100,.18);border-radius:14px;padding:14px 16px;box-shadow:0 6px 18px rgba(0,0,0,.25)">
      <div style="font:600 11px/1 system-ui;letter-spacing:.08em;text-transform:uppercase;color:#8FA0B5">${esc(label)}</div>
      <div style="font:700 italic 26px Georgia;color:${cor||'#E5C77E'};margin-top:6px">${val}</div></div>`;
  }
  function badge(st){ const s=ST[st]||ST.ativo; return `<span style="font:600 11px/1 system-ui;padding:5px 10px;border-radius:20px;color:${s.c};background:${s.bg};border:1px solid ${s.c}55">${s.l}</span>`; }
  function btn(id,txt,kind){
    const base='font:600 13px/1 system-ui;padding:11px 18px;border-radius:11px;cursor:pointer;border:1px solid;transition:.15s';
    if(kind==='primary') return `<button id="${id}" style="${base};background:#D2AE64;color:#070D15;border-color:#E5C77E">${txt}</button>`;
    if(kind==='danger')  return `<button id="${id}" style="${base};background:rgba(199,125,125,.14);color:#E8A6A6;border-color:#C77D7D66">${txt}</button>`;
    return `<button id="${id}" style="${base};background:transparent;color:#E5C77E;border-color:rgba(210,174,100,.4)">${txt}</button>`;
  }
  function field(label,id,val,type,ph){
    return `<label style="display:block;margin-bottom:14px"><span style="display:block;font:600 11px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:#8FA0B5;margin-bottom:6px">${esc(label)}</span>
      <input id="${id}" type="${type||'text'}" value="${val==null?'':esc(val)}" placeholder="${esc(ph||'')}" style="width:100%;background:#070D15;border:1px solid rgba(210,174,100,.25);border-radius:10px;padding:11px 13px;color:#F7F3EC;font-size:14px"/></label>`;
  }
  function selectField(label,id,val,opts){
    return `<label style="display:block;margin-bottom:14px"><span style="display:block;font:600 11px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:#8FA0B5;margin-bottom:6px">${esc(label)}</span>
      <select id="${id}" style="width:100%;background:#070D15;border:1px solid rgba(210,174,100,.25);border-radius:10px;padding:11px 13px;color:#F7F3EC;font-size:14px">
      ${opts.map(o=>`<option value="${esc(o[0])}"${String(val)===String(o[0])?' selected':''}>${esc(o[1])}</option>`).join('')}</select></label>`;
  }

  // ---------- render principal ----------
  function render(el){
    _el=el||_el; if(!_el) return; el=_el;
    const list=filtrados(), dg=diagnostico();
    const counts={ativo:0,afastado:0,desligado:0};
    _rows.forEach(r=>{ counts[r.status]=(counts[r.status]||0)+1; });
    el.innerHTML=`
    <div style="max-width:1180px;margin:0 auto;padding:28px 32px">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:6px">
        <h1 style="font:700 italic 27px Georgia;color:#E5C77E;margin:0;flex:1">Pessoas · BPO de Gente</h1>
        ${btn('px-sync','↻ Sincronizar admissões da obra','ghost')}
        ${btn('px-novo','+ Admitir colaborador','primary')}
      </div>
      <div style="color:#8FA0B5;font-size:13px;margin-bottom:22px">Entidade canônica unificada (obra ↔ gente). A origem do dado é preservada e propaga em tempo real.</div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:22px">
        ${kpi('Ativos',counts.ativo,'#7BD3A0')}${kpi('Afastados',counts.afastado,'#E5C77E')}${kpi('Desligados',counts.desligado,'#E8A6A6')}${kpi('Total',_rows.length,'#F7F3EC')}
      </div>
      ${dg.passos.length?`<div style="background:linear-gradient(180deg,#0C1626,#0A1320);border:1px solid rgba(210,174,100,.22);border-left:3px solid #D2AE64;border-radius:14px;padding:16px 18px;margin-bottom:22px">
        <div style="font:600 12px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:#D2AE64;margin-bottom:10px">Diagnóstico · próximos passos</div>
        <ul style="margin:0;padding-left:18px;color:#CBD5E1;font-size:13px;line-height:1.7">${dg.passos.map(p=>`<li>${esc(p)}</li>`).join('')}</ul></div>`:''}
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
        <input id="px-q" placeholder="Buscar por nome, cargo, projeto…" value="${esc(_filtro.q)}" style="flex:1;min-width:220px;background:#0A1320;border:1px solid rgba(210,174,100,.25);border-radius:11px;padding:11px 14px;color:#F7F3EC;font-size:14px"/>
        <select id="px-st" style="background:#0A1320;border:1px solid rgba(210,174,100,.25);border-radius:11px;padding:11px 14px;color:#F7F3EC;font-size:14px">
          <option value="todos"${_filtro.status==='todos'?' selected':''}>Todos os status</option>
          <option value="ativo"${_filtro.status==='ativo'?' selected':''}>Ativos</option>
          <option value="afastado"${_filtro.status==='afastado'?' selected':''}>Afastados</option>
          <option value="desligado"${_filtro.status==='desligado'?' selected':''}>Desligados</option>
        </select>
      </div>
      <div id="px-list">${ list.length ? list.map(cardRow).join('') : `<div style="padding:48px;text-align:center;color:#6B7A90;border:1px dashed rgba(210,174,100,.2);border-radius:14px">Nenhum colaborador para o filtro atual.</div>` }</div>
    </div>
    <div id="px-drawer"></div>`;
    el.querySelector('#px-novo').onclick=()=>openForm();
    el.querySelector('#px-sync').onclick=syncObra;
    const q=el.querySelector('#px-q');
    q.oninput=()=>{ _filtro.q=q.value; const lst=el.querySelector('#px-list'); const f=filtrados(); lst.innerHTML=f.length?f.map(cardRow).join(''):`<div style="padding:48px;text-align:center;color:#6B7A90">Nenhum colaborador para o filtro atual.</div>`; bindRows(el); };
    el.querySelector('#px-st').onchange=(e)=>{ _filtro.status=e.target.value; render(el); };
    bindRows(el);
  }
  function cardRow(r){
    return `<div class="px-card" data-id="${r.id}" style="display:flex;align-items:center;gap:14px;background:#0C1626;border:1px solid rgba(210,174,100,.14);border-radius:13px;padding:14px 16px;margin-bottom:10px;cursor:pointer;transition:.15s">
      <div style="width:42px;height:42px;border-radius:50%;background:rgba(210,174,100,.14);display:flex;align-items:center;justify-content:center;font:700 16px Georgia;color:#E5C77E">${esc((r.nome||'?').trim().charAt(0).toUpperCase())}</div>
      <div style="flex:1;min-width:0">
        <div style="color:#F7F3EC;font-weight:600;font-size:15px">${esc(r.nome)}</div>
        <div style="color:#8FA0B5;font-size:12.5px;margin-top:2px">${esc(r.cargo||'sem cargo')} · ${esc(r.project_id||r.mandato_id||'—')} · ${esc(r.modelo_contrato||'—')}</div>
      </div>
      <div style="text-align:right">${badge(r.status)}<div style="color:#6B7A90;font-size:11px;margin-top:5px">${r.origem==='innovasphere'?'da obra':'IP'}</div></div>
    </div>`;
  }
  function bindRows(el){ el.querySelectorAll('.px-card').forEach(c=>{ c.onclick=()=>{ const r=_rows.find(x=>x.id===c.dataset.id); if(r) openDetail(r); }; c.onmouseenter=()=>c.style.borderColor='rgba(210,174,100,.4)'; c.onmouseleave=()=>c.style.borderColor='rgba(210,174,100,.14)'; }); }

  // ---------- drawer ----------
  function drawer(html){
    const d=document.getElementById('px-drawer');
    d.innerHTML=`<div id="px-ov" style="position:fixed;inset:0;background:rgba(3,7,12,.66);z-index:9000;display:flex;justify-content:flex-end">
      <div style="width:min(520px,100%);height:100%;background:#0A1320;border-left:1px solid rgba(210,174,100,.25);box-shadow:-12px 0 40px rgba(0,0,0,.5);overflow-y:auto;padding:26px 28px">${html}</div></div>`;
    d.querySelector('#px-ov').onclick=(e)=>{ if(e.target.id==='px-ov') close(); };
  }
  function close(){ const d=document.getElementById('px-drawer'); if(d) d.innerHTML=''; }

  // ---------- admitir ----------
  function openForm(){
    drawer(`<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px"><h2 style="font:700 italic 22px Georgia;color:#E5C77E;margin:0;flex:1">Admitir colaborador</h2>${btn('px-x','✕ Fechar','ghost')}</div>
      <div style="background:rgba(210,174,100,.08);border:1px solid rgba(210,174,100,.2);border-radius:10px;padding:10px 12px;color:#C9B98F;font-size:12px;margin-bottom:18px">Admissão é ato sensível — registrada em auditoria. (MFA TOTP será exigido na P12.)</div>
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
      whatsapp_e164:(g('f-wa').value||'').trim()||null, status:'ativo', origem:'innovapeople',
      criado_por:(window.__IP_USER_EMAIL)||'innovapeople' };
    const sv=g('px-save'); sv.disabled=true; sv.textContent='Salvando…';
    const r=await window.IpPersist.write(
      ()=> SB().from('core_colaborador').insert(payload).select(),
      { label:'Admissão', offline:{ op:'insert', table:'core_colaborador', payload } });
    if(r.ok){ if(window.IspCelebra) try{window.IspCelebra()}catch(_){}; close(); await reload(); render(_el); }
    else { sv.disabled=false; sv.textContent='Confirmar admissão'; }
  }

  // ---------- detalhe / alterar / desligar ----------
  function openDetail(r){
    const desligado=r.status==='desligado';
    drawer(`<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px"><h2 style="font:700 italic 22px Georgia;color:#E5C77E;margin:0;flex:1">${esc(r.nome)}</h2>${btn('px-x','✕','ghost')}</div>
      <div style="margin-bottom:18px">${badge(r.status)} <span style="color:#6B7A90;font-size:12px;margin-left:6px">${r.origem==='innovasphere'?'origem: obra (InnovaSphere)':'origem: InnovaPeople'}</span></div>
      <div style="background:#0C1626;border:1px solid rgba(210,174,100,.16);border-radius:12px;padding:14px 16px;margin-bottom:18px;font-size:13.5px;line-height:1.9;color:#CBD5E1">
        <div><span style="color:#8FA0B5">CPF:</span> ${cpfMask(r.cpf)}</div>
        <div><span style="color:#8FA0B5">Projeto/Obra:</span> ${esc(r.project_id||'—')}</div>
        <div><span style="color:#8FA0B5">Admissão:</span> ${dt(r.data_admissao)}</div>
        <div><span style="color:#8FA0B5">E-mail:</span> ${esc(r.email_institucional||'—')}</div>
        <div><span style="color:#8FA0B5">Remuneração:</span> ${money(r.remuneracao)} <span style="color:#6B7A90;font-size:11px">(armazenada p/ handoff; plataforma não calcula tributo)</span></div>
        ${desligado?`<div><span style="color:#8FA0B5">Desligamento:</span> ${dt(r.data_desligamento)}</div>`:''}
      </div>
      ${desligado?'':`<div style="font:600 11px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:#8FA0B5;margin:0 0 12px">Editar</div>
      ${field('Cargo','e-cargo',r.cargo,'text')}
      ${field('Centro de custo','e-cc',r.centro_custo,'text')}
      ${selectField('Status','e-st',r.status,[['ativo','Ativo'],['afastado','Afastado']])}
      <div style="margin:6px 0 22px">${btn('px-upd','Salvar alterações','primary')}</div>
      <div style="border-top:1px solid rgba(199,125,125,.2);padding-top:16px">
        <div style="font:600 11px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:#C77D7D;margin-bottom:8px">Zona sensível</div>
        <div style="color:#8FA0B5;font-size:12.5px;margin-bottom:10px">Desligar emite <code>pessoa:desligada</code> e propaga. Ato auditado (MFA TOTP na P12).</div>
        ${field('Digite DESLIGAR para confirmar','e-conf','','text')}
        ${field('Data de desligamento','e-data',new Date().toISOString().slice(0,10),'date')}
        <div style="margin-top:8px">${btn('px-desl','Desligar colaborador','danger')}</div></div>`}`);
    const d=document.getElementById('px-drawer');
    d.querySelector('#px-x').onclick=close;
    if(!desligado){ d.querySelector('#px-upd').onclick=()=>salvarAlteracao(r); d.querySelector('#px-desl').onclick=()=>desligar(r); }
  }
  async function salvarAlteracao(r){
    const g=id=>document.getElementById(id);
    const patch={ cargo:(g('e-cargo').value||'').trim()||null, centro_custo:(g('e-cc').value||'').trim()||null, status:g('e-st').value };
    const b=g('px-upd'); b.disabled=true; b.textContent='Salvando…';
    const res=await window.IpPersist.write(
      ()=> SB().from('core_colaborador').update(patch).eq('id',r.id).select(),
      { label:'Alteração', offline:{ op:'update', table:'core_colaborador', payload:patch, match:[['id',r.id]] } });
    if(res.ok){ close(); await reload(); render(_el); } else { b.disabled=false; b.textContent='Salvar alterações'; }
  }
  async function desligar(r){
    const g=id=>document.getElementById(id);
    if((g('e-conf').value||'').trim().toUpperCase()!=='DESLIGAR'){ T.toast('Confirme digitando DESLIGAR.'); return; }
    const patch={ status:'desligado', data_desligamento:g('e-data').value||new Date().toISOString().slice(0,10) };
    const b=g('px-desl'); b.disabled=true; b.textContent='Processando…';
    const res=await window.IpPersist.write(
      ()=> SB().from('core_colaborador').update(patch).eq('id',r.id).select(),
      { label:'Desligamento', offline:{ op:'update', table:'core_colaborador', payload:patch, match:[['id',r.id]] } });
    if(res.ok){ close(); await reload(); render(_el); } else { b.disabled=false; b.textContent='Desligar colaborador'; }
  }

  // ---------- sync da obra (RPC idempotente) ----------
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
    try{ if(_chan) sb.removeChannel(_chan); }catch(_){}
    _chan=sb.channel('core_colab_rt').on('postgres_changes',{event:'*',schema:'public',table:'core_colaborador'},async()=>{ await reload(); if(_el) render(_el); }).subscribe();
  }

  function mount(el){ _el=el; reload().then(()=>{ render(el); subscribe(); }); }
  window.IpPessoas={ mount, _isShim:false };
})();
