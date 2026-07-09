import "server-only";
import { scoreAnswer } from "./scoring";

/**
 * Motor do quiz ao vivo (M5) — v1 em memória, single-instance.
 * Estado por sala + broadcast via SSE. A decisão build vs. buy do motor
 * realtime para produção segue aberta (PRD Q4); esta implementação cobre o
 * piloto e define o contrato de eventos.
 */

export type LiveQuestion = {
  id: string;
  statement: string;
  baseText: string | null;
  options: { key: string; text: string }[];
  correctKey: string | null;
  weight: number;
};

export type Player = {
  studentId: string;
  name: string;
  score: number;
  lastAnswerAt: number;
  answers: Map<number, { key: string; correct: boolean; points: number; elapsedMs: number }>;
};

export type Room = {
  activityId: string;
  disciplineId: string;
  timePerQuestionSec: number;
  questions: LiveQuestion[];
  status: "lobby" | "question" | "reveal" | "ended";
  currentIndex: number;
  questionStartedAt: number;
  players: Map<string, Player>;
  listeners: Set<(data: string) => void>;
  persisted: boolean;
};

// Sobrevive a hot-reload em dev.
const globalStore = globalThis as unknown as { __liveRooms?: Map<string, Room> };
const rooms = (globalStore.__liveRooms ??= new Map<string, Room>());

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function createRoom(
  code: string,
  init: Pick<Room, "activityId" | "disciplineId" | "timePerQuestionSec" | "questions">,
): Room {
  const room: Room = {
    ...init,
    status: "lobby",
    currentIndex: -1,
    questionStartedAt: 0,
    players: new Map(),
    listeners: new Set(),
    persisted: false,
  };
  rooms.set(code.toUpperCase(), room);
  broadcast(code);
  return room;
}

export function closeRoom(code: string) {
  rooms.delete(code.toUpperCase());
}

export function joinRoom(code: string, studentId: string, name: string): Room | null {
  const room = getRoom(code);
  if (!room || room.status === "ended") return null;
  if (!room.players.has(studentId)) {
    room.players.set(studentId, {
      studentId,
      name,
      score: 0,
      lastAnswerAt: 0,
      answers: new Map(),
    });
  }
  broadcast(code);
  return room;
}

export function startQuestion(code: string, index: number) {
  const room = getRoom(code);
  if (!room || index < 0 || index >= room.questions.length) return;
  room.status = "question";
  room.currentIndex = index;
  room.questionStartedAt = Date.now();
  broadcast(code);
}

export function reveal(code: string) {
  const room = getRoom(code);
  if (!room) return;
  room.status = "reveal";
  broadcast(code);
}

export function endRoom(code: string) {
  const room = getRoom(code);
  if (!room) return;
  room.status = "ended";
  broadcast(code);
}

export function submitAnswer(code: string, studentId: string, key: string): boolean {
  const room = getRoom(code);
  if (!room || room.status !== "question") return false;
  const player = room.players.get(studentId);
  if (!player) return false;
  const idx = room.currentIndex;
  if (player.answers.has(idx)) return false; // uma resposta por questão

  const question = room.questions[idx];
  const elapsedMs = Date.now() - room.questionStartedAt;
  const timeLimitMs = room.timePerQuestionSec * 1000;
  if (elapsedMs > timeLimitMs + 1500) return false; // janela encerrada (tolerância de rede)

  const correct = question.correctKey !== null && key === question.correctKey;
  const points = scoreAnswer({ correct, elapsedMs, timeLimitMs, weight: question.weight });
  player.answers.set(idx, { key, correct, points, elapsedMs });
  player.score += points;
  player.lastAnswerAt = Date.now();
  broadcast(code);
  return true;
}

/** Snapshot serializável para o SSE (sem gabarito durante a questão!). */
export function snapshot(code: string, opts?: { forHost?: boolean }) {
  const room = getRoom(code);
  if (!room) return null;
  const q = room.currentIndex >= 0 ? room.questions[room.currentIndex] : null;
  const showCorrect = room.status === "reveal" || room.status === "ended" || !!opts?.forHost;
  const players = [...room.players.values()]
    .map((p) => ({
      name: p.name,
      score: p.score,
      lastAnswerAt: p.lastAnswerAt,
      answered: room.currentIndex >= 0 ? p.answers.has(room.currentIndex) : false,
    }))
    .sort((a, b) => b.score - a.score || a.lastAnswerAt - b.lastAnswerAt);

  return {
    status: room.status,
    currentIndex: room.currentIndex,
    totalQuestions: room.questions.length,
    timePerQuestionSec: room.timePerQuestionSec,
    questionStartedAt: room.questionStartedAt,
    question: q
      ? {
          statement: q.statement,
          baseText: q.baseText,
          options: q.options.map((o) => ({ key: o.key, text: o.text })),
          correctKey: showCorrect ? q.correctKey : null,
        }
      : null,
    players,
  };
}

export function broadcast(code: string) {
  const room = getRoom(code);
  if (!room) return;
  const data = JSON.stringify(snapshot(code));
  for (const send of room.listeners) {
    try {
      send(data);
    } catch {
      room.listeners.delete(send);
    }
  }
}

export function subscribe(code: string, send: (data: string) => void): () => void {
  const room = getRoom(code);
  if (!room) return () => {};
  room.listeners.add(send);
  send(JSON.stringify(snapshot(code)));
  return () => room.listeners.delete(send);
}
