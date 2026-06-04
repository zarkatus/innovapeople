-- ============================================================================
-- InnovaPeople · Sprint #5 · SISTEMA NERVOSO (EventBus cognitivo)
-- ============================================================================
-- Fronteira IREU 625 da varredura: o dado de gente ENTRA e MORRE na auditoria —
-- core_colaborador (e 9 pessoa-tables) NÃO emitem para ip_eventos (a trilha
-- cognitiva que agentes IA / IpConcierge / Sala de Guerra / BI consomem). Por isso
-- os agentes re-raciocinam sobre template, não sobre o estado vivo.
--
-- ARQUITETURA (painel adversarial, 3 juízes convergentes; verificada no DDL vivo):
--   ip_eventos = TRILHA COGNITIVA forense append-only (ECST). RETER.
--   eventbus_events/_queue = DESPACHO efêmero (notificação). EXPURGAR.
--   Captura = TRANSACTIONAL OUTBOX nativo (trigger genérico fn_ip_eventbus_capturar,
--             já provado em 15 tabelas ip_*). Custo marginal por tabela futura = 1 linha.
--   Relay = ASSÍNCRONO: SÓ enfileira (eventbus_enqueue), NUNCA eventbus_dispatch_v2
--           síncrono (evita o deadlock 40P01 da crise 02/06 — verificado no DDL).
--   3 colunas aditivas: event_type (intenção de negócio), schema_version (anteparo
--           de forma), correlation_id (grafo causal). Zero backfill obrigatório.
--
-- IDEMPOTENTE: re-rodável sem erro (IF NOT EXISTS / OR REPLACE / DROP-then-CREATE).
-- Diretriz CVO: modularidade absoluta, longevidade, holística sobre eventos futuros,
--               LGPD/RLS (sócios-only), respeitar feriado/horário no despacho.
-- ============================================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- 1. SCHEMA · 3 colunas semânticas aditivas + índices + doutrina no COMMENT
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.ip_eventos
  ADD COLUMN IF NOT EXISTS event_type     text,                       -- intenção de NEGÓCIO (pessoa.colaborador.admitido). NULL p/ 124 legados.
  ADD COLUMN IF NOT EXISTS schema_version smallint NOT NULL DEFAULT 1, -- versão da FORMA do payload; bump quando a tabela-fonte mudar de forma.
  ADD COLUMN IF NOT EXISTS correlation_id uuid;                        -- cadeia causal (admissão→OKR inicial→1ª decisão). NULL quando ausente.

