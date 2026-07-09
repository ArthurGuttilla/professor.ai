# ADR 0001 — Escolha de stack

**Status:** Aceito · **Data:** 2026-07-09

## Contexto

A plataforma (ver `docs/PRD.md`) é dominada por dois tipos de trabalho:
1. **UI multi-persona** — professor/admin (desktop-first) e aluno (mobile-first via
   QR), com uma cadeia de artefatos fortemente tipada e interdependente.
2. **Pipelines de IA** — geração de plano de ensino, bibliografia, questões, provas,
   correção por rubrica e um tutor RAG, todos com humano no loop.

Precisamos de um stack que minimize atrito entre esses artefatos (eles compartilham
o mesmo modelo de domínio) e que suporte multi-tenancy e conformidade (LGPD, gate
de validação).

## Decisão

**Next.js 15 (App Router) + TypeScript, PostgreSQL via Prisma, Tailwind, Anthropic SDK.**

- **Um único codebase TypeScript** do banco à UI. A cadeia
  plano→bibliografia→aula→prova→correção é o coração do produto; mantê-la em um só
  sistema de tipos evita duplicação de contratos entre um backend e um frontend
  separados.
- **Next.js** cobre as três áreas (professor/admin/aluno) com route groups e
  entrega tanto a UI quanto a API (Route Handlers / Server Actions) — reduzindo
  superfície operacional na Fase 1.
- **Postgres + Prisma** dão modelagem relacional tipada e migrations — adequado a
  um domínio altamente relacional e multi-tenant.
- **Anthropic SDK** para toda geração e o tutor. Saída estruturada + validação Zod
  atendem o requisito anti-alucinação.

## Alternativas consideradas

- **FastAPI (Python) + React separados.** Python é natural para pipelines de IA,
  mas o custo de manter contratos entre dois sistemas de tipos, para um domínio tão
  interligado, supera o ganho na Fase 1. O SDK Anthropic em TS é maduro. Podemos
  extrair um worker Python específico (ex.: OCR) sem reescrever o núcleo.
- **React (Vite) + Node/Express separados.** Divisão clássica, mas duplica
  roteamento, auth e serialização sem benefício claro para uma equipe pequena.

## Consequências

- Cargas de trabalho de perfil distinto **serão extraídas depois**, não agora:
  worker de correção/OCR (jobs longos, Fase 2) e motor de quiz realtime (<300ms,
  Fase 2 — decisão build vs. buy ainda aberta, ver Q4 do PRD). A arquitetura
  (`docs/architecture.md` §3) já reserva essa fronteira.
- Deploy inicial simples (um app + Postgres). Storage S3 e filas entram na Fase 2.
- Se um pipeline de IA exigir bibliotecas só-Python, isolamos como serviço; o
  contrato é HTTP/JSON, não o modelo de domínio inteiro.
