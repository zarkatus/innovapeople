-- ============================================================================
-- InnovaPeople · Gestão da Árvore Organizacional (RPCs p/ a UI) — Brookfield/Siemens by hand
-- ============================================================================
-- O CVO monta e reorganiza o conglomerado pela interface, sem SQL: criar grupo/holding/unidade,
-- mover empresa entre grupos (re-parent), renomear, arquivar. Reusa os triggers já existentes
-- (tg_ip_org_node_path recalcula path; tg_ip_org_node_reparent cascateia a subárvore). RPCs finas
-- com guard fn_ip_is_socio + validações (anti-ciclo no re-parent). Idempotente. Soft-delete.
-- ============================================================================

-- ── criar nó (grupo/holding/unidade/frente…) sob um pai ──
CREATE OR REPLACE FUNCTION public.fn_ip_org_criar_no(
  p_nome text, p_tipo text, p_parent_id uuid DEFAULT NULL, p_estagio text DEFAULT 'maduro'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_id uuid; v_raiz uuid;
BEGIN
  IF NOT fn_ip_is_socio() THEN RAISE EXCEPTION 'acesso restrito'; END IF;
  IF p_nome IS NULL OR length(trim(p_nome))<2 THEN RAISE EXCEPTION 'nome obrigatório'; END IF;
  IF p_tipo NOT IN ('grupo','holding','empresa','unidade_negocio','frente','ativo','veiculo','fundo','segmento')
    THEN RAISE EXCEPTION 'tipo inválido: %', p_tipo; END IF;
  -- raiz: herda do pai; se sem pai, é raiz de si (nó de agregação não tem mandato)
  IF p_parent_id IS NOT NULL THEN
    SELECT raiz_mandato_id INTO v_raiz FROM ip_org_node WHERE id=p_parent_id;
  END IF;
  INSERT INTO ip_org_node(tipo_no, nome, parent_id, raiz_mandato_id, estagio)
  VALUES (p_tipo, trim(p_nome), p_parent_id, v_raiz, COALESCE(NULLIF(p_estagio,''),'maduro'))
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok',true,'id',v_id,'nome',trim(p_nome),'tipo',p_tipo);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.fn_ip_org_criar_no(text,text,uuid,text) TO authenticated;

-- ── mover nó (re-parent) — o trigger cascateia o path da subárvore. Bloqueia ciclo. ──
CREATE OR REPLACE FUNCTION public.fn_ip_org_mover_no(p_node_id uuid, p_novo_parent uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_path ltree; v_novo_path ltree;
BEGIN
  IF NOT fn_ip_is_socio() THEN RAISE EXCEPTION 'acesso restrito'; END IF;
  IF p_node_id = p_novo_parent THEN RAISE EXCEPTION 'um nó não pode ser pai de si mesmo'; END IF;
  SELECT path INTO v_path FROM ip_org_node WHERE id=p_node_id;
  IF v_path IS NULL THEN RAISE EXCEPTION 'nó não encontrado'; END IF;
  -- anti-ciclo: o novo pai não pode estar DENTRO da subárvore do nó movido
  IF p_novo_parent IS NOT NULL THEN
    SELECT path INTO v_novo_path FROM ip_org_node WHERE id=p_novo_parent;
    IF v_novo_path <@ v_path THEN RAISE EXCEPTION 'não é possível mover um nó para dentro da própria subárvore'; END IF;
  END IF;
  UPDATE ip_org_node SET parent_id=p_novo_parent WHERE id=p_node_id; -- trigger recalcula path + cascata
  RETURN jsonb_build_object('ok',true,'movido',p_node_id);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.fn_ip_org_mover_no(uuid,uuid) TO authenticated;

-- ── renomear ──
CREATE OR REPLACE FUNCTION public.fn_ip_org_renomear(p_node_id uuid, p_nome text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
BEGIN
  IF NOT fn_ip_is_socio() THEN RAISE EXCEPTION 'acesso restrito'; END IF;
  IF p_nome IS NULL OR length(trim(p_nome))<2 THEN RAISE EXCEPTION 'nome obrigatório'; END IF;
  UPDATE ip_org_node SET nome=trim(p_nome), updated_at=now() WHERE id=p_node_id;
  RETURN jsonb_build_object('ok',true);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.fn_ip_org_renomear(uuid,text) TO authenticated;

-- ── arquivar (soft-delete): status='encerrado'. Bloqueia se houver filhos ativos. ──
CREATE OR REPLACE FUNCTION public.fn_ip_org_arquivar(p_node_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_filhos int;
BEGIN
  IF NOT fn_ip_is_socio() THEN RAISE EXCEPTION 'acesso restrito'; END IF;
  SELECT count(*) INTO v_filhos FROM ip_org_node WHERE parent_id=p_node_id AND status='ativo';
  IF v_filhos>0 THEN RAISE EXCEPTION 'arquive ou mova os % nó(s) filho(s) antes de arquivar este', v_filhos; END IF;
  UPDATE ip_org_node SET status='encerrado', vigencia_fim=current_date, updated_at=now() WHERE id=p_node_id;
  RETURN jsonb_build_object('ok',true,'arquivado',p_node_id);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.fn_ip_org_arquivar(uuid) TO authenticated;

-- ── anexar DD a um nó: grava cnpj + dossiê + parecer no metadata (toda inserção de CNPJ exige DD) ──
CREATE OR REPLACE FUNCTION public.fn_ip_org_set_dd(p_node_id uuid, p_cnpj text, p_dossie jsonb DEFAULT NULL, p_dd jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_cnpj text;
BEGIN
  IF NOT fn_ip_is_socio() THEN RAISE EXCEPTION 'acesso restrito'; END IF;
  v_cnpj := NULLIF(regexp_replace(COALESCE(p_cnpj,''),'\D','','g'),'');
  UPDATE ip_org_node
     SET metadata = COALESCE(metadata,'{}'::jsonb)
                    || jsonb_build_object('cnpj', v_cnpj)
                    || CASE WHEN p_dossie IS NOT NULL THEN jsonb_build_object('dossie', p_dossie) ELSE '{}'::jsonb END
                    || CASE WHEN p_dd IS NOT NULL THEN jsonb_build_object('dd', p_dd, 'dd_em', now()) ELSE '{}'::jsonb END,
         updated_at = now()
   WHERE id = p_node_id;
  RETURN jsonb_build_object('ok', true);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.fn_ip_org_set_dd(uuid,text,jsonb,jsonb) TO authenticated;

-- ── rollup de DUE DILIGENCE por subárvore: consolida os pareceres dos nós com CNPJ ──
CREATE OR REPLACE FUNCTION public.fn_ip_org_dd_rollup(p_node_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_root ltree; v_entrar int; v_cautela int; v_evitar int; v_total int; v_pendentes int; v_pior jsonb;
BEGIN
  IF NOT fn_ip_is_socio() THEN RAISE EXCEPTION 'acesso restrito'; END IF;
  SELECT path INTO v_root FROM ip_org_node WHERE id=p_node_id;
  SELECT
    count(*) FILTER (WHERE metadata->'dd'->>'veredicto'='ENTRAR'),
    count(*) FILTER (WHERE metadata->'dd'->>'veredicto'='CAUTELA'),
    count(*) FILTER (WHERE metadata->'dd'->>'veredicto'='EVITAR'),
    count(*) FILTER (WHERE metadata->>'cnpj' IS NOT NULL),
    count(*) FILTER (WHERE metadata->>'cnpj' IS NOT NULL AND metadata->'dd' IS NULL)
  INTO v_entrar, v_cautela, v_evitar, v_total, v_pendentes
  FROM ip_org_node WHERE path <@ v_root AND status='ativo';
  SELECT jsonb_build_object('nome',nome,'veredicto',metadata->'dd'->>'veredicto','score',(metadata->'dd'->>'risco_score'))
    INTO v_pior FROM ip_org_node
    WHERE path <@ v_root AND status='ativo' AND metadata->'dd'->>'veredicto' IN ('EVITAR','CAUTELA')
    ORDER BY CASE metadata->'dd'->>'veredicto' WHEN 'EVITAR' THEN 0 ELSE 1 END, (metadata->'dd'->>'risco_score')::int NULLS LAST LIMIT 1;
  RETURN jsonb_build_object('entrar',COALESCE(v_entrar,0),'cautela',COALESCE(v_cautela,0),'evitar',COALESCE(v_evitar,0),
    'com_cnpj',COALESCE(v_total,0),'dd_pendentes',COALESCE(v_pendentes,0),'pior',v_pior);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.fn_ip_org_dd_rollup(uuid) TO authenticated;

INSERT INTO public.core_schema_version (patch, descricao)
VALUES ('org-node-gestao', 'RPCs de gestão da árvore: criar_no/mover_no(anti-ciclo)/renomear/arquivar(guard filhos) + set_dd(anexa DD ao nó) + dd_rollup(consolida pareceres), guard fn_ip_is_socio')
ON CONFLICT (patch) DO NOTHING;
