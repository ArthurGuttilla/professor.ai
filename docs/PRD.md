# PRD — Plataforma de Ensino para Professores Universitários

**Versão:** 1.0 · **Data:** 09/07/2026 · **Owner:** Guttilla
**Status:** Draft para revisão

> Este documento é a **fonte de verdade de produto**. O código do repositório
> deriva dele. Ao alterar escopo, atualize este arquivo na mesma PR.

---

## 1. Problema

Professores universitários gastam 10–15h/semana em trabalho operacional que não é ensinar: montar plano de ensino no formato MEC, planejar aula a aula, produzir slides e materiais, criar atividades e provas, corrigir manualmente e dar feedback individual. As ferramentas existentes resolvem pedaços isolados (Kahoot para quiz, PowerPoint para slides, Moodle para entrega), forçando o professor a costurar tudo manualmente — sem que nenhum artefato converse com o outro.

O custo de não resolver: professores sobrecarregados produzem material genérico, feedback raso e provas desalinhadas com o plano de ensino. Instituições perdem em avaliação MEC/ENADE e em retenção de alunos.

**Tese central:** todos os artefatos da disciplina derivam de uma única fonte de verdade — o plano de ensino. Cada etapa alimenta a próxima em cadeia: plano → bibliografia → plano aula a aula → conteúdos/slides/atividades → provas/rubricas → correção → feedback ao aluno → tutor de IA da disciplina.

---

## 2. Personas

| Persona | Papel | Necessidade principal |
|---|---|---|
| **Administrador institucional** | Cria disciplinas, vincula professores, gerencia templates da instituição | Governança e padronização |
| **Professor** (máx. 2 por disciplina) | Dono da disciplina: planeja, produz, avalia, valida feedbacks | Reduzir trabalho operacional mantendo controle pedagógico |
| **Assistente/Monitor** (máx. 2 por disciplina) | Apoia produção de material e correção | Executar tarefas delegadas sem acesso total |
| **Aluno** | Consome materiais via QR code/link, faz atividades, acompanha notas, usa o tutor | Acesso simples (sem fricção de login pesado), feedback claro |

---

## 3. Objetivos

1. **Reduzir em 70% o tempo de preparação de disciplina** (plano + aulas + materiais), medido por time-tracking em piloto.
2. **Reduzir em 80% o tempo de correção de provas** com correção automática por rubrica + validação do professor.
3. **100% dos artefatos gerados em conformidade com formato MEC** (plano de ensino, conteúdo programático) e **ENADE** (provas).
4. **≥60% dos alunos ativos no tutor de IA** até a metade do semestre nas turmas piloto.
5. **NPS de professor ≥50** ao final do primeiro semestre de uso.

## 4. Não-objetivos (v1)

- **Não é um LMS completo.** Sem fórum, sem trilhas adaptativas, sem SCORM. Integração com LMS existentes fica para v2.
- **Não substitui o sistema acadêmico** (matrícula, diário oficial, lançamento de notas no sistema da instituição). Exportamos notas; não somos o registro oficial.
- **Não faz proctoring/anti-fraude em provas online.** Provas presenciais digitalizadas são o caso de uso principal de correção.
- **Sem app nativo.** Web responsiva + QR code cobrem o acesso do aluno.
- **Sem detecção de plágio** em v1 (parceria/integração futura).

---

## 5. Fluxo mestre da disciplina

```
Admin cria disciplina → vincula professor(es)
        │
        ▼
[1] Plano de Ensino (formato MEC) ─ criar com IA ou importar pronto
        │  ementa + objetivos de aprendizagem + conteúdo programático
        ▼
[2] Bibliografia ─ sugerida por IA a partir do plano, curada pelo professor
        │
        ▼
[3] Plano Aula a Aula ─ distribui o programa pelo volume de aulas do semestre
        │
        ▼
[4] Por aula: Conteúdo (markdown) + Atividades + Slides (template institucional)
        │  bibliografia por aula · PDF/slides online · QR code por material
        ▼
[5] Por aula: Atividade gamificada (quiz Kahoot-like, ao vivo/assíncrono)
        │  banco de questões ou geração por IA · data de início e entrega
        ▼
[6] Provas formato ENADE + rubricas (critério, descrição, pontos)
        │  export: PDF único, prova+gabarito, ou 2 PDFs separados
        ▼
[7] Correção ─ upload das provas (scan/foto/arquivo) → vínculo ao aluno
        │  correção automática por rubrica → validação obrigatória do professor
        ▼
[8] Feedback ao aluno ─ link/QR com correção detalhada, notas da disciplina e do semestre
        │
        ▼
[9] Tutor de IA da disciplina ─ treinado em todos os materiais, atividades,
    provas e correções da matéria
```

