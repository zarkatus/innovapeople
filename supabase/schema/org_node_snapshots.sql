-- ============================================================================
-- InnovaPeople · HISTÓRICO DE ROLLUPS (ip_org_node_snapshots) — evolução temporal dos nós
-- ============================================================================
-- Os rollups (fn_ip_org_*_rollup) só dizem "como o nó está AGORA". Este histórico congela
-- uma FOTO periódica de cada nó (cron diário) para responder "como EVOLUIU":
--   'o grupo cresceu de 5 p/ 12 empresas em 6 meses', 'o CPI do grupo caiu 0.08 no trimestre'.
-- Uma linha por (nó, data) com os 5 rollups em jsonb. Idempotente. Guard fn_ip_is_socio.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ip_org_node_snapshots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id     uuid NOT NULL REFERENCES public.ip_org_node(id) ON DELETE CASCADE,
  data_ref    date NOT NULL DEFAULT current_date,
  tipo_no     text,                     -- desnormalizado p/ filtrar séries sem join
  evm         jsonb,                    -- fn_ip_org_evm_rollup
  pessoas     jsonb,                    -- fn_ip_org_pessoas_rollup
  clima       jsonb,                    -- fn_ip_org_clima_rollup
  dd          jsonb,                    -- fn_ip_org_dd_rollup
  financeiro  jsonb,                    -- fn_ip_org_financeiro_rollup
  criado_em   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (node_id, data_ref)            -- 1 foto por nó por dia (recaptura sobrescreve)
);
CREATE INDEX IF NOT EXISTS idx_org_snap_node_data ON public.ip_org_node_snapshots(node_id, data_ref);

COMMENT ON TABLE public.ip_org_node_snapshots IS
  'Foto diária dos rollups de cada nó da Espinha (evm/pessoas/clima/dd/financeiro em jsonb). '
  'Série temporal p/ ver evolução. Cron diário via fn_ip_org_snapshot_todos.';

ALTER TABLE public.ip_org_node_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ip_org_snap_socios ON public.ip_org_node_snapshots;
CREATE POLICY ip_org_snap_socios ON public.ip_org_node_snapshots FOR ALL
  USING (fn_ip_is_socio()) WITH CHECK (fn_ip_is_socio());

