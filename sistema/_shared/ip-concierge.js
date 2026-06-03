// InnovaPeople · Concierge Cognitivo (tool-use real · PQV-01 03/06)
// SALTO sobre o concierge antigo (snapshot fixo) e sobre os agentes (prompt fixo): aqui a IA
// DECIDE quais dados ler (tool_use), o client EXECUTA a query real sob a sessão do usuário (RLS),
// devolve, e a IA sintetiza. Loop verdadeiro grounded no dado vivo. Usa o ai-proxy via IpAI.
// API: window.IpConcierge.ask(pergunta, {onStep}) -> {ok, text, steps}
//      window.IpConcierge.sintese() -> leitura unificada "o que está acontecendo na operação"
(function(){
  'use strict';
  if(window.IpConcierge) return;
  var SB = function(){ return window.__IP_SB || window.sb; };
  var MODEL = 'claude-haiku-4-5-20251001';

  // ── Ferramentas: cada uma é uma query REAL (RLS do usuário). schema p/ a Anthropic + run(). ──
  var TOOLS = {
    listar_programas: {
      def: { name:'listar_programas', description:'Lista os programas de desenvolvimento de gente (cultura, liderança, onboarding) com EVM resumido (CPI/SPI/status). Use para saber saúde dos programas.', input_schema:{type:'object',properties:{},required:[]} },
      run: async function(){
        var sb=SB(); var r=await sb.from('ip_programas').select('id,nome,tipo,status,pv_total,ev_total,ac_total').limit(20);
        if(r.error) return {erro:r.error.message};
        var rows=(r.data||[]).map(function(p){ var cpi=p.ac_total>0?(p.ev_total/p.ac_total):null, spi=p.pv_total>0?(p.ev_total/p.pv_total):null;
          return { nome:p.nome, tipo:p.tipo, status:p.status, cpi:cpi?+cpi.toFixed(2):null, spi:spi?+spi.toFixed(2):null }; });
        return { total: rows.length, programas: rows };
      }
    },
    contar_colaboradores: {
      def: { name:'contar_colaboradores', description:'Conta colaboradores por status (ativo/afastado/desligado) — o headcount da operação.', input_schema:{type:'object',properties:{},required:[]} },
      run: async function(){
        var sb=SB(); var r=await sb.from('core_colaborador').select('status');
        if(r.error) return {erro:r.error.message};
        var c={ativo:0,afastado:0,desligado:0}; (r.data||[]).forEach(function(x){ c[x.status]=(c[x.status]||0)+1; });
        return { ativos:c.ativo, afastados:c.afastado, desligados:c.desligado, total:(r.data||[]).length };
      }
    },
    clima_pulso: {
      def: { name:'clima_pulso', description:'Clima de engajamento (Pulso 6D anônimo) por equipe, com supressão N<5 (LGPD). Use para saber o humor/engajamento das equipes.', input_schema:{type:'object',properties:{},required:[]} },
      run: async function(){
        var sb=SB(); var r=await sb.from('v_core_clima_pulso').select('equipe,respostas,score_medio,suprimido_privacidade').order('respostas',{ascending:false}).limit(12);
        if(r.error) return {erro:r.error.message};
        return { equipes:(r.data||[]).map(function(e){ return { equipe:e.equipe, respostas:e.respostas, score:e.suprimido_privacidade?'(oculto N<5)':e.score_medio }; }) };
      }
    },
    sinais_pendentes: {
      def: { name:'sinais_pendentes', description:'Sinais/sugestões pendentes dos agentes IA (anomalias, drift, programas em risco). Use para saber o que precisa de atenção AGORA.', input_schema:{type:'object',properties:{},required:[]} },
      run: async function(){
        var sb=SB(); var r=await sb.from('ip_agent_sugestoes').select('agente,severidade,titulo').eq('status','pendente').order('created_at',{ascending:false}).limit(15);
        if(r.error) return {erro:r.error.message};
        return { total:(r.data||[]).length, sinais:(r.data||[]).map(function(s){ return { agente:s.agente, severidade:s.severidade, titulo:s.titulo }; }) };
      }
    },
    acoes_prioritarias: {
      def: { name:'acoes_prioritarias', description:'Ações priorizadas por IREU (impacto×relevância×efeito×urgência), as de maior score primeiro. Use para "o que fazer primeiro".', input_schema:{type:'object',properties:{},required:[]} },
      run: async function(){
        var sb=SB(); var r=await sb.from('ip_plano_acoes').select('titulo,ireu_score,frente,status').eq('status','pendente').order('ireu_score',{ascending:false}).limit(10);
        if(r.error) return {erro:r.error.message};
        return { acoes:(r.data||[]).map(function(a){ return { titulo:a.titulo, ireu:a.ireu_score, frente:a.frente, tier: a.ireu_score>=200?'T1':a.ireu_score>=100?'T2':'T3' }; }) };
      }
    },
    resultado_obras: {
      def: { name:'resultado_obras', description:'Resultado por obra (participação): custos reais, orçamento, nº de sócios/camadas por empreendimento.', input_schema:{type:'object',properties:{},required:[]} },
      run: async function(){
        var sb=SB(); var r=await sb.from('v_plat_resultado_obra').select('empreendimento,orcamento_total,custo_obra_lancado,n_socios').limit(10);
        if(r.error) return {erro:r.error.message};
        return { obras: r.data||[] };
      }
    }
  };

  var SYSTEM = 'Você é o Concierge da InnovaPeople — copiloto cognitivo da gestão de gente e operação. '
    +'Você NÃO inventa dados: usa as ferramentas para LER o estado real e responde com base nelas. '
    +'Pode chamar várias ferramentas antes de concluir. Tom executivo, caloroso, direto, português do Brasil, sem markdown. '
    +'Quando relevante, priorize por IREU e aponte UMA próxima ação. Se uma ferramenta retornar vazio, diga com honestidade.';

  function toolDefs(){ return Object.keys(TOOLS).map(function(k){ return TOOLS[k].def; }); }

  // Loop tool-use: até N rodadas. onStep(info) reporta cada passo (p/ UI mostrar "lendo X…").
  async function ask(pergunta, opts){
    opts = opts || {};
    var sb = SB();
    if(!sb || !sb.functions) return { ok:false, error:'sem cliente' };
    var messages = [{ role:'user', content: String(pergunta||'') }];
    var steps = [];
    var MAX = 6;
    for(var turn=0; turn<MAX; turn++){
      var body = { model:MODEL, max_tokens:1024, system:SYSTEM, tools:toolDefs(), messages:messages };
      var r = await sb.functions.invoke('ai-proxy', { body: body });
      if(r.error) return { ok:false, error:(r.error.message||''+r.error), steps:steps };
      var d = r.data;
      if(!d || !Array.isArray(d.content)) return { ok:false, error:'resposta inesperada', steps:steps };
      // a IA pediu ferramenta(s)?
      var toolUses = d.content.filter(function(c){ return c.type==='tool_use'; });
      if(d.stop_reason==='tool_use' && toolUses.length){
        messages.push({ role:'assistant', content: d.content });
        var results = [];
        for(var i=0;i<toolUses.length;i++){
          var tu = toolUses[i];
          if(opts.onStep) try{ opts.onStep({ tipo:'tool', nome:tu.name }); }catch(_){}
          steps.push(tu.name);
          var out;
          try{ out = TOOLS[tu.name] ? await TOOLS[tu.name].run(tu.input||{}) : { erro:'ferramenta desconhecida' }; }
          catch(e){ out = { erro:(''+e).slice(0,100) }; }
          results.push({ type:'tool_result', tool_use_id: tu.id, content: JSON.stringify(out) });
        }
        messages.push({ role:'user', content: results });
        continue; // próxima rodada: a IA processa os resultados
      }
      // resposta final (texto)
      var text = d.content.filter(function(c){ return c.type==='text'; }).map(function(c){ return c.text; }).join('\n').trim();
      return { ok:true, text:text, steps:steps };
    }
    return { ok:false, error:'limite de rodadas (loop)', steps:steps };
  }

  // Síntese cruzada: o concierge se auto-pergunta a leitura unificada da operação.
  async function sintese(){
    return ask('Faça uma leitura executiva consolidada da operação AGORA: cruze a saúde dos programas, o headcount, o clima das equipes, os sinais pendentes e as ações prioritárias. Em até 5 frases: o que está realmente acontecendo, o risco principal, e as 2-3 próximas ações por IREU. Use as ferramentas necessárias.',
      { onStep: arguments[0] && arguments[0].onStep });
  }

  window.IpConcierge = { ask: ask, sintese: sintese, _tools: TOOLS };
})();
