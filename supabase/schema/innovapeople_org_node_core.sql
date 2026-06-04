-- ============================================================================
-- InnovaPeople · Espinha Organizacional Holística · ip_org_node (PASSO 1 · núcleo aditivo)
-- ============================================================================
-- Diretiva CVO: a plataforma serve de STARTUP a CONGLOMERADO (Brookfield/Siemens/Samsung) com
-- a simplicidade de Jobs — a complexidade vive por baixo, a superfície move montanhas. SEM
-- perder nada do que existe. Blueprint do painel adversarial (3 arq × 3 juízes convergentes).
--
-- Uma ÁRVORE canônica de gestão: ip_org_node. adjacency-list (parent_id) é a FONTE DA VERDADE;
-- path ltree é cache derivado (GiST p/ rollup de subárvore O(log n)). 1 nó = startup; N = holding.
-- Os ip_mandatos de HOJE não migram: cada um ganha um nó-folha espelho (mandato_id = ip_mandatos.id).
-- mandato_id segue ancorando as 26 tabelas + ip_eventos exatamente como hoje. ZERO dado alterado.
--
-- RLS herda ADR-0015 via raiz_mandato_id DENORMALIZADO (hook barato, sem recursão na policy).
-- effective-dating (vigencia/status soft) = direito ao esquecimento (LGPD), nunca DELETE.
-- IDEMPOTENTE. Verificável: rodar 2× = 1 nó (C&S).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS ltree;

-- sequência p/ labels CURTOS e estáveis (não uuid-hex: legibilidade + limite do ltree)
CREATE SEQUENCE IF NOT EXISTS public.ip_org_node_label_seq;

