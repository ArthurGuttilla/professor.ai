// Seed de demonstração: uma instituição completa com disciplina, plano,
// aulas, materiais, atividades, prova, correção e aluno com nota liberada.
// Credenciais demo: admin@demo.edu / ana@demo.edu / bruno@demo.edu — senha "demo123".
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const prisma = new PrismaClient();
const slug = () => crypto.randomBytes(6).toString("hex");

async function main() {
  const passwordHash = await bcrypt.hash("demo123", 10);

  const inst = await prisma.institution.create({
    data: { name: "Universidade Demo" },
  });

  const [admin, ana, bruno] = await Promise.all([
    prisma.user.create({
      data: { institutionId: inst.id, email: "admin@demo.edu", name: "Alice Admin", passwordHash, isAdmin: true },
    }),
    prisma.user.create({
      data: { institutionId: inst.id, email: "ana@demo.edu", name: "Profa. Ana Souza", passwordHash },
    }),
    prisma.user.create({
      data: { institutionId: inst.id, email: "bruno@demo.edu", name: "Bruno Monitor", passwordHash },
    }),
  ]);

  await prisma.institutionTemplate.create({
    data: {
      institutionId: inst.id,
      kind: "SLIDES",
      name: "Template institucional padrão",
      config: {
        primaryColor: "#1e3a8a",
        secondaryColor: "#f59e0b",
        fontFamily: "Georgia, serif",
        coverText: "Universidade Demo",
        closingText: "Bons estudos!",
      },
    },
  });

  const disc = await prisma.discipline.create({
    data: {
      institutionId: inst.id,
      name: "Introdução à Programação",
      course: "Ciência da Computação",
      term: "2026.2",
      workloadHours: 60,
      memberships: {
        create: [
          { userId: ana.id, role: "PROFESSOR", acceptedAt: new Date() },
          { userId: bruno.id, role: "ASSISTANT", acceptedAt: new Date() },
        ],
      },
    },
  });

  const students = await Promise.all(
    [
      ["joao@aluno.demo.edu", "João Lima", "2026001"],
      ["maria@aluno.demo.edu", "Maria Santos", "2026002"],
      ["pedro@aluno.demo.edu", "Pedro Alves", "2026003"],
    ].map(([email, name, registration]) =>
      prisma.student.create({
        data: {
          institutionId: inst.id,
          email,
          name,
          registration,
          enrollments: { create: { disciplineId: disc.id } },
        },
      }),
    ),
  );
  const [joao, maria] = students;

  // ── M1: Plano de ensino ────────────────────────────────────────
  const plan = await prisma.teachingPlan.create({
    data: {
      disciplineId: disc.id,
      ementa:
        "Fundamentos de lógica de programação. Variáveis, tipos de dados e expressões. Estruturas de controle e repetição. Funções e modularização. Estruturas de dados elementares. Introdução à resolução de problemas computacionais.",
      objetivosGerais:
        "Capacitar o aluno a resolver problemas computacionais por meio da construção de algoritmos e programas estruturados.",
      metodologia:
        "Aulas expositivas dialogadas, resolução de exercícios em laboratório, atividades gamificadas e projetos práticos incrementais.",
      criteriosAvaliacao:
        "Duas provas (60%), atividades e quizzes (25%), projeto final (15%). Média mínima 6,0.",
      programUnits: {
        create: [
          { order: 1, title: "Unidade 1 — Lógica e algoritmos", content: "Conceito de algoritmo; pseudocódigo; fluxogramas; entrada, processamento e saída." },
          { order: 2, title: "Unidade 2 — Variáveis e estruturas de controle", content: "Tipos de dados; expressões; condicionais; laços de repetição." },
          { order: 3, title: "Unidade 3 — Funções e modularização", content: "Definição de funções; parâmetros e retorno; escopo; decomposição de problemas." },
          { order: 4, title: "Unidade 4 — Estruturas de dados elementares", content: "Listas e vetores; dicionários; percursos; buscas simples." },
        ],
      },
      learningObjectives: {
        create: [
          { bloomLevel: "Compreender", description: "Explicar o papel de algoritmos na resolução de problemas.", isSpecific: false, order: 0 },
          { bloomLevel: "Aplicar", description: "Construir programas que utilizem condicionais e laços.", isSpecific: true, order: 1 },
          { bloomLevel: "Aplicar", description: "Decompor problemas em funções reutilizáveis.", isSpecific: true, order: 2 },
          { bloomLevel: "Analisar", description: "Comparar estruturas de dados elementares quanto ao uso adequado.", isSpecific: true, order: 3 },
          { bloomLevel: "Criar", description: "Desenvolver um projeto prático integrando os conceitos da disciplina.", isSpecific: true, order: 4 },
        ],
      },
    },
    include: { programUnits: true },
  });
  const units = plan.programUnits;

  const bibItems = await Promise.all(
    [
      { kind: "BASIC", authors: "FORBELLONE, André Luiz Villar; EBERSPÄCHER, Henri Frederico", title: "Lógica de programação: a construção de algoritmos e estruturas de dados", publisher: "Pearson", year: 2022, isbn: "9788543005150" },
      { kind: "BASIC", authors: "MANZANO, José Augusto N. G.; OLIVEIRA, Jayr Figueiredo de", title: "Algoritmos: lógica para desenvolvimento de programação de computadores", publisher: "Érica", year: 2019, isbn: "9788536530473" },
      { kind: "BASIC", authors: "MATTHES, Eric", title: "Curso intensivo de Python", publisher: "Novatec", year: 2023, isbn: "9788575228432" },
      { kind: "COMPLEMENTARY", authors: "CORMEN, Thomas H. et al.", title: "Algoritmos: teoria e prática", publisher: "GEN LTC", year: 2012, isbn: "9788535236996" },
      { kind: "COMPLEMENTARY", authors: "DOWNEY, Allen B.", title: "Pense em Python", publisher: "Novatec", year: 2016, isbn: "9788575225080" },
    ].map((b, i) =>
      prisma.bibliographyItem.create({
        data: {
          teachingPlanId: plan.id,
          ...b,
          order: i,
          verified: true,
          provenance: "Curadoria manual (seed de demonstração)",
          abntFormatted: `${b.authors}. ${b.title}. ${b.publisher}, ${b.year}.`,
          unitLinks: { create: { programUnitId: units[i % units.length].id } },
        },
      }),
    ),
  );

  await prisma.teachingPlanVersion.create({
    data: {
      teachingPlanId: plan.id,
      version: 1,
      authorId: ana.id,
      note: "Versão inicial",
      snapshot: { ementa: plan.ementa, objetivosGerais: plan.objetivosGerais },
    },
  });

  // ── M3: Plano aula a aula ──────────────────────────────────────
  const lessonPlan = await prisma.lessonPlan.create({
    data: {
      teachingPlanId: plan.id,
      startDate: new Date("2026-08-03"),
      endDate: new Date("2026-11-30"),
      weekdays: [1, 3],
      holidays: [new Date("2026-09-07")],
    },
  });

  const lessonDefs = [
    { theme: "Apresentação da disciplina e conceito de algoritmo", unit: 0 },
    { theme: "Pseudocódigo e fluxogramas", unit: 0 },
    { theme: "Variáveis, tipos e expressões", unit: 1 },
    { theme: "Estruturas condicionais", unit: 1 },
    { theme: "Laços de repetição", unit: 1 },
    { theme: "Prova 1", unit: 1, isAssessment: true },
    { theme: "Funções: definição, parâmetros e retorno", unit: 2 },
    { theme: "Escopo e decomposição de problemas", unit: 2 },
    { theme: "Listas e vetores", unit: 3 },
    { theme: "Dicionários e buscas", unit: 3 },
    { theme: "Prova 2", unit: 3, isAssessment: true },
    { theme: "Projeto final: apresentações", unit: 3 },
  ];
  const start = new Date("2026-08-03");
  const lessons = [];
  let d = new Date(start);
  for (let i = 0; i < lessonDefs.length; i++) {
    while (![1, 3].includes(d.getDay()) || d.toISOString().startsWith("2026-09-07")) {
      d.setDate(d.getDate() + 1);
    }
    const def = lessonDefs[i];
    lessons.push(
      await prisma.lesson.create({
        data: {
          lessonPlanId: lessonPlan.id,
          number: i + 1,
          date: new Date(d),
          theme: def.theme,
          objectives: def.isAssessment ? "Avaliação." : `Ao final da aula o aluno deve dominar: ${def.theme.toLowerCase()}.`,
          isAssessment: !!def.isAssessment,
          qrSlug: slug(),
          unitLinks: { create: { programUnitId: units[def.unit].id } },
        },
      }),
    );
    d.setDate(d.getDate() + 1);
  }

  // ── M4: Conteúdo + slides publicados da aula 1 ─────────────────
  await prisma.lessonContent.create({
    data: {
      lessonId: lessons[0].id,
      status: "PUBLISHED",
      qrSlug: slug(),
      markdown: `# Conceito de algoritmo\n\nUm **algoritmo** é uma sequência finita e não ambígua de passos para resolver um problema.\n\n## Por que estudar algoritmos?\n\n- Base de toda a programação\n- Desenvolve raciocínio lógico\n- Independe de linguagem\n\n## Exemplo do cotidiano\n\nUma receita de bolo é um algoritmo: entradas (ingredientes), processamento (passos) e saída (bolo pronto).\n\n## Propriedades\n\n1. **Finitude** — termina em um número finito de passos\n2. **Definição** — cada passo é preciso e não ambíguo\n3. **Entradas e saídas** bem definidas\n4. **Efetividade** — cada passo é executável`,
      proposedActivities: `1. Escreva, em passos numerados, o algoritmo para trocar um pneu.\n2. Identifique entradas, processamento e saída em três tarefas do seu dia.\n3. Discuta em dupla: o que torna um passo "ambíguo"?`,
    },
  });

  await prisma.slideDeck.create({
    data: {
      lessonId: lessons[0].id,
      status: "PUBLISHED",
      qrSlug: slug(),
      data: {
        slides: [
          { title: "Introdução à Programação", bullets: ["Aula 1 — Conceito de algoritmo", "Profa. Ana Souza", "2026.2"] },
          { title: "O que é um algoritmo?", bullets: ["Sequência finita de passos", "Não ambígua", "Resolve um problema definido"] },
          { title: "Exemplo: receita de bolo", bullets: ["Entradas: ingredientes", "Processamento: modo de preparo", "Saída: bolo pronto"] },
          { title: "Propriedades", bullets: ["Finitude", "Definição precisa", "Entradas e saídas", "Efetividade"] },
          { title: "Bibliografia da aula", bullets: [bibItems[0].abntFormatted, bibItems[1].abntFormatted] },
        ],
      },
    },
  });

  // ── M5: Banco de questões + quiz assíncrono ────────────────────
  const q = [];
  const mcDefs = [
    {
      baseText: "Uma padaria automatizou a produção: o forno executa uma sequência fixa de passos para assar cada fornada.",
      statement: "Essa sequência de passos caracteriza, em computação, o conceito de:",
      options: [
        { key: "A", text: "Algoritmo" },
        { key: "B", text: "Variável" },
        { key: "C", text: "Compilador" },
        { key: "D", text: "Banco de dados" },
        { key: "E", text: "Sistema operacional" },
      ],
      correctKey: "A",
      unit: 0,
      theme: "Algoritmos",
    },
    {
      statement: "Qual estrutura repete um bloco de código enquanto uma condição for verdadeira?",
      options: [
        { key: "A", text: "if/else" },
        { key: "B", text: "while" },
        { key: "C", text: "função" },
        { key: "D", text: "constante" },
      ],
      correctKey: "B",
      unit: 1,
      theme: "Laços",
    },
    {
      statement: "Um algoritmo precisa terminar em um número finito de passos.",
      type: "TRUE_FALSE",
      options: [
        { key: "V", text: "Verdadeiro" },
        { key: "F", text: "Falso" },
      ],
      correctKey: "V",
      unit: 0,
      theme: "Algoritmos",
    },
    {
      statement: "Qual o valor de x após: x = 2; x = x * 3 + 1?",
      options: [
        { key: "A", text: "6" },
        { key: "B", text: "7" },
        { key: "C", text: "8" },
        { key: "D", text: "9" },
      ],
      correctKey: "B",
      unit: 1,
      theme: "Variáveis",
    },
  ];
  for (const def of mcDefs) {
    q.push(
      await prisma.question.create({
        data: {
          disciplineId: disc.id,
          type: def.type ?? "MULTIPLE_CHOICE",
          difficulty: "EASY",
          source: "MANUAL",
          baseText: def.baseText,
          statement: def.statement,
          options: def.options,
          correctKey: def.correctKey,
          unitId: units[def.unit].id,
          theme: def.theme,
          reviewedAt: new Date(),
        },
      }),
    );
  }
  const essay = await prisma.question.create({
    data: {
      disciplineId: disc.id,
      type: "ESSAY",
      difficulty: "MEDIUM",
      source: "MANUAL",
      baseText:
        "Um estagiário escreveu um programa que calcula a média de notas, mas o código repete o mesmo bloco de soma em quatro lugares diferentes.",
      statement:
        "Explique por que a modularização com funções melhoraria esse código, citando pelo menos dois benefícios concretos.",
      answerKey:
        "Resposta esperada: funções eliminam duplicação (único ponto de manutenção), dão nome/abstração ao comportamento, facilitam testes isolados e reuso. Benefícios: manutenibilidade, legibilidade, testabilidade, reuso.",
      unitId: units[2].id,
      theme: "Funções",
      reviewedAt: new Date(),
    },
  });

  const quiz = await prisma.activity.create({
    data: {
      disciplineId: disc.id,
      lessonId: lessons[0].id,
      kind: "QUIZ_ASYNC",
      title: "Quiz — Aula 1: Algoritmos",
      status: "PUBLISHED",
      startsAt: new Date("2026-06-20"),
      dueAt: new Date("2026-08-20"),
      maxAttempts: 2,
      joinCode: "DEMO01",
      questions: {
        create: [
          { questionId: q[0].id, order: 1, points: 1 },
          { questionId: q[2].id, order: 2, points: 1 },
          { questionId: q[3].id, order: 3, points: 1 },
        ],
      },
    },
  });

  await prisma.activityAttempt.create({
    data: {
      activityId: quiz.id,
      studentId: joao.id,
      attemptNumber: 1,
      submittedAt: new Date("2026-07-01"),
      score: 2,
      answers: {
        create: [
          { questionId: q[0].id, answer: "A", isCorrect: true, points: 1 },
          { questionId: q[2].id, answer: "F", isCorrect: false, points: 0 },
          { questionId: q[3].id, answer: "B", isCorrect: true, points: 1 },
        ],
      },
    },
  });

  // ── M6: Prova ENADE com rubrica ────────────────────────────────
  const exam = await prisma.exam.create({
    data: {
      disciplineId: disc.id,
      kind: "ENADE_EXAM",
      title: "Prova 1 — Unidades 1 e 2",
      scope: { unitIds: [units[0].id, units[1].id] },
      status: "PUBLISHED",
      totalPoints: 10,
      appliedAt: new Date("2026-07-06"),
      questions: {
        create: [
          { questionId: q[0].id, order: 1, points: 3 },
          { questionId: q[1].id, order: 2, points: 3 },
          { questionId: essay.id, order: 3, points: 4 },
        ],
      },
    },
  });

  const rubric = await prisma.rubric.create({
    data: {
      examId: exam.id,
      criteria: {
        create: [
          { criterion: "Objetivas — acerto", description: "Pontuação integral por alternativa correta.", points: 6, order: 0 },
          { questionId: essay.id, criterion: "Compreensão do problema", description: "Identifica a duplicação de código como problema central.", points: 1.5, order: 1 },
          { questionId: essay.id, criterion: "Benefícios da modularização", description: "Cita ao menos dois benefícios corretos (manutenção, reuso, testes, legibilidade).", points: 2, order: 2 },
          { questionId: essay.id, criterion: "Clareza e coesão", description: "Texto organizado, terminologia adequada.", points: 0.5, order: 3 },
        ],
      },
    },
    include: { criteria: true },
  });
  const [critObj, critComp, critBen, critClar] = rubric.criteria;

  // ── M7/M8: Submissão da Maria — corrigida, validada e LIBERADA ─
  const subMaria = await prisma.submission.create({
    data: {
      examId: exam.id,
      studentId: maria.id,
      linkState: "CONFIRMED",
      ocrHeader: "Maria Santos — mat. 2026002",
      ocrText:
        "Q1: A\nQ2: B\nQ3: Repetir código é ruim porque quando precisar mudar tem que mudar em 4 lugares. Com função muda em um lugar só. Também fica mais fácil de ler e dá pra testar a função sozinha.",
      status: "RELEASED",
      aiTotal: 9.0,
      finalTotal: 9.5,
      validatedById: ana.id,
      validatedAt: new Date("2026-07-08T14:00:00Z"),
      releasedAt: new Date("2026-07-08T14:05:00Z"),
      answers: {
        create: [
          { questionId: q[0].id, answer: "A", isCorrect: true, aiPoints: 3, finalPoints: 3 },
          { questionId: q[1].id, answer: "B", isCorrect: true, aiPoints: 3, finalPoints: 3 },
          {
            questionId: essay.id,
            answer:
              "Repetir código é ruim porque quando precisar mudar tem que mudar em 4 lugares. Com função muda em um lugar só. Também fica mais fácil de ler e dá pra testar a função sozinha.",
            aiPoints: 3,
            finalPoints: 3.5,
            aiFeedback: "Identifica a duplicação e cita manutenção, legibilidade e testabilidade.",
            finalFeedback: "Excelente resposta: identifica o problema e cita três benefícios corretos. Faltou apenas mencionar reuso.",
          },
        ],
      },
      criterionScores: {
        create: [
          { criterionId: critObj.id, aiScore: 6, finalScore: 6, aiJustification: "Duas objetivas corretas." },
          { criterionId: critComp.id, aiScore: 1.5, finalScore: 1.5, aiJustification: "Identifica claramente a duplicação como problema." },
          { criterionId: critBen.id, aiScore: 1.5, finalScore: 2, aiJustification: "Cita manutenção e testabilidade.", finalJustification: "Cita três benefícios: manutenção, legibilidade e testabilidade." },
          { criterionId: critClar.id, aiScore: 0, finalScore: 0, aiJustification: "Texto informal, sem terminologia técnica." },
        ],
      },
      feedback: {
        create: {
          aiText: "Bom domínio do conteúdo. Atenção à formalidade do texto na discursiva.",
          finalText:
            "Parabéns, Maria! Você acertou todas as objetivas e sua resposta discursiva demonstra compreensão real do valor da modularização. Para a próxima: use terminologia mais técnica (ex.: 'manutenibilidade', 'ponto único de mudança') — foi o único critério em que perdeu pontos.",
          reviewState: "RELEASED",
        },
      },
    },
  });

  // Submissão do João — corrigida pela IA, aguardando validação (demo do gate).
  await prisma.submission.create({
    data: {
      examId: exam.id,
      studentId: joao.id,
      linkState: "SUGGESTED",
      suggestedStudentId: joao.id,
      ocrHeader: "Joao Lima 2026001",
      ocrText: "Q1: A\nQ2: C\nQ3: Função serve para organizar o código.",
      status: "AI_GRADED",
      aiTotal: 4.5,
      answers: {
        create: [
          { questionId: q[0].id, answer: "A", isCorrect: true, aiPoints: 3 },
          { questionId: q[1].id, answer: "C", isCorrect: false, aiPoints: 0 },
          {
            questionId: essay.id,
            answer: "Função serve para organizar o código.",
            aiPoints: 1.5,
            aiFeedback: "Resposta genérica: não identifica a duplicação nem cita benefícios concretos.",
          },
        ],
      },
      criterionScores: {
        create: [
          { criterionId: critObj.id, aiScore: 3, aiJustification: "Uma objetiva correta de duas." },
          { criterionId: critComp.id, aiScore: 0.5, aiJustification: "Menciona organização, mas não a duplicação." },
          { criterionId: critBen.id, aiScore: 0.5, aiJustification: "Nenhum benefício concreto citado." },
          { criterionId: critClar.id, aiScore: 0.5, aiJustification: "Texto curto porém claro." },
        ],
      },
      feedback: {
        create: {
          aiText:
            "João, revise a Unidade 2 (laços) e o conceito de modularização: sua resposta da questão 3 não abordou o problema da duplicação de código.",
          reviewState: "PENDING_REVIEW",
        },
      },
    },
  });

  await prisma.auditEvent.create({
    data: {
      institutionId: inst.id,
      actorType: "USER",
      actorId: ana.id,
      action: "submission.release",
      entity: "Submission",
      entityId: subMaria.id,
      data: { aiTotal: 9.0, finalTotal: 9.5, note: "Ajuste no critério de benefícios (+0.5)" },
    },
  });

  console.log("Seed concluído.");
  console.log("Admin:      admin@demo.edu / demo123");
  console.log("Professora: ana@demo.edu / demo123");
  console.log("Assistente: bruno@demo.edu / demo123");
  console.log("Alunos:     joao@aluno.demo.edu · maria@aluno.demo.edu · pedro@aluno.demo.edu");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