---

## 6. Módulos e requisitos

### Módulo 1 — Plano de Ensino e Conteúdo Programático

**User stories**
- Como professor, quero gerar um plano de ensino no formato MEC a partir do nome da disciplina, carga horária e curso, para não começar do zero.
- Como professor, quero importar um plano de ensino já pronto (PDF/DOCX) e a plataforma estruturar automaticamente, para aproveitar material existente.
- Como professor, quero editar ementa, objetivos de aprendizagem e conteúdo programático em campos estruturados, para manter conformidade com o padrão MEC.

**Requisitos P0**
- [ ] Criação assistida por IA: input mínimo (nome da disciplina, curso, carga horária, semestre) → gera ementa, objetivos de aprendizagem (taxonomia de Bloom), conteúdo programático e metodologia no template MEC.
- [ ] Upload de plano existente (PDF, DOCX) com parsing e mapeamento automático para os campos estruturados; professor revisa e confirma.
- [ ] Campos obrigatórios do formato MEC: identificação, ementa, objetivos gerais e específicos, conteúdo programático por unidade, metodologia, critérios de avaliação, bibliografia básica e complementar.
- [ ] Versionamento do plano (histórico de edições).
- [ ] Export em PDF e DOCX no template da instituição.

**P1**
- [ ] Validador de conformidade MEC (checklist automático com alertas do que falta).
- [ ] Biblioteca institucional de planos aprovados como ponto de partida.

---

### Módulo 2 — Bibliografia

**User stories**
- Como professor, quero receber sugestões de bibliografia básica e complementar coerentes com a ementa, para acelerar a curadoria.
- Como professor, quero adicionar/remover referências manualmente e marcar quais estão disponíveis na biblioteca da instituição.

**Requisitos P0**
- [ ] Sugestão por IA de bibliografia básica (mín. 3) e complementar (mín. 5) a partir do plano de ensino, com referências reais e verificáveis (título, autor, editora, ano, ISBN quando disponível) — **nunca inventar referências**; toda sugestão passa por verificação de existência.
- [ ] Formatação automática em ABNT.
- [ ] Edição manual completa (adicionar, remover, reordenar).
- [ ] Vínculo de cada referência às unidades do conteúdo programático (usado depois no aula a aula e nos slides).

**P1**
- [ ] Integração com acervo da biblioteca institucional (marcar disponibilidade).
- [ ] Sugestão de artigos e materiais abertos (SciELO, periódicos CAPES).

---

### Módulo 3 — Plano Aula a Aula

**User stories**
- Como professor, quero informar o número de aulas do semestre (e feriados/datas bloqueadas) e receber a distribuição do conteúdo programático aula a aula, para planejar o semestre em minutos.
- Como professor, quero reordenar aulas por drag-and-drop e realocar conteúdo, mantendo a coerência com o plano de ensino.

**Requisitos P0**
- [ ] Input: calendário do semestre (data início/fim, dias da semana, feriados) + volume de aulas → geração automática da grade aula a aula.
- [ ] Cada aula recebe: número, data, tema, objetivos da aula, unidades do programa cobertas, bibliografia recomendada (herdada do Módulo 2).
- [ ] Reserva automática de aulas para avaliações (configurável).
- [ ] Edição total: reordenar, mesclar, dividir aulas.
- [ ] Alerta de desalinhamento: se conteúdo programático não couber no volume de aulas, sugerir cortes ou compressão.

---

### Módulo 4 — Conteúdo, Slides e Materiais por Aula

**User stories**
- Como professor, quero gerar para cada aula um texto-base em markdown, atividades propostas e slides, tudo derivado do plano aula a aula, para chegar na sala com material pronto.
- Como admin, quero cadastrar o template de slides da instituição (logo, cores, tipografia) para que todo material saia padronizado.
- Como aluno, quero acessar slides e PDFs online via QR code, sem instalar nada.

**Requisitos P0**
- [ ] Geração por aula: **texto de conteúdo em markdown** (editável em editor rico), **lista de atividades propostas** e **deck de slides**.
- [ ] Templates de slide: institucional (upload pelo admin — logo, paleta, fontes, capa/fechamento) ou padrão da plataforma.
- [ ] Bibliografia recomendada renderizada em cada aula e no slide final do deck.
- [ ] Visualização online de PDFs e slides (viewer embutido, sem download obrigatório).
- [ ] **QR code único por material** (e por aula), gerado automaticamente, apontando para a versão publicada — professor projeta o QR, aluno acompanha no celular.
- [ ] Upload de materiais próprios do professor (PDF, PPTX, imagens) anexados à aula — esses materiais também alimentam a IA (atividades, provas, tutor).
- [ ] Estados: rascunho / publicado. Aluno só vê o publicado.

