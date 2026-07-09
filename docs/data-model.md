# Modelo de dados — professor.ai

> Esboço conceitual que acompanha `prisma/schema.prisma`. A cadeia de derivação
> do PRD (§5) é o eixo do modelo.

## Cadeia de derivação

```
Institution
  └─ Discipline (curso, período, carga horária)
       ├─ Membership (User ↔ Discipline, role: PROFESSOR/ASSISTANT; ≤2 de cada)
       ├─ Enrollment (Student ↔ Discipline)
       └─ TeachingPlan (formato MEC, versionado)
            ├─ ProgramUnit (unidade do conteúdo programático)
            ├─ LearningObjective (taxonomia de Bloom)
            ├─ BibliographyItem (básica/complementar, ABNT, verificável)
            │     └─ vínculo N:N com ProgramUnit
            └─ LessonPlan (distribuição no calendário do semestre)
                 └─ Lesson (nº, data, tema, objetivos, unidades cobertas)
                      ├─ LessonContent (markdown)  [draft/published]
                      ├─ SlideDeck               [draft/published]
                      ├─ Material (upload próprio; alimenta IA/tutor)
                      ├─ QrCode (por material e por aula)
                      └─ Activity (quiz/atividade)
                           └─ Question ← QuestionBank
       Exam (escopo: disciplina ou unidades) 
         ├─ Question (ENADE MC / discursiva)
         └─ Rubric → RubricCriterion (critério, descrição, pontos)
              └─ Submission (scan/foto/arquivo ↔ Student)
                   └─ CriterionScore (nota IA → validada pelo professor)
                        └─ Feedback (liberado só após validação)
```

## Entidades-chave e invariantes

### Tenancy & RBAC
- **Institution** — raiz do tenant. Toda entidade de negócio referencia `institutionId`.
- **User** — pessoa (admin, professor, assistente). Aluno é modelado como **Student**
  (autenticação leve por e-mail institucional, ver M8).
- **Membership** — vincula `User` a `Discipline` com `role ∈ {PROFESSOR, ASSISTANT}`.
  Invariante: **≤2 PROFESSOR e ≤2 ASSISTANT por disciplina** (limite hard do M10).
- **Permissões:** Admin não edita conteúdo pedagógico; Assistente cria rascunhos e
  faz triagem, mas **não publica, não valida nota, não edita plano de ensino**.

### Cadeia pedagógica
- **TeachingPlan** — versionado (`version`, histórico). Campos MEC obrigatórios:
  identificação, ementa, objetivos gerais/específicos, conteúdo programático por
  unidade, metodologia, critérios de avaliação, bibliografia.
- **BibliographyItem** — carrega `provenance` (fonte da verificação) e `verified:boolean`.
  Invariante anti-alucinação: item sugerido por IA só é aceito com verificação.
- **Lesson / LessonContent / SlideDeck / Material** — todos com
  `status ∈ {DRAFT, PUBLISHED}`. **Aluno só vê PUBLISHED.**

### Avaliação e correção (o gate)
- **Exam / Rubric / RubricCriterion** — rubrica obrigatória por prova e por
  atividade avaliativa; pontos por critério somam o total.
- **Submission** — vínculo prova↔aluno via OCR sugerido + confirmação humana.
  `linkState ∈ {UNLINKED, SUGGESTED, CONFIRMED}`.
- **CriterionScore** — guarda **duas** notas: `aiScore` (sugerida) e `finalScore`
  (validada). Trilha de auditoria = diff entre as duas.
- **ReviewState** (enum de domínio) — `PENDING_REVIEW → APPROVED → RELEASED`.
  Invariante inegociável: `Feedback` e nota só ficam visíveis ao aluno em `RELEASED`,
  e a transição exige ação de um `PROFESSOR`.

### Tutor
- **TutorIndexItem** — o que o tutor pode indexar: apenas material `PUBLISHED`/`RELEASED`,
  com proveniência (aula/slide/material de origem) para citação. Correções indexadas
  são escopadas ao aluno logado — nunca cruzam alunos.

## Enums centrais

- `Role`: `ADMIN | PROFESSOR | ASSISTANT | STUDENT`
- `PublishState`: `DRAFT | PUBLISHED`
- `ReviewState`: `PENDING_REVIEW | APPROVED | RELEASED`
- `LinkState`: `UNLINKED | SUGGESTED | CONFIRMED`
- `BibKind`: `BASIC | COMPLEMENTARY`
- `AssessmentKind`: `ENADE_EXAM | TRADITIONAL_EXAM | GRADED_ACTIVITY`
- `QuestionType`: `MULTIPLE_CHOICE | TRUE_FALSE | ESSAY`

> O `prisma/schema.prisma` implementa um subconjunto desta modelagem suficiente
> para ancorar a Fase 1; entidades de Fase 2/3 estão comentadas como roadmap.
