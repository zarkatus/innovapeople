// IpOrganograma - Organograma CHRO: estrutura organizacional viva (ferramenta real).
// Redesenho RapheiceOS dark/light + organismo (sintese IA + proximos passos IREU
// + linha do tempo via EventBus + propagacao). CRUD em ip_organograma_cadeira +
// inteligencia de sucessao/risco (vacancia, gestor unico, modelo contrato).
// API: IpOrganograma.open(host)
(function(){
  'use strict';
  if(window.IpOrganograma) return;
  if(!window.IpPersist){window.IpPersist={write:async function(fn,o){o=o||{};try{var r=await fn();if(r&&!r.error){if(o.toast!==false&&window.TB)TB.toast((o.label||'registro')+' salvo');return{ok:true,data:r.data,error:null,queued:false};}return{ok:false,error:r?r.error:{message:'sem resposta'},queued:false};}catch(e){return{ok:false,error:e,queued:false};}},drain:function(){},pendingCount:function(){return 0;},failedCount:function(){return 0;},retryFailed:function(){},_enqueue:function(){return false;},_isShim:true};}

  const sb=()=>window.__IP_SB||window.sb;
  const T=window.TB||{esc:s=>String(s==null?'':s),safe:async(f,fb)=>{try{return await f()}catch(e){return fb}},toast:m=>alert(m),fmtRel:s=>s};
  const esc=T.esc;
  const NIVEIS=['N0','N1','N2','N3','N4','N5'];
  const STATUS=['Ativa','Vacância','Em transição','Bloqueada'];
  const MODELOS=['CLT','PJ','ESTAGIO','APRENDIZ','SOCIO'];
  const PAPEIS=['Colaborador','Gestor','Administrador'];
  let _s={tab:'tabela',mandato:null,mandatos:[],cadeiras:[],editId:null};
  let _host=null;
  let _gen=0;
  let _confirmOpen=false;

  async function open(host){
    _host=host;
    host.innerHTML='<div id="og-root"><div class="og-empty">Carregando estrutura organizacional&hellip;</div></div>';
    const {data}=await T.safe(()=>sb().from('ip_mandatos').select('id,empresa,status').eq('status','ativo').order('empresa').limit(100),{data:[]});
    _s.mandatos=data||[]; _s.mandato=_s.mandatos[0]?.id||null;
    await reload();
    render();
    await _mountExtras();
  }

  async function reload(){
    if(!_s.mandato){_s.cadeiras=[];return}
    const {data}=await T.safe(()=>sb().from('ip_organograma_cadeira').select('*').eq('mandato_id',_s.mandato).order('nivel').order('codigo'),{data:[]});
    _s.cadeiras=data||[];
  }

  function mandatoSel(){
    if(!_s.mandatos.length) return '<div class="og-warn">Nenhum trabalho ativo. Crie um trabalho antes de mapear o organograma.</div>';
    let h='<select class="og-select" onchange="IpOrganograma._setMandato(this.value)">';
    _s.mandatos.forEach(m=>{h+='<option value="'+esc(m.id)+'"'+(m.id===_s.mandato?' selected':'')+'>'+esc(m.empresa||'(sem nome)')+'</option>';});
    h+='</select>';
    return h;
  }

  function kpis(){
    const c=_s.cadeiras;
    const ativ=c.filter(x=>x.status==='Ativa').length;
    const vac=c.filter(x=>x.status==='Vacância').length;
    const trans=c.filter(x=>x.status==='Em transição').length;
    const bloq=c.filter(x=>x.status==='Bloqueada').length;
    const gestores=c.filter(x=>x.papel==='Gestor').length;
    const semGestor=c.filter(x=>x.papel==='Colaborador'&&!x.gestor_id&&!x.gestor_nome).length;
    return '<div class="og-kpis">'+
      '<div class="og-kpi hero"><div class="lab">Cadeiras</div><div class="val">'+c.length+'</div></div>'+
      '<div class="og-kpi"><div class="lab">Ativas</div><div class="val">'+ativ+'</div></div>'+
      '<div class="og-kpi"><div class="lab">Vacância</div><div class="val" style="'+(vac?'color:var(--warn, var(--ip-warn))':'')+'">'+vac+'</div></div>'+
      '<div class="og-kpi"><div class="lab">Em transição</div><div class="val">'+trans+'</div></div>'+
      '<div class="og-kpi"><div class="lab">Bloqueadas</div><div class="val" style="'+(bloq?'color:var(--danger, var(--ip-danger))':'')+'">'+bloq+'</div></div>'+
      '<div class="og-kpi"><div class="lab">Gestores</div><div class="val">'+gestores+'</div></div>'+
      '<div class="og-kpi"><div class="lab">Sem gestor</div><div class="val" style="'+(semGestor?'color:var(--warn, var(--ip-warn))':'')+'">'+semGestor+'</div></div>'+
    '</div>';
  }

  function inteligenciaSucessao(){
    const c=_s.cadeiras; if(!c.length) return '<div class="og-empty">Cadastre cadeiras para que a inteligencia de sucessao apareca aqui.</div>';
    const risco=c.filter(x=>x.status==='Vacância'||x.status==='Bloqueada').sort((a,b)=>(a.nivel||'Z').localeCompare(b.nivel||'Z'));
    const gestCount={}; c.forEach(x=>{const g=x.gestor_id||(x.gestor_nome?'@'+String(x.gestor_nome).trim().toLowerCase():null);if(g)gestCount[g]=(gestCount[g]||0)+1;});
    const gestoresMuitos=Object.entries(gestCount).filter(([_,n])=>n>=5).sort((a,b)=>b[1]-a[1]);
    const semBackup=c.filter(x=>x.papel==='Gestor'); // gestor sem indicacao de substituto formal e proxy de risco
    const porModelo={}; c.forEach(x=>{const m=x.modelo_contrato||'(nao definido)';porModelo[m]=(porModelo[m]||0)+1});
    let h='<div class="og-sect-h">Inteligencia de sucessao &middot; risco organizacional</div>';
    h+='<div class="og-int-grid">';
    h+='<div class="og-int-card"><div class="og-int-lab">Risco imediato</div><div class="og-int-val">'+risco.length+'</div><div class="og-int-note">vacancia + bloqueadas '+(risco.length?'(niveis: '+[...new Set(risco.map(r=>r.nivel||'?'))].join(', ')+')':'')+'</div></div>';
    h+='<div class="og-int-card"><div class="og-int-lab">Concentracao de poder</div><div class="og-int-val">'+gestoresMuitos.length+'</div><div class="og-int-note">'+(gestoresMuitos.length?'gestor(es) com 5+ subordinados (top: '+gestoresMuitos.slice(0,3).map(g=>g[1]).join(', ')+')':'distribuicao saudavel')+'</div></div>';
    h+='<div class="og-int-card"><div class="og-int-lab">Mix contratual</div><div class="og-int-val">'+Object.keys(porModelo).length+'</div><div class="og-int-note">'+Object.entries(porModelo).slice(0,4).map(([k,v])=>k+':'+v).join(' | ')+'</div></div>';
    h+='</div>';
    if(risco.length){
      h+='<div class="og-risco-list">';
      risco.slice(0,8).forEach(r=>{h+='<div class="og-risco-item"><span class="og-tag '+(r.status==='Bloqueada'?'danger':'warn')+'">'+esc(r.status)+'</span><strong>'+esc(r.nome||r.codigo||'(sem nome)')+'</strong> &middot; '+esc(r.cargo||'-')+' &middot; '+esc(r.nivel||'-')+' &middot; '+esc(r.diretoria||'-')+'</div>';});
      h+='</div>';
    }
    return h;
  }

  function tabela(){
    const c=_s.cadeiras; if(!c.length) return '<div class="og-empty">Sem cadeiras cadastradas. Use <strong>+ Nova cadeira</strong> acima.</div>';
    let h='<table class="og-tbl"><thead><tr><th>Cod</th><th>Nome</th><th>Cargo</th><th>Niv</th><th>Status</th><th>Papel</th><th>Diretoria</th><th>Modelo</th><th>Gestor</th><th></th></tr></thead><tbody>';
    c.forEach(r=>{
      h+='<tr><td><code>'+esc(r.codigo||'-')+'</code></td><td><strong>'+esc(r.nome||'(vacante)')+'</strong></td><td>'+esc(r.cargo||'-')+'</td><td><span class="og-pill niv">'+esc(r.nivel||'-')+'</span></td><td><span class="og-tag '+statusCls(r.status)+'">'+esc(r.status||'-')+'</span></td><td>'+esc(r.papel||'-')+'</td><td>'+esc(r.diretoria||'-')+'</td><td>'+esc(r.modelo_contrato||'-')+'</td><td>'+esc(r.gestor_nome||'-')+'</td><td><button class="og-btn-mini" onclick="IpOrganograma._abrir(\''+esc(r.id)+'\')">editar</button></td></tr>';
    });
    h+='</tbody></table>';
    return h;
  }
  function statusCls(s){return s==='Ativa'?'ok':s==='Vacância'?'warn':s==='Bloqueada'?'danger':'info';}

  function cards(){
    const c=_s.cadeiras; if(!c.length) return '<div class="og-empty">Sem cadeiras.</div>';
    let h='<div class="og-cards">';
    c.forEach(r=>{h+='<div class="og-card '+(r.status==='Vacância'?'vac':r.status==='Bloqueada'?'bloq':'')+'"><div class="og-card-h"><span class="og-pill niv">'+esc(r.nivel||'-')+'</span><span class="og-tag '+statusCls(r.status)+'">'+esc(r.status||'-')+'</span></div><div class="og-card-nm">'+esc(r.nome||'(vacante)')+'</div><div class="og-card-cg">'+esc(r.cargo||'-')+'</div><div class="og-card-meta">'+esc(r.diretoria||'-')+(r.subarea?' / '+esc(r.subarea):'')+'</div><div class="og-card-meta">gestor: '+esc(r.gestor_nome||'-')+'</div><button class="og-btn-mini" style="margin-top:8px" onclick="IpOrganograma._abrir(\''+esc(r.id)+'\')">editar</button></div>';});
    h+='</div>';
    return h;
  }

  function render(){
    const root=_host.querySelector('#og-root');
    let html='';
    html+='<div class="og-hero"><div class="og-eyebrow">CHRO &middot; Estrutura organizacional</div><h1><em>Organograma</em> vivo</h1><div class="og-tag">Cada cadeira (N0-N5) e um no de decisao. A inteligencia abaixo aponta sucessao, vacancia e concentracao de poder em tempo real, e propaga via EventBus para a Sala de Guerra e o Skill Map.</div></div>';
    html+='<div class="og-bar">'+mandatoSel()+'<button class="og-btn" onclick="IpOrganograma._abrir(null)">+ Nova cadeira</button></div>';
    html+=kpis();
    html+='<div class="og-section">'+inteligenciaSucessao()+'</div>';
    html+='<div class="og-tabs"><button class="og-tab'+(_s.tab==='tabela'?' on':'')+'" onclick="IpOrganograma._tab(\'tabela\')">Tabela</button><button class="og-tab'+(_s.tab==='cards'?' on':'')+'" onclick="IpOrganograma._tab(\'cards\')">Cards</button></div>';
    html+='<div class="og-view">'+(_s.tab==='cards'?cards():tabela())+'</div>';
    root.innerHTML=html;
  }

  function _tab(t){_s.tab=t;render();_mountExtras();}
  async function _mountExtras(){
    const my=++_gen;
    const root=_host.querySelector('#og-root'); if(!root)return;
    const oldOrg=root.querySelector('#og-org'); if(oldOrg)oldOrg.remove();
    const oldBl=root.querySelector('#og-bloco'); if(oldBl)oldBl.remove();
    if(window.IpFerramenta&&_s.mandato){
      const org=document.createElement('div'); org.id='og-org'; org.setAttribute('data-fc-host','');
      root.appendChild(org);
      await IpFerramenta.organismo(org,{
        chave:'organograma', mandato:_s.mandato, rotulo:'Organograma',
        diagnosticoHTML:'',
        fontesEvento:['ip_organograma_cadeira','ip_plano_acoes','ip_agent_sugestoes'],
        consumidores:[
          {nome:'Skill Map', porque:'cada cadeira ativa precisa de skill map 6D + reconversao'},
          {nome:'Mattering', porque:'gestores com 5+ subordinados puxam o pertencimento da equipe'},
          {nome:'Sala de Guerra', porque:'vacancias e bloqueadas sobem no quadro IREU consolidado'}
        ]
      });
      if(my!==_gen)return;
    }
    if(window.IpProximosPassos&&_s.mandato){
      const bloco=document.createElement('div'); bloco.id='og-bloco';
      root.appendChild(bloco);
      await IpProximosPassos.bloco(bloco,['CHRO','Mattering','Skill Map'],{mandato:_s.mandato, limit:5});
      if(my!==_gen)return;
    }
  }

  function _setMandato(id){_s.mandato=id;const my=++_gen;reload().then(()=>{if(my===_gen){render();_mountExtras();}});}

  function _abrir(id){
    _s.editId=id; const r=id?_s.cadeiras.find(x=>x.id===id):{};
    const v=k=>esc((r&&r[k])||'');
    const opts=(arr,sel)=>arr.map(o=>'<option '+(o===sel?'selected':'')+'>'+o+'</option>').join('');
    const html='<div class="og-modal-bg" onclick="IpOrganograma._fechar()"></div><div class="og-modal"><div class="og-modal-h" id="og-modal-h">'+(id?'Editar':'Nova')+' cadeira</div>'+
      '<div class="og-mform">'+
      '<label>Codigo<input id="og-f-codigo" value="'+v('codigo')+'"></label>'+
      '<label>Nome<input id="og-f-nome" value="'+v('nome')+'"></label>'+
      '<label>Cargo<input id="og-f-cargo" value="'+v('cargo')+'"></label>'+
      '<label>Diretoria<input id="og-f-diretoria" value="'+v('diretoria')+'"></label>'+
      '<label>Subarea<input id="og-f-subarea" value="'+v('subarea')+'"></label>'+
      '<label>Nivel<select id="og-f-nivel">'+opts(NIVEIS,r.nivel)+'</select></label>'+
      '<label>Status<select id="og-f-status">'+opts(STATUS,r.status||'Ativa')+'</select></label>'+
      '<label>Papel<select id="og-f-papel">'+opts(PAPEIS,r.papel||'Colaborador')+'</select></label>'+
      '<label>Modelo contrato<select id="og-f-modelo"><option value="">-</option>'+opts(MODELOS,r.modelo_contrato)+'</select></label>'+
      '<label>Gestor (nome)<input id="og-f-gestor" value="'+v('gestor_nome')+'"></label>'+
      '<label>Email<input id="og-f-email" type="email" value="'+v('email')+'"></label>'+
      '<label>Observacoes<textarea id="og-f-obs">'+v('observacoes')+'</textarea></label>'+
      '</div><div class="og-mact">'+(id?'<button class="og-btn ghost danger" onclick="IpOrganograma._excluir()">Excluir</button>':'')+'<button class="og-btn ghost" onclick="IpOrganograma._fechar()">Cancelar</button><button class="og-btn" onclick="IpOrganograma._salvar()">Salvar</button></div></div>';
    const _old=document.getElementById('og-modal-root'); if(_old){if(_old._escH)document.removeEventListener('keydown',_old._escH); _old.remove();}
    const m=document.createElement('div'); m.id='og-modal-root'; m.innerHTML=html; document.body.appendChild(m);
    const modal=m.querySelector('.og-modal'); if(modal){modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','og-modal-h');}
    const escH=(e)=>{if(e.key==='Escape')_fechar();};
    document.addEventListener('keydown',escH); m._escH=escH;
    setTimeout(()=>{const f=m.querySelector('input,select,textarea');if(f)f.focus();},60);
  }
  function _fechar(){const m=document.getElementById('og-modal-root');if(m){if(m._escH)document.removeEventListener('keydown',m._escH);m.remove();}_s.editId=null;}
  async function _salvar(){
    const g=id=>document.getElementById(id)?.value;
    if(!_s.mandato){T.toast('Selecione um trabalho ativo');return;}
    if(!g('og-f-codigo')||!g('og-f-nome')){T.toast('Codigo e Nome sao obrigatorios');return;}
    const saveBtn=document.querySelector('#og-modal-root .og-mact .og-btn:not(.ghost):not(.danger)');
    if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='Salvando...';}
    const row={mandato_id:_s.mandato,codigo:g('og-f-codigo')||null,nome:g('og-f-nome')||null,cargo:g('og-f-cargo')||null,diretoria:g('og-f-diretoria')||null,subarea:g('og-f-subarea')||null,nivel:g('og-f-nivel')||null,status:g('og-f-status')||null,papel:g('og-f-papel')||null,modelo_contrato:g('og-f-modelo')||null,gestor_nome:g('og-f-gestor')||null,email:g('og-f-email')||null,observacoes:g('og-f-obs')||null};
    const r=_s.editId
      ? await IpPersist.write(()=>sb().from('ip_organograma_cadeira').update(row).eq('id',_s.editId).select(),{label:'Cadeira',offline:{table:'ip_organograma_cadeira',op:'update',payload:row,match:[['id',_s.editId]]}})
      : await IpPersist.write(()=>sb().from('ip_organograma_cadeira').insert(row).select(),{label:'Cadeira',offline:{table:'ip_organograma_cadeira',op:'insert',payload:row}});
    if(r.ok||r.queued){ _fechar(); await reload(); render(); await _mountExtras(); }
    else { const btn=document.querySelector('#og-modal-root .og-mact .og-btn:not(.ghost):not(.danger)'); if(btn){btn.disabled=false;btn.textContent='Salvar';} }
  }
  async function _excluir(){
    if(!_s.editId)return;
    if(_confirmOpen)return;
    _confirmOpen=true;
    const prevFocus=document.activeElement;
    const parentRoot=document.getElementById('og-modal-root');
    const parentEsc=parentRoot&&parentRoot._escH; if(parentEsc)document.removeEventListener('keydown',parentEsc);
    const ok=await new Promise(res=>{
      const m=document.createElement('div');m.className='og-modal-bg';
      m.innerHTML='<div class="og-modal" role="dialog" aria-modal="true" aria-labelledby="og-confirm-h" style="text-align:center"><div class="og-modal-h" id="og-confirm-h">Confirmar exclusao</div><p style="color:var(--cream);margin:0 0 18px;font-family:var(--serif);font-style:italic">Excluir esta cadeira? Esta acao nao pode ser desfeita.</p><div class="og-mact"><button class="og-btn ghost" id="og-c-no">Cancelar</button><button class="og-btn ghost danger" id="og-c-yes">Excluir</button></div></div>';
      document.body.appendChild(m);
      const cleanup=(r)=>{document.removeEventListener('keydown',escH);m.remove();_confirmOpen=false;if(prevFocus&&typeof prevFocus.focus==='function')try{prevFocus.focus();}catch(_){};res(r);};
      const escH=(e)=>{if(e.key==='Escape')cleanup(false);};
      document.addEventListener('keydown',escH);
      m.onclick=(e)=>{if(e.target===m)cleanup(false);};
      m.querySelector('#og-c-no').onclick=()=>cleanup(false);
      m.querySelector('#og-c-yes').onclick=()=>cleanup(true);
      setTimeout(()=>{const f=m.querySelector('#og-c-no');if(f)f.focus();},60);
    });
    if(parentEsc&&document.getElementById('og-modal-root'))document.addEventListener('keydown',parentEsc);
    if(!ok)return;
    const _delId=_s.editId;
    const r=await IpPersist.write(()=>sb().from('ip_organograma_cadeira').delete().eq('id',_delId).select(),{label:'Remocao da cadeira',offline:{table:'ip_organograma_cadeira',op:'delete',match:[['id',_delId]]}});
    if(r.ok||r.queued){ _fechar(); await reload(); render(); await _mountExtras(); }
  }

  const CSS_A=`
  #og-root .og-hero{padding:24px 0 18px;border-bottom:1px solid var(--rule,rgba(200,89,36,.15));margin-bottom:18px}
  #og-root .og-eyebrow{font-family:var(--mono);font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--acento-deep, var(--ip-accent-strong));font-weight:600;margin-bottom:8px}
  #og-root h1{font-family:var(--serif);font-size:36px;font-weight:400;color:var(--cream);line-height:1.1;margin:0}
  #og-root h1 em{font-style:italic;color:var(--acento)}
  #og-root .og-tag{margin-top:10px;font-family:var(--serif);font-style:italic;font-size:15px;color:var(--cream-muted);line-height:1.5;max-width:760px}
  #og-root .og-bar{display:flex;gap:10px;align-items:center;margin-bottom:14px;flex-wrap:wrap}
  #og-root .og-select{padding:9px 13px;background:var(--navy-raised);border:1px solid var(--rule-strong);border-radius:7px;color:var(--cream);font-family:var(--sans);font-size:13px;min-width:240px}
  #og-root .og-warn{padding:14px 18px;background:rgba(224,118,58,.1);border-left:2px solid var(--warn, var(--ip-warn));border-radius:6px;color:var(--cream-muted);font-size:13px;font-style:italic;font-family:var(--serif)}
  #og-root .og-btn{padding:9px 16px;border:none;border-radius:7px;background:linear-gradient(135deg,var(--acento-glow, var(--ip-accent-light)),var(--acento));color:#2A1A3B;font-family:var(--sans);font-weight:600;font-size:12.5px;cursor:pointer;transition:all .2s}
  #og-root .og-btn:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(200,89,36,.3)}
  #og-root .og-btn.ghost{background:transparent;color:var(--acento);border:1px solid var(--rule-strong)}
  #og-root .og-btn.ghost.danger{color:var(--danger, var(--ip-danger));border-color:var(--danger, var(--ip-danger))}
  #og-root .og-btn-mini{padding:4px 10px;border:1px solid var(--rule-strong);border-radius:5px;background:transparent;color:var(--acento);font-size:10.5px;cursor:pointer}
  #og-root .og-btn-mini:hover{background:rgba(200,89,36,.1)}
  #og-root .og-kpis{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-bottom:18px}
  #og-root .og-kpi{padding:12px 14px;border-radius:10px;background:var(--navy-raised);border:1px solid var(--rule)}
  #og-root .og-kpi.hero{background:linear-gradient(135deg,rgba(200,89,36,.1),transparent);border-color:var(--navy-edge,rgba(200,89,36,.3))}
  #og-root .og-kpi .lab{font-family:var(--mono);font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:var(--cream-dim);font-weight:600}
  #og-root .og-kpi .val{font-family:var(--serif);font-style:italic;font-size:24px;color:var(--cream);margin-top:4px;line-height:1}`;

  const CSS_B=`
  #og-root .og-section{padding:18px;border-radius:12px;background:var(--navy-raised);border:1px solid var(--rule);margin-bottom:18px}
  #og-root .og-sect-h{font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--acento-deep, var(--ip-accent-strong));font-weight:700;margin-bottom:12px}
  #og-root .og-int-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px}
  #og-root .og-int-card{padding:14px 16px;border-radius:10px;background:rgba(51,71,92,.08);border:1px solid var(--rule)}
  #og-root .og-int-lab{font-family:var(--mono);font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--cream-dim);font-weight:600}
  #og-root .og-int-val{font-family:var(--serif);font-style:italic;font-size:28px;color:var(--acento);margin-top:4px}
  #og-root .og-int-note{font-family:var(--sans);font-size:11.5px;color:var(--cream-muted);margin-top:5px;line-height:1.4}
  #og-root .og-risco-list{display:flex;flex-direction:column;gap:6px;margin-top:10px}
  #og-root .og-risco-item{padding:8px 12px;border-radius:6px;background:rgba(255,255,255,.02);font-size:12.5px;color:var(--cream);display:flex;align-items:center;gap:10px}
  #og-root .og-tabs{display:flex;gap:4px;border-bottom:1px solid var(--rule);margin-bottom:12px}
  #og-root .og-tab{padding:8px 14px;background:none;border:none;border-bottom:2px solid transparent;color:var(--cream-dim);font-family:var(--sans);font-size:12.5px;font-weight:500;cursor:pointer}
  #og-root .og-tab:hover{color:var(--cream)}
  #og-root .og-tab.on{color:var(--acento);border-bottom-color:var(--acento)}
  #og-root .og-tbl{width:100%;border-collapse:collapse;font-size:12.5px}
  #og-root .og-tbl th{text-align:left;padding:8px 10px;font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--acento-deep, var(--ip-accent-strong));font-weight:700;border-bottom:1px solid var(--rule-strong)}
  #og-root .og-tbl td{padding:9px 10px;border-bottom:1px solid var(--rule);color:var(--cream-muted)}
  #og-root .og-tbl tr:hover td{background:rgba(200,89,36,.04)}
  #og-root .og-tbl strong{color:var(--cream)}
  #og-root .og-tbl code{font-family:var(--mono);font-size:11px;color:var(--acento)}
  #og-root .og-pill{font-family:var(--mono);font-size:10px;padding:2px 7px;border-radius:10px;background:rgba(200,89,36,.14);color:var(--acento)}
  #og-root .og-pill.niv{background:rgba(123,165,216,.14);color:var(--info, var(--ip-info))}
  #og-root .og-tag{font-family:var(--sans);font-size:10px;padding:2px 8px;border-radius:10px;text-transform:lowercase;letter-spacing:.04em}
  #og-root .og-tag.ok{background:rgba(116,192,143,.14);color:var(--ok, var(--ip-ok))}
  #og-root .og-tag.warn{background:rgba(224,118,58,.16);color:var(--warn, var(--ip-warn))}
  #og-root .og-tag.danger{background:rgba(216,117,117,.16);color:var(--danger, var(--ip-danger))}
  #og-root .og-tag.info{background:rgba(123,165,216,.14);color:var(--info, var(--ip-info))}
  #og-root .og-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
  #og-root .og-card{padding:14px;border-radius:11px;background:var(--navy-raised);border:1px solid var(--rule)}
  #og-root .og-card.vac{border-left:3px solid var(--warn, var(--ip-warn))}
  #og-root .og-card.bloq{border-left:3px solid var(--danger, var(--ip-danger))}
  #og-root .og-card-h{display:flex;justify-content:space-between;gap:6px}
  #og-root .og-card-nm{margin-top:8px;font-size:14px;font-weight:600;color:var(--cream)}
  #og-root .og-card-cg{font-size:12px;color:var(--acento);font-family:var(--serif);font-style:italic}
  #og-root .og-card-meta{font-size:11px;color:var(--cream-dim);margin-top:4px}
  #og-root .og-empty{text-align:center;padding:26px;color:var(--cream-dim);font-style:italic;font-family:var(--serif);font-size:14px}
  .og-modal-bg{position:fixed;inset:0;background:rgba(7,5,15,.7);z-index:1000}
  .og-modal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--bg-sidebar,#080D13);color:var(--cream);padding:24px;border-radius:14px;border:1px solid var(--acento);z-index:1001;width:min(560px,92vw);max-height:88vh;overflow:auto}
  .og-modal-h{font-family:var(--mono);font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--acento-deep, var(--ip-accent-strong));font-weight:700;margin-bottom:14px}
  .og-mform{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .og-mform label{display:flex;flex-direction:column;gap:4px;font-family:var(--mono);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--cream-dim);font-weight:600}
  .og-mform input,.og-mform select,.og-mform textarea{padding:8px 11px;background:var(--navy-raised,#0F1325);border:1px solid var(--rule-strong);border-radius:6px;color:var(--cream);font-family:var(--sans);font-size:12.5px;text-transform:none;letter-spacing:0}
  .og-mform textarea{min-height:60px;resize:vertical;grid-column:1/-1}
  .og-mact{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
  @media(max-width:980px){#og-root .og-kpis{grid-template-columns:repeat(3,1fr)} #og-root .og-int-grid{grid-template-columns:1fr} .og-mform{grid-template-columns:1fr}}`;
  function injectCSS(){ if(document.getElementById('og-css'))return; const s=document.createElement('style'); s.id='og-css'; s.textContent=CSS_A+CSS_B; document.head.appendChild(s); }
  injectCSS();
  window.IpOrganograma={open,_setMandato,_tab,_abrir,_fechar,_salvar,_excluir};
})();