CREATE TABLE IF NOT EXISTS public.ip_org_node (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id       uuid REFERENCES public.ip_org_node(id) ON DELETE RESTRICT, -- adjacency = verdade
  label           ltree NOT NULL,                 -- 1 label curto estável por nó (ex. 'n1a')
  path            ltree NOT NULL,                 -- caminho materializado = parent.path || label (cache)
  mandato_id      uuid REFERENCES public.ip_mandatos(id), -- NULL em nós de agregação; só na folha-empresa
  raiz_mandato_id uuid,                           -- denormalizado: espaço hermético dono da árvore (RLS)
  tipo_no         text NOT NULL DEFAULT 'empresa'
                    CHECK (tipo_no IN ('grupo','holding','empresa','unidade_negocio','frente','ativo','veiculo','fundo','segmento')),
  nome            text NOT NULL,
  status          text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','cindido','encerrado')),
  estagio         text NOT NULL DEFAULT 'maduro' CHECK (estagio IN ('nascente','crescimento','maduro','aposta')),
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  vigencia_inicio date NOT NULL DEFAULT current_date,
  vigencia_fim    date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_node_path_gist  ON public.ip_org_node USING gist(path);
CREATE INDEX IF NOT EXISTS idx_org_node_path_btree ON public.ip_org_node USING btree(path);
CREATE INDEX IF NOT EXISTS idx_org_node_mandato    ON public.ip_org_node(mandato_id);
CREATE INDEX IF NOT EXISTS idx_org_node_raiz       ON public.ip_org_node(raiz_mandato_id);
CREATE INDEX IF NOT EXISTS idx_org_node_parent     ON public.ip_org_node(parent_id);

COMMENT ON TABLE public.ip_org_node IS
  'Árvore canônica de gestão (de startup a conglomerado). adjacency(parent_id)=verdade, path ltree=cache. '
  'mandato_id na folha-empresa ancora as tabelas operacionais. raiz_mandato_id=espaço hermético (RLS ADR-0015). '
  'Gate de invisibilidade: com 1 nó a hierarquia some da tela (simplicidade Jobs).';

-- ── trigger: deriva path + raiz_mandato_id; re-parent cascateia o path da subárvore ──
CREATE OR REPLACE FUNCTION public.fn_ip_org_node_path()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_parent_path ltree;
  v_parent_raiz uuid;
BEGIN
  -- label curto estável só na 1ª vez
  IF NEW.label IS NULL THEN
    NEW.label := text2ltree('n' || to_hex(nextval('ip_org_node_label_seq')));
  END IF;
  IF NEW.parent_id IS NOT NULL THEN
    SELECT path, raiz_mandato_id INTO v_parent_path, v_parent_raiz FROM ip_org_node WHERE id = NEW.parent_id;
    NEW.path := v_parent_path || NEW.label;
    NEW.raiz_mandato_id := COALESCE(v_parent_raiz, NEW.raiz_mandato_id, NEW.mandato_id);
  ELSE
    NEW.path := NEW.label;
    NEW.raiz_mandato_id := COALESCE(NEW.raiz_mandato_id, NEW.mandato_id);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS tg_ip_org_node_path ON public.ip_org_node;
CREATE TRIGGER tg_ip_org_node_path BEFORE INSERT OR UPDATE OF parent_id, label, mandato_id, raiz_mandato_id
  ON public.ip_org_node FOR EACH ROW EXECUTE FUNCTION public.fn_ip_org_node_path();

-- re-parent: ao mudar parent_id, recalcula o path de toda a subárvore (1 evento semântico, fora do eventbus genérico)
CREATE OR REPLACE FUNCTION public.fn_ip_org_node_reparent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
BEGIN
  IF TG_OP='UPDATE' AND NEW.path IS DISTINCT FROM OLD.path THEN
    UPDATE ip_org_node
       SET path = NEW.path || subpath(path, nlevel(OLD.path)),
           raiz_mandato_id = NEW.raiz_mandato_id, updated_at = now()
     WHERE path <@ OLD.path AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS tg_ip_org_node_reparent ON public.ip_org_node;
CREATE TRIGGER tg_ip_org_node_reparent AFTER UPDATE OF parent_id ON public.ip_org_node
  FOR EACH ROW EXECUTE FUNCTION public.fn_ip_org_node_reparent();

-- ── RLS: herda fn_ip_is_socio via raiz_mandato_id (preserva espaço hermético ADR-0015) ──
ALTER TABLE public.ip_org_node ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ip_org_node_socios ON public.ip_org_node;
CREATE POLICY ip_org_node_socios ON public.ip_org_node FOR ALL
  USING (fn_ip_is_socio()) WITH CHECK (fn_ip_is_socio());

-- ── primitivo de rollup: ids de mandato de toda a subárvore de um nó ──
CREATE OR REPLACE FUNCTION public.fn_ip_org_descendentes(p_node_id uuid)
RETURNS TABLE(node_id uuid, mandato_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT n.id, n.mandato_id
  FROM ip_org_node n
  WHERE n.path <@ (SELECT path FROM ip_org_node WHERE id = p_node_id) AND n.status = 'ativo';
$$;
GRANT EXECUTE ON FUNCTION public.fn_ip_org_descendentes(uuid) TO authenticated;

-- contador (gate de invisibilidade): quantos nós na árvore do espaço do sócio
CREATE OR REPLACE FUNCTION public.fn_ip_org_count()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT count(*)::int FROM ip_org_node WHERE status='ativo';
$$;
GRANT EXECUTE ON FUNCTION public.fn_ip_org_count() TO authenticated;

-- ── BOOTSTRAP idempotente: cada ip_mandatos sem nó ganha folha-espelho 'empresa' ──
INSERT INTO public.ip_org_node (mandato_id, raiz_mandato_id, tipo_no, nome, parent_id, label)
SELECT m.id, m.id, 'empresa', m.empresa, NULL, text2ltree('n' || to_hex(nextval('ip_org_node_label_seq')))
FROM public.ip_mandatos m
WHERE NOT EXISTS (SELECT 1 FROM public.ip_org_node n WHERE n.mandato_id = m.id);

INSERT INTO public.core_schema_version (patch, descricao)
VALUES ('org-node-core', 'ip_org_node (ltree, adjacency=verdade) + path/raiz trigger + reparent + RLS herdada + rollup primitivo + bootstrap folhas-empresa')
ON CONFLICT (patch) DO NOTHING;
