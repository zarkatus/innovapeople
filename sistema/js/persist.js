// IpPersist — persistencia MAXIMA de escrita (CVO 30/05: "nada se perde ao salvar").
// retry backoff + fila offline (reenvia ao reconectar) + fila de ERROS permanentes
// (nunca descarta calado) + confirmacao real. IO consciente (sem polling).
(function(){
  'use strict';
  if(window.IpPersist && !window.IpPersist._isShim) return;
  const T=window.TB||{toast:m=>{try{console.log(m)}catch(_){}}};
  const QKEY='ip_persist_queue_v1';
  const FKEY='ip_persist_failed_v1';
  const MAX_RETRY=4;
  const BACKOFF=[400,1200,3000,7000];
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function isOffline(){ return typeof navigator!=='undefined' && navigator.onLine===false; }
  function transient(err){
    if(!err) return false;
    const m=((err.message||err.msg||'')+'').toLowerCase();
    const code=(err.code||err.status||'')+'';
    if(/fetch|network|timeout|timed out|failed to fetch|load failed|econn|503|502|504|429/.test(m)) return true;
    if(['503','502','504','429','ETIMEDOUT','ECONNRESET'].includes(code)) return true;
    if(isOffline()) return true;
    return false;
  }
  function load(k){ try{return JSON.parse(localStorage.getItem(k)||'[]')}catch(_){return []} }
  function save(k,q){ try{localStorage.setItem(k,JSON.stringify(q.slice(0,300)))}catch(_){} }
  function pendingCount(){ return load(QKEY).length; }
  function failedCount(){ return load(FKEY).length; }
  function enqueue(desc){
    if(!desc||!desc.table) return false;
    const q=load(QKEY);
    q.push(Object.assign({_id:Date.now()+'-'+Math.round((performance&&performance.now?performance.now():Math.random()*1e6))},desc));
    save(QKEY,q); _badge(); return true;
  }
  function pushFailed(desc,msg){
    const f=load(FKEY);
    f.push(Object.assign({_failedAt:new Date().toISOString(),_erro:msg||'erro'},desc));
    save(FKEY,f);
  }
  function sbc(){ return window.__IP_SB||window.sb; }
  async function runDesc(d){
    const sb=sbc(); if(!sb) return {error:{message:'sem cliente'}};
    try{
      let qb;
      if(d.op==='insert') qb=sb.from(d.table).insert(d.payload).select();
      else if(d.op==='upsert') qb=sb.from(d.table).upsert(d.payload,d.opts||undefined).select();
      else if(d.op==='update'){ qb=sb.from(d.table).update(d.payload); (d.match||[]).forEach(m=>{qb=qb.eq(m[0],m[1]);}); qb=qb.select(); }
      else if(d.op==='delete'){ qb=sb.from(d.table).delete(); (d.match||[]).forEach(m=>{qb=qb.eq(m[0],m[1]);}); qb=qb.select(); }
      else return {error:{message:'op desconhecida '+d.op}};
      return await qb;
    }catch(e){ return {error:e}; }
  }
  let _draining=false;
  async function drain(){
    if(_draining) return;
    _draining=true;
    try{
      let q=load(QKEY);
      let i=0;
      while(i<q.length){
        const d=q[i];
        const res=await runDesc(d);
        if(res && !res.error){ q.splice(i,1); save(QKEY,q); }
        else if(res && transient(res.error)){ i++; }
        else {
          const msg=(res&&res.error&&res.error.message)||'erro';
          pushFailed(d,msg); q.splice(i,1); save(QKEY,q);
          T.toast('Sincronizacao falhou (erro permanente): '+msg+' — ver pendencias');
        }
      }
      _badge();
    } finally { _draining=false; }
  }
  async function write(builderFn, opts){
    opts=opts||{};
    const label=opts.label||'registro';
    const op=(opts.offline&&opts.offline.op)||'';
    let lastErr=null;
    for(let attempt=0; attempt<=MAX_RETRY; attempt++){
      let res;
      try{ res=await builderFn(); }catch(e){ res={error:e}; }
      if(res && !res.error){
        if(opts.toast!==false) T.toast(label+' salvo');
        if(load(QKEY).length) drain();
        return {ok:true,data:res.data,error:null,queued:false};
      }
      lastErr=res?res.error:{message:'sem resposta'};
      if(!transient(lastErr)) break;
      if(attempt<MAX_RETRY) await sleep(BACKOFF[attempt]||7000);
    }
    if(transient(lastErr) && opts.offline){
      // idempotente (update/delete/upsert): reenfileirar e seguro. INSERT offline-real
      // tambem (request nem saiu). INSERT com timeout ESTANDO online e ambiguo: o
      // servidor pode ter commitado e so a resposta se perdeu -> reenfileirar criaria
      // DUPLICATA. Politica: nao enfileira (evita cadastro duplicado), avisa claramente.
      // Evolucao p/ exactly-once: idempotency-key no payload + ON CONFLICT no servidor.
      const idempotente = (op==='update'||op==='delete'||op==='upsert');
      if(idempotente || isOffline()){
        if(enqueue(opts.offline)){ T.toast(label+': sem conexao — salvo localmente, reenvia ao reconectar'); return {ok:false,error:lastErr,queued:true}; }
      } else {
        T.toast('Falha ao salvar '+label+': resposta perdida. Confira se gravou antes de repetir (evitando duplicar).');
        return {ok:false,error:lastErr,queued:false};
      }
    }
    T.toast('Falha ao salvar '+label+': '+((lastErr&&lastErr.message)||'erro')+' — tente de novo');
    return {ok:false,error:lastErr,queued:false};
  }
  async function retryFailed(){
    const f=load(FKEY); if(!f.length) return;
    save(FKEY,[]);
    const q=load(QKEY); f.forEach(d=>q.push(d)); save(QKEY,q);
    _badge(); await drain();
  }
  function _badge(){
    try{
      const n=pendingCount(), e=failedCount();
      let b=document.getElementById('ip-persist-badge');
      if(!n && !e){ if(b)b.remove(); return; }
      if(!b){ b=document.createElement('div'); b.id='ip-persist-badge'; b.style.cssText='position:fixed;bottom:18px;left:18px;z-index:2147483600;font:600 11px/1 Inter,system-ui;letter-spacing:.04em;padding:8px 13px;border-radius:20px;box-shadow:0 6px 18px rgba(0,0,0,.3);cursor:pointer'; document.body.appendChild(b); }
      if(e){ b.style.background='#5A1F1F'; b.style.color='#F5C9C9'; b.style.border='1px solid rgba(216,117,117,.5)'; b.title='Escritas com erro permanente. Clique para tentar de novo.'; b.textContent='⚠ '+e+' erro(s) ao salvar'+(n?' · '+n+' na fila':''); b.onclick=function(){retryFailed();}; }
      else { b.style.background='#3F2756'; b.style.color='#F5DDA5'; b.style.border='1px solid rgba(245,221,165,.3)'; b.title='Escritas aguardando reenvio. Clique para tentar agora.'; b.textContent='↻ '+n+' p/ sincronizar'; b.onclick=function(){drain();}; }
    }catch(_){}
  }
  if(typeof window!=='undefined'){
    window.addEventListener('online', function(){ if(pendingCount()){ T.toast('Conexao restabelecida — reenviando pendencias'); drain(); } });
    setTimeout(function(){ if(pendingCount()||failedCount()){ _badge(); if(pendingCount())drain(); } }, 1500);
  }
  window.IpPersist={write:write,drain:drain,pendingCount:pendingCount,failedCount:failedCount,retryFailed:retryFailed,_enqueue:enqueue};
})();