-- ── captura a foto de UM nó (idempotente por nó+dia: ON CONFLICT sobrescreve) ──
CREATE OR REPLACE FUNCTION public.fn_ip_org_snapshot_capturar(p_node_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_tipo text; v_evm jsonb; v_pes jsonb; v_cli jsonb; v_dd jsonb; v_fin jsonb;
BEGIN
  IF NOT fn_ip_is_socio() THEN RAISE EXCEPTION 'acesso restrito'; END IF;
  SELECT tipo_no INTO v_tipo FROM ip_org_node WHERE id=p_node_id;
  IF v_tipo IS NULL THEN RAISE EXCEPTION 'nó não encontrado'; END IF;
  -- chama os rollups existentes (cada um já tem guard próprio); tolera nulos
  v_evm := fn_ip_org_evm_rollup(p_node_id);
  v_pes := fn_ip_org_pessoas_rollup(p_node_id);
  v_cli := fn_ip_org_clima_rollup(p_node_id);
  v_dd  := fn_ip_org_dd_rollup(p_node_id);
  BEGIN v_fin := fn_ip_org_financeiro_rollup(p_node_id); EXCEPTION WHEN OTHERS THEN v_fin := NULL; END;
  INSERT INTO ip_org_node_snapshots(node_id, data_ref, tipo_no, evm, pessoas, clima, dd, financeiro)
  VALUES (p_node_id, current_date, v_tipo, v_evm, v_pes, v_cli, v_dd, v_fin)
  ON CONFLICT (node_id, data_ref) DO UPDATE SET
    tipo_no=EXCLUDED.tipo_no, evm=EXCLUDED.evm, pessoas=EXCLUDED.pessoas,
    clima=EXCLUDED.clima, dd=EXCLUDED.dd, financeiro=EXCLUDED.financeiro, criado_em=now();
  RETURN jsonb_build_object('ok',true,'node_id',p_node_id,'data',current_date);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.fn_ip_org_snapshot_capturar(uuid) TO authenticated;

-- ── captura TODOS os nós ativos (o cron diário chama esta) ──
CREATE OR REPLACE FUNCTION public.fn_ip_org_snapshot_todos()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE r record; v_n int := 0;
BEGIN
  -- SECURITY DEFINER + sem guard de sócio: roda no contexto do cron (sem JWT). Itera nós ativos.
  FOR r IN SELECT id FROM ip_org_node WHERE status='ativo' LOOP
    PERFORM _fn_ip_org_snapshot_um(r.id);
    v_n := v_n + 1;
  END LOOP;
  RETURN jsonb_build_object('ok',true,'nos',v_n,'data',current_date);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.fn_ip_org_snapshot_todos() TO authenticated;

-- helper interno sem guard (usado só pelo _todos, que roda no cron); idêntico ao capturar mas sem fn_ip_is_socio
CREATE OR REPLACE FUNCTION public._fn_ip_org_snapshot_um(p_node_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_tipo text; v_evm jsonb; v_pes jsonb; v_cli jsonb; v_dd jsonb; v_fin jsonb;
BEGIN
  SELECT tipo_no INTO v_tipo FROM ip_org_node WHERE id=p_node_id;
  IF v_tipo IS NULL THEN RETURN; END IF;
  BEGIN v_evm := fn_ip_org_evm_rollup(p_node_id); EXCEPTION WHEN OTHERS THEN v_evm := NULL; END;
  BEGIN v_pes := fn_ip_org_pessoas_rollup(p_node_id); EXCEPTION WHEN OTHERS THEN v_pes := NULL; END;
  BEGIN v_cli := fn_ip_org_clima_rollup(p_node_id); EXCEPTION WHEN OTHERS THEN v_cli := NULL; END;
  BEGIN v_dd  := fn_ip_org_dd_rollup(p_node_id); EXCEPTION WHEN OTHERS THEN v_dd := NULL; END;
  BEGIN v_fin := fn_ip_org_financeiro_rollup(p_node_id); EXCEPTION WHEN OTHERS THEN v_fin := NULL; END;
  INSERT INTO ip_org_node_snapshots(node_id, data_ref, tipo_no, evm, pessoas, clima, dd, financeiro)
  VALUES (p_node_id, current_date, v_tipo, v_evm, v_pes, v_cli, v_dd, v_fin)
  ON CONFLICT (node_id, data_ref) DO UPDATE SET
    tipo_no=EXCLUDED.tipo_no, evm=EXCLUDED.evm, pessoas=EXCLUDED.pessoas,
    clima=EXCLUDED.clima, dd=EXCLUDED.dd, financeiro=EXCLUDED.financeiro, criado_em=now();
END;
$fn$;

-- ── SÉRIE TEMPORAL de uma métrica (a UI chama p/ desenhar sparkline + delta) ──
-- p_metrica usa caminho 'bloco.campo' (ex: 'evm.avanco_pct','evm.cpi','pessoas.ativos','financeiro.atribuivel_controlador')
CREATE OR REPLACE FUNCTION public.fn_ip_org_snapshot_serie(p_node_id uuid, p_metrica text, p_dias int DEFAULT 180)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_bloco text; v_campo text; v_pos int; v_arr jsonb;
BEGIN
  IF NOT fn_ip_is_socio() THEN RAISE EXCEPTION 'acesso restrito'; END IF;
  v_pos := position('.' in p_metrica);
  IF v_pos = 0 THEN RAISE EXCEPTION 'métrica deve ser bloco.campo (ex: evm.cpi)'; END IF;
  v_bloco := left(p_metrica, v_pos-1);
  v_campo := substring(p_metrica from v_pos+1);
  IF v_bloco NOT IN ('evm','pessoas','clima','dd','financeiro') THEN RAISE EXCEPTION 'bloco inválido: %', v_bloco; END IF;
  EXECUTE format($q$
    SELECT COALESCE(jsonb_agg(jsonb_build_object('data', data_ref, 'v', (%I ->> %L)::numeric) ORDER BY data_ref), '[]'::jsonb)
    FROM ip_org_node_snapshots
    WHERE node_id = $1 AND data_ref >= current_date - $2 AND (%I ->> %L) IS NOT NULL
  $q$, v_bloco, v_campo, v_bloco, v_campo)
  INTO v_arr USING p_node_id, p_dias;
  RETURN jsonb_build_object('metrica', p_metrica, 'pontos', v_arr);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.fn_ip_org_snapshot_serie(uuid,text,int) TO authenticated;

-- ── cron diário (06:10 UTC = 03:10 BRT): captura a foto de todos os nós ──
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule('ip_org_snapshot_diario') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='ip_org_snapshot_diario');
    PERFORM cron.schedule('ip_org_snapshot_diario', '10 6 * * *', 'SELECT public.fn_ip_org_snapshot_todos();');
  END IF;
END;
$cron$;

INSERT INTO public.core_schema_version (patch, descricao)
VALUES ('org-node-snapshots', 'ip_org_node_snapshots (foto diária dos 5 rollups por nó) + capturar/todos/_um + serie(bloco.campo) + cron ip_org_snapshot_diario 03:10 BRT')
ON CONFLICT (patch) DO NOTHING;
