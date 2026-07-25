# innovaPeople — Site Institucional

Site oficial da innovaPeople. Duas práticas sob a mesma casa: **Mentoria Executiva** (jornadas individuais Aceleração de Talento e Repertório de Gestão) e **Design Organizacional** (engenharia de contexto, retenção de conhecimento, Raio-X).

Produção: https://innovapeople.com.br

## Stack

- HTML estático, self-contained por página
- Google Fonts (Cormorant Garamond + Inter + Poppins)
- Cloudflare Pages para hospedagem
- GitHub Actions para deploy automático em push para `main`
- Formulários: Supabase Edge Functions (`innovapeople-contato-submit`, `innovapeople-raio-x-submit`)

## Estrutura pública

```
.
├── index.html              # Home v6: duas práticas (mentoria + organizações)
├── mentoria/index.html     # Página flagship da Mentoria Executiva
├── raio-x.html             # Funil de diagnóstico organizacional (4 etapas)
├── frentes/*.html          # 4 frentes da prática organizacional
├── acervo/index.html       # Acervo intelectual da casa
├── pulso/index.html        # Pulso quinzenal (token, noindex)
├── privacidade.html        # LGPD
├── termos.html             # Termos de uso
├── assets/                 # Retrato da mentora e afins
├── og-image.jpg            # Open Graph 1200x630 (identidade v6)
└── sitemap.xml
```

`sistema/` é a área restrita (login) e não faz parte do site público.

## Identidade v6 (25/07/2026)

Alinhada às propostas comerciais da marca: navy `#041320`, creme `#F7F3EB`, laranja `#F8A117`, laranja vivo `#EE4609`, teal `#0F6B66` de apoio. Wordmark `innovaPeople` (Poppins, "People" em laranja) + símbolo φ. Serif editorial Cormorant Garamond para display.

Regras editoriais do site:
- **Zero travessões** (— e –): apenas hífens ortográficos. Reestruturar com dois-pontos, vírgula, ponto ou parênteses.
- **Zero números próprios ou dados sensíveis**: nomes de clientes, preços e métricas internas não vão ao site. Dados de mercado apenas com fonte externa nomeada (Gallup, McKinsey, WEF, DDI, ICF).
- CTAs conversacionais: conversa de 30 minutos (mentoria) e Raio-X (organizações).

## Deploy

Push em `main` dispara o GitHub Action `deploy.yml` (`wrangler pages deploy`, projeto Cloudflare Pages `innovapeople`). O push é o deploy.

## Posicionamento

Casa de desenvolvimento de liderança e design organizacional. Mentoria conduzida por Gleice Schifino (Diretora de Gente e Gestão; 25+ anos, ex-CHRO). Prática organizacional: Defasagem Decisória, Engenharia de Contexto (4 guardrails), contexto proprietário, modelo D-P-A.

Casa especializada da InnovaSphere · braço de inteligência e gestão da InnCorporate.
