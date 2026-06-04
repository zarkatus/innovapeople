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

INSERT INTO public.core_schema_version (patch, descricao)
VALUES ('org-node-gestao', 'RPCs de gestão da árvore: criar_no/mover_no(anti-ciclo)/renomear/arquivar(guard filhos), guard fn_ip_is_socio')
ON CONFLICT (patch) DO NOTHING;
