// InnovaPeople · Biblioteca de UI reutilizável (IP-3 + IP-4 · PQV-01 03/06)
// Primitivos vanilla que hoje são reinventados ad-hoc em cada tela (kpi/badge/btn/field
// existem 3× diferentes em pessoas/resultado/folha). Centraliza + adiciona ARIA + usa os
// tokens var(--ip-*). NÃO reescreve as telas existentes (já verificadas) — é para USO
// INCREMENTAL: telas novas e refactors usam window.IpUI.*. Inclui EmptyState e Skeleton (IP-4).
// API: window.IpUI = { esc, kpi, badge, btn, field, select, emptyState, skeleton, toast, modal }
(function(){
  'use strict';
  if(window.IpUI) return;
  var esc = function(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); };

  // ---- KPI (tom via token) ----
  function kpi(label,val,opts){
    opts=opts||{}; var cor=opts.color||'var(--ip-gold-lum)';
    return '<div role="group" aria-label="'+esc(label)+'" style="flex:1;min-width:118px;background:var(--ip-bg-card);border:1px solid rgba(210,174,100,.18);border-radius:14px;padding:14px 16px;box-shadow:0 6px 18px rgba(0,0,0,.25)">'
      +'<div style="font:600 11px/1 system-ui;letter-spacing:.08em;text-transform:uppercase;color:var(--ip-ink-3)">'+esc(label)+'</div>'
      +'<div style="font:700 italic 26px Georgia;color:'+cor+';margin-top:6px">'+(val==null?'—':val)+'</div></div>';
  }
  // ---- Badge ----
  function badge(txt,cor){ cor=cor||'var(--ip-gold-lum)'; return '<span style="font:600 11px/1 system-ui;padding:5px 10px;border-radius:20px;color:'+cor+';background:color-mix(in srgb,'+cor+' 16%,transparent);border:1px solid color-mix(in srgb,'+cor+' 40%,transparent)">'+esc(txt)+'</span>'; }
  // ---- Button ----
  function btn(id,txt,kind){
    var base='font:600 13px/1 system-ui;padding:11px 18px;border-radius:11px;cursor:pointer;border:1px solid;transition:.15s';
    if(kind==='primary') return '<button id="'+id+'" style="'+base+';background:var(--ip-gold);color:var(--ip-bg-deep);border-color:var(--ip-gold-lum)">'+txt+'</button>';
    if(kind==='danger')  return '<button id="'+id+'" style="'+base+';background:color-mix(in srgb,var(--ip-danger-2) 18%,transparent);color:var(--ip-danger);border-color:color-mix(in srgb,var(--ip-danger-2) 45%,transparent)">'+txt+'</button>';
    return '<button id="'+id+'" style="'+base+';background:transparent;color:var(--ip-gold-lum);border-color:rgba(210,174,100,.4)">'+txt+'</button>';
  }
  // ---- Field / Select (com label + aria) ----
  function field(label,id,val,type,ph){
    return '<label style="display:block;margin-bottom:13px"><span style="display:block;font:600 11px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-ink-3);margin-bottom:6px">'+esc(label)+'</span>'
      +'<input id="'+id+'" type="'+(type||'text')+'" value="'+(val==null?'':esc(val))+'" placeholder="'+esc(ph||'')+'" aria-label="'+esc(label)+'" style="width:100%;background:var(--ip-bg-deep);border:1px solid rgba(210,174,100,.25);border-radius:10px;padding:10px 13px;color:var(--ip-cream);font-size:14px"/></label>';
  }
  function select(label,id,val,opts){
    return '<label style="display:block;margin-bottom:13px"><span style="display:block;font:600 11px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:var(--ip-ink-3);margin-bottom:6px">'+esc(label)+'</span>'
      +'<select id="'+id+'" aria-label="'+esc(label)+'" style="width:100%;background:var(--ip-bg-deep);border:1px solid rgba(210,174,100,.25);border-radius:10px;padding:10px 13px;color:var(--ip-cream);font-size:14px">'
      +opts.map(function(o){return '<option value="'+esc(o[0])+'"'+(String(val)===String(o[0])?' selected':'')+'>'+esc(o[1])+'</option>';}).join('')+'</select></label>';
  }
  // ---- EmptyState (IP-4) ----
  function emptyState(o){
    o=o||{};
    return '<div role="status" style="padding:44px 28px;text-align:center;border:1px dashed rgba(210,174,100,.2);border-radius:14px">'
      +(o.icon?'<div style="font-size:34px;margin-bottom:10px;opacity:.8">'+o.icon+'</div>':'')
      +(o.eyebrow?'<div style="font:600 10.5px/1 system-ui;letter-spacing:.12em;text-transform:uppercase;color:var(--ip-gold);margin-bottom:8px">'+esc(o.eyebrow)+'</div>':'')
      +'<div style="font:600 italic 18px Georgia;color:var(--ip-cream);margin-bottom:6px">'+esc(o.title||'Nada por aqui ainda')+'</div>'
      +(o.description?'<div style="color:var(--ip-ink-3);font-size:13px;max-width:380px;margin:0 auto 14px">'+esc(o.description)+'</div>':'')
      +(o.actionHtml||'')+'</div>';
  }
  // ---- Skeleton loader (IP-4) ----
  function skeleton(rows){
    rows=rows||3; var bars='';
    for(var i=0;i<rows;i++){ var w=60+Math.round(((i*37)%35)); bars+='<div class="ip-sk" style="height:14px;width:'+w+'%;border-radius:7px;margin:10px 0"></div>'; }
    return '<div aria-busy="true" aria-label="Carregando" style="padding:18px 4px">'+bars+'</div>';
  }
  // injeta a animação do skeleton 1×
  (function injectSkeletonCss(){
    if(document.getElementById('ip-ui-css')) return;
    var st=document.createElement('style'); st.id='ip-ui-css';
    st.textContent='.ip-sk{background:linear-gradient(90deg,rgba(210,174,100,.06),rgba(210,174,100,.16),rgba(210,174,100,.06));background-size:200% 100%;animation:ipSk 1.3s ease-in-out infinite}@keyframes ipSk{0%{background-position:200% 0}100%{background-position:-200% 0}}@media (prefers-reduced-motion:reduce){.ip-sk{animation:none}}';
    (document.head||document.documentElement).appendChild(st);
  })();
  // ---- Toast (usa TB.toast se existir; senão cria efêmero acessível) ----
  function toast(msg,opts){
    if(window.TB && window.TB.toast){ try{ return window.TB.toast(msg); }catch(_){}}
    var t=document.createElement('div'); t.setAttribute('role','status'); t.setAttribute('aria-live','polite');
    t.style.cssText='position:fixed;bottom:22px;left:50%;transform:translateX(-50%);z-index:2147483600;background:var(--ip-bg-card);color:var(--ip-cream);border:1px solid rgba(210,174,100,.35);border-radius:10px;padding:11px 16px;font:500 13px/1.3 system-ui;box-shadow:0 8px 24px rgba(0,0,0,.4);max-width:80vw';
    t.textContent=msg; document.body.appendChild(t);
    setTimeout(function(){ t.style.transition='opacity .4s'; t.style.opacity='0'; setTimeout(function(){t.remove();},400); }, (opts&&opts.ms)||4200);
  }
  // ---- Modal acessível (Escape, backdrop click, aria-modal, foco) ----
  function modal(html,opts){
    opts=opts||{};
    var ov=document.createElement('div'); ov.className='ip-modal-ov';
    ov.style.cssText='position:fixed;inset:0;background:rgba(3,7,12,.66);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px';
    var box=document.createElement('div'); box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true');
    if(opts.label) box.setAttribute('aria-label',opts.label);
    box.style.cssText='width:'+(opts.width||'min(520px,100%)')+';max-height:90vh;overflow-y:auto;background:var(--ip-bg);border:1px solid rgba(210,174,100,.25);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.5);padding:24px 26px';
    box.innerHTML=html; ov.appendChild(box); document.body.appendChild(ov);
    function close(){ document.removeEventListener('keydown',onKey); ov.remove(); if(opts.onClose)opts.onClose(); }
    function onKey(e){ if(e.key==='Escape') close(); }
    ov.addEventListener('click',function(e){ if(e.target===ov && opts.dismissable!==false) close(); });
    document.addEventListener('keydown',onKey);
    var f=box.querySelector('input,select,textarea,button'); if(f) try{f.focus();}catch(_){}
    return { close:close, box:box };
  }

  window.IpUI = { esc:esc, kpi:kpi, badge:badge, btn:btn, field:field, select:select, emptyState:emptyState, skeleton:skeleton, toast:toast, modal:modal };
})();
