-- ============================================================================
-- HARDENING #7 · RBAC de REMUNERAÇÃO (auditoria CISO 06/06/2026)
-- ============================================================================
-- Hoje qualquer usuário do módulo Pessoas vê/edita remuneração e benefícios de colegas
-- (dado trabalhista sensível). Correção na FONTE: a view v_core_colaborador_360 (que o
-- módulo Pessoas lê) passa a mascarar remuneracao/beneficios -> NULL para quem NÃO é sócio
-- (fn_ip_is_socio). Sócio/CVO/CEO vê o valor real. Protege mesmo que a UI exiba o campo.
-- A edição é tratada no front (esconde o campo p/ não-sócio); o insert/update da tabela segue
-- a RLS existente, mas o valor sensível não trafega na leitura para não-autorizados.
-- Idempotente (CREATE OR REPLACE VIEW preserva as colunas/ordem). security_invoker p/ herdar RLS.
-- ============================================================================

CREATE OR REPLACE VIEW public.v_core_colaborador_360
WITH (security_invoker = true) AS
 SELECT id, cpf, matricula, nome, nome_social, data_nascimento, project_id, mandato_id,
    centro_custo, cargo, funcao, modelo_contrato, data_admissao, data_desligamento, status,
    email_institucional, whatsapp_e164,
    -- DADO SENSÍVEL: só sócio/CVO/CEO vê remuneração e benefícios
    CASE WHEN public.fn_ip_is_socio() THEN remuneracao ELSE NULL END AS remuneracao,
    CASE WHEN public.fn_ip_is_socio() THEN beneficios  ELSE NULL END AS beneficios,
    origem, origem_id, meta, criado_por, created_at, updated_at,
    (EXISTS ( SELECT 1 FROM core_afastamento a WHERE a.colaborador_id = c.id AND a.status = 'ativo'::text)) AS tem_afastamento_ativo,
    ( SELECT min(s.data_vencimento) FROM core_aso s WHERE s.colaborador_id = c.id AND s.data_vencimento >= CURRENT_DATE) AS aso_proximo_venc
   FROM core_colaborador c;

INSERT INTO public.core_schema_version (patch, descricao)
VALUES ('sec-remuneracao-rbac', 'v_core_colaborador_360 mascara remuneracao/beneficios -> NULL p/ nao-socio (fn_ip_is_socio). RBAC de salario. Auditoria CISO #7.')
ON CONFLICT (patch) DO NOTHING;
