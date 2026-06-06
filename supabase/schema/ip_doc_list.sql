-- ============================================================================
-- InnovaPeople · fn_ip_doc_list — leitura de documentos de GENTE/GESTÃO/SST para a IP
-- ============================================================================
-- A InnovaPeople é a plataforma de Gente: precisa MOSTRAR os documentos de Gente/Gestão/
-- Estratégia/SST que vivem em plat_obra_documentos (mesmo Supabase da InnovaSphere).
-- A RPC fn_plat_doc_list da InnovaSphere tem gate de COMPRAS (fn_plat_compras_can_edit) —
-- restritivo demais para RH/gestão. Esta RPC dedicada NÃO toca nada do existente: libera
-- LEITURA para quem ACESSA o projeto (fn_user_pode_acessar_projeto) e expõe SOMENTE as
-- categorias/tipos de Gente/SST (esconde Pasta Fiscal e financeiro). SECURITY DEFINER.
-- Apenas leitura. Idempotente. Não altera tabela, RLS, nem a RPC da InnovaSphere.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_ip_doc_list(p_project_id text DEFAULT NULL, p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_search text;
BEGIN
  v_search := NULLIF(p_filters->>'search','');
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(x) ORDER BY x.data_documento DESC NULLS LAST, x.created_at DESC)
    FROM (
      SELECT d.id, d.project_id, d.tipo, d.categoria, d.nome, d.descricao, d.file_path,
             d.file_mime, d.data_documento, d.data_validade, d.responsavel, d.status, d.created_at,
             d.metadata   -- inclui drive_url quando o doc tem espelho no Google Drive (fonte canônica)
      FROM public.plat_obra_documentos d
      WHERE d.file_path IS NOT NULL
        -- acesso: quem pode acessar o projeto vê os documentos de gente daquele projeto
        AND public.fn_user_pode_acessar_projeto(d.project_id)
        AND (p_project_id IS NULL OR d.project_id = p_project_id)
        -- FOCO curado: só Gente / Gestão / Estratégia / SST.
        AND (
              d.tipo IN ('programa_sst','estrategia','orientacao')
           OR d.categoria ~* '(MTE\s*/\s*SST|SSMA|Pessoas|Governan|Operacional|Templates|Institucional|Qualidade|Estrat[ée]g)'
        )
        -- esconde as demais letras da Pasta Fiscal (A contratual, B CREA, C prefeitura, E receita,
        -- F bombeiros, G ambiental, H VISA), MAS mantém a D (MTE/SST), que é justamente SST.
        AND d.categoria !~* 'Pasta Fiscal · [ABCEFGH] ·'
        AND d.categoria !~* 'Financeiro|Comercial|Societario|Societário|Registral|Licenciamento'
        AND (v_search IS NULL OR (
              d.nome ILIKE '%'||v_search||'%' OR d.categoria ILIKE '%'||v_search||'%'
           OR d.tipo ILIKE '%'||v_search||'%' OR d.descricao ILIKE '%'||v_search||'%'
        ))
    ) x
  ), '[]'::jsonb);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.fn_ip_doc_list(text,jsonb) TO authenticated;

COMMENT ON FUNCTION public.fn_ip_doc_list(text,jsonb) IS
  'InnovaPeople: lista documentos de Gente/Gestão/Estratégia/SST (plat_obra_documentos) p/ quem '
  'acessa o projeto (fn_user_pode_acessar_projeto). Esconde Pasta Fiscal/financeiro. Só leitura.';

INSERT INTO public.core_schema_version (patch, descricao)
VALUES ('ip-doc-list', 'fn_ip_doc_list: leitura de docs Gente/SST p/ a InnovaPeople (gate fn_user_pode_acessar_projeto, foco curado, esconde fiscal) sem tocar RLS/RPC existentes')
ON CONFLICT (patch) DO NOTHING;
