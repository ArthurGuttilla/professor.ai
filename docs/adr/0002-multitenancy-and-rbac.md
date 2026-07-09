# ADR 0002 — Multi-tenancy e RBAC

**Status:** Aceito · **Data:** 2026-07-09

## Contexto

O M10 exige isolamento de dados por instituição e um modelo de papéis com limites
hard: **≤2 professores e ≤2 assistentes por disciplina**, com permissões distintas
(admin não edita pedagógico; assistente não publica/valida/edita plano). LGPD exige
que dados de alunos (notas, correções) não vazem entre tenants nem entre alunos.

## Decisão

- **Tenancy por coluna:** toda entidade de negócio carrega `institutionId`. Acesso a
  dados passa por um helper de tenancy (`src/lib/tenancy`) que injeta o filtro. Sem
  queries cruas sem tenant.
- **RBAC escopado por disciplina** via tabela `Membership (userId, disciplineId, role)`.
  O papel não é global — um usuário pode ser professor em uma disciplina e nada em
  outra.
- **Limites hard no convite:** a criação de `Membership` valida a contagem por papel
  por disciplina (≤2/≤2) antes de gravar.
- **Aluno é um tipo à parte** (`Student` + `Enrollment`), com autenticação leve por
  e-mail institucional, refletindo o fluxo de baixa fricção do M8.

## Alternativas consideradas

- **Banco por tenant (schema-per-tenant / db-per-tenant).** Isolamento mais forte,
  mas custo operacional alto para muitas instituições pequenas; adiado. A modelagem
  por coluna permite migrar entidades sensíveis para RLS do Postgres sem mudar o
  domínio.
- **Papel global no usuário.** Simples, mas não modela "professor nesta disciplina,
  aluno em outra" e quebra o limite ≤2 por disciplina.

## Consequências

- Endurecimento futuro com **Postgres Row-Level Security** nas tabelas mais
  sensíveis (correções, feedback) sem refatorar o modelo.
- O gate de validação (ReviewState) e o isolamento por aluno no tutor dependem desse
  escopo — são regras de domínio, testadas na camada de serviço.
