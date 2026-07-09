# ADR 0003 — IA com humano no loop e anti-alucinação

**Status:** Aceito · **Data:** 2026-07-09

## Contexto

Dois requisitos não-funcionais são **inegociáveis** (PRD §7):
1. **Humano no loop:** nota/feedback de IA nunca chega ao aluno sem validação do
   professor (requisito legal e de confiança).
2. **Anti-alucinação:** bibliografia e citações do tutor sempre verificáveis;
   referência inventada é bug crítico.

Tratar isso apenas como "instrução no prompt" é frágil. Precisa ser garantido pela
arquitetura.

## Decisão

- **Gate no tipo, não na UI.** Saídas de IA destinadas ao aluno nascem em
  `ReviewState.PENDING_REVIEW`. A transição para `RELEASED` exige ação explícita de
  um `PROFESSOR`. Nenhum caminho de leitura do aluno retorna dado que não esteja
  `RELEASED`/`PUBLISHED`.
- **Dupla nota com auditoria.** `CriterionScore` guarda `aiScore` e `finalScore`
  separados; a trilha de auditoria é o diff. O professor pode aprovar em lote ou
  editar individualmente.
- **Proveniência obrigatória.** `BibliographyItem` e itens do tutor carregam a fonte.
  A camada de serviço **rejeita** itens de IA sem proveniência verificável — não é
  best-effort.
- **Saída estruturada validada.** Geração pede JSON e valida contra schema (Zod);
  saída malformada é erro. Isso reduz alucinação de formato e permite verificação
  programática dos campos (ex.: ISBN, ano).
- **Guard-rails do tutor** (não fazer a atividade pelo aluno; modo socrático;
  indexar só material liberado) são checados na camada de recuperação, não só no
  system prompt.

## Consequências

- O caminho feliz da correção tem uma etapa humana obrigatória — modelada, não
  opcional. A UX otimiza *velocidade da validação* (lote + amostragem), não sua
  remoção.
- Verificação de bibliografia pode exigir chamadas a fontes externas
  (acervo, catálogos) — modelado como passo de verificação, com fallback para
  "não verificável → não sugerir".
- Custo/latência de IA são gerenciados escolhendo o modelo por tarefa (ver
  `.env.example`): raciocínio pesado (correção, provas) vs. tarefas leves.
