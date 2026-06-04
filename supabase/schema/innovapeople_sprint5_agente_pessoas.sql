-- ============================================================================
-- InnovaPeople · Sprint #5 item 4 · AGENTE DETERMINÍSTICO de cluster de PESSOAS
-- ============================================================================
-- Diretriz CVO: "priorizar leituras determinísticas" — o agente raciocina por REGRAS sobre o
-- estado vivo (que agora flui via Sistema Nervoso: ip_eventos domain=pessoa) e gera sinais
-- estruturados (ip_agent_sugestoes) + ações priorizadas por IREU (ip_plano_acoes). ZERO IA:
-- 100% determinístico, roda no cron, propaga. A IA fica como enriquecimento opcional (on-demand).
-- Espelha fn_ip_agent_programa (já em produção). Idempotente. Guard fn_ip_is_socio. Território ip_*.
-- ============================================================================

-- 'agente_pessoas' é o 7º agente canônico. Preserva os 6 existentes.
ALTER TABLE public.ip_agent_sugestoes DROP CONSTRAINT IF EXISTS ip_agent_sugestoes_agente_check;
ALTER TABLE public.ip_agent_sugestoes ADD CONSTRAINT ip_agent_sugestoes_agente_check
  CHECK (agente = ANY (ARRAY['mattering_coach','knowledge_retention_watchdog','clock_drift_detector',
    'pulse_anomaly_detector','critic_org_designer','programa_evm','agente_pessoas']));

