"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";

type Snapshot = {
  status: "lobby" | "question" | "reveal" | "ended";
  currentIndex: number;
  totalQuestions: number;
  timePerQuestionSec: number;
  questionStartedAt: number;
  question: {
    statement: string;
    baseText: string | null;
    options: { key: string; text: string }[];
    correctKey: string | null;
  } | null;
  players: { name: string; score: number; answered: boolean }[];
};

function useRoom(code: string) {
  const [state, setState] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/quiz/${code}/events`);
    es.onmessage = (e) => setState(JSON.parse(e.data));
    es.onerror = () => setError("Conexão perdida — recarregue a página.");
    return () => es.close();
  }, [code]);

  return { state, error };
}

function Countdown({ startedAt, limitSec }: { startedAt: number; limitSec: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const remaining = Math.max(0, Math.ceil((startedAt + limitSec * 1000 - now) / 1000));
  return (
    <span
      className={`text-2xl font-bold tabular-nums ${remaining <= 5 ? "text-red-600" : "text-gray-900"}`}
    >
      {remaining}s
    </span>
  );
}

const OPTION_COLORS = [
  "bg-red-500 hover:bg-red-600",
  "bg-blue-500 hover:bg-blue-600",
  "bg-yellow-500 hover:bg-yellow-600",
  "bg-green-500 hover:bg-green-600",
  "bg-purple-500 hover:bg-purple-600",
];

/** Tela do ALUNO no quiz ao vivo (mobile-first). */
export function QuizPlayer({ code }: { code: string }) {
  const { state, error } = useRoom(code);
  const [joined, setJoined] = useState(false);
  const answeredIndex = useRef<number>(-1);
  const [myAnswer, setMyAnswer] = useState<string | null>(null);

  useEffect(() => {
    if (!joined) {
      fetch(`/api/quiz/${code}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join" }),
      }).then((r) => setJoined(r.ok));
    }
  }, [code, joined]);

  useEffect(() => {
    if (state?.status === "question" && answeredIndex.current !== state.currentIndex) {
      setMyAnswer(null);
    }
  }, [state?.status, state?.currentIndex]);

  if (error) return <p className="p-8 text-center text-sm text-red-600">{error}</p>;
  if (!state) return <p className="p-8 text-center text-sm text-gray-500">Conectando…</p>;

  const answer = async (key: string) => {
    if (myAnswer) return;
    setMyAnswer(key);
    answeredIndex.current = state.currentIndex;
    await fetch(`/api/quiz/${code}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "answer", key }),
    });
  };

  if (state.status === "lobby") {
    return (
      <div className="p-8 text-center">
        <p className="text-lg font-semibold text-gray-900">Você está na sala!</p>
        <p className="mt-2 text-sm text-gray-500">
          {state.players.length} participante(s). Aguarde o professor iniciar.
        </p>
      </div>
    );
  }

  if (state.status === "ended") {
    return (
      <div className="p-8">
        <h2 className="text-center text-lg font-bold text-gray-900">Fim de jogo! 🏁</h2>
        <ol className="mx-auto mt-4 max-w-sm space-y-1">
          {state.players.slice(0, 10).map((p, i) => (
            <li key={i} className="flex justify-between rounded bg-gray-50 px-3 py-1.5 text-sm">
              <span>
                {i + 1}. {p.name}
              </span>
              <span className="font-semibold">{p.score}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const q = state.question;
  if (!q) return null;

  return (
    <div className="mx-auto max-w-md p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-gray-500">
          Questão {state.currentIndex + 1}/{state.totalQuestions}
        </span>
        {state.status === "question" ? (
          <Countdown startedAt={state.questionStartedAt} limitSec={state.timePerQuestionSec} />
        ) : null}
      </div>
      {q.baseText ? <p className="mb-2 text-xs italic text-gray-500">{q.baseText}</p> : null}
      <p className="mb-4 font-medium text-gray-900">{q.statement}</p>
      <div className="grid grid-cols-1 gap-2">
        {q.options.map((o, i) => {
          const revealed = state.status === "reveal";
          const isCorrect = revealed && q.correctKey === o.key;
          const isMine = myAnswer === o.key;
          return (
            <button
              key={o.key}
              disabled={!!myAnswer || state.status !== "question"}
              onClick={() => answer(o.key)}
              className={`rounded-lg px-4 py-3 text-left text-white transition-transform active:scale-95 disabled:opacity-70 ${
                revealed
                  ? isCorrect
                    ? "bg-green-600"
                    : isMine
                      ? "bg-red-600"
                      : "bg-gray-400"
                  : OPTION_COLORS[i % OPTION_COLORS.length]
              } ${isMine ? "ring-4 ring-gray-900/30" : ""}`}
            >
              <span className="font-bold">{o.key})</span> {o.text}
              {revealed && isCorrect ? " ✓" : ""}
            </button>
          );
        })}
      </div>
      {myAnswer && state.status === "question" ? (
        <p className="mt-3 text-center text-sm text-gray-500">Resposta enviada! Aguarde…</p>
      ) : null}
    </div>
  );
}

/** Tela do PROFESSOR (host): projeta questão, ranking e controla o fluxo. */
export function QuizHost({ code, disciplineId }: { code: string; disciplineId: string }) {
  const { state, error } = useRoom(code);

  const command = async (cmd: string) => {
    await fetch(`/api/quiz/${code}/host`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: cmd, disciplineId }),
    });
  };

  if (error) return <p className="p-8 text-center text-sm text-red-600">{error}</p>;
  if (!state) return <p className="p-8 text-center text-sm text-gray-500">Conectando…</p>;

  const answeredCount = state.players.filter((p) => p.answered).length;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <p className="text-lg">
          Sala <span className="font-bold tracking-widest text-brand">{code}</span> ·{" "}
          {state.players.length} participante(s)
        </p>
        <div className="flex gap-2">
          {state.status === "lobby" ? (
            <Button onClick={() => command("start")} disabled={state.players.length === 0}>
              Iniciar quiz
            </Button>
          ) : null}
          {state.status === "question" ? (
            <Button onClick={() => command("reveal")}>Revelar resposta</Button>
          ) : null}
          {state.status === "reveal" && state.currentIndex < state.totalQuestions - 1 ? (
            <Button onClick={() => command("next")}>Próxima questão</Button>
          ) : null}
          {state.status === "reveal" && state.currentIndex >= state.totalQuestions - 1 ? (
            <Button onClick={() => command("end")}>Encerrar e salvar</Button>
          ) : null}
          {state.status !== "ended" && state.status !== "lobby" ? (
            <Button variant="secondary" onClick={() => command("end")}>
              Encerrar
            </Button>
          ) : null}
        </div>
      </div>

      {state.status === "lobby" ? (
        <Card>
          <p className="text-center text-sm text-gray-500">
            Aguardando participantes… Projete o código/QR da sala.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {state.players.map((p, i) => (
              <span key={i} className="rounded-full bg-gray-100 px-3 py-1 text-sm">
                {p.name}
              </span>
            ))}
          </div>
        </Card>
      ) : null}

      {state.question && state.status !== "ended" ? (
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Questão {state.currentIndex + 1}/{state.totalQuestions} · {answeredCount}/
              {state.players.length} responderam
            </span>
            {state.status === "question" ? (
              <Countdown startedAt={state.questionStartedAt} limitSec={state.timePerQuestionSec} />
            ) : null}
          </div>
          {state.question.baseText ? (
            <p className="mb-2 text-sm italic text-gray-500">{state.question.baseText}</p>
          ) : null}
          <p className="text-xl font-semibold text-gray-900">{state.question.statement}</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {state.question.options.map((o) => (
              <li
                key={o.key}
                className={`rounded-md border px-3 py-2 text-sm ${
                  state.question?.correctKey === o.key
                    ? "border-green-500 bg-green-50 font-medium text-green-800"
                    : "border-gray-200 text-gray-700"
                }`}
              >
                {o.key}) {o.text}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* Ranking projetável */}
      <Card>
        <h2 className="mb-2 font-semibold text-gray-900">
          {state.status === "ended" ? "Ranking final 🏆" : "Ranking"}
        </h2>
        <ol className="space-y-1">
          {state.players.slice(0, 10).map((p, i) => (
            <li
              key={i}
              className={`flex justify-between rounded px-3 py-1.5 text-sm ${
                i === 0 ? "bg-yellow-50 font-semibold" : "bg-gray-50"
              }`}
            >
              <span>
                {i + 1}. {p.name} {p.answered && state.status === "question" ? "✓" : ""}
              </span>
              <span className="tabular-nums">{p.score}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
