// Sidebar unificado InnovaPeople — catálogo completo + busca fuzzy (cmd+K)
// 27/05/2026 · uso: <link rel="stylesheet" href="/sistema/_shared/sidebar.css">
//                   <script src="/sistema/_shared/sidebar.js" defer></script>

(function(){
  'use strict';

  // ═══ TEMA (dark default / light) — aplica cedo p/ evitar flash ═══
  try{
    const saved=localStorage.getItem('ip_theme')||'dark';
    document.documentElement.setAttribute('data-theme',saved);
  }catch(_){}
  function setTheme(t){
    document.documentElement.setAttribute('data-theme',t);
    try{localStorage.setItem('ip_theme',t)}catch(_){}
    const dk=document.getElementById('sb-theme-dark'),lt=document.getElementById('sb-theme-light');
    if(dk)dk.classList.toggle('on',t==='dark');
    if(lt)lt.classList.toggle('on',t==='light');
  }

  // ═══ CATÁLOGO ═══ (estrutura espelhada da InnovaSphere: categoria > item, sem aninhamento)
  // Cada item: {g (categoria), i (emoji), n (nome), p (path), d (desc), t (tags p/ busca)}
  const CATALOG = [
    // VISÃO GERAL
    {g:'Visão Geral', i:'🏠', n:'Dashboard',          p:'/sistema/',          d:'Visão única · KPIs + raio-x + trabalhos + módulos', t:'home overview painel inicial casa dashboard'},
    {g:'Visão Geral', i:'◆',  n:'ToolBox · Comando',  p:'/sistema/toolbox/',  d:'Hub central · 6 painéis vivos · auto-refresh 60s', t:'toolbox comando hub painel central tier one'},

    // TOOLBOX TIER ONE
    {g:'ToolBox · Tier One', i:'👥', n:'Gente · Mattering',     p:'/sistema/toolbox/gente/',        d:'SAID 4D · Skill Map 6D · Liderança 8D · Pulse · Career · 12 Processos · Rituais · Cultura · Compensation', t:'gente pessoas mattering said skill skills lideranca pulse career carreira rituais cultura compensation equipe rh'},
    {g:'ToolBox · Tier One', i:'🎯', n:'Estratégia · OKRs',     p:'/sistema/toolbox/estrategia/',   d:'OKRs · Projetos delivery · Cronograma · Matriz Riscos · Stakeholders', t:'estrategia okrs objetivos projetos cronograma marcos riscos stakeholders delivery'},
    {g:'ToolBox · Tier One', i:'⚖️', n:'Operações · Compliance',p:'/sistema/toolbox/operacoes/',    d:'Documental · LGPD · RFIs · QA · Financeiro · Audit Trail · Integrations', t:'operacoes compliance lgpd rfis qa financeiro audit trail integrations docs documentos'},
    {g:'ToolBox · Tier One', i:'🔍', n:'Pipeline · Curadoria',  p:'/sistema/toolbox/pipeline/',     d:'Kanban Raio-X · Golden Tickets · Portfólio · Distribuição score', t:'pipeline curadoria kanban raio-x raiox golden tickets convites portfolio leads funil'},
    {g:'ToolBox · Tier One', i:'🤖', n:'Inteligência · IA',     p:'/sistema/toolbox/inteligencia/', d:'5 Agentes IA · 9-Box · Succession · Pulse Analytics · Benchmark KF/Gallup/OHI', t:'inteligencia ia agentes 9box nine-box succession sucessao pulse analytics benchmark korn ferry gallup ohi peakon'},

    // CURADORIA · CHRO
    {g:'Curadoria · CHRO', i:'⌘', n:'Centro de Comando', p:'/sistema/chro/',               d:'39 instrumentos · curadoria de talento · sinal vivo · rituais · governança', t:'chro centro comando curadoria talento rh gente cultura'},
    {g:'Curadoria · CHRO', i:'📈', n:'Painel Mensal',     p:'/sistema/chro/painel-mensal/', d:'OLAP tendências · BI · digest semanal', t:'chro painel mensal olap bi tendencias digest analytics'},
    {g:'Curadoria · CHRO', i:'🗂️', n:'Organograma',        p:'/sistema/chro/organograma/',   d:'Estrutura org dinâmica · badges N0-N5 · export PPTX', t:'organograma estrutura hierarquia cadeiras export pptx'},

    // TRABALHOS
    {g:'Trabalhos', i:'💼', n:'Mandatos',  p:'/sistema/#sec-trabalhos', d:'Trabalhos ativos em curadoria · drill-down por mandato', t:'mandatos trabalhos curadoria clientes empresas contratos'},

    // COMUNICAÇÃO
    {g:'Comunicação', i:'💬', n:'WhatsApp · Inbox', p:'/sistema/whatsapp/',  d:'Inbox unificada · envio · reply · encaminhar · busca · PTT', t:'whatsapp wa inbox mensagens conversas zap chat'},
    {g:'Comunicação', i:'📅', n:'Calendário',       p:'/sistema/calendar.html', d:'Google Calendar integrado · agendamentos Raio-X', t:'calendar calendario google agendamentos eventos reuniao'},

    // INTELIGÊNCIA · GOVERNANÇA
    {g:'Inteligência · Governança', i:'✦',  n:'Agentes IA', p:'/sistema/agentes.html', d:'5 agentes determinísticos · histórico runs · cron 07:30 UTC', t:'agentes ia inteligencia cron pulse anomaly knowledge retention clock drift mattering critic'},
    {g:'Inteligência · Governança', i:'📡', n:'Bastidores · EventBus', p:'/sistema/bastidores/', d:'Trilha imutável append-only · Clock Drift detection · auditoria', t:'bastidores eventbus event bus audit auditoria trilha governanca clock drift'},
  ];
  const CAT_ORDER=['Visão Geral','ToolBox · Tier One','Curadoria · CHRO','Trabalhos','Comunicação','Inteligência · Governança'];

  // ═══ AUTH CONTEXT ═══
  // Pega email do localStorage Supabase ou da sessão se sb global existir
  function getCurrentEmail(){
    try{
      if(window.__IP_USER_EMAIL) return window.__IP_USER_EMAIL;
      const k=Object.keys(localStorage).find(k=>k.includes('auth-token'));
      if(!k) return null;
      const v=JSON.parse(localStorage.getItem(k)||'{}');
      return v?.user?.email || v?.currentSession?.user?.email || null;
    }catch(_){return null}
  }

  function getInitials(email){
    if(!email) return '·';
    const local=email.split('@')[0];
    return (local.slice(0,2)||'·').toUpperCase();
  }

  async function doLogout(){
    try{
      if(window.__IP_SB){await window.__IP_SB.auth.signOut()}
      else if(window.sb){await window.sb.auth.signOut()}
    }catch(_){}
    location.replace('/sistema/');
  }

  // ═══ FUZZY SEARCH ═══
  // Score = quantos tokens da query batem em label/desc/tags
  function fuzzyScore(item, query){
    if(!query) return 1;
    const q=query.toLowerCase().trim();
    const tokens=q.split(/\s+/).filter(Boolean);
    const haystack=(item.n+' '+item.d+' '+item.t+' '+item.g).toLowerCase();
    let score=0;
    for(const t of tokens){
      if(haystack.includes(t)){
        score+=1;
        if(item.n.toLowerCase().includes(t))score+=2; // bonus se bate no nome
        if(item.t.toLowerCase().split(/\s+/).includes(t))score+=1; // bonus se bate em tag exata
      }else{
        // fuzzy char-by-char (mais permissivo)
        let hi=0, miss=0;
        for(const c of t){
          const i=haystack.indexOf(c,hi);
          if(i<0){miss++;break}
          hi=i+1;
        }
        if(!miss)score+=0.5;
      }
    }
    return score;
  }

  function highlightMatch(text, query){
    if(!query) return escapeHtml(text);
    const tokens=query.toLowerCase().trim().split(/\s+/).filter(t=>t.length>1);
    let html=escapeHtml(text);
    for(const t of tokens){
      const re=new RegExp('('+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig');
      html=html.replace(re,'<mark>$1</mark>');
    }
    return html;
  }

  function escapeHtml(s){return String(s??'').replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]))}

  // ═══ RENDER SIDEBAR ═══
  function renderSidebar(){
    // Detecta página ativa
    const path=location.pathname.replace(/\/+$/,'/')||'/';
    function isActive(p){
      const a=p.split('?')[0].split('#')[0].replace(/\/+$/,'/');
      if(a===path)return true;
      if(a!=='/sistema/' && path.startsWith(a))return true;
      return false;
    }

    // Agrupa por g
    const groups={};
    for(const it of CATALOG){if(!groups[it.g])groups[it.g]=[];groups[it.g].push(it)}

    const navHtml=CAT_ORDER.map(g=>!groups[g]?'':`
      <div class="sb-cat">
        <div class="sb-cat-h">${escapeHtml(g)}</div>
        ${groups[g].map(it=>`
          <a class="sb-link${isActive(it.p)?' active':''}" href="${escapeHtml(it.p)}" data-id="${escapeHtml(it.n)}">
            <span class="sb-ic">${it.i}</span>
            <span class="sb-txt">${escapeHtml(it.n)}</span>
          </a>
        `).join('')}
      </div>
    `).join('');

    const email=getCurrentEmail();
    const name=email?email.split('@')[0]:'—';
    const role=email==='raphael@schifino.com.br'?'CVO':(email?'Sócia':'—');

    const isCollapsed=localStorage.getItem('ip_sb_collapsed')==='1';
    document.body.classList.toggle('ip-sb-collapsed',isCollapsed);
    document.body.classList.add('ip-has-sidebar');

    const aside=document.createElement('aside');
    aside.id='ip-sidebar';
    aside.innerHTML=`
      <div class="sb-head">
        <svg class="logo" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="16" cy="16" r="14"/><path d="M16 6 v20 M6 16 h20"/></svg>
        <div class="txt">
          <div class="wm">innova<em>·</em>people</div>
          <div class="sub">Tier One</div>
        </div>
      </div>
      <button class="sb-collapse" id="sb-collapse" title="Recolher (Ctrl+B)">${isCollapsed?'›':'‹'}</button>
      <div class="sb-search">
        <svg class="sb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
        <input type="text" id="sb-search-input" placeholder="Buscar… (Ctrl+K)" autocomplete="off">
        <span class="sb-kbd">⌘K</span>
      </div>
      <nav class="sb-nav">${navHtml}</nav>
      <div class="sb-foot">
        <div class="sb-user">
          <div class="av">${escapeHtml(getInitials(email))}</div>
          <div class="nm"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(role)}</small></div>
          <button class="sb-out" onclick="window.IpSidebar.logout()">SAIR</button>
        </div>
        <div class="sb-theme">
          <button id="sb-theme-dark" onclick="window.IpSidebar.theme('dark')" title="Modo escuro">◑ <span>Escuro</span></button>
          <button id="sb-theme-light" onclick="window.IpSidebar.theme('light')" title="Modo claro">◐ <span>Claro</span></button>
        </div>
      </div>
    `;
    document.body.insertBefore(aside,document.body.firstChild);

    // Mobile toggle button
    if(window.innerWidth<=880){
      const tg=document.createElement('button');
      tg.className='ip-sb-toggle';
      tg.innerHTML='☰';
      tg.onclick=()=>document.body.classList.toggle('ip-sb-mobile-open');
      document.body.appendChild(tg);
    }

    // Bindings
    document.getElementById('sb-collapse').onclick=()=>{
      const c=document.body.classList.toggle('ip-sb-collapsed');
      localStorage.setItem('ip_sb_collapsed',c?'1':'0');
      document.getElementById('sb-collapse').textContent=c?'›':'‹';
    };
    // search inline filtra sidebar
    const inp=document.getElementById('sb-search-input');
    inp.addEventListener('focus',openCmdk);
    inp.addEventListener('click',openCmdk);

    // V3 28/05: preserva posição de scroll do sidebar entre navegações (multi-page).
    // Antes, ao clicar numa aba a nova página remontava o sidebar no topo — irritante.
    const nav=aside.querySelector('.sb-nav');
    if(nav){
      // restaura
      try{const s=sessionStorage.getItem('ip_sb_scroll');if(s)nav.scrollTop=parseInt(s,10)||0;}catch(_){}
      // salva on scroll (throttled)
      let raf=0;
      nav.addEventListener('scroll',()=>{
        if(raf)return;
        raf=requestAnimationFrame(()=>{raf=0;try{sessionStorage.setItem('ip_sb_scroll',String(nav.scrollTop))}catch(_){}});
      });
      // salva antes de navegar por link
      nav.addEventListener('click',e=>{
        const a=e.target.closest('a.sb-link');
        if(a){try{sessionStorage.setItem('ip_sb_scroll',String(nav.scrollTop))}catch(_){}}
      });
    }
  }

  // ═══ COMMAND PALETTE (cmd+K) ═══
  let cmdkOpen=false, cmdkResults=[], cmdkSel=0;
  function buildCmdk(){
    if(document.getElementById('ip-cmdk'))return;
    const m=document.createElement('div');
    m.id='ip-cmdk';
    m.innerHTML=`
      <div class="pal" id="ip-cmdk-pal">
        <div class="pal-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
          <input type="text" id="ip-cmdk-input" placeholder="Busque qualquer ferramenta… (ex: mattering, pulse, kanban, organograma…)" autocomplete="off">
          <span class="esc">ESC</span>
        </div>
        <div class="pal-list" id="ip-cmdk-list"></div>
        <div class="pal-foot">
          <span><kbd>↑↓</kbd> navegar</span>
          <span><kbd>↵</kbd> abrir</span>
          <span><kbd>esc</kbd> fechar</span>
        </div>
      </div>
    `;
    document.body.appendChild(m);
    m.addEventListener('click',e=>{if(e.target===m)closeCmdk()});
    document.getElementById('ip-cmdk-input').addEventListener('input',renderCmdkList);
    document.getElementById('ip-cmdk-input').addEventListener('keydown',handleCmdkKey);
    renderCmdkList();
  }

  function openCmdk(){
    if(cmdkOpen)return;
    buildCmdk();
    cmdkOpen=true;cmdkSel=0;
    document.getElementById('ip-cmdk').classList.add('on');
    document.getElementById('ip-cmdk-input').value='';
    document.getElementById('ip-cmdk-input').focus();
    renderCmdkList();
  }
  function closeCmdk(){
    cmdkOpen=false;
    const m=document.getElementById('ip-cmdk');if(m)m.classList.remove('on');
    document.getElementById('sb-search-input')?.blur();
  }
  function renderCmdkList(){
    const q=(document.getElementById('ip-cmdk-input')?.value||'').trim();
    const scored=CATALOG.map(it=>({it,s:fuzzyScore(it,q)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s);
    cmdkResults=scored.map(x=>x.it);
    cmdkSel=0;
    const list=document.getElementById('ip-cmdk-list');
    if(!cmdkResults.length){list.innerHTML='<div class="pal-empty">Nada encontrado. Tente: mattering, pulse, organograma, agentes, kanban…</div>';return}
    // agrupa por g
    const byGroup={};
    for(const it of cmdkResults){if(!byGroup[it.g])byGroup[it.g]=[];byGroup[it.g].push(it)}
    let html='', idx=0;
    for(const g of Object.keys(byGroup)){
      html+=`<div class="pal-cat">${escapeHtml(g)}</div>`;
      for(const it of byGroup[g]){
        html+=`<div class="pal-item${idx===cmdkSel?' sel':''}" data-i="${idx}" onclick="window.IpSidebar.cmdkGo(${idx})">
          <div class="pal-ic">${escapeHtml(it.i)}</div>
          <div class="pal-body">
            <div class="pal-nm">${highlightMatch(it.n,q)}</div>
            <div class="pal-desc">${highlightMatch(it.d,q)}</div>
          </div>
          <div class="pal-path">${escapeHtml(it.p)}</div>
        </div>`;
        idx++;
      }
    }
    list.innerHTML=html;
  }
  function handleCmdkKey(e){
    if(e.key==='Escape'){e.preventDefault();closeCmdk();return}
    if(e.key==='ArrowDown'){e.preventDefault();cmdkSel=Math.min(cmdkResults.length-1,cmdkSel+1);updateCmdkSel();return}
    if(e.key==='ArrowUp'){e.preventDefault();cmdkSel=Math.max(0,cmdkSel-1);updateCmdkSel();return}
    if(e.key==='Enter'){e.preventDefault();cmdkGo(cmdkSel);return}
  }
  function updateCmdkSel(){
    document.querySelectorAll('#ip-cmdk-list .pal-item').forEach((el,i)=>{
      el.classList.toggle('sel',i===cmdkSel);
      if(i===cmdkSel)el.scrollIntoView({block:'nearest'});
    });
  }
  function cmdkGo(i){
    const it=cmdkResults[i];if(!it)return;
    closeCmdk();
    location.href=it.p;
  }

  // ═══ HOTKEYS ═══
  document.addEventListener('keydown',e=>{
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){
      e.preventDefault();
      cmdkOpen?closeCmdk():openCmdk();
    }
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='b'){
      e.preventDefault();
      document.getElementById('sb-collapse')?.click();
    }
  });

  // ═══ BOOT ═══
  // Botão WhatsApp flutuante elegante (global, exceto na própria página WhatsApp)
  function buildWaFab(){
    if(document.getElementById('ip-wa-fab'))return;
    const onWa=location.pathname.includes('/whatsapp');
    if(onWa){document.body.classList.add('ip-wa-page');return;}
    const a=document.createElement('a');
    a.id='ip-wa-fab';a.href='/sistema/whatsapp/';a.title='Abrir WhatsApp';
    a.innerHTML=`<span class="wa-badge" id="ip-wa-badge"></span>
      <span class="wa-ico"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.03-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.371-.025-.52-.075-.149-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/></svg></span>
      <span class="wa-tx"><b>WhatsApp</b><span>conversas vivas</span></span>`;
    document.body.appendChild(a);
    // badge de não-lidas (best-effort via supabase)
    try{
      const sb=window.__IP_SB||window.sb;
      if(sb)sb.from('wa_conversa').select('nao_lidas').gt('nao_lidas',0).then(({data})=>{
        const total=(data||[]).reduce((a,c)=>a+(c.nao_lidas||0),0);
        const b=document.getElementById('ip-wa-badge');
        if(b&&total>0){b.textContent=total>99?'99+':total;b.classList.add('on')}
      }).catch(()=>{});
    }catch(_){}
  }

  function boot(){
    if(document.getElementById('ip-sidebar'))return;
    renderSidebar();
    buildCmdk();
    buildWaFab();
    syncThemeButtons();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();

  // Atualiza user no footer (chamado pós-login pelo dashboard)
  function refreshUser(email){
    const av=document.querySelector('#ip-sidebar .sb-foot .av');
    const nm=document.querySelector('#ip-sidebar .sb-foot .nm strong');
    const rl=document.querySelector('#ip-sidebar .sb-foot .nm small');
    const e=email||getCurrentEmail();
    if(av)av.textContent=getInitials(e);
    if(nm)nm.textContent=e?e.split('@')[0]:'—';
    if(rl)rl.textContent=e==='raphael@schifino.com.br'?'CVO':(e?'Sócia':'—');
  }

  // marca o toggle ativo após montar
  function syncThemeButtons(){
    const t=document.documentElement.getAttribute('data-theme')||'dark';
    const dk=document.getElementById('sb-theme-dark'),lt=document.getElementById('sb-theme-light');
    if(dk)dk.classList.toggle('on',t==='dark');
    if(lt)lt.classList.toggle('on',t==='light');
  }

  // Expose
  window.IpSidebar={open:openCmdk,close:closeCmdk,cmdkGo,logout:doLogout,catalog:CATALOG,refresh:refreshUser,theme:setTheme};
})();
