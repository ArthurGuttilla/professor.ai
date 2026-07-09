# professor.ai

Plataforma de ensino para professores universitários. Todos os artefatos de uma
disciplina — plano de ensino, bibliografia, plano aula a aula, materiais, slides,
atividades, provas, correção, feedback e um tutor de IA — derivam de uma **única
fonte de verdade: o plano de ensino**.

> **Estado atual:** P0 dos 10 módulos do PRD implementados (Fases 1–3).
> Ver [`docs/roadmap.md`](docs/roadmap.md) para o que está feito e o backlog P1.

## O que está implementado

| Módulo | Destaques |
|---|---|
| **M1** Plano de Ensino | Geração por IA (formato MEC + Bloom), import PDF/DOCX, versionamento, export PDF/DOCX |
| **M2** Bibliografia | Sugestão por IA **verificada em catálogo** (nunca inventa referência), ABNT automático, vínculo a unidades |
| **M3** Aula a aula | Calendário com feriados, reserva de avaliações, distribuição do programa por IA, mover/mesclar/dividir |
| **M4** Materiais | Markdown + slides (template institucional) + uploads por aula, **QR code por material**, draft/published |
| **M5** Atividades | Quiz ao vivo Kahoot-like (sala com código/QR, ranking em tempo real), quiz assíncrono, banco de questões + IA |
| **M6** Provas | Formato ENADE (situação-problema), **rubrica obrigatória**, export em 3 modos de PDF |
| **M7** Correção | Upload em lote, OCR + vínculo sugerido, correção por rubrica via IA, **gate de validação do professor**, auditoria |
| **M8** Aluno | Painel de notas/semestre/entregas, correção detalhada via link+QR (só após validação) |
| **M9** Tutor | Contexto = material publicado + correções liberadas do próprio aluno, cita fontes, modo socrático |
| **M10** Admin | Disciplinas, convites com limite hard ≤2 professores/≤2 assistentes, templates, multi-tenant |

## Documentação

| Doc | Conteúdo |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Fonte de verdade de produto |
| [`docs/architecture.md`](docs/architecture.md) | Arquitetura, camadas e dívidas conscientes da v1 |
| [`docs/data-model.md`](docs/data-model.md) | Cadeia de derivação e invariantes de domínio |
| [`docs/roadmap.md`](docs/roadmap.md) | Status por módulo e backlog P1 |
| [`docs/adr/`](docs/adr/) | Decisões: stack, tenancy/RBAC, IA com humano no loop |

## Stack

Next.js 15 (App Router) · TypeScript · PostgreSQL + Prisma · Tailwind CSS ·
Anthropic SDK (geração estruturada validada com Zod).

## Setup local

Pré-requisitos: Node 20+ e PostgreSQL.

```bash
npm install
cp .env.example .env        # DATABASE_URL, ANTHROPIC_API_KEY, AUTH_SECRET, APP_URL
npm run db:migrate          # aplica migrations
npm run db:seed             # dados demo (instituição, disciplina, prova corrigida)
npm run dev                 # http://localhost:3000
```

**Credenciais do seed** (senha `demo123`): `admin@demo.edu` (admin),
`ana@demo.edu` (professora), `bruno@demo.edu` (assistente). Alunos entram só com
o e-mail: `maria@aluno.demo.edu` (tem prova corrigida e liberada),
`joao@aluno.demo.edu`, `pedro@aluno.demo.edu`.

Sem `ANTHROPIC_API_KEY`, tudo funciona exceto as gerações por IA (que degradam
com mensagem amigável); o seed permite explorar todos os fluxos.

| Script | Ação |
|---|---|
| `npm run dev` / `build` / `start` | Desenvolvimento / build / produção |
| `npm test` | Testes unitários (lógica pura: ABNT, calendário, pontuação, RBAC) |
| `npm run typecheck` / `lint` | Verificações estáticas |
| `npm run db:migrate` / `db:seed` / `db:reset` | Banco |

## Princípios inegociáveis (garantidos por construção)

- **Humano no loop:** nota/feedback de IA só chega ao aluno após validação
  explícita do professor (`ReviewState`/`SubmissionStatus` no domínio, não na UI).
- **Anti-alucinação:** referência bibliográfica sem verificação de existência
  exige confirmação explícita do professor; o tutor só indexa material
  publicado/liberado e cita fontes.
- **Isolamento:** multi-tenant por instituição; correções escopadas ao próprio
  aluno na camada de recuperação.
- **RBAC do PRD:** assistente não publica, não valida nota, não edita plano;
  admin não edita conteúdo pedagógico; limites ≤2/≤2 por disciplina.
