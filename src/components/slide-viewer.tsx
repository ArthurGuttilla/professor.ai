"use client";

import { useCallback, useEffect, useState } from "react";

export type SlideTemplate = {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  coverText?: string;
  closingText?: string;
  logoUrl?: string;
};

type Slide = { title: string; bullets: string[] };

/**
 * Viewer de slides embutido (M4): navegação por teclado/clique, sem download.
 * Aplica o template institucional (cores, fonte, capa/fechamento).
 */
export function SlideViewer({
  slides,
  template,
  deckTitle,
}: {
  slides: Slide[];
  template: SlideTemplate;
  deckTitle: string;
}) {
  const [index, setIndex] = useState(0);

  const all: Slide[] = [
    { title: deckTitle, bullets: template.coverText ? [template.coverText] : [] },
    ...slides,
    ...(template.closingText ? [{ title: template.closingText, bullets: [] }] : []),
  ];

  const next = useCallback(
    () => setIndex((i) => Math.min(i + 1, all.length - 1)),
    [all.length],
  );
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") next();
      if (e.key === "ArrowLeft" || e.key === "PageUp") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const primary = template.primaryColor ?? "#1e3a8a";
  const secondary = template.secondaryColor ?? "#f59e0b";
  const isCover = index === 0 || (index === all.length - 1 && !!template.closingText);
  const slide = all[index];

  return (
    <div
      className="flex min-h-screen cursor-pointer select-none flex-col"
      style={{ fontFamily: template.fontFamily ?? "system-ui, sans-serif" }}
      onClick={next}
      title="Clique ou use as setas para navegar"
    >
      <div
        className="flex flex-1 flex-col justify-center px-8 py-12 sm:px-20"
        style={{ backgroundColor: isCover ? primary : "#ffffff" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {template.logoUrl ? (
          <img src={template.logoUrl} alt="logo" className="absolute right-6 top-6 h-10" />
        ) : null}
        <h1
          className="text-3xl font-bold sm:text-5xl"
          style={{ color: isCover ? "#ffffff" : primary }}
        >
          {slide.title}
        </h1>
        {slide.bullets.length > 0 ? (
          <ul className="mt-8 space-y-3">
            {slide.bullets.map((b, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-lg sm:text-2xl"
                style={{ color: isCover ? "#e5e7eb" : "#374151" }}
              >
                <span style={{ color: secondary }}>▸</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div
        className="flex items-center justify-between px-6 py-3 text-sm"
        style={{ backgroundColor: primary, color: "#ffffff" }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
          className="rounded px-3 py-1 hover:bg-white/10"
        >
          ← Anterior
        </button>
        <span>
          {index + 1} / {all.length}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
          className="rounded px-3 py-1 hover:bg-white/10"
        >
          Próximo →
        </button>
      </div>
    </div>
  );
}
