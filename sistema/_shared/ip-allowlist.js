// InnovaPeople · Allowlist centralizada (IP-1 · PQV-01 03/06).
// ANTES: cada página tinha `const ALLOWED=[3 emails]` hardcoded (17 cópias) — revogar
// acesso = editar 17 arquivos à mão (risco crítico). AGORA a tabela `ip_allowed_users` é a
// fonte de verdade (via RPC SECURITY DEFINER `fn_ip_pode_acessar`).
//
// ESTRATÉGIA "segunda barreira pós-login" (decisão CVO 03/06): NÃO mexemos no gate síncrono
// inline (a cicatriz "fica-caindo" veio de tocar o caminho de login). O gate continua deixando
// passar quem está no array semente; ESTE helper se auto-arma, observa o login concluído
// (window.__IP_USER_EMAIL setado por allow()), e consulta a fonte de verdade. Se a tabela
// REVOGOU o usuário (RPC=false), desloga. Assim revogar tem efeito em 1 lugar, sem risco de boot.
// Fail-SAFE: erro de REDE na RPC nunca desloga (não tranca o CVO por timeout).
(function(){
  'use strict';
  var SEED = ['raphael@schifino.com.br','gleice@schifino.com.br','rapheice@schifino.com.br'];
  function norm(e){ return String(e||'').trim().toLowerCase(); }

  // Retorna {ok, via:'rpc'|'seed-fallback'|'empty'}. ok=false só quando a RPC afirma `false`.
  async function check(sb, email){
    var e = norm(email);
    if(!e) return { ok:false, via:'empty' };
    if(sb && sb.rpc){
      try{
        var r = await sb.rpc('fn_ip_pode_acessar', { p_email: e });
        if(!r.error && (r.data === true || r.data === false)){
          return { ok: r.data === true, via:'rpc' };
        }
      }catch(_){ /* rede -> fallback */ }
    }
    return { ok: SEED.indexOf(e) >= 0, via:'seed-fallback' };
  }
  async function allows(sb, email){ return (await check(sb, email)).ok; }

  // Barreira pós-login: espera o login (email + __IP_SB) e valida contra a fonte de verdade.
  var _armed=false, _checked=false;
  function _sb(){ return window.__IP_SB || window.sb; }
  async function _enforce(email){
    if(_checked) return;
    var sb=_sb(); if(!sb) return;            // ainda sem client — tenta de novo no próximo tick
    _checked=true;
    var res = await check(sb, email);
    if(res.via==='rpc' && res.ok===false){    // SÓ desloga quando a tabela afirma revogado
      try{ console.warn('[IpAllowlist] acesso revogado na fonte de verdade, deslogando', email); }catch(_){}
      try{ if(sb.auth&&sb.auth.signOut) await sb.auth.signOut(); }catch(_){}
      try{ location.replace('/sistema/?revoked=1'); }catch(_){ location.href='/sistema/'; }
    }
  }
  function arm(){
    if(_armed) return; _armed=true;
    var tries=0;
    var iv=setInterval(function(){
      tries++;
      var em = window.__IP_USER_EMAIL;
      if(em && _sb()){ clearInterval(iv); _enforce(em); }
      else if(tries>40){ clearInterval(iv); }   // ~20s: login não veio, desiste silenciosamente
    }, 500);
  }
  if(document.readyState!=='loading') arm();
  else document.addEventListener('DOMContentLoaded', arm, {once:true});

  window.IpAllowlist = { check: check, allows: allows, _seed: SEED };
})();
