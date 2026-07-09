# Arquitetura — professor.ai

> Documento vivo. Descreve a arquitetura-alvo e o estado atual do scaffold.
> Para o *porquê* das escolhas de stack, veja `docs/adr/`.

## 1. Princípios de arquitetura

Derivados diretamente do PRD (`docs/PRD.md`):

1. **Plano de ensino é a fonte de verdade.** O modelo de dados é uma cadeia de
   derivação: `Discipline → TeachingPlan → Bibliography → LessonPlan → Lesson →
   {Content, Slides, Activity} → Exam → Rubric → Submission → Grade → Feedback`.
   Cada nível referencia o anterior; nada é gerado "solto".
2. **Humano no loop é inegociável.** Toda saída de IA que chega ao aluno (nota,
   feedback) passa por um *gate* de validação do professor. Isto é uma regra de
   domínio, não de UI — modelada em `ReviewState` (ver data-model.md).
3. **Multi-tenant com isolamento por instituição.** Toda linha de dado de
   negócio carrega `institutionId`. Nenhuma query cruza tenants.
4. **Anti-alucinação por construção.** Bibliografia e citações do tutor sempre
   carregam proveniência verificável; geração sem fonte é rejeitada na camada de
   serviço, não apenas no prompt.
5. **Desktop-first para o professor, mobile-first para o aluno.** Duas árvores de
   rota (`/(professor)` e `/(aluno)`) com necessidades de layout distintas.

## 2. Stack

| Camada | Escolha | Papel |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | UI do professor/admin/aluno + Route Handlers/Server Actions para a API |
| Estilo | **Tailwind CSS** | Design system; temas institucionais via CSS vars |
| Banco | **PostgreSQL** | Fonte de verdade relacional; multi-tenant |
| ORM | **Prisma** | Schema tipado, migrations, client |
| IA | **Anthropic SDK (`@anthropic-ai/sdk`)** | Geração de plano/bibliografia/questões/correção; tutor |
| Auth | **Auth.js (NextAuth)** *(a integrar)* | Professor/admin (senha/SSO); aluno via magic-link leve |
| Storage | **S3-compatível** *(a integrar)* | Uploads (PDF/PPTX/scans), slides publicados |
| Filas | **Worker dedicado** *(Fase 2)* | OCR + correção em lote (jobs longos) |
| Realtime | **Serviço gerenciado ou WS próprio** *(Fase 2, ver Q4 do PRD)* | Quiz ao vivo <300ms |

Ver `docs/adr/0001-tech-stack.md` para o racional completo e alternativas descartadas.

## 3. Fronteiras de serviço (evolução planejada)

O scaffold começa como **um app Next.js**. Duas cargas de trabalho vão se
separar quando a Fase 2 exigir:

```
                    ┌─────────────────────────────┐
                    │      Next.js app (web)       │
                    │  professor · admin · aluno   │
                    │  Route Handlers / Actions    │
                    │  geração IA síncrona (curta)  │
                    └───────────┬─────────────────┘
                                │
             ┌──────────────────┼───────────────────┐
             ▼                  ▼                   ▼
   ┌──────────────┐   ┌──────────────────┐  ┌───────────────┐
   │  PostgreSQL  │   │ Correção Worker  │  │ Quiz Realtime │
   │  (Prisma)    │   │ OCR + rubrica IA │  │  (Fase 2)     │
   │              │   │  (Fase 2, fila)  │  │  WS / SSE     │
   └──────────────┘   └──────────────────┘  └───────────────┘
```

Por que separar mais tarde e não agora:
- **Correção (M7):** jobs de OCR + correção por rubrica são longos e em lote; não
  cabem no timeout de uma request web. Vão para uma fila + worker. Mas o *gate de
  validação* continua no app web.
- **Quiz ao vivo (M5):** requisito de <300ms e 100+ conexões por sala é um perfil
  de carga distinto (ver Q4 do PRD — build vs. buy ainda aberto).

Tudo o mais (planos, bibliografia, aula a aula, materiais, provas, tutor RAG)
roda bem dentro do app Next.js na Fase 1.

## 4. Camadas dentro do app

```
src/
  app/            Rotas (App Router) — thin: só orquestram serviços
    (professor)/  Área do professor/assistente (desktop-first)
    (admin)/      Área do admin institucional
    (aluno)/      Área do aluno (mobile-first, QR)
    api/          Route Handlers (webhooks, endpoints públicos de QR)
  modules/        Um diretório por módulo do PRD (M1..M10) — lógica de domínio
  lib/
    ai/           Wrapper do Anthropic SDK, prompts, schemas de saída
    db.ts         Prisma client (singleton)
    auth/         Config Auth.js (a integrar)
    tenancy/      Helpers de isolamento por instituição
  components/      UI compartilhada
  server/         Serviços de aplicação chamados pelas rotas
```

Regra: **rotas não contêm lógica de negócio.** Uma rota valida input, resolve o
tenant/usuário, chama um serviço em `modules/<m>/` e serializa a resposta. Isso
mantém a lógica testável e reutilizável entre web/worker.

## 5. Camada de IA (`src/lib/ai`)

Todas as chamadas de modelo passam por um wrapper único. Princípios:

- **Saída estruturada + validação.** Prompts de geração pedem JSON e validam
  contra um schema (Zod). Saída malformada = erro, não best-effort.
- **Proveniência obrigatória.** Bibliografia e respostas do tutor carregam a
  fonte; a camada de serviço rejeita itens sem proveniência (anti-alucinação).
- **Modelos configuráveis por env.** Tarefas pesadas de raciocínio (correção,
  geração de prova) e tarefas mais leves (rerank, formatação) apontam para
  modelos distintos. IDs em `.env.example`.
- **Human-in-the-loop no tipo.** Saídas destinadas ao aluno nascem em estado
  `PENDING_REVIEW` e só transitam por ação explícita do professor.

## 6. Multi-tenancy

- Toda tabela de negócio tem `institutionId` (FK).
- Acesso a dados passa por um helper de tenancy que injeta o filtro; queries cruas
  sem tenant são proibidas por convenção (e futuramente por lint/RLS no Postgres).
- Papéis (`ADMIN`, `PROFESSOR`, `ASSISTANT`, `STUDENT`) são escopados por
  disciplina via a tabela de vínculo `Membership`, com os limites hard do PRD
  (≤2 professores, ≤2 assistentes por disciplina) validados no convite.

## 7. Estado atual

**Todos os P0 dos módulos M1–M10 estão implementados** (ver `docs/roadmap.md`).
Decisões v1 que diferem da arquitetura-alvo (dívidas conscientes):

- **Quiz ao vivo em memória + SSE** (`src/modules/m5-activities/live-store.ts`):
  single-instance; contrato de eventos definido, motor gerenciado fica para a
  decisão build vs. buy (Q4 do PRD).
- **OCR/correção inline na request** (não em worker/fila). Funciona para lotes
  de piloto; extração para worker está reservada em §3.
- **Storage em disco local** (`src/lib/storage.ts`, `STORAGE_DIR`): interface
  mínima pensada para trocar por S3 sem tocar nos módulos.
- **Convite por link copiado** (sem SMTP): o admin copia o link do convite.
- **Auth própria com sessões em banco** (cookies httpOnly): simples e auditável;
  SSO institucional (M10 P1) entra por cima.

Verificação: testes unitários da lógica pura (`npm test` — ABNT, calendário,
pontuação, slides, RBAC), typecheck/lint/build limpos, e fluxos exercitados
end-to-end com o seed (`npm run db:seed`).
