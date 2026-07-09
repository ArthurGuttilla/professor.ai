# professor.ai

Plataforma de ensino para professores universitários. Todos os artefatos de uma
disciplina — plano de ensino, bibliografia, plano aula a aula, materiais, slides,
atividades, provas, correção, feedback e um tutor de IA — derivam de uma **única
fonte de verdade: o plano de ensino**.

> **Estado atual:** scaffold + documentação (Fase 0). Ainda não há features de
> produto implementadas. Veja `docs/roadmap.md` para o que vem a seguir.

## Documentação

| Doc | Conteúdo |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Fonte de verdade de produto (problema, personas, 10 módulos, métricas) |
| [`docs/architecture.md`](docs/architecture.md) | Arquitetura-alvo, camadas, fronteiras de serviço |
| [`docs/data-model.md`](docs/data-model.md) | Cadeia de derivação e invariantes de domínio |
| [`docs/roadmap.md`](docs/roadmap.md) | Faseamento e próxima tarefa concreta |
| [`docs/adr/`](docs/adr/) | Decisões de arquitetura (stack, tenancy, IA no loop) |

## Stack

Next.js 15 (App Router) · TypeScript · PostgreSQL + Prisma · Tailwind CSS ·
Anthropic SDK. Racional em [`docs/adr/0001-tech-stack.md`](docs/adr/0001-tech-stack.md).

## Estrutura

```
docs/            PRD, arquitetura, ADRs, roadmap
prisma/          schema.prisma (esboço do modelo de dados)
src/
  app/           Rotas: (professor) (admin) (aluno) + api
  modules/       Um diretório por módulo do PRD (m1..m10)
  lib/           ai/ (wrapper Anthropic) · db.ts (Prisma) · tenancy/
  components/     UI compartilhada
  server/        Serviços de aplicação
```

## Setup local

Pré-requisitos: Node 20+ e um PostgreSQL acessível.

```bash
npm install
cp .env.example .env        # preencha DATABASE_URL e ANTHROPIC_API_KEY
npm run db:generate         # gera o Prisma client
# npm run db:migrate        # (quando houver um Postgres configurado)
npm run dev                 # http://localhost:3000
```

Scripts úteis:

| Script | Ação |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run format` | Prettier |
| `npm run db:generate` | Gera o Prisma client |
| `npm run db:migrate` | Aplica migrations (requer Postgres) |

## Princípios inegociáveis

- **Humano no loop:** nota/feedback de IA nunca chega ao aluno sem validação do professor.
- **Anti-alucinação:** bibliografia e citações do tutor sempre verificáveis.
- **Isolamento multi-tenant** por instituição; **LGPD** para dados de alunos.

Ver [`docs/adr/0003-ai-human-in-the-loop.md`](docs/adr/0003-ai-human-in-the-loop.md).
