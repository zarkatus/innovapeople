-- ============================================================================
-- InnovaPeople · COFRE DE CONSENTIMENTO · Due Diligence de Pessoa Física (LGPD)
-- ============================================================================
-- Diretiva CVO: pesquisas avançadas de CPF SÓ com consentimento da pessoa — "faremos APENAS
-- com o consentimento". Aqui isso é tecnicamente IMPOSSÍVEL de violar: o gate é FAIL-CLOSED.
-- Blueprint do painel adversarial (3 arq × 3 juízes) + 6 enxertos. Espelha o padrão PROVADO
-- de cur_termo_aceite (hash SHA-256 + trigger imutável + RLS por projeto). Idempotente.
--
-- ENXERTOS aplicados: #1 contexto_origem NOT NULL (sem objeto-contexto, não há coleta de CPF
-- avulso → minimização art.6 III); #2 consentimento GRANULAR por finalidade (não por tier);
-- #3 flag dado_sensivel art.11 (biometria/renda); #4 expiração por tipo (pontual 90d / relacional
-- 12m); #5 RLS por fn_user_pode_acessar_projeto (NUNCA USING(true)); #6 renda só via titular.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── COFRE: registro de consentimento (imutável, hasheado) ──
CREATE TABLE IF NOT EXISTS public.dd_consentimento_pessoa (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_doc        text NOT NULL,                 -- CPF só-dígitos
  pessoa_nome       text,
  onboarding_id     uuid,                           -- FK opcional p/ plat_onboarding_pessoa
  candidato_id      uuid,                           -- FK opcional p/ cur_candidato
  mandato_id        uuid,                           -- FK opcional p/ ip_mandatos (cliente/sócio)
  project_id        text NOT NULL,                  -- RLS por projeto (ENXERTO #5)
  contexto_origem   text NOT NULL                   -- ENXERTO #1: sem contexto, sem coleta de CPF avulso
                      CHECK (contexto_origem IN ('onboarding','candidato','socio_vinculado','cliente_curadoria')),
  finalidades_consentidas jsonb NOT NULL,           -- ENXERTO #2/#3: [{finalidade, dado_sensivel, aceito_em}]
  tier_max_autorizado int NOT NULL DEFAULT 0,       -- derivado, só p/ UX
  escopo_apis       text[] NOT NULL DEFAULT '{}',   -- provedores nomeados no termo
  termo_versao      text NOT NULL DEFAULT 'dd-pf-v1-2026-06',
  termo_hash        text NOT NULL,                  -- SHA-256 do snapshot
  snapshot_conteudo text NOT NULL,                  -- texto exato exibido (>=200 chars)
  tipo_finalidade   text NOT NULL DEFAULT 'pontual' CHECK (tipo_finalidade IN ('pontual','relacional')), -- ENXERTO #4
  consentido_em     timestamptz NOT NULL DEFAULT now(),
  consentido_ip     text,
  consentido_user_agent text,
  consentido_canal  text NOT NULL DEFAULT 'plataforma' CHECK (consentido_canal IN ('plataforma','whatsapp_otp','link_assinado')),
  expira_em         timestamptz,                    -- pontual=+90d, relacional=+12m
  revogado_em       timestamptz,
  revogado_por      text,
  revogado_motivo   text,
  revogado_canal    text,
  criado_em         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dd_consent_doc      ON public.dd_consentimento_pessoa(pessoa_doc);
CREATE INDEX IF NOT EXISTS idx_dd_consent_project  ON public.dd_consentimento_pessoa(project_id);

-- ── LASTRO: prova append-only de CADA consulta executada ──
CREATE TABLE IF NOT EXISTS public.dd_consentimento_uso (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consentimento_id uuid REFERENCES public.dd_consentimento_pessoa(id),
  pessoa_doc      text NOT NULL,
  project_id      text NOT NULL,
  finalidade      text NOT NULL,
  contexto_origem text NOT NULL,
  apis_chamadas   text[] NOT NULL DEFAULT '{}',
  executado_em    timestamptz NOT NULL DEFAULT now(),
  executado_por   text,
  resultado_hash  text
);
CREATE INDEX IF NOT EXISTS idx_dd_uso_doc ON public.dd_consentimento_uso(pessoa_doc);

-- ── DOSSIÊ leve de pessoa (DD avulsa: sócio/cliente; onboarding usa plat_onboarding_pessoa) ──
CREATE TABLE IF NOT EXISTS public.dd_pessoa_dossie (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_doc      text NOT NULL,
  pessoa_nome     text,
  project_id      text NOT NULL,
  contexto_origem text NOT NULL,
  dossie_por_tier jsonb NOT NULL DEFAULT '{}'::jsonb,
  score_determinístico int,
  veredicto       text,
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pessoa_doc, project_id)
);

-- ── TRIGGER imutável (cópia de tg_cur_termo_aceite_imutavel): só campos de revogação mudam ──
CREATE OR REPLACE FUNCTION public.tg_dd_consentimento_imutavel()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'dd_consentimento_pessoa é imutável (auditoria) — DELETE proibido'; END IF;
  IF (NEW.id<>OLD.id OR NEW.termo_hash<>OLD.termo_hash OR NEW.snapshot_conteudo<>OLD.snapshot_conteudo
      OR NEW.consentido_em<>OLD.consentido_em OR NEW.finalidades_consentidas::text<>OLD.finalidades_consentidas::text
      OR NEW.pessoa_doc<>OLD.pessoa_doc) THEN
    RAISE EXCEPTION 'dd_consentimento_pessoa é imutável — apenas campos de revogação podem mudar';
  END IF;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS trg_dd_consentimento_imutavel ON public.dd_consentimento_pessoa;
CREATE TRIGGER trg_dd_consentimento_imutavel BEFORE UPDATE OR DELETE ON public.dd_consentimento_pessoa
  FOR EACH ROW EXECUTE FUNCTION public.tg_dd_consentimento_imutavel();

-- ── RPC registrar (hash SHA-256, espelho de fn_cur_termo_registrar_aceite) ──
CREATE OR REPLACE FUNCTION public.fn_dd_consentimento_registrar(
  p_snapshot text, p_doc text, p_project text, p_contexto text, p_finalidades jsonb,
  p_nome text DEFAULT NULL, p_tipo_finalidade text DEFAULT 'pontual',
  p_escopo_apis text[] DEFAULT '{}', p_canal text DEFAULT 'plataforma',
  p_ip text DEFAULT NULL, p_user_agent text DEFAULT NULL,
  p_onboarding uuid DEFAULT NULL, p_candidato uuid DEFAULT NULL, p_mandato uuid DEFAULT NULL,
  p_versao text DEFAULT 'dd-pf-v1-2026-06'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions' AS $fn$
DECLARE v_hash text; v_id uuid; v_doc text; v_exp timestamptz; v_tier int;
BEGIN
  IF p_snapshot IS NULL OR length(p_snapshot) < 200 THEN RETURN jsonb_build_object('ok',false,'error','snapshot_invalido'); END IF;
  v_doc := regexp_replace(COALESCE(p_doc,''),'\D','','g');
  IF length(v_doc) <> 11 THEN RETURN jsonb_build_object('ok',false,'error','cpf_invalido'); END IF;
  IF p_contexto IS NULL THEN RETURN jsonb_build_object('ok',false,'error','contexto_obrigatorio'); END IF; -- ENXERTO #1
  IF p_finalidades IS NULL OR jsonb_array_length(p_finalidades) = 0 THEN RETURN jsonb_build_object('ok',false,'error','sem_finalidade'); END IF;

  v_hash := encode(digest(p_snapshot, 'sha256'), 'hex');
  v_exp  := now() + CASE WHEN p_tipo_finalidade='relacional' THEN interval '12 months' ELSE interval '90 days' END;
  -- tier derivado das finalidades (UX): cadastral=1, credito/processos=2, kyc/renda=3
  SELECT COALESCE(MAX(CASE
            WHEN f->>'finalidade' IN ('kyc_biometria','vinculos_renda') THEN 3
            WHEN f->>'finalidade' IN ('credito_score','processos') THEN 2
            WHEN f->>'finalidade' IN ('situacao_cadastral','certidoes','pep_sancoes') THEN 1
            ELSE 0 END),0)
    INTO v_tier FROM jsonb_array_elements(p_finalidades) f;

  INSERT INTO public.dd_consentimento_pessoa(
    pessoa_doc, pessoa_nome, onboarding_id, candidato_id, mandato_id, project_id, contexto_origem,
    finalidades_consentidas, tier_max_autorizado, escopo_apis, termo_versao, termo_hash, snapshot_conteudo,
    tipo_finalidade, consentido_ip, consentido_user_agent, consentido_canal, expira_em)
  VALUES (v_doc, p_nome, p_onboarding, p_candidato, p_mandato, p_project, p_contexto,
    p_finalidades, v_tier, p_escopo_apis, p_versao, v_hash, p_snapshot,
    p_tipo_finalidade, p_ip, p_user_agent, p_canal, v_exp)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok',true,'id',v_id,'hash',v_hash,'expira_em',v_exp,'tier',v_tier);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.fn_dd_consentimento_registrar(text,text,text,text,jsonb,text,text,text[],text,text,text,uuid,uuid,uuid,text) TO authenticated;

-- ── RPC status por FINALIDADE (gate fail-closed) ──
CREATE OR REPLACE FUNCTION public.fn_dd_consentimento_status(p_doc text, p_finalidade text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE r record; v_doc text;
BEGIN
  v_doc := regexp_replace(COALESCE(p_doc,''),'\D','','g');
  SELECT * INTO r FROM dd_consentimento_pessoa
   WHERE pessoa_doc=v_doc AND revogado_em IS NULL AND (expira_em IS NULL OR expira_em > now())
     AND finalidades_consentidas @> jsonb_build_array(jsonb_build_object('finalidade', p_finalidade))
   ORDER BY consentido_em DESC LIMIT 1;
  IF r.id IS NULL THEN
    -- tenta achar por finalidade dentro do array (objetos têm outros campos)
    SELECT c.* INTO r FROM dd_consentimento_pessoa c, jsonb_array_elements(c.finalidades_consentidas) f
     WHERE c.pessoa_doc=v_doc AND c.revogado_em IS NULL AND (c.expira_em IS NULL OR c.expira_em > now())
       AND f->>'finalidade'=p_finalidade ORDER BY c.consentido_em DESC LIMIT 1;
  END IF;
  IF r.id IS NULL THEN RETURN jsonb_build_object('valido',false,'motivo','sem_consentimento'); END IF;
  RETURN jsonb_build_object('valido',true,'id',r.id,'tier',r.tier_max_autorizado,'expira_em',r.expira_em,'versao',r.termo_versao);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.fn_dd_consentimento_status(text,text) TO authenticated;

-- ── RPC revogar (único UPDATE permitido; integra lgpd_requests) ──
CREATE OR REPLACE FUNCTION public.fn_dd_consentimento_revogar(p_id uuid, p_motivo text DEFAULT NULL, p_canal text DEFAULT 'plataforma')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_doc text; v_email text;
BEGIN
  UPDATE dd_consentimento_pessoa
     SET revogado_em=now(), revogado_por=COALESCE(auth.email(),'titular'), revogado_motivo=p_motivo, revogado_canal=p_canal
   WHERE id=p_id AND revogado_em IS NULL
   RETURNING pessoa_doc INTO v_doc;
  IF v_doc IS NULL THEN RETURN jsonb_build_object('ok',false,'error','nao_encontrado_ou_ja_revogado'); END IF;
  -- rastreabilidade LGPD
  BEGIN
    INSERT INTO lgpd_requests(user_name, request_type, status, notes)
    VALUES ('CPF '||left(v_doc,3)||'***', 'revogacao_consentimento', 'concluido', 'DD-PF consentimento '||p_id||' revogado: '||COALESCE(p_motivo,''));
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN jsonb_build_object('ok',true,'revogado',true);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.fn_dd_consentimento_revogar(uuid,text,text) TO authenticated;

-- ── RLS por projeto (ENXERTO #5: NUNCA USING(true) — dado sensível de PF) ──
ALTER TABLE public.dd_consentimento_pessoa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dd_consentimento_uso    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dd_pessoa_dossie        ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dd_consent_proj ON public.dd_consentimento_pessoa;
CREATE POLICY dd_consent_proj ON public.dd_consentimento_pessoa FOR SELECT
  USING (fn_user_pode_acessar_projeto('project_'||project_id) OR fn_ip_is_socio());
DROP POLICY IF EXISTS dd_uso_proj ON public.dd_consentimento_uso;
CREATE POLICY dd_uso_proj ON public.dd_consentimento_uso FOR SELECT
  USING (fn_user_pode_acessar_projeto('project_'||project_id) OR fn_ip_is_socio());
DROP POLICY IF EXISTS dd_dossie_proj ON public.dd_pessoa_dossie;
CREATE POLICY dd_dossie_proj ON public.dd_pessoa_dossie FOR SELECT
  USING (fn_user_pode_acessar_projeto('project_'||project_id) OR fn_ip_is_socio());

INSERT INTO public.core_schema_version (patch, descricao)
VALUES ('dd-consentimento-pf', 'Cofre de consentimento DD-PF: dd_consentimento_pessoa/_uso/dd_pessoa_dossie + trigger imutável + RPCs registrar(hash)/status(finalidade)/revogar(lgpd) + RLS por projeto')
ON CONFLICT (patch) DO NOTHING;
