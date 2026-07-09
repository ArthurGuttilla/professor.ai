export default function AlunoLayout({ children }: { children: React.ReactNode }) {
  // Área do aluno é mobile-first; login e páginas públicas cuidam do próprio shell.
  return <div className="min-h-screen bg-gray-50">{children}</div>;
}
