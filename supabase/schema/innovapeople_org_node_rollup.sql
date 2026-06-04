-- ============================================================================
-- InnovaPeople · Espinha Org · PASSO 2 (rollup) + PASSO 3 (carimbo no Sistema Nervoso)
-- ============================================================================
-- Rollup: funções que agregam métricas por SUBÁRVORE reusando o que já existe, via o conjunto
-- de mandatos descendentes (fn_ip_org_descendentes). Assinaturas antigas INTACTAS (zero regressão).
-- Carimbo: ip_eventos ganha org_node_id (nullable); a função de captura resolve o nó pelo mandato.
-- Idempotente. Determinístico (sem IA). Preserva tudo.
-- ============================================================================

-- ── ROLLUP EVM por nó: soma PV/EV/AC dos programas dos mandatos da subárvore + CPI/SPI consolidados ──
CREATE OR REPLACE FUNCTION public.fn_ip_org_evm_rollup(p_node_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_pv numeric; v_ev numeric; v_ac numeric; v_nprog int; v_nempresas int;
BEGIN
  IF NOT fn_ip_is_socio() THEN RAISE EXCEPTION 'acesso restrito'; END IF;
  SELECT COALESCE(SUM(p.pv_total),0), COALESCE(SUM(p.ev_total),0), COALESCE(SUM(p.ac_total),0), COUNT(*)
    INTO v_pv, v_ev, v_ac, v_nprog
  FROM ip_programas p
  WHERE p.mandato_id IN (SELECT mandato_id FROM fn_ip_org_descendentes(p_node_id) WHERE mandato_id IS NOT NULL)
    AND p.status NOT IN ('cancelado');
  SELECT COUNT(*) INTO v_nempresas FROM fn_ip_org_descendentes(p_node_id) WHERE mandato_id IS NOT NULL;
  RETURN jsonb_build_object(
    'pv', v_pv, 'ev', v_ev, 'ac', v_ac, 'programas', v_nprog, 'empresas', v_nempresas,
    'cpi', CASE WHEN v_ac>0 THEN round(v_ev/v_ac,2) ELSE NULL END,
    'spi', CASE WHEN v_pv>0 THEN round(v_ev/v_pv,2) ELSE NULL END,
    'avanco_pct', CASE WHEN v_pv>0 THEN round(v_ev/v_pv*100,0) ELSE 0 END);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.fn_ip_org_evm_rollup(uuid) TO authenticated;

-- ── ROLLUP PESSOAS por nó: headcount + ações IREU pendentes da subárvore ──
CREATE OR REPLACE FUNCTION public.fn_ip_org_pessoas_rollup(p_node_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_ativos int; v_afast int; v_deslig int; v_sinais int; v_acoes_t1 int;
DECLARE v_mandatos uuid[];
BEGIN
  IF NOT fn_ip_is_socio() THEN RAISE EXCEPTION 'acesso restrito'; END IF;
  SELECT array_agg(mandato_id) INTO v_mandatos FROM fn_ip_org_descendentes(p_node_id) WHERE mandato_id IS NOT NULL;
  SELECT count(*) FILTER (WHERE status='ativo'), count(*) FILTER (WHERE status='afastado'), count(*) FILTER (WHERE status='desligado')
    INTO v_ativos, v_afast, v_deslig
  FROM core_colaborador WHERE mandato_id = ANY(v_mandatos);
  SELECT count(*) INTO v_sinais FROM ip_agent_sugestoes WHERE status='pendente' AND mandato_id = ANY(v_mandatos);
  SELECT count(*) INTO v_acoes_t1 FROM ip_plano_acoes WHERE status='pendente' AND ireu_score>=200 AND mandato_id = ANY(v_mandatos);
  RETURN jsonb_build_object('ativos',COALESCE(v_ativos,0),'afastados',COALESCE(v_afast,0),'desligados',COALESCE(v_deslig,0),
    'sinais_pendentes',COALESCE(v_sinais,0),'acoes_tier1',COALESCE(v_acoes_t1,0));
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.fn_ip_org_pessoas_rollup(uuid) TO authenticated;

-- ── ROLLUP CLIMA por nó: Pulso 6D agregado com SUPRESSÃO N<5 APLICADA EM CADA EQUIPE (LGPD) ──
-- suprimir-antes-de-agregar: o nó nunca reconstrói time pequeno por subtração.
CREATE OR REPLACE FUNCTION public.fn_ip_org_clima_rollup(p_node_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_mandatos uuid[]; v_risco numeric; v_equipes int; v_score numeric;
BEGIN
  IF NOT fn_ip_is_socio() THEN RAISE EXCEPTION 'acesso restrito'; END IF;
  SELECT array_agg(mandato_id) INTO v_mandatos FROM fn_ip_org_descendentes(p_node_id) WHERE mandato_id IS NOT NULL;
  -- só equipes visíveis (N>=5) entram no agregado do nó
  SELECT count(*), round(avg(risco_saida),2), round(avg(score_medio),1)
    INTO v_equipes, v_risco, v_score
  FROM v_core_clima_pulso
  WHERE mandato_id = ANY(v_mandatos) AND NOT suprimido_privacidade;
  RETURN jsonb_build_object('equipes_visiveis',COALESCE(v_equipes,0),'risco_saida_medio',v_risco,'score_medio',v_score);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.fn_ip_org_clima_rollup(uuid) TO authenticated;

-- ── PASSO 3 · CARIMBO NO NERVO: ip_eventos ganha org_node_id (nullable); captura resolve o nó ──
ALTER TABLE public.ip_eventos ADD COLUMN IF NOT EXISTS org_node_id uuid;
CREATE INDEX IF NOT EXISTS idx_ip_eventos_org_node ON public.ip_eventos(org_node_id) WHERE org_node_id IS NOT NULL;

-- recria fn_ip_eventbus_capturar com +1 resolução de nó (grava SÓ org_node_id estável, NUNCA path)
CREATE OR REPLACE FUNCTION public.fn_ip_eventbus_capturar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_after jsonb; v_before jsonb; v_mandato_id uuid; v_source_id uuid; v_actor text;
  v_event_type text; v_domain text; v_correlation uuid; v_org_node_id uuid;
BEGIN
  IF TG_OP='DELETE' THEN v_before:=to_jsonb(OLD); v_after:=NULL;
  ELSIF TG_OP='UPDATE' THEN v_before:=to_jsonb(OLD); v_after:=to_jsonb(NEW);
  ELSE v_before:=NULL; v_after:=to_jsonb(NEW); END IF;

  v_mandato_id := COALESCE(
    NULLIF(COALESCE(v_after->>'mandato_id', v_before->>'mandato_id'),'')::uuid,
    CASE WHEN TG_TABLE_NAME='ip_mandatos' THEN NULLIF(COALESCE(v_after->>'id', v_before->>'id'),'')::uuid ELSE NULL END
  );
  v_source_id := NULLIF(COALESCE(v_after->>'id', v_before->>'id'),'')::uuid;

  BEGIN v_actor := auth.email(); EXCEPTION WHEN OTHERS THEN v_actor := NULL; END;
  IF v_actor IS NULL THEN BEGIN v_actor := current_setting('request.jwt.claim.email', true); EXCEPTION WHEN OTHERS THEN v_actor := NULL; END; END IF;
  IF v_actor IS NULL THEN v_actor := CASE WHEN current_user='authenticator' THEN 'service_role' ELSE current_user END; END IF;

  v_event_type := fn_ip_event_type(TG_TABLE_NAME, TG_OP, v_after, v_before);
  v_domain     := fn_ip_event_domain(v_event_type);
  BEGIN v_correlation := NULLIF(current_setting('ip.correlation_id', true),'')::uuid; EXCEPTION WHEN OTHERS THEN v_correlation := NULL; END;

  -- NOVO: resolve o nó organizacional pelo mandato (folha-empresa). Grava SÓ o id estável.
  IF v_mandato_id IS NOT NULL THEN
    SELECT id INTO v_org_node_id FROM ip_org_node WHERE mandato_id = v_mandato_id AND status='ativo' LIMIT 1;
  END IF;

  INSERT INTO public.ip_eventos (
    mandato_id, source_table, source_id, operacao, domain,
    actor_email, before_payload, after_payload,
    event_type, schema_version, correlation_id, org_node_id
  ) VALUES (
    v_mandato_id, TG_TABLE_NAME, v_source_id, TG_OP, v_domain,
    v_actor, v_before, v_after,
    v_event_type, 1, v_correlation, v_org_node_id
  );
  RETURN COALESCE(NEW, OLD);
END;
$fn$;

INSERT INTO public.core_schema_version (patch, descricao)
VALUES ('org-node-rollup', 'rollups por nó (evm/pessoas/clima, supressão N<5) + carimbo org_node_id em ip_eventos via fn_ip_eventbus_capturar')
ON CONFLICT (patch) DO NOTHING;
