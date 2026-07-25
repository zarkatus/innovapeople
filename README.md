# InnovaPeople — Site Institucional

Site oficial da InnovaPeople: consultoria boutique de design organizacional, engenharia de contexto e retenção de conhecimento, e mentoria executiva individual.

Produção: https://innovapeople.com.br

## Stack

- HTML estático, self-contained por página
- Google Fonts (Cormorant Garamond + Inter)
- Cloudflare Pages para hospedagem
- GitHub Actions para deploy automático em push para `main`
- Formulários: Supabase Edge Functions (`innovapeople-contato-submit`, `innovapeople-raio-x-submit`) com anon key nos headers (obrigatório desde jul/2026)

## Estrutura pública

```
.
├── index.html              # Site institucional (identidade editorial violeta/dourado)
├── mentoria/index.html     # Mentoria Executiva (mesma identidade da casa)
├── raio-x.html             # Funil de diagnóstico organizacional (4 etapas)
├── frentes/*.html          # 4 frentes da prática organizacional
├── acervo/index.html       # Acervo intelectual da casa
├── pulso/index.html        # Pulso quinzenal (token, noindex)
├── privacidade.html        # LGPD
├── termos.html             # Termos de uso
├── assets/                 # Retrato da mentora
├── og-image.jpg            # Open Graph
└── sitemap.xml
```

`sistema/` é a área restrita (login) e não faz parte do site público.

## Identidade

Editorial da casa: violeta `#5B3A7A`, dourado `#C4A35A`, papel `#FAF7F1`, Cormorant Garamond + Inter. Essa identidade é canônica; qualquer evolução visual deve partir dela, nunca substituí-la.

Regras editoriais do site:
- **Zero travessões** (— e –): apenas hífens ortográficos. Reestruturar com dois-pontos, vírgula, ponto ou parênteses.
- **Zero números próprios ou dados sensíveis**: nomes de clientes, preços e métricas internas não vão ao site. Dados de mercado apenas com fonte externa nomeada.

## Deploy

Push em `main` dispara o GitHub Action `deploy.yml` (`wrangler pages deploy`, projeto Cloudflare Pages `innovapeople`). O push é o deploy.

## Posicionamento

Duas práticas sob a mesma casa: prática organizacional (Defasagem Decisória, Engenharia de Contexto, contexto proprietário, Raio-X, modelo D-P-A) e Mentoria Executiva (jornadas Aceleração de Talento e Repertório de Gestão, conduzidas por Gleice Schifino).

Casa especializada da InnovaSphere · braço de inteligência e gestão da InnCorporate.
