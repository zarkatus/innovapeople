// InnovaPeople · Diagnóstico Determinístico (client) · Sprint #5 · PQV-01 04/06
// Diretriz CVO: "priorizar leituras determinísticas" — toda ferramenta tem diagnóstico por
// REGRAS de primeira linha (funciona sem crédito de IA); a IA vira enriquecimento opcional.
// MODULAR e reutilizável: window.IpDiag.* devolve {titulo, leitura, severidade, acao, sinais[]}.
// Não chama rede. Puro raciocínio sobre números. Cada ferramenta importa e usa.
(function(){
  'use strict';
  if(window.IpDiag) return;
  function n(x){ return (x==null||isNaN(x))?null:+x; }
  function brl(v){ return (v==null||isNaN(v))?'—':(+v).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}); }

  // EVM: lê CPI/SPI + marcos -> diagnóstico de gestão de valor agregado
  function evm(e, marcos){
    e=e||{}; marcos=marcos||[];
    var cpi=n(e.cpi), spi=n(e.spi), f=[], sev='ok', sinais=[];
    if(cpi!=null){ if(cpi<0.9){f.push('Acima do custo (CPI '+cpi.toFixed(2)+'): gasta-se mais do que se entrega.');sev='alta';sinais.push('CPI<0.9');}
      else if(cpi>1.1) f.push('Eficiente em custo (CPI '+cpi.toFixed(2)+').');
      else f.push('Custo sob controle (CPI '+cpi.toFixed(2)+').'); }
    if(spi!=null){ if(spi<0.9){f.push('Atrasado (SPI '+spi.toFixed(2)+'): avanço físico abaixo do plano.');sev=sev==='alta'?'critica':'alta';sinais.push('SPI<0.9');}
      else if(spi>=1) f.push('No prazo (SPI '+spi.toFixed(2)+').');
      else f.push('Levemente atrás (SPI '+spi.toFixed(2)+').'); }
    var pesado=marcos.slice().sort(function(a,b){return ((n(b.ac)||0)-(n(b.ev)||0))-((n(a.ac)||0)-(n(a.ev)||0));})[0];
    if(pesado && ((n(pesado.ac)||0)-(n(pesado.ev)||0))>0) f.push('Marco que mais pesa: "'+pesado.titulo+'" (AC '+brl(pesado.ac)+' > EV '+brl(pesado.ev)+').');
    var acao = (cpi!=null&&cpi<0.9)||(spi!=null&&spi<0.9) ? 'Replanejar os marcos finais e revisar o esforço antes de novo aporte.' : 'Manter a cadência e apontar avanços para acompanhar a curva.';
    return { titulo:'Saúde do programa', leitura:f.join(' '), severidade:sev, acao:acao, sinais:sinais };
  }

  // CLIMA (Pulso 6D): equipes visíveis -> maior risco/dimensão crítica
  function clima(equipes){
    equipes=(equipes||[]).filter(function(e){return !e.suprimido_privacidade;});
    if(!equipes.length) return { titulo:'Clima', leitura:'Sem equipes com N≥5 — colete mais respostas (privacidade).', severidade:'neutro', acao:'Ampliar a base de respostas do Pulso.', sinais:[] };
    var DIMS=['proposito','autonomia','competencia','pertencimento','clareza','seguranca'];
    var pior=null, piorDim=null, piorVal=99;
    equipes.forEach(function(e){ DIMS.forEach(function(d){ var v=n(e[d]); if(v!=null && v<piorVal){piorVal=v;pior=e;piorDim=d;} }); });
    var risco=equipes.slice().sort(function(a,b){return (n(b.risco_saida)||0)-(n(a.risco_saida)||0);})[0];
    var f=[];
    if(pior) f.push('Menor nota: '+piorDim+' em '+pior.equipe+' ('+piorVal+'/5).');
    if(risco && n(risco.risco_saida)!=null) f.push('Maior risco de saída: '+risco.equipe+' ('+risco.risco_saida+'/5).');
    var sev = piorVal<2.5||(risco&&n(risco.risco_saida)>=3.5) ? 'alta' : piorVal<3 ? 'media' : 'ok';
    var acao = sev==='alta' ? 'Conversa estruturada com '+(risco?risco.equipe:pior.equipe)+' sobre '+piorDim+'.' : 'Manter o ritual de Pulso e acompanhar a tendência.';
    return { titulo:'Clima das equipes', leitura:f.join(' '), severidade:sev, acao:acao, sinais: sev==='alta'?[piorDim+'_baixo']:[] };
  }

  // SEQUÊNCIA de marcos (CPM por ordem, sem datas): onde o avanço trava
  function sequencia(marcos){
    marcos=marcos||[];
    if(!marcos.length) return { titulo:'Sequência', leitura:'Sem marcos cadastrados.', severidade:'neutro', acao:'Cadastrar os marcos do programa.', sinais:[] };
    var concl=marcos.filter(function(m){return m.status==='concluido';}).length;
    var andamento=marcos.filter(function(m){return m.status==='em_andamento';});
    // gargalo = 1º marco não-concluído na ordem (o que segura a cadeia)
    var gargalo=marcos.find(function(m){return m.status!=='concluido';});
    var f=[concl+' de '+marcos.length+' marcos concluídos.'];
    if(gargalo) f.push('Próximo elo da cadeia: "'+gargalo.titulo+'" ('+gargalo.status+').');
    if(andamento.length>1) f.push(andamento.length+' marcos em paralelo — atenção à dispersão de esforço.');
    var sev = (concl/marcos.length)<0.34 ? 'media' : 'ok';
    return { titulo:'Sequência de marcos', leitura:f.join(' '), severidade:sev, acao: gargalo?('Destravar "'+gargalo.titulo+'" para liberar os marcos seguintes.'):'Avançar para o próximo programa.', sinais:[] };
  }

  // render padrão de um diagnóstico (card elegante reutilizável)
  function card(d, opts){
    opts=opts||{};
    var cor = d.severidade==='critica'?'var(--ip-danger)':d.severidade==='alta'?'var(--ip-danger)':d.severidade==='media'?'var(--ip-gold-lum)':d.severidade==='neutro'?'var(--ip-ink-3)':'var(--ip-ok)';
    var esc=(window.IpUI&&IpUI.esc)||function(s){return String(s==null?'':s);};
    return '<div style="background:linear-gradient(135deg,#0C1626,#0A1320);border:1px solid rgba(210,174,100,.16);border-left:3px solid '+cor+';border-radius:14px;padding:18px 20px">'
      +'<div style="font:600 10px/1 system-ui;letter-spacing:.16em;text-transform:uppercase;color:var(--ip-gold-lum);margin-bottom:10px">◆ '+esc(opts.titulo||d.titulo)+(opts.semIA?' · leitura por regras':'')+'</div>'
      +'<div style="font-size:14px;line-height:1.6;color:var(--ip-cream)">'+esc(d.leitura)+'</div>'
      +(d.acao?'<div style="margin-top:10px;font-size:12.5px;color:var(--ip-ink-2)"><b style="color:'+cor+'">Ação:</b> '+esc(d.acao)+'</div>':'')+'</div>';
  }

  window.IpDiag = { evm:evm, clima:clima, sequencia:sequencia, card:card };
})();