CREATE OR REPLACE FUNCTION public.fn_ip_agente_pessoas(p_mandato_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  r record;
  v_gerados int := 0;
  v_i int; v_r int; v_e int; v_u int; v_ireu int;
  v_titulo text; v_sug text; v_sev text;
BEGIN
  IF NOT fn_ip_is_socio() THEN RAISE EXCEPTION 'acesso restrito'; END IF;

  -- ── REGRA 1 · CLIMA: equipe com risco de saída alto (Pulso, N≥5, anônimo) ──
  FOR r IN
    SELECT equipe, mandato_id, risco_saida, respostas,
           LEAST(proposito,autonomia,competencia,pertencimento,clareza,seguranca) AS pior_dim_val
    FROM v_core_clima_pulso
    WHERE NOT suprimido_privacidade AND risco_saida IS NOT NULL AND risco_saida >= 3.3
      AND (p_mandato_id IS NULL OR mandato_id = p_mandato_id)
  LOOP
    v_titulo := 'Risco de saída elevado em '||r.equipe||' ('||round(r.risco_saida,1)||'/5)';
    v_sug := 'O Pulso anônimo aponta risco de retenção em '||r.equipe||' (risco '||round(r.risco_saida,1)||'/5, menor dimensão '||round(r.pior_dim_val,1)||'/5, N='||r.respostas||'). Conversa estruturada de retenção e ataque à dimensão mais baixa.';
    v_sev := CASE WHEN r.risco_saida >= 3.8 THEN 'critica' ELSE 'alta' END;
    v_i := 5; v_r := 5; v_e := 4; v_u := CASE WHEN r.risco_saida >= 3.8 THEN 5 ELSE 4 END;
    v_ireu := v_i*v_r*v_e*v_u;
    IF NOT EXISTS (SELECT 1 FROM ip_agent_sugestoes WHERE agente='agente_pessoas' AND status='pendente'
                   AND contexto->>'tipo'='clima_risco' AND contexto->>'equipe'=r.equipe) THEN
      INSERT INTO ip_agent_sugestoes(mandato_id, agente, severidade, titulo, sugestao, contexto, status)
      VALUES (r.mandato_id, 'agente_pessoas', v_sev, v_titulo, v_sug,
              jsonb_build_object('tipo','clima_risco','equipe',r.equipe,'risco',r.risco_saida), 'pendente');
      IF r.mandato_id IS NOT NULL THEN
        INSERT INTO ip_plano_acoes(mandato_id, titulo, descricao, frente, origem, ireu_score, impacto, relevancia, efeito_borboleta, urgencia, status)
        VALUES (r.mandato_id, v_titulo, v_sug, 'Pessoas · Retenção', 'sugestao_agente', v_ireu, v_i, v_r, v_e, v_u, 'pendente');
      END IF;
      v_gerados := v_gerados + 1;
    END IF;
  END LOOP;

  -- ── REGRA 2 · DEPENDÊNCIA: operação com headcount perigosamente concentrado (1 ativo) ──
  FOR r IN
    SELECT mandato_id, count(*) FILTER (WHERE status='ativo') AS ativos
    FROM core_colaborador
    WHERE (p_mandato_id IS NULL OR mandato_id = p_mandato_id)
    GROUP BY mandato_id
    HAVING count(*) FILTER (WHERE status='ativo') BETWEEN 1 AND 2
  LOOP
    v_titulo := 'Operação dependente de poucas pessoas ('||r.ativos||' ativo(s))';
    v_sug := 'Headcount ativo muito concentrado ('||r.ativos||'). Risco de continuidade: documentar conhecimento crítico e planejar redundância/sucessão antes que vire ponto único de falha.';
    v_i := 4; v_r := 4; v_e := 5; v_u := 3; v_ireu := v_i*v_r*v_e*v_u;
    IF NOT EXISTS (SELECT 1 FROM ip_agent_sugestoes WHERE agente='agente_pessoas' AND status='pendente'
                   AND contexto->>'tipo'='headcount_concentrado'
                   AND COALESCE(contexto->>'mandato_id','')=COALESCE(r.mandato_id::text,'')) THEN
      INSERT INTO ip_agent_sugestoes(mandato_id, agente, severidade, titulo, sugestao, contexto, status)
      VALUES (r.mandato_id, 'agente_pessoas', 'alta', v_titulo, v_sug,
              jsonb_build_object('tipo','headcount_concentrado','mandato_id',r.mandato_id,'ativos',r.ativos), 'pendente');
      IF r.mandato_id IS NOT NULL THEN
        INSERT INTO ip_plano_acoes(mandato_id, titulo, descricao, frente, origem, ireu_score, impacto, relevancia, efeito_borboleta, urgencia, status)
        VALUES (r.mandato_id, v_titulo, v_sug, 'Pessoas · Continuidade', 'sugestao_agente', v_ireu, v_i, v_r, v_e, v_u, 'pendente');
      END IF;
      v_gerados := v_gerados + 1;
    END IF;
  END LOOP;

  -- ── REGRA 3 · GOVERNANÇA: ações pendentes sem dono (responsável vazio) há tempo ──
  FOR r IN
    SELECT mandato_id, count(*) AS n
    FROM ip_plano_acoes
    WHERE status='pendente' AND (responsavel IS NULL OR responsavel='')
      AND created_at < now() - interval '3 days'
      AND (p_mandato_id IS NULL OR mandato_id = p_mandato_id)
    GROUP BY mandato_id HAVING count(*) >= 2
  LOOP
    v_titulo := r.n||' ações pendentes sem responsável';
    v_sug := 'Há '||r.n||' ações no plano sem dono há mais de 3 dias. Sem responsável, não andam: atribuir dono e prazo a cada uma na próxima revisão.';
    v_i := 3; v_r := 4; v_e := 3; v_u := 4; v_ireu := v_i*v_r*v_e*v_u;
    IF NOT EXISTS (SELECT 1 FROM ip_agent_sugestoes WHERE agente='agente_pessoas' AND status='pendente'
                   AND contexto->>'tipo'='acoes_sem_dono'
                   AND COALESCE(contexto->>'mandato_id','')=COALESCE(r.mandato_id::text,'')) THEN
      INSERT INTO ip_agent_sugestoes(mandato_id, agente, severidade, titulo, sugestao, contexto, status)
      VALUES (r.mandato_id, 'agente_pessoas', 'media', v_titulo, v_sug,
              jsonb_build_object('tipo','acoes_sem_dono','mandato_id',r.mandato_id,'n',r.n), 'pendente');
      v_gerados := v_gerados + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'sinais_gerados', v_gerados, 'agente', 'agente_pessoas');
END;
$fn$;

INSERT INTO public.core_schema_version (patch, descricao)
VALUES ('sprint5-agente-pessoas', 'fn_ip_agente_pessoas: agente determinístico de cluster de pessoas (clima/headcount/governança) -> ip_agent_sugestoes + ip_plano_acoes IREU, idempotente')
ON CONFLICT (patch) DO NOTHING;
