# Módulos de domínio

Um diretório por módulo do PRD (`docs/PRD.md` §6). A lógica de negócio vive aqui;
as rotas em `src/app` apenas orquestram estes serviços (ver `docs/architecture.md` §4).

| Dir | Módulo | Fase |
|---|---|---|
| `m1-teaching-plan` | Plano de Ensino e Conteúdo Programático | 1 |
| `m2-bibliography` | Bibliografia | 1 |
| `m3-lesson-plan` | Plano Aula a Aula | 1 |
| `m4-materials` | Conteúdo, Slides e Materiais por Aula | 1 |
| `m5-activities` | Atividades e Gamificação | 2 |
| `m6-exams` | Provas ENADE e Rubricas | 2 |
| `m7-grading` | Correção | 2 |
| `m8-feedback` | Feedback e Acompanhamento do Aluno | 2 |
| `m9-tutor` | Tutor de IA da Disciplina | 3 |
| `m10-admin` | Administração Institucional e Permissões | 1 |

Cada diretório contém um `README.md` com o escopo do módulo até ser implementado.
