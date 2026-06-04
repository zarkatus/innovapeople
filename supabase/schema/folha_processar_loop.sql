-- ============================================================================
-- InnovaPeople · FECHAR O LOOP da folha (fn_ip_folha_processar) — IS ⇄ IP
-- ============================================================================
-- O pipeline C&S→InnovaSphere→InnovaPeople já chega ao inbox (ip_folha_pagamento_inbox)
-- via fn_folha_encaminhar_ip. MAS quando a InnovaPeople processa, NADA voltava para a
-- InnovaSphere — a folha-origem (plat_folha_pagamento) ficava 'encaminhada_ip' para sempre.
-- Esta RPC fecha o ciclo: processa no inbox IP E carimba de volta na folha-origem (mesmo banco).
-- Tudo numa transação. Determinístico, sem LLM. Guard fn_ip_is_socio.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_ip_folha_processar(p_inbox_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_inbox record; v_origem_id uuid;
BEGIN
  IF NOT fn_ip_is_socio() THEN RAISE EXCEPTION 'acesso restrito'; END IF;
  SELECT * INTO v_inbox FROM ip_folha_pagamento_inbox WHERE id=p_inbox_id;
  IF v_inbox.id IS NULL THEN RAISE EXCEPTION 'folha do inbox não encontrada'; END IF;

  -- 1) transiciona o inbox IP → processada (idempotente: reprocessar só re-carimba)
  UPDATE ip_folha_pagamento_inbox
     SET estado='processada', processado_em=COALESCE(processado_em, now())
   WHERE id=p_inbox_id;

  -- 2) FECHA O LOOP: carimba de volta a folha-origem na InnovaSphere (link por origem_is_id)
  v_origem_id := v_inbox.origem_is_id;
  IF v_origem_id IS NOT NULL THEN
    UPDATE plat_folha_pagamento
       SET estado='processada_ip',
           historico = COALESCE(historico,'[]'::jsonb) || jsonb_build_object(
             'em', now(), 'acao', 'processada_ip',
             'por', COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'email','sistema'),
             'ip_inbox_id', p_inbox_id),
           updated_at = now()
     WHERE id=v_origem_id
       AND estado IN ('encaminhada_ip','processada_ip'); -- não sobrescreve se já enviada_cs
  END IF;

  RETURN jsonb_build_object('ok',true,'inbox_id',p_inbox_id,'origem_is_id',v_origem_id,
    'loop_fechado', (v_origem_id IS NOT NULL));
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.fn_ip_folha_processar(uuid) TO authenticated;

COMMENT ON FUNCTION public.fn_ip_folha_processar(uuid) IS
  'Processa a folha no inbox da InnovaPeople E carimba de volta plat_folha_pagamento=processada_ip '
  '(fecha o loop IS⇄IP). Substitui o UPDATE direto da UI. Guard fn_ip_is_socio. Intra-banco.';

INSERT INTO public.core_schema_version (patch, descricao)
VALUES ('folha-processar-loop', 'fn_ip_folha_processar: processa inbox IP + carimba de volta plat_folha_pagamento=processada_ip + historico (fecha o ciclo IS<->IP)')
ON CONFLICT (patch) DO NOTHING;