**P1**
- [ ] Export de slides em PPTX e PDF.
- [ ] Analytics de acesso por material (quantos alunos abriram, quando).

---

### Módulo 5 — Atividades e Gamificação

**User stories**
- Como professor, quero criar um quiz estilo Kahoot para cada aula, no modo ao vivo (competição em tempo real, tempo por questão, ranking) ou assíncrono (prazo de entrega), para engajar a turma.
- Como professor, quero escolher entre questões do banco de questões ou geradas por IA a partir dos materiais da aula, para montar atividades em segundos.
- Como aluno, quero entrar no quiz ao vivo com um código/QR e competir com a turma.

**Requisitos P0**
- [ ] Dois formatos: **Quiz gamificado** (Kahoot-like) e **Atividade** (lista de questões tradicional, objetivas e/ou dissertativas).
- [ ] Quiz ao vivo: sala com código/QR, tempo configurável por questão, pontuação por acerto + velocidade, ranking em tempo real projetável.
- [ ] Quiz assíncrono: data de início e data de entrega obrigatórias, tentativas configuráveis.
- [ ] Fonte de questões: (a) banco de questões da disciplina/instituição, (b) geração por IA baseada nos materiais da aula (markdown, slides, PDFs anexados) — sempre com revisão do professor antes de publicar.
- [ ] Banco de questões: taggeado por unidade/tema/aula, nível de dificuldade, tipo (múltipla escolha, V/F, dissertativa).
- [ ] Correção automática de objetivas; dissertativas vão para o fluxo de correção (Módulo 7).
- [ ] Toda atividade tem data de início e entrega, com visibilidade para o aluno.

**P1**
- [ ] Modos de jogo adicionais (times, sudden death).
- [ ] Compartilhamento de banco de questões entre professores da instituição.

---

### Módulo 6 — Provas ENADE e Rubricas

**User stories**
- Como professor, quero gerar provas no formato ENADE cobrindo a matéria toda ou temáticas selecionadas, para alinhar a avaliação ao padrão nacional.
- Como professor, quero uma rubrica por prova/atividade com critérios, descrição, pontos totais e pontos por critério, para correção objetiva e transparente.
- Como professor, quero exportar a prova em diferentes formatos de PDF conforme minha logística de aplicação.

**Requisitos P0**
- [ ] Geração de prova por escopo: disciplina inteira **ou** seleção de temáticas/unidades/aulas.
- [ ] Formato ENADE: questões de múltipla escolha com texto-base/situação-problema, e discursivas com padrão de resposta — estrutura, enunciado e complexidade seguindo o estilo ENADE.
- [ ] Escolha do formato da avaliação: prova ENADE, prova tradicional, atividade avaliativa.
- [ ] **Rubrica obrigatória por prova e por atividade avaliativa:** critério, descrição do critério, pontos totais da avaliação, pontos por critério. Rubrica por questão discursiva e rubrica geral.
- [ ] Export em três modos:
  - PDF único (só a prova)
  - PDF único com gabarito na última página
  - Dois PDFs separados (prova + gabarito/padrão de resposta)
- [ ] Gabarito inclui padrão de resposta das discursivas e a rubrica.
- [ ] Questões podem vir do banco, da IA (baseada nos materiais) ou manuais — mix livre.

**P1**
- [ ] Embaralhamento de questões/alternativas com múltiplas versões (tipo A/B).
- [ ] Matriz de referência: mapa questão → objetivo de aprendizagem.

---

### Módulo 7 — Correção

**User stories**
- Como professor, quero subir as provas respondidas (scan, foto ou arquivo) e a plataforma vincular cada prova ao aluno correto, para eliminar digitação.
- Como professor, quero uma correção automática baseada na rubrica, com nota sugerida e feedback por critério, que eu **valido ou ajusto antes de liberar**, para manter minha autoridade pedagógica.
- Como assistente, quero apoiar a triagem e o vínculo prova-aluno, para acelerar o processo.

