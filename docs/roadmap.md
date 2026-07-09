# Roadmap — professor.ai

Deriva do faseamento do PRD (§9). Cada fase entrega valor de ponta a ponta.

## Fase 0 — Fundação (este scaffold) ✅

- [x] Escolha de stack + ADRs (`docs/adr/`)
- [x] Estrutura do projeto (Next.js + TS + Tailwind)
- [x] Esboço do modelo de dados (`prisma/schema.prisma`, `docs/data-model.md`)
- [x] Ponto de extensão de IA (`src/lib/ai`) e Prisma client
- [x] Placeholders por módulo (`src/modules/*`)

## Fase 1 — Espinha dorsal do professor (MVP piloto)

Módulos **1, 2, 3, 4** + **10 (admin básico)**. Alvo: professor sai com a
disciplina inteira planejada e materiais publicáveis via QR.

- [ ] **M10** Auth + Institution/Discipline/Membership + limites hard (≤2/≤2)
- [ ] **M1** Plano de Ensino: geração por IA (campos MEC + Bloom) → *primeira fatia vertical*
- [ ] **M1** Import de plano (PDF/DOCX) + versionamento + export PDF/DOCX
- [ ] **M2** Bibliografia: sugestão por IA verificável + ABNT + vínculo a unidades
- [ ] **M3** Plano aula a aula: geração a partir do calendário + edição
- [ ] **M4** Conteúdo markdown + slides + materiais + QR code + estados draft/published

## Fase 2 — Avaliação

Módulos **5, 6, 7, 8**.

- [ ] **M6** Provas ENADE + rubricas + export (3 modos de PDF)
- [ ] **M5** Atividades: quiz gamificado (realtime) + assíncrono + banco de questões
- [ ] **M7** Correção: upload em lote + OCR/vínculo + correção por rubrica + **gate de validação**
- [ ] **M8** Feedback ao aluno + painel de notas (só após validação)
- [ ] Extrair worker de correção/OCR; decidir build vs. buy do realtime (Q4)

## Fase 3 — Tutor e inteligência

Módulo **9** + dashboards P1.

- [ ] **M9** Tutor RAG por disciplina (só material liberado, citação, isolamento por aluno)
- [ ] Dashboards: top dúvidas, alunos em risco, estatísticas de questões

## Primeira tarefa concreta

Implementar **M1 (Plano de Ensino) como fatia vertical**: rota do professor →
serviço em `src/modules/teaching-plan` → wrapper de IA com saída estruturada →
persistência Prisma → render dos campos MEC. É o menor incremento que prova a
cadeia inteira (auth → geração IA → domínio → UI).
