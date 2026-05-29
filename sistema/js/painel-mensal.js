// IpPainelMensal - Painel Mensal CHRO: inteligencia executiva mensal consolidada.
// Redesenho RapheiceOS (dark/light) + organismo (sintese IA + proximos passos
// macro + propagacao) + dados reais corrigidos (created_at, source_table/operacao).
// API: IpPainelMensal.open(host)
(function(){
  'use strict';
  if(window.IpPainelMensal) return;
  const sb=()=>window.__IP_SB||window.sb;
  const T=window.TB||{esc:s=>String(s==null?'':s),safe:async(f,fb)=>{try{return await f()}catch(e){return fb}},toast:m=>alert(m),fmtRel:s=>s};
  const esc=T.esc;
  let _host=null,_d=null;
  const DIMS=[{k:'r_proposito',n:'propósito'},{k:'r_autonomia',n:'autonomia'},{k:'r_competencia',n:'competência'},{k:'r_pertencimento',n:'pertencimento'},{k:'r_clareza',n:'clareza'},{k:'r_seguranca',n:'segurança'}];

  async function open(host){
    _host=host;
    host.innerHTML='<div id="pm-root"><div class="pm-empty">Consolidando inteligência mensal&hellip;</div></div>';
    await carregar();
    render();
    if(window.IpFerramenta){
      const cfg={chave:'consolidado', rotulo:'Painel Mensal',
        diagnosticoHTML:'',
        fontesEvento:['ip_pulsos','ip_mandatos','ip_decisoes','ip_relacionamentos','ip_agent_sugestoes','ip_plano_acoes','ip_perfil_colaborador','ip_skill_map'],
        consumidores:[
          {nome:'Sala de Guerra', porque:'a sintese macro alimenta o quadro consolidado IREU'},
          {nome:'CHRO · Centro de Comando', porque:'tendencias do mes orientam rituais e calibracoes'},
          {nome:'Mattering / Skill Map', porque:'baixos agregados disparam diagnostico nas frentes especificas'}
        ]};
      const org=document.createElement('div'); org.id='pm-org';
      _host.querySelector('#pm-root').appendChild(org);
      org.setAttribute('data-fc-host','');
      await IpFerramenta.organismo(org, cfg);
    }
  }

  async function carregar(){
    const since30=new Date(Date.now()-30*864e5).toISOString();
    const since6m=new Date(Date.now()-180*864e5).toISOString();
    const [mand,pulsos,sug,dec,rel,rx,prog,eventos]=await Promise.all([
      T.safe(()=>sb().from('ip_mandatos').select('id,empresa,estagio,status,setor,porte').limit(200),{data:[]}),
      T.safe(()=>sb().from('ip_pulsos').select('mandato_id,equipe,r_proposito,r_autonomia,r_competencia,r_pertencimento,r_clareza,r_seguranca,risco_saida,score,created_at').gte('created_at',since6m).order('created_at',{ascending:false}).limit(3000),{data:[]}),
      T.safe(()=>sb().from('ip_agent_sugestoes').select('severidade,status,agente,created_at').limit(800),{data:[]}),
      T.safe(()=>sb().from('ip_decisoes').select('id,nivel,status,created_at').gte('created_at',since6m).limit(500),{data:[]}),
      T.safe(()=>sb().from('ip_relacionamentos').select('id,backup').limit(500),{data:[]}),
      T.safe(()=>sb().from('ip_raio_x_submissions').select('status,sintomas_score,created_at').gte('created_at',since6m).order('created_at',{ascending:false}).limit(1000),{data:[]}),
      T.safe(()=>sb().from('ip_programas').select('id,nome').limit(100),{data:[]}),
      T.safe(()=>sb().from('ip_eventos').select('source_table,operacao,ts').gte('ts',since30).limit(2000),{data:[]}),
    ]);
    _d={mand:mand.data||[],pulsos:pulsos.data||[],sug:sug.data||[],dec:dec.data||[],rel:rel.data||[],rx:rx.data||[],prog:prog.data||[],eventos:eventos.data||[]};
  }

  function farol(v){ return v>=4?'no-alvo':(v>=3?'atencao':'fora'); }
  function avg(a){ const f=a.filter(x=>typeof x==='number'); return f.length?f.reduce((x,y)=>x+y,0)/f.length:null; }
  function monthBucket(rows,dateField){
    const map={}; const today=new Date(); const labels=[];
    for(let i=5;i>=0;i--){const d=new Date(today.getFullYear(),today.getMonth()-i,1);const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');labels.push(k);map[k]=[];}
    rows.forEach(r=>{if(!r[dateField])return;const d=new Date(r[dateField]);const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');if(map[k])map[k].push(r);});
    return {labels,map};
  }
  function svgLine(series, w, h){
    const pad=22; const W=w||520, H=h||140;
    const all=series.flatMap(s=>s.data).filter(v=>v!=null);
    const mn=Math.min(0,...all), mx=Math.max(5,...all);
    const n=series[0].labels.length;
    const x=(i)=>pad+(W-pad*2)*(n<=1?0:i/(n-1));
    const y=(v)=>H-pad-(H-pad*2)*(v-mn)/((mx-mn)||1);
    const colors=['var(--gold,#C4A35A)','var(--info,#7BA5D8)','var(--ok,#6BAE82)','var(--warn,#E1A754)','var(--danger,#D87575)','var(--cream-muted,#D6CDB8)'];
    let lines=''; series.forEach((s,si)=>{
      const pts=s.data.map((v,i)=>v==null?null:x(i)+','+y(v)).filter(Boolean).join(' ');
      lines+='<polyline fill="none" stroke="'+colors[si%colors.length]+'" stroke-width="1.6" points="'+pts+'"/>';
      s.data.forEach((v,i)=>{if(v!=null)lines+='<circle cx="'+x(i)+'" cy="'+y(v)+'" r="2.5" fill="'+colors[si%colors.length]+'"/>';});
    });
    const xl=series[0].labels.map((l,i)=>'<text x="'+x(i)+'" y="'+(H-6)+'" text-anchor="middle" font-family="var(--mono,monospace)" font-size="9" fill="var(--cream-dim,#A99E86)">'+l.slice(5)+'</text>').join('');
    const yl=[mn,(mn+mx)/2,mx].map(v=>'<text x="4" y="'+y(v)+'" font-family="var(--mono,monospace)" font-size="9" fill="var(--cream-dim,#A99E86)">'+v.toFixed(1)+'</text>').join('');
    const leg=series.map((s,si)=>'<tspan fill="'+colors[si%colors.length]+'">&#9679;</tspan> '+esc(s.nome)).join(' &nbsp; ');
    return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:'+H+'px">'+yl+xl+lines+'</svg><div style="font-family:var(--mono,monospace);font-size:10px;color:var(--cream-dim,#A99E86);text-align:center;margin-top:4px">'+leg+'</div>';
  }
  function svgBars(items, w, h){
    const W=w||520, H=h||140, pad=22;
    const mx=Math.max(1,...items.map(i=>i.v));
    const bw=(W-pad*2)/items.length*0.65;
    const x=(i)=>pad+(W-pad*2)*(i+.5)/items.length-bw/2;
    let bars=''; items.forEach((it,i)=>{
      const bh=(H-pad*2)*it.v/mx; const by=H-pad-bh;
      bars+='<rect x="'+x(i)+'" y="'+by+'" width="'+bw+'" height="'+bh+'" rx="3" fill="'+(it.color||'var(--gold,#C4A35A)')+'"/>';
      bars+='<text x="'+(x(i)+bw/2)+'" y="'+(by-4)+'" text-anchor="middle" font-family="var(--mono,monospace)" font-size="10" fill="var(--cream,#F7F3EC)">'+it.v+'</text>';
      bars+='<text x="'+(x(i)+bw/2)+'" y="'+(H-6)+'" text-anchor="middle" font-family="var(--mono,monospace)" font-size="9" fill="var(--cream-dim,#A99E86)">'+esc(it.l)+'</text>';
    });
    return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:'+H+'px">'+bars+'</svg>';
  }

  function render(){
    const d=_d, root=_host.querySelector('#pm-root');
    const since=new Date(Date.now()-30*864e5).toISOString();
    const mAtivos=d.mand.filter(m=>m.status==='ativo').length;
    const sugPend=d.sug.filter(s=>s.status==='pendente').length;
    const sugCrit=d.sug.filter(s=>s.status==='pendente'&&(s.severidade==='alta'||s.severidade==='critica')).length;
    const score30=avg(d.pulsos.filter(p=>p.created_at>=since).flatMap(p=>DIMS.map(x=>p[x.k])).filter(v=>typeof v==='number'));
    const risco30=avg(d.pulsos.filter(p=>p.created_at>=since).map(p=>p.risco_saida));
    const pulsos30=d.pulsos.filter(p=>p.created_at>=since).length;
    const rxConv=d.rx.length?(d.rx.filter(r=>r.status==='convertido').length/d.rx.length*100):null;
    const semBackup=d.rel.filter(r=>!r.backup).length;
    const buck=monthBucket(d.pulsos,'created_at');
    const series=DIMS.map(dim=>({nome:dim.n,labels:buck.labels,data:buck.labels.map(k=>{const a=buck.map[k]||[];return avg(a.map(p=>p[dim.k]))})}));
    const rxStages=['novo','contatado','agendado','realizado','convertido'];
    const rxBars=rxStages.map(s=>({l:s,v:d.rx.filter(r=>r.status===s).length,color:s==='convertido'?'var(--ok,#6BAE82)':'var(--gold,#C4A35A)'}));
    const evtBy={}; d.eventos.forEach(e=>{const k=(e.source_table||'?').replace('ip_','');evtBy[k]=(evtBy[k]||0)+1});
    const evtBars=Object.entries(evtBy).sort((a,b)=>b[1]-a[1]).slice(0,7).map(([k,v])=>({l:k,v,color:'var(--info,#7BA5D8)'}));
    const partes=[];
    partes.push(mAtivos+' trabalho'+(mAtivos===1?'':'s')+' ativo'+(mAtivos===1?'':'s'));
    if(pulsos30)partes.push(pulsos30+' pulso(s) no mes (score '+(score30==null?'-':score30.toFixed(1))+'/5)');
    if(sugCrit)partes.push(sugCrit+' sugestao(es) alta/critica pendente(s)');
    if(semBackup)partes.push(semBackup+' rel. sem backup');
    if(rxConv!=null)partes.push('raio-x conv '+rxConv.toFixed(1)+'%');
    const sintese=partes.join(' &middot; ')+'.';
    const kpiFarol=score30==null?'sem-meta':farol(score30);
    const kpiFarolTxt=score30==null?'sem dado':(kpiFarol==='no-alvo'?'saudavel':kpiFarol==='atencao'?'atencao':'critico');
    let html='<div class="pm-hero"><div class="pm-eyebrow">CHRO &middot; Inteligencia Mensal</div><h1>Painel <em>Mensal</em></h1><div class="pm-tag">Diagnostico executivo agregado de TODOS os trabalhos: tendencias do pulso 6D, funil de raio-x, sinais dos agentes, atividade do EventBus. A IA cruza tudo no organismo abaixo.</div></div>';
    html+='<div class="pm-sint"><span class="pm-sint-ico">&#9670;</span><div class="pm-sint-body"><div class="pm-sint-lab">Sintese executiva agregada</div><div class="pm-sint-txt">'+sintese+'</div></div></div>';
    html+='<div class="pm-kpis">';
    html+='<div class="pm-kpi hero"><div class="lab">Score 6D 30d</div><div class="val">'+(score30==null?'—':score30.toFixed(1)+'<span class="un">/5</span>')+'</div><span class="farol '+kpiFarol+'">'+kpiFarolTxt+'</span></div>';
    html+='<div class="pm-kpi"><div class="lab">Pulsos 30d</div><div class="val">'+pulsos30+'</div><div class="note">anonimos k>=3</div></div>';
    html+='<div class="pm-kpi"><div class="lab">Risco saida</div><div class="val" style="'+(risco30!=null&&risco30>=3.5?'color:var(--danger,#D87575)':'')+'">'+(risco30==null?'—':risco30.toFixed(1)+'<span class="un">/5</span>')+'</div></div>';
    html+='<div class="pm-kpi"><div class="lab">Trabalhos ativos</div><div class="val">'+mAtivos+'</div></div>';
    html+='<div class="pm-kpi"><div class="lab">Sugestoes pend.</div><div class="val" style="'+(sugCrit?'color:var(--danger,#D87575)':'')+'">'+sugPend+'</div><div class="note">'+sugCrit+' alta/critica</div></div>';
    html+='<div class="pm-kpi"><div class="lab">Conv. raio-x</div><div class="val">'+(rxConv==null?'—':rxConv.toFixed(1)+'<span class="un">%</span>')+'</div></div>';
    html+='</div>';
    html+='<div class="pm-grid">';
    html+='<div class="pm-panel"><div class="pm-h">Tendencia 6D do pulso &middot; ultimos 6 meses</div>'+(d.pulsos.length?svgLine(series):'<div class="pm-empty">Sem pulsos no periodo.</div>')+'</div>';
    html+='<div class="pm-panel"><div class="pm-h">Funil Raio-X</div>'+(d.rx.length?svgBars(rxBars):'<div class="pm-empty">Sem submissoes ainda.</div>')+'</div>';
    html+='<div class="pm-panel"><div class="pm-h">Atividade 30d &middot; EventBus por fonte</div>'+(d.eventos.length?svgBars(evtBars):'<div class="pm-empty">Sem eventos no periodo.</div>')+'</div>';
    html+='</div>';
    root.innerHTML=html;
  }

  const CSS=`
  #pm-root .pm-hero{padding:24px 0 18px;border-bottom:1px solid var(--rule,rgba(196,163,90,.15));margin-bottom:18px}
  #pm-root .pm-eyebrow{font-family:var(--mono);font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold-deep,#9a7b3a);font-weight:600;margin-bottom:8px}
  #pm-root h1{font-family:var(--serif);font-size:36px;font-weight:400;color:var(--cream);line-height:1.1;margin:0}
  #pm-root h1 em{font-style:italic;color:var(--gold)}
  #pm-root .pm-tag{margin-top:10px;font-family:var(--serif);font-style:italic;font-size:15px;color:var(--cream-muted);line-height:1.5;max-width:760px}
  #pm-root .pm-sint{display:flex;gap:14px;align-items:flex-start;padding:14px 18px;border-radius:10px;background:linear-gradient(135deg,rgba(196,163,90,.08),rgba(123,90,168,.06));border:1px solid var(--navy-edge,rgba(196,163,90,.2));margin-bottom:18px}
  #pm-root .pm-sint-ico{font-size:20px;color:var(--gold)}
  #pm-root .pm-sint-lab{font-family:var(--mono);font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold-deep,#9a7b3a);font-weight:700;margin-bottom:4px}
  #pm-root .pm-sint-txt{font-family:var(--serif);font-style:italic;font-size:15px;color:var(--cream);line-height:1.5}
  #pm-root .pm-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:18px}
  #pm-root .pm-kpi{padding:14px 16px;border-radius:11px;background:var(--navy-raised);border:1px solid var(--rule)}
  #pm-root .pm-kpi.hero{background:linear-gradient(135deg,rgba(196,163,90,.1),transparent);border-color:var(--navy-edge,rgba(196,163,90,.3))}
  #pm-root .pm-kpi .lab{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--cream-muted);font-weight:600}
  #pm-root .pm-kpi .val{font-family:var(--serif);font-style:italic;font-size:26px;color:var(--cream);margin-top:6px;line-height:1}
  #pm-root .pm-kpi .val .un{font-size:12px;color:var(--cream-dim);font-style:normal;margin-left:2px}
  #pm-root .pm-kpi .note{font-family:var(--mono);font-size:9.5px;color:var(--cream-dim);margin-top:5px}
  #pm-root .pm-kpi .farol{display:inline-block;margin-top:8px;font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;padding:2px 8px;border-radius:10px}
  #pm-root .pm-kpi .farol.no-alvo{background:rgba(116,192,143,.16);color:var(--ok,#6BAE82)}
  #pm-root .pm-kpi .farol.atencao{background:rgba(225,167,84,.16);color:var(--warn,#E1A754)}
  #pm-root .pm-kpi .farol.fora{background:rgba(216,117,117,.16);color:var(--danger,#D87575)}
  #pm-root .pm-kpi .farol.sem-meta{background:rgba(255,255,255,.04);color:var(--cream-dim)}
  #pm-root .pm-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px}
  #pm-root .pm-grid .pm-panel:first-child{grid-column:1/-1}
  #pm-root .pm-panel{padding:16px;border-radius:12px;background:var(--navy-raised);border:1px solid var(--rule)}
  #pm-root .pm-h{font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold-deep,#9a7b3a);font-weight:700;margin-bottom:10px}
  #pm-root .pm-empty{text-align:center;padding:24px;font-family:var(--serif);font-style:italic;color:var(--cream-dim);font-size:14px}
  @media(max-width:980px){#pm-root .pm-kpis{grid-template-columns:repeat(3,1fr)} #pm-root .pm-grid{grid-template-columns:1fr}}
  @media(max-width:560px){#pm-root .pm-kpis{grid-template-columns:repeat(2,1fr)} #pm-root h1{font-size:28px}}`;
  function injectCSS(){ if(document.getElementById('pm-css'))return; const s=document.createElement('style'); s.id='pm-css'; s.textContent=CSS; document.head.appendChild(s); }
  injectCSS();
  window.IpPainelMensal={open};
})();