**Requisitos P0**
- [ ] Upload em lote: scan (PDF multipágina), foto (mobile) ou arquivo digital.
- [ ] OCR + reconhecimento de identificação do aluno (nome/matrícula no cabeçalho); vínculo sugerido automaticamente com confirmação humana; vínculo manual como fallback.
- [ ] Correção automática por IA aplicando a rubrica: nota por critério, nota total, justificativa por critério, feedback textual.
- [ ] **Gate de validação obrigatório:** nenhuma nota ou feedback chega ao aluno sem aprovação explícita do professor (aprovar em lote ou individualmente, com edição livre de nota e texto).
- [ ] Objetivas: correção instantânea contra gabarito. Discursivas: correção por rubrica + padrão de resposta.
- [ ] Fila de correção com status: pendente vínculo → corrigida (IA) → validada (professor) → liberada.
- [ ] Trilha de auditoria: o que a IA sugeriu vs. o que o professor aprovou.

**P1**
- [ ] Detecção de questões em branco/ilegíveis com flag para revisão manual.
- [ ] Estatísticas por questão (índice de acerto, discriminação) para melhorar o banco.

---

### Módulo 8 — Feedback e Acompanhamento do Aluno

**User stories**
- Como aluno, quero receber um link/QR code com a correção detalhada de cada atividade e prova (múltipla escolha e dissertativa), para entender exatamente onde errei.
- Como aluno, quero acompanhar minhas notas da disciplina e do semestre em um só lugar.

**Requisitos P0**
- [ ] Página individual de correção por aluno por avaliação: questão a questão, resposta dada, resposta esperada/rubrica, pontos por critério, feedback validado pelo professor.
- [ ] Acesso via link único + QR code (autenticação leve por e-mail institucional do aluno).
- [ ] Painel do aluno: notas por avaliação, nota acumulada da disciplina, visão do semestre (todas as disciplinas dele na plataforma), próximas entregas.
- [ ] Feedback exibido **somente após validação do professor** (herda o gate do Módulo 7).

**P1**
- [ ] Notificações (e-mail/WhatsApp) de nota liberada e prazo próximo.
- [ ] Pedido de revisão de nota dentro da plataforma.

---

### Módulo 9 — Tutor de IA da Disciplina

**User stories**
- Como aluno, quero um tutor que conhece todos os materiais, atividades, provas e correções da disciplina, para estudar e tirar dúvidas a qualquer hora.
- Como aluno, quero perguntar sobre minha correção específica ("por que perdi ponto na questão 3?") e sobre datas de entrega.
- Como professor, quero visibilidade sobre os temas mais perguntados, para ajustar minhas aulas.

**Requisitos P0**
- [ ] Tutor por disciplina, com contexto de: plano de ensino, bibliografia, conteúdo aula a aula, markdown, slides, PDFs anexados, atividades, provas liberadas e **correções individuais do aluno logado**.
- [ ] Responde dúvidas de conteúdo com citação da fonte (aula X, slide Y, material Z).
- [ ] Responde sobre a correção do próprio aluno (por que perdeu pontos, com base na rubrica validada) — nunca expõe dados de outros alunos.
- [ ] Responde sobre logística: datas de entrega, calendário de aulas, pesos das avaliações.
- [ ] Guard-rails: não faz a atividade pelo aluno (não entrega respostas de atividades abertas); modo socrático configurável pelo professor.
- [ ] Só indexa material publicado/liberado.

**P1**
- [ ] Dashboard para o professor: top dúvidas, tópicos com mais confusão, alunos em risco (baixo engajamento + notas baixas).
- [ ] Geração de simulados personalizados pelo tutor com base nas dificuldades do aluno.

---

### Módulo 10 — Administração Institucional e Permissões

**User stories**
- Como admin da instituição, quero criar disciplinas e vinculá-las ao e-mail de um professor, para distribuir a gestão.
- Como admin, quero gerenciar templates institucionais (slides, plano de ensino, identidade visual).

**Requisitos P0**
- [ ] Admin cria disciplina (nome, curso, período, carga horária) e vincula por e-mail: **máximo 2 professores** e **máximo 2 assistentes por disciplina** (limite hard, validado no convite).
- [ ] Papéis e permissões:
  - **Admin:** CRUD de disciplinas, vínculos, templates, visão agregada. Não edita conteúdo pedagógico.
  - **Professor:** tudo dentro da disciplina, incluindo validação de correções e publicação.
  - **Assistente:** cria/edita rascunhos de materiais e atividades, faz triagem de correção; **não** publica, **não** valida notas, **não** edita plano de ensino.
- [ ] Convite por e-mail com aceite; professor sem conta cria no fluxo do convite.
- [ ] Upload de template institucional de slides e de documentos (plano de ensino, prova).
- [ ] Isolamento de dados por instituição (multi-tenant).

