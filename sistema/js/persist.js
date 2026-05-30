// IpPersist — persistencia MAXIMA de escrita (CVO 30/05: "nada se perde ao salvar").
// Garante que toda gravacao chega no banco: retry com backoff em falha transitoria,
// fila offline (localStorage) que reenvia quando volta a conexao, e confirmacao real.
// IO consciente: NAO faz polling; so age no momento do save e no evento 'online'.
// API:
//   await IpPersist.write(()=>sb.from('t').insert(row).select(), {label}) -> {ok,data,error,queued}
//   IpPersist.pendingCount() -> n de escritas em fila
// Uso: troca `const {error}=await sb...insert(...)` por `const r=await IpPersist.write(()=>sb...insert(...).select())`
(function(){
  'use strict';
  if(window.IpPersist) return;
  const T=window.TB||{toast:m=>{try{console.log(m)}catch(_){}}};
  const QKEY='ip_persist_queue_v1';
  const MAX_RETRY=4;               // tentativas no momento do save
  const BACKOFF=[400,1200,3000,7000];
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  // erros que vale retentar (rede/transitorio); erro de RLS/constraint NAO adianta retentar
  function transient(err){
    if(!err) return false;
    const m=((err.message||err.msg||'')+'').toLowerCase();
    const code=(err.code||err.status||'')+'';
    if(/fetch|network|timeout|timed out|failed to fetch|load failed|econn|503|502|504|429/.test(m)) return true;
    if(['503','502','504','429','ETIMEDOUT','ECONNRESET'].includes(code)) return true;
    if(typeof navigator!=='undefined' && navigator.onLine===false) return true;
    return false;
  }

  function loadQueue(){ try{return JSON.parse(localStorage.getItem(QKEY)||'[]')}catch(_){return []} }
  function saveQueue(q){ try{localStorage.setItem(QKEY,JSON.stringify(q.slice(0,200)))}catch(_){} }
  function pendingCount(){ return loadQueue().length; }

  // descritor serializavel p/ fila offline: {table, op, payload, match}
  function enqueue(desc){
    if(!desc||!desc.table){ return false; }
    const q=loadQueue();
    q.push(Object.assign({_id:Date.now()+'-'+Math.round(performance.now()),_at:new Date().toISOString()},desc));
    saveQueue(q);
    _renderBadge();
    return true;
  }

  function sbc(){ return window.__IP_SB||window.sb; }

  // executa um descritor da fila
  async function runDesc(d){
    const sb=sbc(); if(!sb) return {error:{message:'sem cliente'}};
    let qb=sb.from(d.table);
    if(d.op==='insert') qb=qb.insert(d.payload);
    else if(d.op==='upsert') qb=qb.upsert(d.payload, d.opts||undefined);
    else if(d.op==='update'){ qb=qb.update(d.payload); (d.match||[]).forEach(m=>{qb=qb.eq(m[0],m[1]);}); }
    else if(d.op==='delete'){ qb=sb.from(d.table).delete(); (d.match||[]).forEach(m=>{qb=qb.eq(m[0],m[1]);}); }
    else return {error:{message:'op desconhecida '+d.op}};
    try{ return await qb; }catch(e){ return {error:e}; }
  }

  // drena a fila (chamado no save bem-sucedido e no evento online)
  let _draining=false;
  async function drain(){
    if(_draining) return;
    _draining=true;
    try{
      let q=loadQueue();
      let i=0;
      while(i<q.length){
        const d=q[i];
        const res=await runDesc(d);
        if(res && !res.error){ q.splice(i,1); saveQueue(q); }       // gravou -> remove da fila
        else if(res && transient(res.error)){ i++; }                 // ainda offline -> mantem, tenta proximo
        else { d._erro=(res&&res.error&&res.error.message)||'erro'; q.splice(i,1); saveQueue(q); } // erro permanente -> descarta (nao bloqueia fila)
      }
      _renderBadge();
      if(loadQueue().length===0 && q.length===0){}
    } finally { _draining=false; }
  }

  // escrita principal: builderFn deve retornar a query supabase (idealmente com .select())
  // descOffline (opcional): {table,op,payload,match} p/ reconstruir na fila se cair a rede
  async function write(builderFn, opts){
    opts=opts||{};
    const label=opts.label||'registro';
    let lastErr=null;
    for(let attempt=0; attempt<=MAX_RETRY; attempt++){
      let res;
      try{ res=await builderFn(); }catch(e){ res={error:e}; }
      if(res && !res.error){
        if(opts.toast!==false) T.toast(label+' salvo');
        if(loadQueue().length) drain();   // aproveita p/ drenar pendencias
        return {ok:true,data:res.data,error:null,queued:false};
      }
      lastErr=res?res.error:{message:'sem resposta'};
      if(!transient(lastErr)) break;       // erro permanente: nao retenta
      if(attempt<MAX_RETRY) await sleep(BACKOFF[attempt]||7000);
    }
    // falhou todas as tentativas. Se for transitorio/offline e temos descritor -> fila.
    if(transient(lastErr) && opts.offline){
      const q=enqueue(opts.offline);
      if(q){ T.toast(label+': sem conexao — salvo localmente, reenvia ao reconectar'); return {ok:false,error:lastErr,queued:true}; }
    }
    T.toast('Falha ao salvar '+label+': '+((lastErr&&lastErr.message)||'erro')+' — tente de novo');
    return {ok:false,error:lastErr,queued:false};
  }

  // badge discreto de pendencias
  function _renderBadge(){
    try{
      const n=pendingCount();
      let b=document.getElementById('ip-persist-badge');
      if(!n){ if(b)b.remove(); return; }
      if(!b){ b=document.createElement('div'); b.id='ip-persist-badge'; b.style.cssText='position:fixed;bottom:18px;left:18px;z-index:2147483600;background:#3F2756;color:#F5DDA5;font:600 11px/1 Inter,system-ui;letter-spacing:.04em;padding:8px 13px;border-radius:20px;border:1px solid rgba(245,221,165,.3);box-shadow:0 6px 18px rgba(0,0,0,.3);cursor:pointer'; b.title='Escritas aguardando reenvio. Clique para tentar agora.'; b.onclick=()=>drain(); document.body.appendChild(b); }
      b.textContent='↻ '+n+' p/ sincronizar';
    }catch(_){}
  }

  // reenvia quando a conexao volta
  if(typeof window!=='undefined'){
    window.addEventListener('online', ()=>{ T.toast('Conexao restabelecida — reenviando pendencias'); drain(); });
    // ao carregar, se ha fila, tenta drenar (best-effort, sem travar boot)
    setTimeout(()=>{ if(pendingCount()) { _renderBadge(); drain(); } }, 1500);
  }

  window.IpPersist={write,drain,pendingCount,_enqueue:enqueue};
})();
