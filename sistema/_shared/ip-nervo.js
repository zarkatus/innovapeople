// InnovaPeople · Sistema Nervoso (client) · Sprint #5 · PQV-01 04/06
// O dado de gente agora PULSA: cada CRUD vira ip_eventos (trigger server-side) e este módulo
// é o ÚNICO ponto client que (a) assina o realtime e (b) renderiza a timeline ao vivo.
// MODULAR: telas só importam e chamam window.IpNervo.* — zero lógica de captura no client
// (captura é 100% trigger no Postgres). Consome a VIEW v_ip_timeline_mandato (projeção estável):
// rename de coluna na tabela-fonte NÃO quebra a UI.
// API:
//   IpNervo.subscribe(mandatoId, onEvent) -> unsub()   // realtime de ip_eventos (sócios-only via RLS)
//   IpNervo.setCorrelation(uuid|null)                  // amarra a cadeia causal no próximo write
//   IpNervo.withCorrelation(fn)                         // executa fn com um correlation_id novo
//   IpNervo.timeline(hostEl, {mandato, limit, live})   // renderiza timeline + (opcional) ao vivo
//   IpNervo.recent({mandato, limit})                    // lê a projeção humanizada (Promise)
(function(){
  'use strict';
  if(window.IpNervo) return;
  var SB = function(){ return window.__IP_SB || window.sb; };
  var esc = (window.IpUI && window.IpUI.esc) || function(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); };

  // correlation_id: amarra eventos de um mesmo fluxo (admissão→OKR inicial→1ª decisão).
  // Setado via GUC no Postgres (current_setting('ip.correlation_id')) através de um RPC leve.
  var _corr = null;
  function _uuid(){ // RFC4122 v4 sem depender de crypto (compat)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){
      var r = (window.crypto && crypto.getRandomValues) ? crypto.getRandomValues(new Uint8Array(1))[0]%16 : Math.floor(((Date.now()+performance.now())%16));
      var v = c==='x' ? r : (r&0x3|0x8); return v.toString(16);
    });
  }
  async function setCorrelation(uuid){
    _corr = uuid || null;
    var sb=SB(); if(!sb) return;
    try{ await sb.rpc('fn_ip_set_correlation', { p_id: _corr }); }catch(_){ /* GUC best-effort */ }
  }
  async function withCorrelation(fn){
    var prev=_corr, id=_uuid();
    await setCorrelation(id);
    try{ return await fn(id); } finally { await setCorrelation(prev); }
  }

  // ---- Realtime: assina INSERTs de ip_eventos no escopo da curadoria (RLS sócios-only filtra) ----
  function subscribe(mandatoId, onEvent){
    var sb=SB();
    if(!sb || !sb.channel){ return function(){}; }
    var filtro = mandatoId ? ('mandato_id=eq.'+mandatoId) : undefined;
    var ch = sb.channel('ip_eventos:'+(mandatoId||'all'))
      .on('postgres_changes',
        { event:'INSERT', schema:'public', table:'ip_eventos', filter: filtro },
        function(payload){ try{ onEvent && onEvent(payload.new); }catch(_){} })
      .subscribe();
    return function unsub(){ try{ sb.removeChannel(ch); }catch(_){} };
  }

  // ---- Leitura da projeção humanizada (VIEW estável) ----
  async function recent(opts){
    opts=opts||{}; var sb=SB(); if(!sb) return [];
    var q=sb.from('v_ip_timeline_mandato').select('id,ts,event_type,operacao,actor_email,rotulo,tipo_negocio,sujeito,correlation_id');
    if(opts.mandato) q=q.eq('mandato_id', opts.mandato);
    if(opts.tipos && opts.tipos.length) q=q.in('tipo_negocio', opts.tipos);
    var r=await q.order('ts',{ascending:false}).limit(opts.limit||30);
    return r.error ? [] : (r.data||[]);
  }

  // ---- Timeline visual (reusa estética; injeta CSS 1×). live:true assina realtime e prepende. ----
  function _ico(op){ op=(op||'').toUpperCase(); return op==='INSERT'?'+':(op==='DELETE'?'×':'~'); }
  function _cls(op){ op=(op||'').toUpperCase(); return op==='INSERT'?'ins':(op==='DELETE'?'del':'upd'); }
  function _fmtRel(ts){
    try{ var d=new Date(ts), s=Math.floor((Date.now()-d)/1000);
      if(s<60)return 'agora'; if(s<3600)return Math.floor(s/60)+'min'; if(s<86400)return Math.floor(s/3600)+'h';
      return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}); }catch(_){ return ''; }
  }
  function _item(e){
    var op=e.operacao;
    return '<div class="ipn-item '+_cls(op)+'" data-id="'+esc(e.id)+'">'
      +'<div class="ipn-dot">'+_ico(op)+'</div>'
      +'<div class="ipn-body"><div class="ipn-line"><strong>'+esc(e.rotulo||e.event_type||e.source_table||'evento')+'</strong>'
      +(e.sujeito?' <span class="ipn-subj">· '+esc(e.sujeito)+'</span>':'')+'</div>'
      +'<div class="ipn-meta">'+(e.actor_email?esc(e.actor_email)+' · ':'')+_fmtRel(e.ts)+'</div></div></div>';
  }
  function _injectCss(){
    if(document.getElementById('ip-nervo-css'))return;
    var st=document.createElement('style'); st.id='ip-nervo-css';
    st.textContent=
      '.ipn-tl{display:flex;flex-direction:column;gap:2px;position:relative}'
     +'.ipn-item{display:flex;gap:12px;align-items:flex-start;padding:10px 4px;border-left:2px solid rgba(210,174,100,.12);margin-left:8px;padding-left:16px;position:relative;animation:ipnIn .5s ease}'
     +'@keyframes ipnIn{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}}'
     +'@media(prefers-reduced-motion:reduce){.ipn-item{animation:none}}'
     +'.ipn-dot{position:absolute;left:-9px;top:11px;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 11px/1 system-ui;color:var(--ip-bg-deep,#070D15)}'
     +'.ipn-item.ins .ipn-dot{background:var(--ip-ok,#7BD3A0)}.ipn-item.upd .ipn-dot{background:var(--ip-gold-lum,#E9A578)}.ipn-item.del .ipn-dot{background:var(--ip-danger-2,#C77D7D)}'
     +'.ipn-line{font-size:13px;color:var(--ip-cream,#F7F3EC)}.ipn-line strong{font-weight:600}'
     +'.ipn-subj{color:var(--ip-ink-2,#9FB0C5);font-weight:400}'
     +'.ipn-meta{font-size:10.5px;color:var(--ip-ink-4,#6B7A90);font-family:ui-monospace,monospace;margin-top:2px}'
     +'.ipn-empty{padding:26px 16px;text-align:center;color:var(--ip-ink-4,#6B7A90);font-style:italic}'
     +'.ipn-live{display:inline-flex;align-items:center;gap:6px;font:600 9px/1 system-ui;letter-spacing:.14em;text-transform:uppercase;color:var(--ip-ok,#7BD3A0)}'
     +'.ipn-live .d{width:6px;height:6px;border-radius:50%;background:var(--ip-ok,#7BD3A0);box-shadow:0 0 0 0 rgba(123,211,160,.5);animation:ipnPulse 2s infinite}'
     +'@keyframes ipnPulse{70%{box-shadow:0 0 0 7px rgba(123,211,160,0)}100%{box-shadow:0 0 0 0 rgba(123,211,160,0)}}';
    (document.head||document.documentElement).appendChild(st);
  }

  async function timeline(host, opts){
    opts=opts||{}; if(!host) return function(){};
    _injectCss();
    var liveTag = opts.live ? '<span class="ipn-live"><span class="d"></span>ao vivo</span>' : '';
    host.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
      +'<span style="font:600 10px/1 system-ui;letter-spacing:.16em;text-transform:uppercase;color:var(--ip-ink-3,#8FA0B5)">Linha do tempo · o que aconteceu</span>'+liveTag+'</div>'
      +'<div class="ipn-tl" id="ipn-tl">'+ (window.IpUI && IpUI.skeleton ? IpUI.skeleton(4) : '…') +'</div>';
    var tl = host.querySelector('#ipn-tl');
    var rows = await recent({ mandato: opts.mandato, limit: opts.limit||30, tipos: opts.tipos });
    tl.innerHTML = rows.length ? rows.map(_item).join('')
      : '<div class="ipn-empty">Ainda sem eventos nesta frente. Cada ação na plataforma passa a aparecer aqui — trilha append-only.</div>';
    var unsub = function(){};
    if(opts.live){
      unsub = subscribe(opts.mandato, async function(ev){
        // busca a projeção humanizada do evento recém-criado (1 leitura) e prepende
        try{
          var sb=SB(); var r=await sb.from('v_ip_timeline_mandato')
            .select('id,ts,event_type,operacao,actor_email,rotulo,tipo_negocio,sujeito,correlation_id').eq('id', ev.id).single();
          var e = r && r.data; if(!e) return;
          var empty = tl.querySelector('.ipn-empty'); if(empty) tl.innerHTML='';
          tl.insertAdjacentHTML('afterbegin', _item(e));
          if(opts.onLive) try{ opts.onLive(e); }catch(_){}
        }catch(_){}
      });
    }
    return unsub;
  }

  window.IpNervo = { subscribe:subscribe, setCorrelation:setCorrelation, withCorrelation:withCorrelation, timeline:timeline, recent:recent };
})();
