// ToolBox · helpers compartilhados (V1 27/05/2026)
// Diretiva modularização CVO: módulos JS separados, não inline no monolito.
window.TB = {
  esc:(s)=>String(s??'').replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])),
  fmtRel:(d)=>{if(!d)return'—';const t=Date.now()-new Date(d).getTime(),m=Math.floor(t/60000),h=Math.floor(m/60),dd=Math.floor(h/24);if(m<1)return'agora';if(m<60)return m+'min';if(h<24)return h+'h';if(dd<7)return dd+'d';return new Date(d).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})},
  fmtFull:(d)=>d?new Date(d).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—',
  fmtDate:(d)=>d?new Date(d).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}):'—',
  fmtMoney:(v)=>v==null?'—':'R$ '+Number(v).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0}),
  fmtPct:(v)=>v==null?'—':Math.round(Number(v))+'%',
  initials:(s)=>(s||'').split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase()||'·',
  toast:(msg)=>{const t=document.getElementById('toast');if(!t)return;t.textContent=msg;t.classList.add('on');setTimeout(()=>t.classList.remove('on'),2600)},
  safe:async(fn,fallback)=>{try{return await fn()}catch(e){console.warn('[TB.safe]',e);return fallback}},
  // Farol semântico (RapheiceOS-pattern)
  farol:(v,meta,inverse=false)=>{
    if(v==null||meta==null)return{c:'sem-meta',t:'sem meta'};
    const r=inverse?meta/v:v/meta;
    if(r>=1)return{c:'no-alvo',t:'no alvo'};
    if(r>=.85)return{c:'atencao',t:'atenção'};
    return{c:'fora',t:'fora'};
  },
  // Heatmap level 1-5 (skill profile)
  heatLevel:(score)=>{
    if(score==null)return'l1';
    if(score>=8)return'l5';
    if(score>=6)return'l4';
    if(score>=4)return'l3';
    if(score>=2)return'l2';
    return'l1';
  },
  // Empty visual skeleton (RapheiceOS pattern)
  skeleton:(lines=3)=>{
    const ws=['w85','w70','w50','w85','w70'];
    return '<div class="empty-skeleton">'+Array(lines).fill(0).map((_,i)=>`<div class="bar ${ws[i%ws.length]}"></div>`).join('')+'</div>';
  },
};

// Auth gate compartilhado (uso opcional pelas sub-rotas)
window.TBAuth = {
  SUPA_URL:'https://auth.innovasphere.ia.br',
  SUPA_ANON:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxa255aGZycm1icXZrZHNoamZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzY3NjIsImV4cCI6MjA4NzUxMjc2Mn0.FQhTsVKAh_Abei65nJZsuXE7SbAxJ6yndFepeI_pZdA',
  ALLOWED:['raphael@schifino.com.br','gleice@schifino.com.br','rapheice@schifino.com.br'],
  init:(fromKey,onAuth)=>{
    function deny(){location.replace('/sistema/?from='+(fromKey||'toolbox'))}
    function ovl(){if(document.getElementById('ipovl'))return;const o=document.createElement('div');o.id='ipovl';o.innerHTML='<div style="text-align:center"><div style="margin-bottom:14px;font-size:10px;opacity:.6">InnovaPeople · ToolBox</div><div>Validando acesso…</div></div>';(document.body||document.documentElement).appendChild(o)}
    function rmovl(){const o=document.getElementById('ipovl');if(o)o.remove()}
    if(document.body)ovl();else document.addEventListener('DOMContentLoaded',ovl,{once:true});
    const safety=setTimeout(()=>{rmovl();deny()},6000);
    (async()=>{
      try{
        // [perf 30/05] fast-path: token local valido (gate V4) libera sem await getSession
        try{var _k=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.includes('auth-token'));if(_k){var _raw=JSON.parse(localStorage.getItem(_k)||'null');var _ls=_raw&&(_raw.currentSession||_raw.session||_raw);var _em=_ls&&_ls.user&&(_ls.user.email||(_ls.user.user_metadata&&_ls.user.user_metadata.email));var _exp=_ls&&_ls.expires_at?(_ls.expires_at*1000):0;if(_ls&&_ls.access_token&&_em&&(!_exp||_exp>Date.now())&&TBAuth.ALLOWED.includes(_em)){clearTimeout(safety);try{window.__IP_SB=window.supabase.createClient(TBAuth.SUPA_URL,TBAuth.SUPA_ANON,{auth:{persistSession:true,autoRefreshToken:true}});}catch(_){}window.__IP_USER_EMAIL=_em;var _fire=function(){rmovl();if(typeof onAuth==='function')onAuth(_em);if(typeof boot==='function')boot()};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',_fire,{once:true});else _fire();return;}}}catch(_){}
        const sb=window.supabase.createClient(TBAuth.SUPA_URL,TBAuth.SUPA_ANON,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
        window.__IP_SB=sb;
        const {data:{session}}=await sb.auth.getSession();
        if(!session){clearTimeout(safety);deny();return}
        const email=session.user?.email||'';
        if(!TBAuth.ALLOWED.includes(email)){await sb.auth.signOut();clearTimeout(safety);deny();return}
        clearTimeout(safety);
        window.__IP_USER_EMAIL=email;
        const fire=()=>{rmovl();if(typeof onAuth==='function')onAuth(email);if(typeof boot==='function')boot()};
        if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fire,{once:true});
        else fire();
      }catch(e){clearTimeout(safety);deny()}
    })();
  }
};