CREATE INDEX IF NOT EXISTS idx_ip_eventos_event_type   ON public.ip_eventos(event_type, ts DESC);
CREATE INDEX IF NOT EXISTS idx_ip_eventos_correlation  ON public.ip_eventos(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ip_eventos_mandato_ts   ON public.ip_eventos(mandato_id, ts DESC);

COMMENT ON TABLE public.ip_eventos IS
  'TRILHA COGNITIVA forense append-only (ECST). FRONTEIRA: ip_eventos=cognição imutável (RETER); '
  'eventbus_events/_queue=despacho efêmero (EXPURGAR — cron de retenção NUNCA apaga ip_eventos). '
  'schema_version: evento velho nunca muda; mudou a forma -> bump no trigger + upcasting na view. '
  'RLS sócios-only (LGPD: after_payload de core_colaborador carrega cpf/nascimento/remuneração).';

-- ──────────────────────────────────────────────────────────────────────────
-- 2. MAPA event_type · função imutável (espelha fn_publica_evento_generico do AIPrev)
--    Deriva a INTENÇÃO de negócio do par (tabela, operação, payload). 1 entrada = 1 tipo novo.
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_ip_event_type(p_table text, p_op text, p_after jsonb, p_before jsonb)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    -- PESSOAS · ciclo de vida do colaborador
    WHEN p_table = 'core_colaborador' AND p_op = 'INSERT' THEN 'pessoa.colaborador.admitido'
    WHEN p_table = 'core_colaborador' AND p_op = 'UPDATE'
         AND COALESCE(p_before->>'status','') <> 'desligado'
         AND p_after->>'status' = 'desligado'                     THEN 'pessoa.colaborador.desligado'
    WHEN p_table = 'core_colaborador' AND p_op = 'UPDATE'         THEN 'pessoa.colaborador.alterado'
    WHEN p_table = 'core_colaborador' AND p_op = 'DELETE'         THEN 'pessoa.colaborador.removido'
    -- PESSOAS · eventos de SST / afastamento / desligamento formal
    WHEN p_table = 'core_afastamento'                            THEN 'pessoa.afastamento.'||lower(p_op)
    WHEN p_table = 'core_aso'                                    THEN 'pessoa.aso.'||lower(p_op)
    WHEN p_table = 'core_desligamento'                           THEN 'pessoa.desligamento.'||lower(p_op)
    WHEN p_table = 'core_ato_sensivel'                           THEN 'pessoa.ato_sensivel.'||lower(p_op)
    -- PESSOAS · desenvolvimento (OKR, check-in, avaliação, sucessão, compensação)
    WHEN p_table = 'core_okr'                                    THEN 'pessoa.okr.'||lower(p_op)
    WHEN p_table = 'core_checkin'                                THEN 'pessoa.checkin.'||lower(p_op)
    WHEN p_table = 'ip_avaliacao_perfil'                         THEN 'pessoa.avaliacao.'||lower(p_op)
    WHEN p_table = 'ip_compensacao'                             THEN 'pessoa.compensacao.'||lower(p_op)
    WHEN p_table = 'ip_sucessao'                                THEN 'pessoa.sucessao.'||lower(p_op)
    WHEN p_table = 'ip_perfil_colaborador'                      THEN 'pessoa.perfil.'||lower(p_op)
    WHEN p_table = 'ip_skill_map'                               THEN 'pessoa.skill.'||lower(p_op)
    WHEN p_table = 'ip_pulsos'                                  THEN 'pessoa.pulso.'||lower(p_op)
    -- PROGRAMAS / MANDATOS / PLANO
    WHEN p_table = 'ip_programas'                               THEN 'programa.'||lower(p_op)
    WHEN p_table = 'ip_programa_marcos'                         THEN 'programa.marco.'||lower(p_op)
    WHEN p_table = 'ip_mandatos'                                THEN 'mandato.'||lower(p_op)
    WHEN p_table = 'ip_plano_acoes'                             THEN 'plano.acao.'||lower(p_op)
    WHEN p_table = 'ip_agent_sugestoes'                         THEN 'agente.sugestao.'||lower(p_op)
    WHEN p_table = 'ip_organograma_cadeira'                     THEN 'organograma.cadeira.'||lower(p_op)
    WHEN p_table = 'ip_decisoes'                                THEN 'decisao.'||lower(p_op)
    WHEN p_table = 'ip_relacionamentos'                         THEN 'relacionamento.'||lower(p_op)
    -- FALLBACK genérico (toda tabela futura nasce tipada sem tocar este CASE)
    ELSE regexp_replace(p_table, '^(ip_|core_)', '') || '.' || lower(p_op)
  END;
$$;

-- DOMÍNIO fino: o "assunto" macro do evento (pessoa, programa, mandato…) p/ filtro de BI/agente
CREATE OR REPLACE FUNCTION public.fn_ip_event_domain(p_event_type text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT split_part(p_event_type, '.', 1);
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. CAPTURA · estende o trigger genérico (+ event_type / schema_version /
--    correlation_id / domain fino). Preserva 100% da derivação de mandato/actor.
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_ip_eventbus_capturar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_after  jsonb;
  v_before jsonb;
  v_mandato_id uuid;
  v_source_id uuid;
  v_actor text;
  v_event_type text;
  v_domain text;
  v_correlation uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_before := to_jsonb(OLD); v_after := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_before := to_jsonb(OLD); v_after := to_jsonb(NEW);
  ELSE
    v_before := NULL; v_after := to_jsonb(NEW);
  END IF;

  v_mandato_id := COALESCE(
    NULLIF(COALESCE(v_after->>'mandato_id', v_before->>'mandato_id'), '')::uuid,
    CASE WHEN TG_TABLE_NAME = 'ip_mandatos'
         THEN NULLIF(COALESCE(v_after->>'id', v_before->>'id'), '')::uuid ELSE NULL END
  );
  v_source_id := NULLIF(COALESCE(v_after->>'id', v_before->>'id'), '')::uuid;

  BEGIN v_actor := auth.email(); EXCEPTION WHEN OTHERS THEN v_actor := NULL; END;
  IF v_actor IS NULL THEN
    BEGIN v_actor := current_setting('request.jwt.claim.email', true); EXCEPTION WHEN OTHERS THEN v_actor := NULL; END;
  END IF;
  IF v_actor IS NULL THEN
    v_actor := CASE WHEN current_user = 'authenticator' THEN 'service_role' ELSE current_user END;
  END IF;

  -- NOVO: intenção de negócio + domínio fino + correlação causal (ponto único: IpPersist seta a GUC)
  v_event_type := fn_ip_event_type(TG_TABLE_NAME, TG_OP, v_after, v_before);
  v_domain     := fn_ip_event_domain(v_event_type);
  BEGIN v_correlation := NULLIF(current_setting('ip.correlation_id', true), '')::uuid; EXCEPTION WHEN OTHERS THEN v_correlation := NULL; END;

  INSERT INTO public.ip_eventos (
    mandato_id, source_table, source_id, operacao, domain,
    actor_email, before_payload, after_payload,
    event_type, schema_version, correlation_id
  ) VALUES (
    v_mandato_id, TG_TABLE_NAME, v_source_id, TG_OP, v_domain,
    v_actor, v_before, v_after,
    v_event_type, 1, v_correlation
  );

  RETURN COALESCE(NEW, OLD);
END;
$fn$;

-- ──────────────────────────────────────────────────────────────────────────
-- 4. FECHA O GAP RAIZ · liga o trigger genérico nas pessoa-tables órfãs da cognição
--    + consolida os triggers DUPLICADOS verificados (ip_perfil_colaborador, ip_skill_map).
--    NÃO remove tg_core_colab_eventbus (despacho legado coexiste).
-- ──────────────────────────────────────────────────────────────────────────
DO $do$
DECLARE
  t text;
  -- pessoa-tables (verificadas existentes) hoje órfãs de ip_eventos:
  v_tabs text[] := ARRAY[
    'core_colaborador','core_afastamento','core_aso','core_desligamento',
    'core_okr','core_checkin','core_ato_sensivel',
    'ip_avaliacao_perfil','ip_compensacao','ip_sucessao'
  ];
BEGIN
  -- consolida duplicatas reais (1 canônico por tabela)
  EXECUTE 'DROP TRIGGER IF EXISTS trg_eventbus_perfil_colaborador ON public.ip_perfil_colaborador';
  EXECUTE 'DROP TRIGGER IF EXISTS trg_eventbus_skill_map ON public.ip_skill_map';

  FOREACH t IN ARRAY v_tabs LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS tg_%s_eventbus ON public.%I', t, t);
      EXECUTE format(
        'CREATE TRIGGER tg_%s_eventbus AFTER INSERT OR UPDATE OR DELETE ON public.%I '
        'FOR EACH ROW EXECUTE FUNCTION public.fn_ip_eventbus_capturar()', t, t);
    END IF;
  END LOOP;
END;
$do$;

-- ──────────────────────────────────────────────────────────────────────────
-- 5. REALTIME · publica ip_eventos (transporte do já-gravado; captura segue no trigger)
-- ──────────────────────────────────────────────────────────────────────────
DO $rt$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='ip_eventos'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.ip_eventos';
  END IF;
END;
$rt$;

-- ──────────────────────────────────────────────────────────────────────────
-- 6. VIEW de projeção humanizada (consumo estável: telas/concierge leem AQUI, não payload cru)
--    Upcasting por schema_version vive nesta VIEW (hoje só v1).
-- ──────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.v_ip_timeline_mandato;  -- pode existir de experimento anterior c/ colunas em outra ordem
CREATE VIEW public.v_ip_timeline_mandato AS
SELECT
  e.id, e.ts, e.mandato_id, e.source_table, e.source_id, e.operacao,
  e.domain, e.actor_email, e.event_type, e.schema_version, e.correlation_id,
  -- rótulo de negócio humanizado a partir do event_type (estável p/ a UI)
  COALESCE(
    CASE e.event_type
      WHEN 'pessoa.colaborador.admitido'  THEN 'Colaborador admitido'
      WHEN 'pessoa.colaborador.desligado' THEN 'Colaborador desligado'
      WHEN 'pessoa.colaborador.alterado'  THEN 'Colaborador alterado'
      ELSE NULL
    END,
    initcap(replace(replace(COALESCE(e.event_type,e.source_table),'.',' · '),'_',' '))
  ) AS rotulo,
  split_part(COALESCE(e.event_type,''),'.',1) AS tipo_negocio,
  -- nome/título legível do sujeito, sem expor payload sensível inteiro
  COALESCE(e.after_payload->>'nome', e.after_payload->>'titulo',
           e.before_payload->>'nome', e.before_payload->>'titulo') AS sujeito
FROM public.ip_eventos e;

COMMENT ON VIEW public.v_ip_timeline_mandato IS
  'Projeção humanizada de ip_eventos p/ timeline/concierge. Consome event_type (estável), '
  'nunca payload cru -> rename em tabela-fonte não quebra a UI. RLS herdada de ip_eventos.';

-- ──────────────────────────────────────────────────────────────────────────
-- 7. RELAY ASSÍNCRONO · ip_eventos (INSERT) -> eventbus_queue (SÓ enqueue).
--    NUNCA eventbus_dispatch_v2 (síncrono+HTTP = deadlock 40P01). Drain via cron.
--    Só event_types whitelisted de negócio geram despacho. Idempotência via debounce_key.
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_ip_eventos_relay()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $relay$
DECLARE
  v_event_id bigint;
BEGIN
  -- whitelist de negócio que merece notificação (despacho); o resto fica só na cognição
  IF NEW.event_type NOT IN (
    'pessoa.colaborador.admitido','pessoa.colaborador.desligado',
    'pessoa.afastamento.insert','pessoa.desligamento.insert'
  ) THEN
    RETURN NEW;
  END IF;

  -- registra o evento de despacho (efêmero) — espelha o ip_eventos cognitivo
  INSERT INTO public.eventbus_events (event_source, event_type, event_data, priority, status)
  VALUES ('ip_eventos', NEW.event_type,
          jsonb_build_object('ip_evento_id', NEW.id, 'mandato_id', NEW.mandato_id,
                             'source_id', NEW.source_id, 'sujeito',
                             COALESCE(NEW.after_payload->>'nome', NEW.before_payload->>'nome')),
          'normal', 'pending')
  RETURNING id INTO v_event_id;

  -- SÓ ENFILEIRA — nunca despacha aqui (drain fora-de-transação faz o I/O).
  -- debounce_key = id do ip_evento => idempotente (re-disparo não duplica).
  PERFORM public.eventbus_enqueue(
    v_event_id, 'whatsapp', 'governanca', 'Governança',
    'Evento de gente: '||NEW.event_type, 'normal', NEW.id::text
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- relay nunca derruba a transação cognitiva: o evento em ip_eventos é a verdade.
  RETURN NEW;
END;
$relay$;

DROP TRIGGER IF EXISTS tg_ip_eventos_relay ON public.ip_eventos;
CREATE TRIGGER tg_ip_eventos_relay
  AFTER INSERT ON public.ip_eventos
  FOR EACH ROW EXECUTE FUNCTION public.fn_ip_eventos_relay();

-- ──────────────────────────────────────────────────────────────────────────
-- 8. BACKFILL opcional (guardado) · colaboradores existentes ganham seu evento de
--    admissão histórico p/ o agente ver o passado. Re-rodável (NOT EXISTS).
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO public.ip_eventos (mandato_id, source_table, source_id, operacao, domain, actor_email,
                               before_payload, after_payload, event_type, schema_version, ts)
SELECT c.mandato_id, 'core_colaborador', c.id, 'INSERT', 'pessoa', 'backfill:sistema',
       NULL, to_jsonb(c), 'pessoa.colaborador.admitido', 1, COALESCE(c.created_at, now())
FROM public.core_colaborador c
WHERE NOT EXISTS (
  SELECT 1 FROM public.ip_eventos e
  WHERE e.source_table='core_colaborador' AND e.source_id=c.id
);

INSERT INTO public.core_schema_version (patch, descricao)
VALUES ('sprint5-nervo', 'Sistema Nervoso: ip_eventos+event_type/schema_version/correlation_id, trigger genérico em 10 pessoa-tables, realtime, relay assíncrono, view timeline')
ON CONFLICT (patch) DO NOTHING;

COMMIT;
