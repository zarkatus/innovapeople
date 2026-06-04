-- ============================================================================
-- InnovaPeople · GRAFO DE PARTICIPAÇÃO SOCIETÁRIA (ip_org_ownership) — IFRS-10 / NCI
-- ============================================================================
-- A ÁRVORE (ip_org_node) é a GESTÃO; o GRAFO (ip_org_ownership) é a PROPRIEDADE — nunca misturar.
-- Quem controla quem, com % e MÉTODO de consolidação contábil:
--   consolidacao (controlada, >50% ou controle): consolida 100% + separa fatia NCI (não-controladores)
--   equity (coligada, 20-50%): só o resultado proporcional
--   custo (investida, <20%): só o custo do investimento
-- OPCIONAL/sob convite (progressive disclosure): só existe quando uma holding real é declarada.
-- Sem ownership, o rollup financeiro degrada para soma 100% (startup não precisa disto).
-- Idempotente. Guard fn_ip_is_socio. Efetivo-datado (vigência). Blueprint do painel adversarial.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ip_org_ownership (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  de_no           uuid NOT NULL REFERENCES public.ip_org_node(id) ON DELETE CASCADE, -- quem detém
  para_no         uuid NOT NULL REFERENCES public.ip_org_node(id) ON DELETE CASCADE, -- quem é detido
  percentual      numeric NOT NULL CHECK (percentual > 0 AND percentual <= 100),
  metodo          text NOT NULL CHECK (metodo IN ('consolidacao','equity','custo')),
  controla        boolean NOT NULL DEFAULT false,   -- controle de fato (pode ser <50% com acordo)
  observacoes     text,
  vigencia_inicio date NOT NULL DEFAULT current_date,
  vigencia_fim    date,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  CHECK (de_no <> para_no)
);
CREATE INDEX IF NOT EXISTS idx_ownership_de  ON public.ip_org_ownership(de_no);
CREATE INDEX IF NOT EXISTS idx_ownership_para ON public.ip_org_ownership(para_no);

COMMENT ON TABLE public.ip_org_ownership IS
  'Grafo de participação societária (IFRS-10). de_no detém para_no com percentual e método '
  '(consolidacao/equity/custo). controla=true => consolida 100% + NCI. FORA da árvore de gestão.';

ALTER TABLE public.ip_org_ownership ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ip_ownership_socios ON public.ip_org_ownership;
CREATE POLICY ip_ownership_socios ON public.ip_org_ownership FOR ALL
  USING (fn_ip_is_socio()) WITH CHECK (fn_ip_is_socio());

-- ── declarar/atualizar participação (a UI chama isto) ──
CREATE OR REPLACE FUNCTION public.fn_ip_ownership_declarar(
  p_de uuid, p_para uuid, p_percentual numeric, p_metodo text DEFAULT NULL, p_controla boolean DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_id uuid; v_metodo text; v_controla boolean;
BEGIN
  IF NOT fn_ip_is_socio() THEN RAISE EXCEPTION 'acesso restrito'; END IF;
  IF p_de = p_para THEN RAISE EXCEPTION 'um nó não pode deter a si mesmo'; END IF;
  IF p_percentual IS NULL OR p_percentual <= 0 OR p_percentual > 100 THEN RAISE EXCEPTION 'percentual inválido (0-100)'; END IF;
  -- método derivado do percentual se não informado (IFRS-10): >50 consolida, 20-50 equity, <20 custo
  v_controla := COALESCE(p_controla, p_percentual > 50);
  v_metodo := COALESCE(NULLIF(p_metodo,''), CASE WHEN v_controla OR p_percentual > 50 THEN 'consolidacao'
                                                  WHEN p_percentual >= 20 THEN 'equity' ELSE 'custo' END);
  -- encerra participação vigente anterior do mesmo par (efetivo-datado) e cria a nova
  UPDATE ip_org_ownership SET vigencia_fim = current_date
   WHERE de_no=p_de AND para_no=p_para AND vigencia_fim IS NULL;
  INSERT INTO ip_org_ownership(de_no, para_no, percentual, metodo, controla)
  VALUES (p_de, p_para, p_percentual, v_metodo, v_controla)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok',true,'id',v_id,'metodo',v_metodo,'controla',v_controla);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.fn_ip_ownership_declarar(uuid,uuid,numeric,text,boolean) TO authenticated;

-- ── estrutura de propriedade de um nó: quem ele detém (vigente) ──
CREATE OR REPLACE FUNCTION public.fn_ip_ownership_estrutura(p_node_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_arr jsonb;
BEGIN
  IF NOT fn_ip_is_socio() THEN RAISE EXCEPTION 'acesso restrito'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'para_no', o.para_no, 'nome', n.nome, 'percentual', o.percentual,
           'metodo', o.metodo, 'controla', o.controla) ORDER BY o.percentual DESC), '[]'::jsonb)
    INTO v_arr
  FROM ip_org_ownership o JOIN ip_org_node n ON n.id=o.para_no
  WHERE o.de_no=p_node_id AND o.vigencia_fim IS NULL;
  RETURN jsonb_build_object('participacoes', v_arr);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.fn_ip_ownership_estrutura(uuid) TO authenticated;

