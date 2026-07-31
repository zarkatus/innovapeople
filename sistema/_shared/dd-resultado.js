// InnovaPeople · CAIXA DE RESULTADO da Due Diligence de PESSOA (dd-resultado.js) · PQV-01 04/06
// A "caixa que se abre" com TUDO que a DD-PF conseguiu — grátis e determinístico — após o
// consentimento. Imprimir + Gerar PDF. Provedores pagos aparecem como "disponível ao ativar"
// (honesto, nunca inventa dado). Mostra o lastro do consentimento (hash) p/ auditoria LGPD.
// API: window.IpDdResultado.render(hostEl, { cpf, nome, t0, consentimento, avancado, sancoes })
//      window.IpDdResultado.pesquisar({ cpf, nome, contexto_origem, finalidades }) -> Promise<dados>
(function(){
  'use strict';
  if(window.IpDdResultado) return;
  var SB=function(){ return window.__IP_SB||window.sb; };
  var esc=function(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); };
  function fmtCpf(c){ c=String(c||'').replace(/\D/g,''); return c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4'); }
  function hoje(){ try{ return new Date().toLocaleString('pt-BR'); }catch(_){ return ''; } }

  // rótulos amigáveis por finalidade
  var FINLAB={ situacao_cadastral:'Situação cadastral (Receita)', certidoes:'Certidões negativas', pep_sancoes:'PEP e sanções',
    credito_score:'Crédito e restritivos', processos:'Processos judiciais', kyc_biometria:'Identidade (biometria)', vinculos_renda:'Renda (Gov.br)' };

  // ── pesquisa: roda T0+avançado (gate por consentimento na EF) + sanções (grátis, Portal) ──
  async function pesquisar(opts){
    opts=opts||{}; var sb=SB(); var cpf=String(opts.cpf||'').replace(/\D/g,'');
    var out={ cpf:cpf, nome:opts.nome||'', t0:null, avancado:null, sancoes:null };
    try{
      var r=await sb.functions.invoke('dd-pessoa-tiers',{body:{project_id:opts.project_id||'ip',pessoa_doc:cpf,contexto_origem:opts.contexto_origem||'cliente_curadoria',finalidades:opts.finalidades||[]}});
      if(!r.error){ out.t0=(r.data&&r.data.tier0)||null; out.avancado=r.data||null; }
    }catch(_){}
    // sanções: só se PEP/sanções foi consentido (ou sempre, é grátis/honesto). Roda dd-sancoes por CPF.
    if((opts.finalidades||[]).indexOf('pep_sancoes')>=0){
      try{ var s=await sb.functions.invoke('dd-sancoes',{body:{doc:cpf,tipo:'cpf',nome:opts.nome||''}}); if(!s.error) out.sancoes=s.data||null; }catch(_){}
    }
    return out;
  }

  function _css(){
    if(document.getElementById('ddr-css'))return;
    var st=document.createElement('style'); st.id='ddr-css';
    st.textContent=
      '.ddr{background:var(--white,#fff);border:1px solid var(--border,#E5DFD2);border-radius:12px;padding:0;margin-top:14px;overflow:hidden}'
     +'.ddr-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;background:linear-gradient(135deg,#0C1626,#0A1320);color:#F7F3EC}'
     +'.ddr-head h3{font:600 italic 18px Georgia;color:#E9A578;margin:0}'
     +'.ddr-head .meta{font-size:11px;color:#9FB0C5;margin-top:3px}'
     +'.ddr-actions{display:flex;gap:8px}'
     +'.ddr-btn{padding:8px 14px;border-radius:9px;font:600 12px/1 system-ui;cursor:pointer;border:1px solid rgba(229,199,126,.4);background:transparent;color:#E9A578;transition:.15s}'
     +'.ddr-btn:hover{background:rgba(229,199,126,.14)}'
     +'.ddr-btn.solid{background:#E9A578;color:#1a1205;border-color:#E9A578}'
     +'.ddr-body{padding:18px 20px}'
     +'.ddr-sec{margin-bottom:18px}'
     +'.ddr-sec-h{font:600 10px/1 system-ui;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3,#8A8170);margin-bottom:8px;display:flex;align-items:center;gap:8px}'
     +'.ddr-row{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--border,#EFEAE0);font-size:13.5px}'
     +'.ddr-row .k{color:var(--ink2,#5A5446)}.ddr-row .v{color:var(--navy,#0A1320);font-weight:600;text-align:right}'
     +'.ddr-pill{display:inline-flex;align-items:center;gap:5px;font:700 11px/1 system-ui;padding:6px 11px;border-radius:16px}'
     +'.ddr-ok{background:rgba(46,125,50,.12);color:#1B7A3D}.ddr-warn{background:rgba(200,89,36,.16);color:#8C6B2E}.ddr-no{background:rgba(183,28,28,.1);color:#B71C1C}.ddr-pend{background:rgba(120,120,120,.1);color:#6b6256}'
     +'.ddr-card{border:1px solid var(--border,#EFEAE0);border-radius:9px;padding:12px 14px;margin-bottom:8px}'
     +'.ddr-card .t{font-size:13px;font-weight:600;color:var(--navy,#0A1320)}.ddr-card .d{font-size:11.5px;color:var(--ink3,#8A8170);margin-top:3px}'
     +'.ddr-lastro{font-size:10.5px;color:var(--ink3,#8A8170);font-style:italic;border-top:1px dashed var(--border,#E5DFD2);padding-top:10px;margin-top:6px}'
     +'@media print{ body *{visibility:hidden} .ddr,.ddr *{visibility:visible} .ddr{position:absolute;left:0;top:0;width:100%;border:none;margin:0} .ddr-actions{display:none} }';
    (document.head||document.documentElement).appendChild(st);
  }

  function _statusPill(o){
    if(!o) return '<span class="ddr-pill ddr-pend">não consultado</span>';
    if(o._status===503) return '<span class="ddr-pill ddr-warn">⚡ disponível ao ativar provedor</span>';
    if(o._status===501) return '<span class="ddr-pill ddr-warn">conector a implementar</span>';
    if(o._status&&o._status>=400) return '<span class="ddr-pill ddr-no">erro '+o._status+'</span>';
    return '<span class="ddr-pill ddr-ok">✓ consultado</span>';
  }

  function render(host, d){
    if(!host) return; _css(); d=d||{};
    var cpf=fmtCpf(d.cpf), t0=d.t0||{}, av=d.avancado||{}, sanc=d.sancoes||{}, cons=d.consentimento||null;
    var valido = (t0.validacao&&t0.validacao.valido) || (av.cpf_valido);
    var empresas = (t0.societario&&t0.societario.empresas)||[];

    // sanções (grátis via Portal; ou "pendente de token grátis")
    var sancHtml='';
    if(sanc && sanc.ok===false && /pendente|cadastr/i.test(sanc.resumo||'')){
      sancHtml='<div class="ddr-card"><div class="t">PEP e sanções (CEIS/CNEP) <span class="ddr-pill ddr-pend">fonte grátis · pendente de token</span></div><div class="d">'+esc(sanc.resumo||'Cadastro gratuito no Portal da Transparência libera esta verificação, sem custo.')+'</div></div>';
    } else if(sanc && (sanc.fontes||sanc.ceis!==undefined)){
      var nada = !(sanc.ceis&&sanc.ceis.length) && !(sanc.cnep&&sanc.cnep.length) && !(sanc.pep&&sanc.pep.length);
      sancHtml='<div class="ddr-card"><div class="t">PEP e sanções '+(nada?'<span class="ddr-pill ddr-ok">nada consta</span>':'<span class="ddr-pill ddr-no">há registros</span>')+'</div>'
        +'<div class="d">CEIS '+((sanc.ceis||[]).length)+' · CNEP '+((sanc.cnep||[]).length)+' · PEP '+((sanc.pep||[]).length)+' (Portal da Transparência)</div></div>';
    }

    // finalidades avançadas consentidas → status de cada (grátis/pago/ativar)
    var avHtml='';
    var tc=(av.tiers_consentidos)||{}, tb=(av.tiers_bloqueados)||[];
    Object.keys(tc).forEach(function(f){ avHtml+='<div class="ddr-card"><div class="t">'+esc(FINLAB[f]||f)+' '+_statusPill(tc[f])+'</div>'+(tc[f]&&tc[f].erro?'<div class="d">'+esc(tc[f].erro)+'</div>':'')+'</div>'; });
    tb.forEach(function(b){ avHtml+='<div class="ddr-card"><div class="t">'+esc(FINLAB[b.finalidade]||b.finalidade)+' <span class="ddr-pill ddr-pend">sem consentimento</span></div></div>'; });
    if(!avHtml) avHtml='<div class="d" style="font-size:12px;color:var(--ink3)">Nenhuma pesquisa avançada solicitada. Solicite o consentimento da pessoa para liberar situação cadastral, sanções, crédito e mais.</div>';

    var lastro = cons ? ('Consentimento registrado em '+hoje()+' · '+((cons.finalidades&&cons.finalidades.length)||(cons.n_fins)||'?')+' finalidade(s) · hash '+esc(String(cons.hash||cons.termo_hash||'').slice(0,16))+'… · versão '+esc(cons.versao||cons.termo_versao||'dd-pf-v1')+'. Lastro imutável no cofre LGPD.') : 'Pesquisa pública (T0) — sem consentimento avançado registrado.';

    host.innerHTML=''
      +'<div class="ddr" id="ddr-print">'
      +'<div class="ddr-head"><div><h3>Due Diligence · Pessoa Física</h3><div class="meta">CPF '+esc(cpf)+(d.nome?' · '+esc(d.nome):'')+' · gerado em '+esc(hoje())+'</div></div>'
        +'<div class="ddr-actions"><button class="ddr-btn" id="ddr-print-btn">🖨 Imprimir</button><button class="ddr-btn solid" id="ddr-pdf-btn">⬇ Gerar PDF</button></div></div>'
      +'<div class="ddr-body">'
        +'<div class="ddr-sec"><div class="ddr-sec-h">Validação</div>'
          +'<div class="ddr-row"><span class="k">CPF</span><span class="v">'+(valido?'<span class="ddr-pill ddr-ok">✓ válido</span>':'<span class="ddr-pill ddr-no">inválido</span>')+'</span></div></div>'
        +'<div class="ddr-sec"><div class="ddr-sec-h">Participação societária <span class="ddr-pill ddr-ok">público · grátis</span></div>'
          +(empresas.length? empresas.map(function(e){ return '<div class="ddr-card"><div class="t">'+esc(e.empresa||'(empresa)')+'</div><div class="d">'+esc(e.qualificacao||'sócio')+(e.cnpj?' · CNPJ '+esc(e.cnpj):'')+'</div></div>'; }).join('')
              : '<div class="d" style="font-size:12px;color:var(--ink3)">Nenhuma empresa encontrada na base (cruzamento dos 6 dígitos centrais × QSA público).</div>')
          +'</div>'
        +(sancHtml?'<div class="ddr-sec"><div class="ddr-sec-h">Sanções e PEP</div>'+sancHtml+'</div>':'')
        +'<div class="ddr-sec"><div class="ddr-sec-h">Pesquisas avançadas</div>'+avHtml+'</div>'
        +'<div class="ddr-lastro">'+esc(lastro)+'</div>'
      +'</div></div>';

    var pb=host.querySelector('#ddr-print-btn'); if(pb) pb.onclick=function(){ window.print(); };
    var pdf=host.querySelector('#ddr-pdf-btn'); if(pdf) pdf.onclick=function(){ _gerarPdf(host.querySelector('#ddr-print'), cpf); };
  }

  // PDF: usa a impressão do navegador (Salvar como PDF) — sem dependência externa, determinístico.
  // Abre uma janela só com a caixa e dispara print → o usuário escolhe "Salvar como PDF".
  function _gerarPdf(node, cpf){
    if(!node){ window.print(); return; }
    var w=window.open('','_blank','width=820,height=1000');
    if(!w){ window.print(); return; } // popup bloqueado → cai na impressão normal
    var css=document.getElementById('ddr-css'); var cssTxt=css?css.textContent:'';
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>DD · CPF '+esc(cpf)+'</title>'
      +'<style>body{margin:0;font-family:system-ui,Inter,sans-serif;background:#fff;padding:18px}'+cssTxt+' .ddr-actions{display:none!important}</style></head><body>'
      +node.outerHTML+'<script>setTimeout(function(){window.print();},250);<\/script></body></html>');
    w.document.close();
  }

  window.IpDdResultado = { render:render, pesquisar:pesquisar };
})();
