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
    var r=await sb.from('ip_org_node').select('id,parent_id,nome,tipo_no,path,mandato_id,status,estagio').eq('status','ativo').order('path');
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
     +'.ipo-tnode .tp{font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--ip-ink-4);margin-left:auto}';
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
    return '<div class="ipo-tnode'+(cur?' cur':'')+'" data-node="'+esc(n.id)+'" style="padding-left:'+pad+'px">'
      +'<span>'+esc(n.nome)+'</span><span class="tp">'+esc(n.tipo_no)+'</span></div>'
      + kids.map(function(k){return _treeNodeHtml(k, depth+1);}).join('');
  }
  function _bind(host){
    host.querySelectorAll('[data-node]').forEach(function(el){
      el.onclick=function(){ scope.set(el.getAttribute('data-node')); _treeOpen=false; };
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
    t.innerHTML='<div style="font:600 10px/1 system-ui;letter-spacing:.16em;text-transform:uppercase;color:var(--ip-gold-lum);margin-bottom:14px">Árvore do grupo</div>'+_treeNodeHtml(_root(),0);
    _bind(t);
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

  window.IpOrg = { init:init, scope:scope, gate:gate, _reload:function(){_nodes=null;return _load();} };
})();
