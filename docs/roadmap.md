# Roadmap — professor.ai

Deriva do faseamento do PRD (§9). Cada fase entrega valor de ponta a ponta.

## Fase 0 — Fundação ✅

- [x] Escolha de stack + ADRs (`docs/adr/`)
- [x] Estrutura do projeto (Next.js + TS + Tailwind)
- [x] Modelo de dados completo (`prisma/schema.prisma`, `docs/data-model.md`)
- [x] Camada de IA com saída estruturada validada (`src/lib/ai`)

## Fase 1 — Espinha dorsal do professor ✅

- [x] **M10** Auth (professor/admin/aluno) + Institution/Discipline/Membership + limites hard (≤2/≤2 validados no convite E no aceite) + templates institucionais + matrícula em lote
- [x] **M1** Plano de Ensino: geração por IA (campos MEC + Bloom), import PDF/DOCX com estruturação, edição estruturada, versionamento com snapshot, export PDF/DOCX
- [x] **M2** Bibliografia: sugestão por IA com verificação de existência por item (falha fechada), ABNT determinístico, CRUD/reordenação, vínculo a unidades
- [x] **M3** Aula a aula: calendário determinístico (feriados/dias), reserva de avaliações, distribuição por IA, mover/mesclar/dividir, alerta de desalinhamento
- [x] **M4** Conteúdo markdown + slides (template institucional) + materiais próprios + QR por aula/material + draft/published + viewer público

## Fase 2 — Avaliação ✅

- [x] **M6** Provas ENADE/tradicional/atividade com rubrica obrigatória (publish bloqueado sem rubrica), geração por escopo, export PDF em 3 modos
- [x] **M5** Banco de questões taggeado + geração IA com revisão + quiz ao vivo (SSE, pontuação acerto+velocidade, ranking) + assíncrono com prazos/tentativas
- [x] **M7** Correção: upload em lote, OCR vision + vínculo sugerido com confirmação, objetivas instantâneas, discursivas por rubrica via IA, **gate de validação do professor** (individual/lote), fila de status, auditoria IA vs. professor
- [x] **M8** Painel do aluno (notas liberadas, semestre, entregas) + correção detalhada via link/QR (só RELEASED, só o próprio aluno)

## Fase 3 — Tutor e inteligência ✅ (P0) / ◻ (P1)

- [x] **M9** Tutor por disciplina: contexto só de material publicado + correções liberadas do próprio aluno, citação de fonte, guard-rails, modo socrático
- [ ] Dashboards P1: top dúvidas, alunos em risco, estatísticas de questões

## Backlog (P1/P2 do PRD)

- [ ] Validador de conformidade MEC (checklist automático) — M1 P1
- [ ] Integração acervo da biblioteca + SciELO/CAPES — M2 P1
- [ ] Export de slides em PPTX/PDF + analytics de acesso — M4 P1
- [ ] Modos de jogo (times, sudden death) + banco compartilhado — M5 P1
- [ ] Embaralhamento/versões A-B + matriz de referência — M6 P1
- [ ] Flag de questões em branco/ilegíveis + estatísticas por questão — M7 P1
- [ ] Notificações (e-mail/WhatsApp) + pedido de revisão de nota — M8 P1
- [ ] SSO institucional + dashboard institucional — M10 P1
- [ ] Envio real de e-mail de convite (hoje o link é copiado manualmente)
- [ ] Worker dedicado para OCR/correção em lote (fila) — hoje inline na request
- [ ] Motor realtime gerenciado p/ quiz em produção multi-instância (Q4 do PRD)
- [ ] Storage S3 (hoje disco local via `src/lib/storage.ts`)