-- ── ROLLUP FINANCEIRO ponderado por método (IFRS-10 + NCI) ──
-- consolida o resultado das participadas conforme o método; reusa o resultado por obra/empresa.
-- Sem ownership declarado, degrada para soma 100% dos descendentes da árvore (startup).
CREATE OR REPLACE FUNCTION public.fn_ip_org_financeiro_rollup(p_node_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  r record; v_consolidado numeric := 0; v_nci numeric := 0; v_equity numeric := 0;
  v_tem_ownership boolean; v_root ltree; v_soma_arvore numeric := 0;
BEGIN
  IF NOT fn_ip_is_socio() THEN RAISE EXCEPTION 'acesso restrito'; END IF;
  SELECT EXISTS(SELECT 1 FROM ip_org_ownership WHERE de_no=p_node_id AND vigencia_fim IS NULL) INTO v_tem_ownership;

  -- base: resultado líquido de cada empresa (folha) = soma das apurações fechadas (proxy do EVM como fallback)
  IF v_tem_ownership THEN
    -- ponderado por método sobre as participadas declaradas
    FOR r IN
      SELECT o.percentual, o.metodo, o.controla,
             COALESCE((SELECT SUM(resultado_liquido) FROM plat_resultado_apuracao a
                       JOIN ip_org_node nn ON nn.id=o.para_no
                       WHERE a.status='fechada' AND a.project_id = (nn.metadata->>'project_id')),0) AS resultado
      FROM ip_org_ownership o WHERE o.de_no=p_node_id AND o.vigencia_fim IS NULL
    LOOP
      IF r.metodo='consolidacao' THEN
        v_consolidado := v_consolidado + r.resultado;                    -- 100% consolidado
        v_nci := v_nci + r.resultado * (100 - r.percentual)/100.0;       -- fatia dos não-controladores
      ELSIF r.metodo='equity' THEN
        v_equity := v_equity + r.resultado * r.percentual/100.0;         -- só proporcional
      END IF; -- custo: não entra no resultado (só valor de investimento)
    END LOOP;
    RETURN jsonb_build_object('metodo','ifrs10','tem_ownership',true,
      'resultado_consolidado', round(v_consolidado,2),
      'atribuivel_controlador', round(v_consolidado - v_nci + v_equity,2),
      'participacao_nao_controladores', round(v_nci,2),
      'resultado_equity', round(v_equity,2));
  ELSE
    -- degradação: soma 100% dos descendentes da árvore (sem grafo de propriedade)
    SELECT path INTO v_root FROM ip_org_node WHERE id=p_node_id;
    SELECT COALESCE(SUM(a.resultado_liquido),0) INTO v_soma_arvore
    FROM plat_resultado_apuracao a WHERE a.status='fechada'
      AND a.project_id IN (SELECT nn.metadata->>'project_id' FROM ip_org_node nn WHERE nn.path <@ v_root AND nn.status='ativo');
    RETURN jsonb_build_object('metodo','soma_simples','tem_ownership',false,
      'resultado_consolidado', round(v_soma_arvore,2),
      'atribuivel_controlador', round(v_soma_arvore,2),
      'participacao_nao_controladores', 0, 'resultado_equity', 0);
  END IF;
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.fn_ip_org_financeiro_rollup(uuid) TO authenticated;

INSERT INTO public.core_schema_version (patch, descricao)
VALUES ('org-ownership', 'ip_org_ownership (grafo IFRS-10) + declarar/estrutura + financeiro_rollup ponderado por método (consolidacao/equity/custo + NCI), degrada p/ soma simples sem ownership')
ON CONFLICT (patch) DO NOTHING;
