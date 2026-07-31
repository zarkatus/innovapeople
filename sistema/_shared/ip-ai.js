// InnovaPeople · Helper de IA unificado (IP←IS-1 · PQV-01 03/06)
// A IP já tem agentes dedicados (ip-agent-claude, ip-enrich-ia). Este helper cobre o caso
// GENÉRICO: chamar Claude direto (Anthropic verbatim) sem um agente específico — útil p/ os
// drawers "espelho AIPrev" e análises pontuais. Reusa a Edge Function `ai-proxy` que a
// InnovaSphere já tem deployada no MESMO Supabase (CORS permissivo, key server-side).
// Não expõe a chave; tudo server-side. window.IpAI.ask(prompt, opts) -> texto.
(function(){
  'use strict';
  if(window.IpAI) return;
  var SB = function(){ return window.__IP_SB || window.sb; };

  // ask(prompt|messages, opts) -> Promise<{ok, text, error}>
  // opts: { system, model, maxTokens, temperature }
  async function ask(input, opts){
    opts = opts || {};
    var messages = Array.isArray(input)
      ? input
: [{ role:'user', content: String(input||'') }];
    var body = {
      model: opts.model || 'claude-haiku-4-5-20251001',
      max_tokens: opts.maxTokens || 1024,
      messages: messages
    };
    if(opts.system) body.system = opts.system;
    if(opts.temperature != null) body.temperature = opts.temperature;
    var sb = SB();
    if(!sb || !sb.functions){ return { ok:false, error:'sem cliente Supabase' }; }
    try{
      var r = await sb.functions.invoke('ai-proxy', { body: body });
      if(r.error){ return { ok:false, error: (r.error.message||r.error)+'' }; }
      // resposta Anthropic verbatim: { content:[{type:'text', text:'...'}], ... }
      var d = r.data;
      var text = '';
      if(d && Array.isArray(d.content)){
        text = d.content.filter(function(c){return c.type==='text';}).map(function(c){return c.text;}).join('\n').trim();
      } else if(typeof d === 'string'){ text = d; }
      return { ok:true, text: text, raw: d };
    }catch(e){ return { ok:false, error: (e&&e.message)||(''+e) }; }
  }

  // askJson(prompt, opts) -> Promise<{ok, json, error}>: força o modelo a responder JSON e parseia.
  async function askJson(input, opts){
    opts = opts || {};
    var sys = (opts.system ? opts.system+'\n\n': '') + 'Responda APENAS com JSON válido, sem markdown, sem texto fora do JSON.';
    var r = await ask(input, Object.assign({}, opts, { system: sys }));
    if(!r.ok) return { ok:false, error:r.error };
    try{
      var t = r.text.replace(/^```json\s*/i,'').replace(/```\s*$/,'').trim();
      return { ok:true, json: JSON.parse(t) };
    }catch(e){ return { ok:false, error:'JSON inválido: '+r.text.slice(0,120) }; }
  }

  window.IpAI = { ask: ask, askJson: askJson };
})();
