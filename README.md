# InnovaPeople — Site Institucional

Site oficial da InnovaPeople — consultoria boutique de design organizacional, engenharia de contexto e retenção de conhecimento.

Produção: https://innovapeople.com.br

## Stack

- HTML estático (single-page, self-contained)
- Google Fonts (Cormorant Garamond + Inter)
- Cloudflare Pages para hospedagem
- GitHub Actions para deploy automático em push para `main`

## Estrutura

```
.
├── index.html              # Site institucional v5 (~46 KB)
├── robots.txt              # Crawlers (Applebot + Google + IA crawlers permitidos)
├── sitemap.xml             # Sitemap para indexação
├── og-image.jpg            # Open Graph image
├── .github/workflows/
│   └── deploy.yml          # GitHub Action: push main → CF Pages
└── README.md
```

## Deploy

Push em `main` dispara o GitHub Action `deploy.yml`, que executa `wrangler pages deploy` no projeto Cloudflare Pages `innovapeople`.

### Secrets necessários no repo (GitHub Settings → Secrets and variables → Actions)

- `CLOUDFLARE_API_TOKEN` — token com escopo `Pages:Edit`
- `CLOUDFLARE_ACCOUNT_ID` — `95be61c3c8f6535dfc835369b7d32fda`

### Deploy manual (sem Actions)

```bash
npx wrangler pages deploy . --project-name=innovapeople --branch=main
```

## Posicionamento

Consultoria boutique de Design Organizacional + Knowledge Retention. Tese central: **Clock Drift** (Neil Redding, SXSW 2026) + **Engenharia de Contexto com 4 guardrails** + **Liderança como Orquestração**.

Casa especializada da InnovaSphere · braço de inteligência e gestão da InnCorporate.

## Versão atual

v5 · Site Institucional reconstruído · 26/05/2026

Roadmap das próximas frentes em `OUTPUTS/INNOVAPEOPLE-SUITE-v5/ROADMAP-FASE-2.md` (workspace privado).
