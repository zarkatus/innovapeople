// InnovaPeople · Espinha Organizacional (client) · PASSO 4 · PQV-01 04/06
// A simplicidade de Jobs literal: a complexidade vive no DB (ip_org_node, ltree, rollups);
// a SUPERFÍCIE é simples. Com 1 empresa, TODA a hierarquia DESAPARECE — tela idêntica a hoje.
// Com ≥2 nós, o breadcrumb/árvore aparecem e 1 clique reescopa a plataforma inteira.
// MODULAR: window.IpOrg.{ scope, gate, breadcrumb, tree }. Telas não são reescritas —
// recebem o nó corrente via IpOrg.scope.nodeId() (fallback transparente p/ mandato quando não há hierarquia).
(function(){
  'use strict';
  if(window.IpOrg) return;
  var SB=function(){ return window.__IP_SB||window.sb; };
  var esc=function(s){ return (window.IpUI&&IpUI.esc)?IpUI.esc(s):String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); };

  // ── estado da árvore (cache) ──
  var _nodes=null, _curNode=null, _listeners=[];
  async function _load(){
    if(_nodes && _nodes.length) return _nodes; // só cacheia resultado NÃO-vazio (evita prender [] de uma corrida de boot)
    var sb=SB(); if(!sb) return [];
    var r=await sb.from('ip_org_node').select('id,parent_id,nome,tipo_no,path,mandato_id,status,estagio,metadata').eq('status','ativo').order('path');
    if(r.error) return _nodes||[]; // erro (ex. sessão não pronta) -> não cacheia, permite retry
    _nodes=(r.data||[]);
    return _nodes;
  }
  function _byId(id){ return (_nodes||[]).find(function(n){return n.id===id;}); }
  function _root(){ return (_nodes||[]).find(function(n){return !n.parent_id;}) || (_nodes||[])[0]; }
  function _children(id){ return (_nodes||[]).filter(function(n){return n.parent_id===id;}); }
  function _ancestors(node){ // do raiz até o nó
    var chain=[], cur=node;
    while(cur){ chain.unshift(cur); cur=cur.parent_id?_byId(cur.parent_id):null; }
    return chain;
  }

  // ── SCOPE: o nó corrente move a plataforma. Telas leem nodeId()/mandatoIds(). ──
  var scope = {
    nodeId: function(){ return _curNode? _curNode.id : null; },
    node: function(){ return _curNode; },
    // ids de mandato da subárvore corrente (p/ telas que filtram por mandato_id)
    mandatoIds: function(){
      if(!_curNode) return null; // sem hierarquia -> telas usam o comportamento atual
      var root=_curNode, out=[];
      (_nodes||[]).forEach(function(n){ if((n.path===root.path || (n.path||'').indexOf(root.path+'.')===0) && n.mandato_id) out.push(n.mandato_id); });
      return out;
    },
    set: async function(nodeId){
      await _load();
      _curNode = _byId(nodeId) || _root();
      _listeners.forEach(function(fn){ try{ fn(_curNode); }catch(_){} });
      _render();
    },
    onChange: function(fn){ if(typeof fn==='function') _listeners.push(fn); }
  };

  // ── GATE de invisibilidade: com ≤1 nó, hierarquia some. Simplicidade Jobs. ──
  var gate = {
    count: function(){ return (_nodes||[]).length; },
    visible: function(){ return (_nodes||[]).length >= 2; }
  };

  // ── render do chrome (breadcrumb + árvore) — só aparece com ≥2 nós ──
  function _injectCss(){
    if(document.getElementById('ip-org-css'))return;
    var st=document.createElement('style'); st.id='ip-org-css';
    st.textContent=
      '#ip-org-bar{position:sticky;top:0;z-index:45;display:flex;align-items:center;gap:10px;padding:9px 18px;background:color-mix(in srgb,var(--ip-bg-deep,#070D15) 94%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid rgba(210,174,100,.12);font-size:13px}'
     +'.ipo-crumb{display:flex;align-items:center;gap:6px;flex-wrap:wrap}'
     +'.ipo-crumb a{color:var(--ip-ink-2,#9FB0C5);cursor:pointer;padding:3px 8px;border-radius:8px;transition:.15s}'
     +'.ipo-crumb a:hover{background:rgba(210,174,100,.1);color:var(--ip-gold-lum,#E5C77E)}'
     +'.ipo-crumb a.cur{color:var(--ip-gold-lum,#E5C77E);font-weight:600}'
     +'.ipo-crumb .sep{color:var(--ip-ink-4,#6B7A90)}'
     +'.ipo-treebtn{margin-left:auto;font-size:11px;color:var(--ip-ink-3);border:1px solid rgba(210,174,100,.16);border-radius:14px;padding:5px 12px;cursor:pointer;background:transparent;transition:.15s}'
     +'.ipo-treebtn:hover{border-color:var(--ip-gold-lum);color:var(--ip-gold-lum)}'
     +'#ip-org-tree{position:fixed;top:0;right:0;height:100vh;width:300px;background:var(--ip-bg,#0A1320);border-left:1px solid rgba(210,174,100,.2);box-shadow:-12px 0 40px rgba(0,0,0,.5);z-index:9001;transform:translateX(100%);transition:transform .25s;overflow-y:auto;padding:20px 18px}'
     +'#ip-org-tree.on{transform:none}'
     +'.ipo-tnode{display:flex;align-items:center;gap:7px;padding:7px 9px;border-radius:9px;cursor:pointer;font-size:13px;color:var(--ip-ink-2);transition:.12s}'
     +'.ipo-tnode:hover{background:rgba(210,174,100,.08);color:var(--ip-cream)}'
     +'.ipo-tnode.cur{background:color-mix(in srgb,var(--ip-gold-lum) 14%,transparent);color:var(--ip-gold-lum);font-weight:600}'
     +'.ipo-tnode .tp{font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--ip-ink-4);margin-left:auto}'
     +'.ipo-gear{flex:0 0 auto;width:24px;height:24px;border-radius:6px;border:none;background:transparent;color:var(--ip-ink-3,#8FA0B5);cursor:pointer;font-size:15px;line-height:1;opacity:.5;transition:.15s}'
     +'.ipo-tnode:hover .ipo-gear{opacity:1}.ipo-gear:hover{background:rgba(210,174,100,.12);color:var(--ip-gold-lum,#E5C77E)}'
     +'.ipo-gestbtn{font:600 9.5px/1 system-ui;letter-spacing:.08em;text-transform:uppercase;padding:5px 10px;border-radius:14px;border:1px solid rgba(210,174,100,.2);background:transparent;color:var(--ip-ink-3,#8FA0B5);cursor:pointer;transition:.15s}'
     +'.ipo-gestbtn:hover,.ipo-gestbtn.on{border-color:var(--ip-gold-lum,#E5C77E);color:var(--ip-gold-lum,#E5C77E)}'
     +'.ipo-mbtn{display:block;width:100%;text-align:left;padding:11px 13px;margin-bottom:7px;border-radius:9px;border:1px solid rgba(210,174,100,.14);background:var(--ip-bg-deep,#070D15);color:var(--ip-ink,#CBD5E1);font-size:13px;cursor:pointer;transition:.15s}'
     +'.ipo-mbtn:hover{border-color:var(--ip-gold-lum,#E5C77E);color:var(--ip-cream,#F7F3EC)}'
     +'.ipo-dd{font:700 7.5px/1 system-ui;letter-spacing:.06em;padding:3px 6px;border-radius:6px}'
     +'.ipo-dd-ok{background:rgba(123,211,160,.16);color:var(--ip-ok,#7BD3A0)}.ipo-dd-cau{background:rgba(229,199,126,.16);color:var(--ip-gold-lum,#E5C77E)}.ipo-dd-no{background:rgba(232,166,166,.16);color:var(--ip-danger,#E8A6A6)}';
    (document.head||document.documentElement).appendChild(st);
  }
  var _treeOpen=false;
  function _crumbHtml(){
    var anc=_ancestors(_curNode||_root());
    return '<div class="ipo-crumb">'+anc.map(function(n,i){
      var last=i===anc.length-1;
      return (i?'<span class="sep">›</span>':'')+'<a class="'+(last?'cur':'')+'" data-node="'+esc(n.id)+'">'+esc(n.nome)+'</a>';
    }).join('')+'</div>';
  }
  function _treeNodeHtml(n, depth){
    var cur=_curNode&&n.id===_curNode.id;
    var kids=_children(n.id);
    var pad=8+depth*14;
    var gear = _gestao ? '<button class="ipo-gear" data-gear="'+esc(n.id)+'" title="Gerir">⋯</button>' : '';
    var dd = n.metadata && n.metadata.dd;
    var ddBadge = dd ? '<span class="ipo-dd ipo-dd-'+(dd.veredicto==='ENTRAR'?'ok':dd.veredicto==='EVITAR'?'no':'cau')+'" title="Due diligence: '+esc(dd.veredicto)+' · score '+(dd.risco_score)+'">'+esc(dd.veredicto)+'</span>' : '';
    return '<div class="ipo-tnode'+(cur?' cur':'')+'" style="padding-left:'+pad+'px">'
      +'<span class="ipo-tnode-clk" data-node="'+esc(n.id)+'" style="flex:1;display:flex;gap:7px;align-items:center"><span>'+esc(n.nome)+'</span><span class="tp">'+esc(n.tipo_no)+'</span>'+ddBadge+'</span>'+gear+'</div>'
      + kids.map(function(k){return _treeNodeHtml(k, depth+1);}).join('');
  }

  // ── GESTÃO da árvore: criar/mover/renomear/arquivar via RPC + recarrega ──
  var _gestao=false, _mover=null;
  async function _rpc(fn, args){ var sb=SB(); if(!sb) return {error:'sem cliente'}; var r=await sb.rpc(fn,args); if(r.error)throw r.error; return r.data; }
  async function _recarregar(){ _nodes=null; await _load(); _renderTree(); _render(); }
  function _toast(m){ if(window.IpUI&&IpUI.toast)IpUI.toast(m); else if(window.TB&&TB.toast)TB.toast(m); }
  async function criarNo(parentId){
    // modal rico: nome + tipo + CNPJ (opcional, mas desejável). CNPJ dispara DD automática.
    if(window.IpUI && IpUI.modal){ return _criarNoModal(parentId); }
    var nome=prompt('Nome do novo nó:'); if(!nome||nome.trim().length<2)return;
    var tipo=prompt('Tipo (grupo, holding, unidade_negocio, frente, segmento):','unidade_negocio'); if(!tipo)return;
    try{ await _rpc('fn_ip_org_criar_no',{p_nome:nome.trim(),p_tipo:tipo.trim(),p_parent_id:parentId||null}); _toast('Nó criado'); await _recarregar(); }
    catch(e){ _toast('Erro: '+(e.message||e)); }
  }
  function _criarNoModal(parentId){
    var tipos=['unidade_negocio','grupo','holding','empresa','frente','segmento','ativo','veiculo','fundo'];
    var html='<div style="font:600 italic 17px Georgia;color:var(--ip-gold-lum,#E5C77E);margin-bottom:12px">Novo nó'+(parentId?' (dentro deste)':' (raiz)')+'</div>'
      +'<label style="display:block;margin-bottom:10px"><span style="display:block;font:600 10px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-ink-3,#8FA0B5);margin-bottom:5px">Nome</span><input id="onc-nome" style="width:100%;background:var(--ip-bg-deep,#070D15);border:1px solid rgba(210,174,100,.25);border-radius:9px;padding:10px 12px;color:var(--ip-cream,#F7F3EC);font-size:14px"></label>'
      +'<label style="display:block;margin-bottom:10px"><span style="display:block;font:600 10px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-ink-3,#8FA0B5);margin-bottom:5px">Tipo</span><select id="onc-tipo" style="width:100%;background:var(--ip-bg-deep,#070D15);border:1px solid rgba(210,174,100,.25);border-radius:9px;padding:10px 12px;color:var(--ip-cream,#F7F3EC);font-size:14px">'+tipos.map(function(t){return '<option value="'+t+'">'+t+'</option>';}).join('')+'</select></label>'
      +'<label style="display:block;margin-bottom:6px"><span style="display:block;font:600 10px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-ink-3,#8FA0B5);margin-bottom:5px">CNPJ <span style="color:var(--ip-ink-4,#6B7A90);text-transform:none;letter-spacing:0">(opcional — dispara due diligence)</span></span><input id="onc-cnpj" inputmode="numeric" placeholder="00.000.000/0000-00" style="width:100%;background:var(--ip-bg-deep,#070D15);border:1px solid rgba(210,174,100,.25);border-radius:9px;padding:10px 12px;color:var(--ip-cream,#F7F3EC);font-size:14px;font-family:ui-monospace,monospace"></label>'
      +'<div id="onc-res" style="font-size:12px;margin:8px 0;min-height:16px"></div>'
      +'<button class="ipo-mbtn" id="onc-ok" style="margin-top:6px;border-color:var(--ip-gold-lum,#E5C77E);color:var(--ip-gold-lum,#E5C77E);text-align:center;font-weight:600">Criar</button>';
    var m=IpUI.modal(html,{label:'Novo nó',width:'min(420px,100%)'}); var box=m.box;
    setTimeout(function(){ var i=box.querySelector('#onc-nome'); if(i)i.focus(); },50);
    box.querySelector('#onc-ok').onclick=async function(){
      var nome=(box.querySelector('#onc-nome').value||'').trim();
      var tipo=box.querySelector('#onc-tipo').value;
      var cnpj=(box.querySelector('#onc-cnpj').value||'').replace(/\D/g,'');
      var res=box.querySelector('#onc-res'); var btn=box.querySelector('#onc-ok');
      if(nome.length<2){ res.innerHTML='<span style="color:var(--ip-danger,#E8A6A6)">Informe o nome.</span>'; return; }
      if(cnpj && cnpj.length!==14){ res.innerHTML='<span style="color:var(--ip-danger,#E8A6A6)">CNPJ deve ter 14 dígitos (ou deixe vazio).</span>'; return; }
      btn.disabled=true; res.innerHTML='<span style="color:var(--ip-ink-3)">Criando'+(cnpj?' e rodando due diligence…':'…')+'</span>';
      try{
        var r=await _rpc('fn_ip_org_criar_no',{p_nome:nome,p_tipo:tipo,p_parent_id:parentId||null});
        if(cnpj){ await _ddDoNo(r.id, cnpj, res); }   // DD automática: todo CNPJ exige diligência
        _toast('Nó criado'+(cnpj?' + DD':'')); m.close(); await _recarregar();
      }catch(e){ res.innerHTML='<span style="color:var(--ip-danger,#E8A6A6)">Erro: '+esc(e.message||e)+'</span>'; btn.disabled=false; }
    };
  }
  // DD automática de um nó com CNPJ: enriquece, roda o motor, grava o parecer no metadata do nó
  async function _ddDoNo(nodeId, cnpj, resEl){
    var sb=SB();
    try{
      if(resEl) resEl.innerHTML='<span style="color:var(--ip-ink-3)">Due diligence: buscando e avaliando…</span>';
      var enr=await sb.functions.invoke('cnpj-enrich',{body:{cnpj:cnpj}});
      var dossie=(enr&&!enr.error)?enr.data:null;
      var sanc=null; try{ var sr=await sb.functions.invoke('dd-sancoes',{body:{doc:cnpj,tipo:'cnpj'}}); if(!sr.error)sanc=sr.data; }catch(_){}
      var dd = (dossie && window.IpDDMotor) ? IpDDMotor.avaliar(dossie,{sancoes:sanc}) : null;
      // grava no metadata do nó (cnpj + dossiê + parecer)
      await _rpc('fn_ip_org_set_dd',{p_node_id:nodeId, p_cnpj:cnpj, p_dossie:dossie, p_dd:dd});
      if(resEl && dd) resEl.innerHTML='<span style="color:'+(dd.veredicto==='ENTRAR'?'var(--ip-ok,#7BD3A0)':dd.veredicto==='EVITAR'?'var(--ip-danger,#E8A6A6)':'var(--ip-gold-lum,#E5C77E)')+'">DD: '+esc(dd.veredicto)+' (score '+dd.risco_score+')</span>';
      return dd;
    }catch(e){ if(resEl) resEl.innerHTML='<span style="color:var(--ip-ink-4)">Nó criado; DD não pôde rodar agora ('+esc((e.message||e)+'').slice(0,40)+').</span>'; return null; }
  }
  // expõe p/ outras telas dispararem DD de um nó existente
  async function rodarDDdoNo(nodeId, cnpj){ return _ddDoNo(nodeId, (cnpj||'').replace(/\D/g,''), null); }

  // ── declarar PARTICIPAÇÃO societária (este nó detém outro) ──
  function declararParticipacao(deId){
    if(!window.IpUI || !IpUI.modal) return;
    var detido = (_nodes||[]).filter(function(n){ return n.id!==deId; });
    if(!detido.length){ _toast('Não há outro nó para deter.'); return; }
    var html='<div style="font:600 italic 17px Georgia;color:var(--ip-gold-lum,#E5C77E);margin-bottom:4px">Participação societária</div>'
      +'<div style="font-size:11.5px;color:var(--ip-ink-3,#8FA0B5);margin-bottom:12px"><b>'+esc((_byId(deId)||{}).nome||'')+'</b> detém qual empresa, e quanto?</div>'
      +'<label style="display:block;margin-bottom:10px"><span style="display:block;font:600 10px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-ink-3,#8FA0B5);margin-bottom:5px">Empresa detida</span><select id="own-para" style="width:100%;background:var(--ip-bg-deep,#070D15);border:1px solid rgba(210,174,100,.25);border-radius:9px;padding:10px 12px;color:var(--ip-cream,#F7F3EC);font-size:14px">'+detido.map(function(n){return '<option value="'+esc(n.id)+'">'+esc(n.nome)+'</option>';}).join('')+'</select></label>'
      +'<label style="display:block;margin-bottom:6px"><span style="display:block;font:600 10px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-ink-3,#8FA0B5);margin-bottom:5px">Percentual (%)</span><input id="own-pct" type="number" min="1" max="100" placeholder="ex: 80" style="width:100%;background:var(--ip-bg-deep,#070D15);border:1px solid rgba(210,174,100,.25);border-radius:9px;padding:10px 12px;color:var(--ip-cream,#F7F3EC);font-size:14px"></label>'
      +'<div style="font-size:10.5px;color:var(--ip-ink-4,#6B7A90);margin-bottom:10px">O método contábil (consolidação >50% · equity 20-50% · custo &lt;20%) é derivado automaticamente.</div>'
      +'<div id="own-res" style="font-size:12px;margin:6px 0;min-height:14px"></div>'
      +'<button class="ipo-mbtn" id="own-ok" style="border-color:var(--ip-gold-lum,#E5C77E);color:var(--ip-gold-lum,#E5C77E);text-align:center;font-weight:600">Declarar participação</button>';
    var m=IpUI.modal(html,{label:'Participação',width:'min(400px,100%)'}); var box=m.box;
    box.querySelector('#own-ok').onclick=async function(){
      var para=box.querySelector('#own-para').value, pct=parseFloat(box.querySelector('#own-pct').value);
      var res=box.querySelector('#own-res');
      if(!(pct>0&&pct<=100)){ res.innerHTML='<span style="color:var(--ip-danger,#E8A6A6)">Percentual entre 1 e 100.</span>'; return; }
      try{ var r=await _rpc('fn_ip_ownership_declarar',{p_de:deId,p_para:para,p_percentual:pct});
        _toast('Participação: '+r.metodo); m.close(); await _recarregar();
      }catch(e){ res.innerHTML='<span style="color:var(--ip-danger,#E8A6A6)">Erro: '+esc(e.message||e)+'</span>'; }
    };
  }
  async function renomearNo(id){
    var n=_byId(id); var nome=prompt('Renomear:', n?n.nome:''); if(!nome||nome.trim().length<2)return;
    try{ await _rpc('fn_ip_org_renomear',{p_node_id:id,p_nome:nome.trim()}); _toast('Renomeado'); await _recarregar(); }
    catch(e){ _toast('Erro: '+(e.message||e)); }
  }
  async function arquivarNo(id){
    var n=_byId(id); if(!confirm('Arquivar "'+(n?n.nome:'')+'"? (some da árvore; reversível no banco)'))return;
    try{ await _rpc('fn_ip_org_arquivar',{p_node_id:id}); _toast('Arquivado'); await _recarregar(); }
    catch(e){ _toast('Erro: '+(e.message||e)); }
  }
  function iniciarMover(id){ _mover=id; _toast('Selecione o novo PAI para "'+(_byId(id)||{}).nome+'" (clique no ⋯ do destino → "Mover para cá")'); _renderTree(); }
  async function moverPara(novoParent){
    if(!_mover)return; var src=_mover; _mover=null;
    try{ await _rpc('fn_ip_org_mover_no',{p_node_id:src,p_novo_parent:novoParent}); _toast('Movido'); await _recarregar(); }
    catch(e){ _toast('Erro: '+(e.message||e)); _renderTree(); }
  }
  function _menuGestao(id){
    var n=_byId(id); if(!n)return;
    var dest = _mover && _mover!==id;
    var html='<div style="font:600 13px Georgia;font-style:italic;color:var(--ip-cream,#F7F3EC);margin-bottom:12px">'+esc(n.nome)+'</div>'
      +(dest?'<button class="ipo-mbtn" data-act="movercá" style="border-color:var(--ip-ok,#7BD3A0);color:var(--ip-ok,#7BD3A0)">↳ Mover para cá</button>':'')
      +'<button class="ipo-mbtn" data-act="criar">+ Novo nó dentro deste</button>'
      +'<button class="ipo-mbtn" data-act="mover">⇄ Mover este nó…</button>'
      +'<button class="ipo-mbtn" data-act="participacao" style="border-color:var(--ip-gold-lum,#E5C77E);color:var(--ip-gold-lum,#E5C77E)">◈ Participação societária…</button>'
      +'<button class="ipo-mbtn" data-act="renomear">✎ Renomear</button>'
      +'<button class="ipo-mbtn" data-act="arquivar" style="color:var(--ip-danger,#E8A6A6)">🗄 Arquivar</button>';
    var m = (window.IpUI&&IpUI.modal) ? IpUI.modal(html,{label:'Gerir nó',width:'min(340px,100%)'}) : null;
    var box = m ? m.box : null;
    if(!box) return;
    box.querySelectorAll('.ipo-mbtn').forEach(function(b){ b.onclick=function(){
      var act=b.getAttribute('data-act'); m.close();
      if(act==='movercá') moverPara(id);
      else if(act==='criar') criarNo(id);
      else if(act==='mover') iniciarMover(id);
      else if(act==='participacao') declararParticipacao(id);
      else if(act==='renomear') renomearNo(id);
      else if(act==='arquivar') arquivarNo(id);
    }; });
  }
  function _bind(host){
    host.querySelectorAll('[data-node]').forEach(function(el){
      el.onclick=function(){ scope.set(el.getAttribute('data-node')); _treeOpen=false; };
    });
    host.querySelectorAll('[data-gear]').forEach(function(el){
      el.onclick=function(ev){ ev.stopPropagation(); _menuGestao(el.getAttribute('data-gear')); };
    });
  }
  function _render(){
    _injectCss();
    var bar=document.getElementById('ip-org-bar');
    if(!gate.visible()){ // 1 empresa -> remove TODO o chrome de hierarquia (idêntico a hoje)
      if(bar) bar.remove();
      var t=document.getElementById('ip-org-tree'); if(t) t.remove();
      return;
    }
    // ≥2 nós: barra de breadcrumb no topo do body
    if(!bar){ bar=document.createElement('div'); bar.id='ip-org-bar'; document.body.insertBefore(bar, document.body.firstChild); }
    bar.innerHTML=_crumbHtml()+'<button class="ipo-treebtn" id="ipo-treebtn">⌗ Árvore do grupo</button>';
    _bind(bar);
    bar.querySelector('#ipo-treebtn').onclick=function(){ _treeOpen=!_treeOpen; _renderTree(); };
    _renderTree();
  }
  function _renderTree(){
    var t=document.getElementById('ip-org-tree');
    if(!t){ t=document.createElement('div'); t.id='ip-org-tree'; document.body.appendChild(t); }
    t.classList.toggle('on', _treeOpen);
    var header='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'
      +'<span style="font:600 10px/1 system-ui;letter-spacing:.16em;text-transform:uppercase;color:var(--ip-gold-lum)">Árvore do grupo</span>'
      +'<button class="ipo-gestbtn'+(_gestao?' on':'')+'" id="ipo-gestbtn">'+(_gestao?'✓ gerindo':'⚙ gerir')+'</button></div>';
    var moverHint = _mover ? '<div style="font-size:11px;color:var(--ip-ok,#7BD3A0);margin-bottom:10px;padding:8px 10px;background:rgba(123,211,160,.08);border-radius:8px">Movendo "'+esc((_byId(_mover)||{}).nome||'')+'" — abra o ⋯ do destino e escolha "Mover para cá". <a id="ipo-cancelmover" style="cursor:pointer;text-decoration:underline">cancelar</a></div>' : '';
    var novoRaiz = _gestao ? '<button class="ipo-mbtn" id="ipo-novoraiz" style="margin-top:10px">+ Novo grupo/holding (raiz)</button>' : '';
    t.innerHTML=header+moverHint+_treeNodeHtml(_root(),0)+novoRaiz;
    _bind(t);
    var gb=t.querySelector('#ipo-gestbtn'); if(gb) gb.onclick=function(){ _gestao=!_gestao; if(!_gestao)_mover=null; _renderTree(); };
    var nr=t.querySelector('#ipo-novoraiz'); if(nr) nr.onclick=function(){ criarNo(null); };
    var cm=t.querySelector('#ipo-cancelmover'); if(cm) cm.onclick=function(){ _mover=null; _renderTree(); };
  }

  // ── boot: carrega a árvore, define o nó corrente (raiz), renderiza o chrome (se ≥2 nós) ──
  async function init(opts){
    opts=opts||{};
    await _load();
    if(!_nodes.length) return; // sem árvore -> nada (não deveria, bootstrap cria folhas)
    _curNode = opts.nodeId? (_byId(opts.nodeId)||_root()) : _root();
    _render();
    return { count: gate.count(), visible: gate.visible(), node: _curNode };
  }

  window.IpOrg = { init:init, scope:scope, gate:gate,
    criarNo:criarNo, moverNo:iniciarMover, renomearNo:renomearNo, arquivarNo:arquivarNo, rodarDDdoNo:rodarDDdoNo,
    declararParticipacao:declararParticipacao,
    _reload:function(){_nodes=null;return _load();} };
})();
