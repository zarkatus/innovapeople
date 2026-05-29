// ═══════════════════════════════════════════════════════════════════
// IpSkillMap — FERRAMENTA real de mapa de competências 6D (CRUD). Modular.
// Schema real: ip_perfil_colaborador (pessoas) + ip_skill_map (6 dims:
// tecnica/orquestracao/julgamento/relacao/ia_automacao/gestao + score_total).
// Reconversão: skill baixa + automatizabilidade alta = risco.
// API: window.IpSkillMap.open(container)
// ═══════════════════════════════════════════════════════════════════
(function(){
  'use strict';
  if(window.IpSkillMap) return;
  const sb=()=>window.__IP_SB||window.sb;
  const T=window.TB||{esc:s=>String(s??''),fmtRel:s=>s,safe:async(f,fb)=>{try{return await f()}catch(e){return fb}},toast:m=>alert(m)};
  const esc=T.esc;

  const DIMS=[
    {k:'s_tecnica',ab:'TC',n:'Técnica'},
    {k:'s_orquestracao',ab:'OR',n:'Orquestração'},
    {k:'s_julgamento',ab:'JU',n:'Julgamento'},
    {k:'s_relacao',ab:'RE',n:'Relação'},
    {k:'s_ia_automacao',ab:'IA',n:'IA / Automação'},
    {k:'s_gestao',ab:'GE',n:'Gestão'},
  ];
  let _s={tab:'mapa',mandato:null,mandatos:[],perfis:[],skills:{}};

  async function open(container){
    _s.root=container;
    container.innerHTML=`<div id="sk-root">
      <div class="sk-tabs">
        <button class="sk-tab" data-t="mapa">Mapa de Competências</button>
        <button class="sk-tab" data-t="avaliar">Cadastrar / Avaliar</button>
        <button class="sk-tab" data-t="reconversao">Reconversão</button>
      </div>
      <div id="sk-body"><div class="empty-skeleton"><div class="bar w85"></div><div class="bar w70"></div><div class="bar w50"></div></div></div>
    </div>`;
    container.querySelectorAll('.sk-tab').forEach(b=>b.onclick=()=>go(b.dataset.t));
    const {data}=await T.safe(()=>sb().from('v_ip_mandatos_overview').select('id,empresa,setor,status').order('created_at',{ascending:false}).limit(50),{data:[]});
    _s.mandatos=data||[]; _s.mandato=_s.mandatos[0]?.id||null;
    await reload(); go('mapa');
  }

  async function reload(){
    if(!_s.mandato){_s.perfis=[];_s.skills={};return}
    const [p,sk]=await Promise.all([
      T.safe(()=>sb().from('ip_perfil_colaborador').select('*').eq('mandato_id',_s.mandato).order('created_at',{ascending:false}),{data:[]}),
      T.safe(()=>sb().from('ip_skill_map').select('*').eq('mandato_id',_s.mandato),{data:[]}),
    ]);
    _s.perfis=p.data||[];
    _s.skills={};(sk.data||[]).forEach(s=>{_s.skills[s.perfil_id]=s});
  }

  function go(tab){
    _s.tab=tab;
    _s.root.querySelectorAll('.sk-tab').forEach(b=>b.classList.toggle('on',b.dataset.t===tab));
    if(tab==='mapa')renderMapa();else if(tab==='avaliar')renderAvaliar();else renderRecon();
  }

  function mandatoSel(){
    if(!_s.mandatos.length)return `<div class="sk-warn">Nenhum trabalho ativo. Crie um trabalho no <a href="/sistema/" style="color:var(--gold)">Dashboard</a> antes de mapear competências.</div>`;
    return `<select id="sk-mand" onchange="IpSkillMap._setMandato(this.value)" class="sk-select">
      ${_s.mandatos.map(m=>`<option value="${esc(m.id)}" ${m.id===_s.mandato?'selected':''}>${esc(m.empresa||'(sem nome)')} · ${esc(m.setor||'—')}</option>`).join('')}
    </select>`;
  }
  function lvl(v){if(v==null)return'l1';if(v>=5)return'l5';if(v>=4)return'l4';if(v>=3)return'l3';if(v>=2)return'l2';return'l1'}

  // ─── MAPA (heatmap) ───
  async function renderMapa(){
    const b=document.getElementById('sk-body');
    let html=`<div style="margin-bottom:16px">${mandatoSel()}</div>`;
    if(!_s.perfis.length){
      html+=`<div class="sk-empty">Nenhum colaborador mapeado neste trabalho. Vá em <strong>Cadastrar / Avaliar</strong> para começar.</div>`;
      await _mount(b,html);return;
    }
    // cabeçalho dimensões
    html+=`<div style="display:grid;grid-template-columns:1.4fr repeat(6,1fr) .7fr;gap:6px;align-items:center;margin-bottom:8px;font-family:var(--mono);font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold-deep);font-weight:700">
      <div>Colaborador</div>${DIMS.map(d=>`<div style="text-align:center" title="${esc(d.n)}">${d.ab}</div>`).join('')}<div style="text-align:center">Σ</div></div>`;
    _s.perfis.forEach(p=>{
      const s=_s.skills[p.id];
      const cells=DIMS.map(d=>{const v=s?s[d.k]:null;return `<div class="heat-cell ${lvl(v)}" title="${esc(d.n)}: ${v??'—'}">${v??'·'}</div>`}).join('');
      const tot=s?s.s_score_total:null;
      html+=`<div style="display:grid;grid-template-columns:1.4fr repeat(6,1fr) .7fr;gap:6px;align-items:center;margin-bottom:6px">
        <div style="min-width:0"><div style="font-size:13px;color:var(--cream);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.rotulo||p.papel||'(sem rótulo)')}</div><div style="font-size:10.5px;color:var(--cream-dim)">${esc(p.equipe||'—')}</div></div>
        ${cells}
        <div style="text-align:center;font-family:var(--serif);font-style:italic;font-size:18px;color:${tot>=24?'var(--ok)':(tot>=15?'var(--warn)':'var(--danger)')}">${tot??'—'}</div>
      </div>`;
    });
    html+=`<div style="margin-top:14px;display:flex;gap:6px;align-items:center;font-size:10px;color:var(--cream-dim);font-family:var(--mono)">
      Níveis: <span class="heat-cell l1" style="width:18px;height:18px">1</span><span class="heat-cell l2" style="width:18px;height:18px">2</span><span class="heat-cell l3" style="width:18px;height:18px">3</span><span class="heat-cell l4" style="width:18px;height:18px">4</span><span class="heat-cell l5" style="width:18px;height:18px">5</span> · Σ = soma /30</div>`;
    await _mount(b,html);
  }

  // ─── AVALIAR (CRUD) ───
  function renderAvaliar(){
    const b=document.getElementById('sk-body');
    b.innerHTML=`<div style="margin-bottom:16px">${mandatoSel()}</div>
      <div style="display:grid;grid-template-columns:1fr 1.3fr;gap:24px">
        <div>
          <div class="sk-h">Novo colaborador</div>
          <div class="sk-field"><label>Rótulo / nome interno</label><input id="sk-rotulo" placeholder="ex.: Líder de Engenharia, Ana (Comercial)"></div>
          <div class="sk-field"><label>Equipe</label><input id="sk-equipe" placeholder="ex.: Engenharia"></div>
          <div class="sk-field"><label>Papel</label><input id="sk-papel" placeholder="ex.: liderança / IC"></div>
          <div class="sk-field"><label>Automatizabilidade (%)</label><input id="sk-auto" type="number" min="0" max="100" value="0"></div>
          <div class="sk-field"><label>Tempo de casa (meses)</label><input id="sk-tempo" type="number" min="0" value="0"></div>
          <button class="sk-btn" onclick="IpSkillMap._criarPerfil()" id="sk-criar-btn">Cadastrar colaborador</button>
        </div>
        <div>
          <div class="sk-h">Avaliar competências 6D</div>
          <div class="sk-field"><label>Colaborador</label><select id="sk-perfil-sel" class="sk-select" onchange="IpSkillMap._loadSkillForm(this.value)">
            <option value="">— selecione —</option>
            ${_s.perfis.map(p=>`<option value="${esc(p.id)}">${esc(p.rotulo||p.papel||'(sem rótulo)')} · ${esc(p.equipe||'')}</option>`).join('')}
          </select></div>
          <div id="sk-sliders"></div>
        </div>
      </div>`;
  }

  function _loadSkillForm(perfilId){
    const wrap=document.getElementById('sk-sliders');
    if(!perfilId){wrap.innerHTML='<div class="sk-empty" style="padding:20px">Selecione um colaborador para avaliar.</div>';return}
    const s=_s.skills[perfilId]||{};
    wrap.innerHTML=DIMS.map(d=>{
      const v=s[d.k]||3;
      return `<div class="sk-slider-row"><label>${esc(d.n)}</label>
        <div class="sk-scale" data-k="${d.k}">${[1,2,3,4,5].map(n=>`<button class="${n<=v?'on':''}" onclick="IpSkillMap._pick('${d.k}',${n},this)">${n}</button>`).join('')}</div></div>`;
    }).join('')+`<button class="sk-btn" style="margin-top:12px" onclick="IpSkillMap._salvarSkill('${esc(perfilId)}')">Salvar avaliação 6D</button>`;
    wrap.dataset.perfil=perfilId;
    wrap._vals={};DIMS.forEach(d=>wrap._vals[d.k]=s[d.k]||3);
  }
  function _pick(k,n,btn){
    const wrap=document.getElementById('sk-sliders');wrap._vals=wrap._vals||{};wrap._vals[k]=n;
    const scale=btn.parentElement;Array.from(scale.children).forEach((b,i)=>b.classList.toggle('on',i<n));
  }
  async function _salvarSkill(perfilId){
    const wrap=document.getElementById('sk-sliders');const v=wrap._vals||{};
    const total=DIMS.reduce((a,d)=>a+(v[d.k]||0),0);
    const row={mandato_id:_s.mandato,perfil_id:perfilId};
    DIMS.forEach(d=>row[d.k]=v[d.k]||null);
    try{
      const existing=_s.skills[perfilId];
      let res;
      if(existing)res=await sb().from('ip_skill_map').update(row).eq('id',existing.id);
      else res=await sb().from('ip_skill_map').insert(row);
      if(res.error)throw res.error;
      T.toast('Avaliação salva (Σ '+total+'/30)');
      await reload();go('mapa');
    }catch(e){T.toast('Erro: '+(e.message||e))}
  }

  async function _criarPerfil(){
    if(!_s.mandato){T.toast('Selecione um trabalho');return}
    const rotulo=(document.getElementById('sk-rotulo')?.value||'').trim();
    if(!rotulo){T.toast('Informe o rótulo/nome');return}
    const btn=document.getElementById('sk-criar-btn');btn.disabled=true;btn.textContent='Cadastrando…';
    try{
      const {error}=await sb().from('ip_perfil_colaborador').insert({
        mandato_id:_s.mandato,rotulo,
        equipe:(document.getElementById('sk-equipe')?.value||'').trim()||null,
        papel:(document.getElementById('sk-papel')?.value||'').trim()||null,
        automatizabilidade_pct:parseInt(document.getElementById('sk-auto')?.value||'0',10)||0,
        tempo_casa_meses:parseInt(document.getElementById('sk-tempo')?.value||'0',10)||0,
      });
      if(error)throw error;
      T.toast('Colaborador cadastrado');
      await reload();renderAvaliar();
    }catch(e){T.toast('Erro: '+(e.message||e))}
    finally{btn.disabled=false;btn.textContent='Cadastrar colaborador'}
  }

  // ─── RECONVERSÃO ───
  function renderRecon(){
    const b=document.getElementById('sk-body');
    let html=`<div style="margin-bottom:16px">${mandatoSel()}</div>
      <div style="font-family:var(--serif);font-style:italic;color:var(--cream-muted);font-size:14px;margin-bottom:16px;max-width:640px">Reconversão antecipa quem precisa de desenvolvimento: alta automatizabilidade do papel + competências defasadas = janela para reconverter antes que vire risco. Quanto maior o gap, mais urgente.</div>`;
    if(!_s.perfis.length){html+=`<div class="sk-empty">Sem colaboradores mapeados.</div>`;b.innerHTML=html;return}
    const rows=_s.perfis.map(p=>{
      const s=_s.skills[p.id];
      const score=s?s.s_score_total:0;
      const auto=p.automatizabilidade_pct||0;
      // índice de reconversão: alta auto + baixo score = urgente
      const idx=Math.round(auto*0.6+(30-score)/30*100*0.4);
      return {p,s,score,auto,idx};
    }).sort((a,b)=>b.idx-a.idx);
    html+=rows.map(r=>{
      const sev=r.idx>=60?'danger':(r.idx>=40?'warn':'ok');
      const lab=r.idx>=60?'reconverter já':(r.idx>=40?'planejar':'estável');
      return `<div class="row-item"><div class="ico">${esc((r.p.rotulo||'?').slice(0,2).toUpperCase())}</div><div class="body"><div class="nm">${esc(r.p.rotulo||r.p.papel||'(sem rótulo)')}</div><div class="desc">${esc(r.p.equipe||'—')} · auto ${r.auto}% · skill Σ${r.score}/30</div></div><span class="tag ${sev}">${lab}</span><div style="font-family:var(--serif);font-style:italic;font-size:18px;color:var(--${sev==='danger'?'danger':sev==='warn'?'warn':'ok'});min-width:38px;text-align:right">${r.idx}</div></div>`;
    }).join('');
    b.innerHTML=html;
  }

  function _setMandato(id){_s.mandato=id;reload().then(()=>go(_s.tab))}

  async function _mount(b,diag){
    if(window.IpFerramenta){ await IpFerramenta.organismo(b,{chave:'skillmap',mandato:_s.mandato,rotulo:'Skill Map',diagnosticoHTML:diag,fontesEvento:['ip_plano_acoes','ip_agent_sugestoes'],consumidores:[{nome:'Mattering',porque:'reconversao e pertencimento se cruzam no mesmo time'},{nome:'Sala de Guerra',porque:'reconversoes urgentes sobem no quadro IREU macro'},{nome:'Agentes Vigia',porque:'retencao de conhecimento observa concentracao de skill critica'}]}); }
    else { b.innerHTML=diag; }
  }

  const CSS=`
  #sk-root .sk-tabs{display:flex;gap:4px;margin-bottom:18px;border-bottom:1px solid var(--rule)}
  #sk-root .sk-tab{padding:9px 16px;background:none;border:none;border-bottom:2px solid transparent;color:var(--cream-dim);font-family:var(--sans);font-size:12.5px;font-weight:500;cursor:pointer;transition:all .18s}
  #sk-root .sk-tab:hover{color:var(--cream)}
  #sk-root .sk-tab.on{color:var(--gold);border-bottom-color:var(--gold)}
  #sk-root .sk-select{width:100%;max-width:440px;padding:10px 14px;background:var(--navy-raised);border:1px solid var(--rule-strong);border-radius:7px;color:var(--cream);font-family:var(--sans);font-size:13px;margin-bottom:8px}
  #sk-root .sk-h{font-family:var(--mono);font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold-deep);font-weight:700;margin-bottom:12px}
  #sk-root .sk-field{margin-bottom:12px}
  #sk-root .sk-field label{display:block;font-family:var(--mono);font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--cream-dim);font-weight:600;margin-bottom:5px}
  #sk-root .sk-field input{width:100%;padding:10px 13px;background:var(--navy-raised);border:1px solid var(--rule-strong);border-radius:7px;color:var(--cream);font-family:var(--sans);font-size:13.5px}
  #sk-root .sk-field input:focus{outline:none;border-color:var(--gold)}
  #sk-root .sk-btn{padding:11px 20px;border:none;border-radius:8px;background:linear-gradient(135deg,var(--gold-glow,#F5DDA5),var(--gold));color:#2A1A3B;font-family:var(--sans);font-weight:600;font-size:13px;cursor:pointer;transition:all .2s}
  #sk-root .sk-btn:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(196,163,90,.3)}
  #sk-root .sk-btn:disabled{opacity:.5;cursor:not-allowed}
  #sk-root .sk-slider-row{margin-bottom:12px}
  #sk-root .sk-slider-row label{display:block;font-size:12.5px;color:var(--cream);margin-bottom:6px;font-weight:500}
  #sk-root .sk-scale{display:flex;gap:6px}
  #sk-root .sk-scale button{flex:1;height:38px;border:1px solid var(--rule-strong);border-radius:6px;background:var(--navy-raised);color:var(--cream-dim);font-family:var(--serif);font-style:italic;font-size:16px;cursor:pointer;transition:all .15s}
  #sk-root .sk-scale button.on{background:linear-gradient(135deg,var(--gold-glow,#F5DDA5),var(--gold));color:#2A1A3B;border-color:var(--gold)}
  #sk-root .sk-empty{text-align:center;padding:30px 16px;color:var(--cream-dim);font-style:italic;font-family:var(--serif);font-size:15px}
  #sk-root .sk-warn{padding:14px 18px;background:rgba(225,167,84,.1);border-left:2px solid var(--warn);border-radius:6px;color:var(--cream-muted);font-size:13px;font-style:italic;font-family:var(--serif);margin-bottom:14px}
  #sk-root .heat-cell{aspect-ratio:1;border-radius:5px;display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:12px;font-weight:600;border:1px solid transparent}
  #sk-root .heat-cell.l1{background:rgba(216,117,117,.18);color:var(--danger);border-color:rgba(216,117,117,.3)}
  #sk-root .heat-cell.l2{background:rgba(225,167,84,.16);color:var(--warn);border-color:rgba(225,167,84,.28)}
  #sk-root .heat-cell.l3{background:rgba(123,165,216,.16);color:var(--info);border-color:rgba(123,165,216,.28)}
  #sk-root .heat-cell.l4{background:rgba(196,163,90,.16);color:var(--gold);border-color:var(--navy-edge)}
  #sk-root .heat-cell.l5{background:linear-gradient(135deg,var(--gold-glow,#F5DDA5),rgba(196,163,90,.4));color:#2A1A3B;border-color:var(--gold)}`;
  function _css(){if(document.getElementById('sk-css'))return;const s=document.createElement('style');s.id='sk-css';s.textContent=CSS;document.head.appendChild(s)}
  _css();

  window.IpSkillMap={open,go,_setMandato,_criarPerfil,_salvarSkill,_loadSkillForm,_pick};
})();