**P1**
- [ ] SSO institucional (Google Workspace / Microsoft).
- [ ] Dashboard institucional: adoção por professor, disciplinas ativas, volume de correções.

---

## 7. Requisitos não-funcionais

- **LGPD:** dados de alunos (notas, correções) são dados pessoais sensíveis no contexto educacional. Consentimento no primeiro acesso, DPA com a instituição, retenção configurável, direito de exclusão.
- **IA com humano no loop:** feedbacks e notas geradas por IA nunca chegam ao aluno sem validação do professor (requisito legal e de confiança — inegociável).
- **Anti-alucinação:** bibliografia e citações do tutor sempre verificáveis; referências inventadas são bug crítico.
- **Disponibilidade:** quiz ao vivo exige baixa latência (<300ms por resposta) e resiliência a 100+ conexões simultâneas por sala.
- **Acessibilidade:** viewer de materiais e painel do aluno em WCAG 2.1 AA.
- **Mobile-first para o aluno** (QR code → celular é o fluxo dominante); desktop-first para o professor.

---

## 8. Métricas de sucesso

| Métrica | Tipo | Meta (1º semestre piloto) |
|---|---|---|
| Tempo médio para criar disciplina completa (plano → aula a aula → materiais 1ª semana) | Leading | < 2h (vs. ~10h baseline) |
| % de provas corrigidas via plataforma com validação | Leading | > 80% das avaliações da turma piloto |
| Tempo médio de correção por prova discursiva | Leading | < 3 min (validação) vs. ~15 min manual |
| Alunos ativos no tutor (WAU/alunos matriculados) | Leading | ≥ 60% na metade do semestre |
| Taxa de edição do professor sobre output da IA | Leading | Monitorar — proxy de qualidade da geração |
| NPS professor / NPS aluno | Lagging | ≥ 50 / ≥ 40 |
| Renovação institucional pós-piloto | Lagging | 100% dos pilotos renovam |

---

## 9. Faseamento sugerido

**Fase 1 — Espinha dorsal do professor (MVP, semestre piloto)**
Módulos 1, 2, 3, 4 + Módulo 10 (admin básico). O professor sai com a disciplina inteira planejada e materiais publicáveis via QR.

**Fase 2 — Avaliação**
Módulos 5, 6, 7, 8. Quiz ao vivo, provas ENADE, correção com validação, feedback ao aluno.

**Fase 3 — Tutor e inteligência**
Módulo 9 + dashboards P1 (analytics de engajamento, alunos em risco, estatísticas de questões).

Racional: valor imediato para o professor antes de exigir mudança de comportamento do aluno; a correção (fase 2) depende de rubrica e banco de questões maduros; o tutor (fase 3) só é bom quando há material acumulado para indexar.

---

## 10. Questões em aberto

| # | Questão | Quem responde | Bloqueante? |
|---|---|---|---|
| 1 | Provas digitalizadas manuscritas: qual a acurácia mínima aceitável de OCR de caligrafia antes de exigir revisão manual total? | Engenharia (spike técnico) | Sim, para Fase 2 |
| 2 | Nota liberada na plataforma precisa espelhar o sistema acadêmico oficial? Export CSV basta ou precisa integração? | Instituições piloto | Não |
| 3 | Aluno autentica com e-mail institucional ou aceita-se e-mail pessoal? Impacta LGPD e vínculo de correção. | Produto + Jurídico | Sim, para Fase 2 |
| 4 | Quiz ao vivo: build vs. buy do motor real-time (WebSocket próprio vs. serviço gerenciado)? | Engenharia | Não |
| 5 | Banco de questões institucional é compartilhado entre disciplinas do mesmo curso por padrão? | Produto + pilotos | Não |
| 6 | Direitos autorais de PDFs subidos pelo professor: até onde o tutor pode reproduzir trechos? | Jurídico | Sim, para Fase 3 |
| 7 | Precificação por aluno/ano vs. por disciplina vs. por professor — impacta modelagem de tenant. | Guttilla | Não |

---

## 11. Riscos

- **Qualidade da geração de IA no primeiro uso define adoção.** Se o plano de ensino gerado for genérico, o professor abandona. Mitigação: prompts por área de conhecimento + exemplos institucionais como few-shot.
- **Professor como gargalo de validação.** Se validar correção for lento, o ganho de tempo evapora. Mitigação: validação em lote com amostragem inteligente (revisar 100% no início, reduzir conforme confiança).
- **Dependência de admin para setup.** Se a instituição demorar a criar disciplinas, o professor não experimenta. Mitigação: modo self-serve para professor individual (P2) ou trial sem admin.
