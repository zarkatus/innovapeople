// InnovaPeople · Parecer de Due Diligence (UI) · PQV-01 04/06
// Renderiza o parecer do IpDDMotor: veredicto+gauge, sinais por gravidade, condições de entrada,
// e ressalvas de escopo (anti-teatro). Vanilla SVG; reusa ip-ui.js (gauge) se presente.
// API: window.IpDDParecer.render(el, dd)   // dd = saída de IpDDMotor.avaliar
(function(){
  'use strict';
  if(window.IpDDParecer) return;
  var esc=function(s){ return (window.IpUI&&IpUI.esc)?IpUI.esc(s):String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); };

  var COR = { ENTRAR:'var(--ip-ok,#7BD3A0)', CAUTELA:'var(--ip-gold-lum,#E5C77E)', EVITAR:'var(--ip-danger,#E8A6A6)' };
  var SEVCOR = { critica:'var(--ip-danger,#E8A6A6)', alta:'var(--ip-danger,#E8A6A6)', media:'var(--ip-gold-lum,#E5C77E)', baixa:'var(--ip-ink-3,#8FA0B5)', info:'var(--ip-ink-3,#8FA0B5)' };
  var SEVICO = { critica:'⛔', alta:'🔴', media:'🟡', baixa:'🔵', info:'·' };

  // gauge semicircular de risco (0-100) com a cor do veredicto
  function _gauge(score, veredicto){
    var cor = COR[veredicto]||'var(--ip-ink-3)';
    var frac = Math.max(0,Math.min(100,score))/100;
    var R=54, cx=64, cy=64;
    var x0=cx+R*Math.cos(Math.PI), y0=cy+R*Math.sin(Math.PI);
    var bx=cx+R*Math.cos(0), by=cy+R*Math.sin(0);
    var ang=Math.PI - frac*Math.PI, px=cx+R*Math.cos(ang), py=cy+R*Math.sin(ang);
    var large=frac>0.5?1:0;
    return '<svg viewBox="0 0 128 78" width="128" height="78" aria-hidden="true">'
      +'<path d="M'+x0+','+y0+' A'+R+','+R+' 0 0 1 '+bx+','+by+'" fill="none" stroke="rgba(210,174,100,.12)" stroke-width="10" stroke-linecap="round"/>'
      +'<path d="M'+x0+','+y0+' A'+R+','+R+' 0 '+large+' 1 '+px.toFixed(1)+','+py.toFixed(1)+'" fill="none" stroke="'+cor+'" stroke-width="10" stroke-linecap="round"/>'
      +'<text x="64" y="60" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="26" fill="'+cor+'">'+score+'</text></svg>';
  }

  function _injectCss(){
    if(document.getElementById('ip-dd-css'))return;
    var st=document.createElement('style'); st.id='ip-dd-css';
    st.textContent=
      '.dd-wrap{margin-top:8px}'
     +'.dd-veredicto{display:flex;gap:16px;align-items:center;background:linear-gradient(135deg,#0C1626,#0A1320);border:1px solid rgba(210,174,100,.18);border-radius:16px;padding:18px 20px}'
     +'.dd-badge{font:700 13px/1 system-ui;letter-spacing:.08em;text-transform:uppercase;padding:7px 14px;border-radius:20px}'
     +'.dd-syn{font-size:14px;line-height:1.5;color:var(--ip-cream,#F7F3EC);margin-top:8px}'
     +'.dd-conf{font:600 9px/1 system-ui;letter-spacing:.14em;text-transform:uppercase;color:var(--ip-ink-4,#6B7A90);margin-top:6px}'
     +'.dd-sec-h{font:600 10px/1 system-ui;letter-spacing:.16em;text-transform:uppercase;color:var(--ip-gold-lum,#E5C77E);margin:18px 0 10px}'
     +'.dd-sinal{display:flex;gap:11px;align-items:flex-start;padding:11px 13px;background:var(--ip-bg-deep,#070D15);border:1px solid rgba(210,174,100,.07);border-left-width:3px;border-radius:11px;margin-bottom:8px}'
     +'.dd-sinal .ic{font-size:13px;flex:0 0 auto;margin-top:1px}'
     +'.dd-sinal .tx{flex:1;font-size:12.5px;color:var(--ip-ink,#CBD5E1);line-height:1.45}'
     +'.dd-sinal .tx b{color:var(--ip-cream,#F7F3EC)}'
     +'.dd-sinal .ev{font-size:10.5px;color:var(--ip-ink-4,#6B7A90);font-family:ui-monospace,monospace;margin-top:3px}'
     +'.dd-passo{display:flex;gap:9px;align-items:flex-start;font-size:12.5px;color:var(--ip-cream,#F7F3EC);padding:7px 0;border-bottom:1px solid rgba(210,174,100,.06)}'
     +'.dd-passo .n{color:var(--ip-gold-lum,#E5C77E);font-weight:700}'
     +'.dd-escopo{font-size:11.5px;color:var(--ip-ink-3,#8FA0B5);line-height:1.7;padding:12px 14px;border:1px dashed rgba(210,174,100,.2);border-radius:11px}'
     +'.dd-escopo b{color:var(--ip-ink-2,#9FB0C5)}';
    (document.head||document.documentElement).appendChild(st);
  }

  function render(el, dd){
    if(!el||!dd) return; _injectCss();
    var cor=COR[dd.veredicto]||'var(--ip-ink-3)';
    var visiveis = (dd.sinais||[]).filter(function(s){ return s.severidade!=='info'; });
    var html = '<div class="dd-wrap">'
      +'<div class="dd-veredicto"><div>'+_gauge(dd.risco_score, dd.veredicto)+'</div>'
        +'<div style="flex:1"><span class="dd-badge" style="color:'+cor+';background:color-mix(in srgb,'+cor+' 16%,transparent)">'+esc(dd.veredicto)+'</span>'
        +'<div class="dd-syn">'+esc(dd.frase_sintese||'')+'</div>'
        +'<div class="dd-conf">Confiança do parecer: '+esc(dd.confianca||'')+' · '+esc(dd.versao_motor||'')+'</div></div></div>';

    // B · sinais (red flags + positivos)
    html += '<div class="dd-sec-h">Sinais ('+(dd.sinais||[]).length+')</div>';
    html += (dd.sinais||[]).map(function(s){
      return '<div class="dd-sinal" style="border-left-color:'+(SEVCOR[s.severidade]||'var(--ip-ink-3)')+'">'
        +'<span class="ic">'+(SEVICO[s.severidade]||'·')+'</span>'
        +'<div class="tx"><b>'+esc(s.titulo)+'</b> — '+esc(s.por_que)
        +(s.evidencia?'<div class="ev">'+esc(s.evidencia)+'</div>':'')+'</div></div>';
    }).join('');

    // C · condições / próximos passos
    if((dd.proximos_passos||[]).length){
      html += '<div class="dd-sec-h">Condições de entrada · próximos passos</div>';
      html += dd.proximos_passos.map(function(p,i){ return '<div class="dd-passo"><span class="n">'+(i+1)+'</span><span>'+esc(p)+'</span></div>'; }).join('');
    }

    // D · escopo pendente (anti-teatro)
    if((dd.escopo_pendente||[]).length){
      html += '<div class="dd-sec-h">O que esta DD ainda não verificou</div>';
      html += '<div class="dd-escopo">Esta análise é cadastral e societária (fontes públicas gratuitas). <b>Pendente de degrau adicional:</b><br>· '
        + dd.escopo_pendente.map(esc).join('<br>· ') + '</div>';
    }
    html += '</div>';
    el.innerHTML = html;
  }

  window.IpDDParecer = { render: render };
})();
