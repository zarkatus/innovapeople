// InnovaPeople · DD-Motor · Parecer de Contraparte determinístico · PQV-01 04/06
// Cérebro PURO (sem I/O, sem rede): recebe o dossiê do cnpj-enrich e devolve um PARECER acionável.
// Blueprint do painel adversarial (3 arq × 3 juízes). Determinístico de 1ª classe (créditos IA
// esgotados → o parecer sai COMPLETO sem IA; IA só humaniza a narrativa quando há crédito).
// Princípio ANTI-TEATRO: ausência de dado ≠ risco (eixo sem fonte vira 'não avaliado', não penaliza);
// e um bloco de ESCOPO PENDENTE diz o que esta DD grátis NÃO verificou — protege contra falsa segurança.
// LGPD: penaliza OPACIDADE estrutural, NUNCA julga a pessoa física; não reproduz CPF.
// API: window.IpDDMotor.avaliar(dossie, params?) -> { risco_score, veredicto, dd_status, sinais[],
//      proximos_passos[], escopo_pendente[], confianca, versao_motor }
(function(global){
  'use strict';
  if(global.IpDDMotor) return;
  var VERSAO = 'dd-motor-1';
  // pesos por severidade (subtraídos de 100). VETO zera o score.
  var PESO = { critica:100, alta:22, media:11, baixa:5, info:0 };

  function anos(dataBR){ // aceita dd/mm/aaaa ou aaaa-mm-dd
    if(!dataBR) return null;
    var m = String(dataBR).match(/(\d{4})-(\d{2})-(\d{2})/) || String(dataBR).match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if(!m) return null;
    var ano = m[1].length===4 ? +m[1] : +m[3];
    var anoAtual = 2026; // sem Date.now em Node-sandbox; aproximação estável
    return anoAtual - ano;
  }
  function mesesDesde(dataBR){ var a = anos(dataBR); return a==null?null:a*12; }
  function num(v){ var n = typeof v==='number'?v:parseFloat(String(v||'').replace(/[^\d.,-]/g,'').replace(',', '.')); return isNaN(n)?null:n; }

  function avaliar(d, params){
    d = d || {}; params = params || {};
    var sinais = [], passos = [], pendente = [];
    function sinal(eixo, sev, titulo, evidencia, por_que){ sinais.push({ eixo:eixo, severidade:sev, titulo:titulo, evidencia:evidencia, por_que:por_que }); }
    function passo(txt){ if(passos.indexOf(txt)<0) passos.push(txt); }

    var veto = false;

    // ── EIXO 1 · IDONEIDADE CADASTRAL (gate/veto) ──
    var sit = String(d.situacao||'').toUpperCase().trim();
    if(!sit){ pendente.push('Situação cadastral não retornada pelas fontes — não avaliada.'); }
    else if(sit.indexOf('ATIVA')>=0){ sinal('Idoneidade','info','Inscrição ATIVA na Receita', 'situação: '+sit, 'Empresa apta a emitir NF-e e contratar.'); }
    else {
      veto = true;
      sinal('Idoneidade','critica','Inscrição NÃO ativa ('+sit+')', 'situação: '+sit, 'CNPJ irregular: NF-e recusada pela SEFAZ e risco de contaminação fiscal do contratante. Veto.');
      passo('Não contratar até a regularização cadastral na Receita (situação '+sit+').');
    }

    // ── EIXO 2 · MATURIDADE ──
    var idadeM = mesesDesde(d.abertura);
    if(idadeM==null){ pendente.push('Data de abertura indisponível — maturidade não avaliada.'); }
    else {
      var porteGrande = /m[ée]dio|grande|demais/i.test(String(d.porte||''));
      if(idadeM < 12){ sinal('Maturidade','alta','Empresa recém-aberta ('+Math.max(0,Math.round(idadeM))+' meses)', 'abertura: '+d.abertura, 'Pouco track record; risco de descontinuidade.'); passo('Pedir referências comerciais e histórico de entregas (empresa nova).'); }
      else if(idadeM < 36){ sinal('Maturidade','media','Empresa em consolidação ('+Math.round(idadeM/12)+' anos)', 'abertura: '+d.abertura, 'Track record curto.'); }
      else { sinal('Maturidade','info','Empresa madura ('+Math.round(idadeM/12)+' anos)', 'abertura: '+d.abertura, 'Histórico operacional consolidado.'); }
      if(idadeM < 24 && porteGrande){ sinal('Maturidade','alta','Idade baixa para o porte declarado', idadeM+' meses, porte '+d.porte, 'Vetor clássico de empresa-casca: porte alto sem track record compatível.'); }
    }

    // ── EIXO 3 · SUBSTÂNCIA (lastro declarado) ──
    var cap = num(d.capital_social);
    var contrato = num(params.valor_estimado_contrato);
    if(cap==null){ pendente.push('Capital social indisponível — lastro não avaliado.'); }
    else {
      if(cap < 10000){ sinal('Substância','alta','Capital social baixo (R$ '+cap.toLocaleString('pt-BR')+')', 'capital declarado: R$ '+cap.toLocaleString('pt-BR'), 'Lastro declarado reduzido (capital ≠ patrimônio, mas é teto de responsabilidade declarada).'); passo('Exigir contrato com garantia real ou fiança — lastro declarado baixo.'); }
      else if(cap < 50000){ sinal('Substância','media','Capital social modesto (R$ '+cap.toLocaleString('pt-BR')+')', 'capital: R$ '+cap.toLocaleString('pt-BR'), 'Lastro declarado limitado.'); }
      else { sinal('Substância','info','Capital social compatível', 'R$ '+cap.toLocaleString('pt-BR'), 'Lastro declarado adequado.'); }
      if(contrato!=null && contrato>0 && cap < contrato*0.05){ sinal('Substância','alta','Capital muito abaixo do contrato estimado', 'capital R$ '+cap.toLocaleString('pt-BR')+' = '+(cap/contrato*100).toFixed(1)+'% do contrato', 'Subdimensionamento de lastro frente ao valor do negócio.'); }
    }

    // ── EIXO 4 · CONCENTRAÇÃO & TRANSPARÊNCIA SOCIETÁRIA ──
    var socios = Array.isArray(d.socios)? d.socios : [];
    if(!socios.length){ pendente.push('Quadro societário (QSA) indisponível — estrutura não avaliada.'); }
    else {
      if(socios.length === 1){ sinal('Societário','media','Sócio único', '1 sócio no QSA', 'Dependência total de uma pessoa: risco de continuidade e de governança.'); }
      else { sinal('Societário','info', socios.length+' sócios no quadro', socios.length+' sócios', 'Governança distribuída.'); }
      var temPJ = socios.some(function(s){ return /jur[íi]dic|sociedade|ltda|s\/?a\b|empresa|holding|participa[çc]/i.test((s.nome||'')+' '+(s.qualificacao||'')); });
      if(temPJ){ sinal('Societário','alta','Sócio pessoa jurídica no quadro', 'há PJ no QSA', 'Beneficiário final (UBO) opaco: a cadeia societária precisa ser destrinchada para identificar quem controla.'); passo('Mapear o beneficiário final (UBO) — há sócio pessoa jurídica na estrutura.'); }
      // troca societária recente (se data_entrada disponível)
      var recente = socios.filter(function(s){ var mm = mesesDesde(s.data_entrada); return mm!=null && mm < 6; });
      if(recente.length){ sinal('Societário','alta','Troca societária recente', recente.length+' sócio(s) entraram há <6 meses', 'Mudança de controle às vésperas da contratação merece atenção.'); passo('Pedir contrato social atualizado — entrada de sócio nos últimos 6 meses.'); }
    }

    // ── EIXO 5 · COERÊNCIA OPERACIONAL ──
    var semContato = !String(d.email||'').trim() && !String(d.telefone||'').trim() && !String(d.logradouro||'').trim();
    if(semContato && (d.email!==undefined || d.telefone!==undefined)){ sinal('Coerência','media','Sem dados de contato', 'email, telefone e endereço vazios', 'Ausência total de contato pode indicar empresa de fachada.'); }
    if(params.cnaes_esperados && d.cnae){ var ok = [].concat(params.cnaes_esperados).some(function(c){ return String(d.cnae).toLowerCase().indexOf(String(c).toLowerCase())>=0; }); if(!ok){ sinal('Coerência','media','Atividade (CNAE) incompatível com o esperado', 'CNAE: '+d.cnae, 'Possível empresa-veículo ou desvio de finalidade.'); } }

    // ── SCORE ──
    var soma = sinais.reduce(function(a,s){ return a + (PESO[s.severidade]||0); }, 0);
    var risco_score = veto ? 0 : Math.max(0, Math.min(100, 100 - soma));
    var veredicto = veto ? 'EVITAR' : risco_score >= 75 ? 'ENTRAR' : risco_score >= 45 ? 'CAUTELA' : 'EVITAR';
    var dd_status = veredicto === 'ENTRAR' ? 'aprovada' : 'com_ressalva';

    // ── confiança (nº de fontes que responderam) ──
    var nf = d.n_fontes || (Array.isArray(d.fontes)? d.fontes.length : 1);
    var confianca = nf >= 3 ? 'alta' : nf === 2 ? 'média' : 'parcial';

    // ── escopo pendente (anti-teatro: o que esta DD grátis NÃO verificou) ──
    pendente.push('Sanções e idoneidade (CEIS/CNEP/CEPIM) — não verificado nesta DD gratuita.');
    pendente.push('Litígios e execuções (processos judiciais/CNDT) — não verificado.');
    pendente.push('Regularidade fiscal real (CND, CRF do FGTS) — não verificado.');
    pendente.push('Lista Suja (trabalho escravo) e embargos ambientais — não verificado.');

    // síntese
    var frase;
    if(veto) frase = 'Empresa com situação cadastral irregular ('+sit+') — não recomendada até regularização.';
    else if(veredicto==='ENTRAR') frase = 'Idoneidade cadastral e estrutura sem red flags relevantes — recomendado entrar, observando as ressalvas de escopo.';
    else if(veredicto==='CAUTELA') frase = 'Empresa ativa, mas com sinais que pedem cuidado — entrar somente com as condições abaixo.';
    else frase = 'Sinais relevantes desaconselham a contratação sem investigação adicional.';

    return {
      risco_score: risco_score, veredicto: veredicto, dd_status: dd_status, frase_sintese: frase,
      sinais: sinais.sort(function(a,b){ return (PESO[b.severidade]||0)-(PESO[a.severidade]||0); }),
      proximos_passos: passos, escopo_pendente: pendente, confianca: confianca, versao_motor: VERSAO
    };
  }

  global.IpDDMotor = { avaliar: avaliar, VERSAO: VERSAO };
})(typeof window !== 'undefined' ? window : globalThis);
// suporte a import em Node/Deno (a EF reusa o mesmo cérebro)
if (typeof module !== 'undefined' && module.exports) module.exports = (typeof window!=='undefined'?window:globalThis).IpDDMotor;
