import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Storage de arquivos v1: disco local (STORAGE_DIR, default ./storage).
 * A interface é mínima de propósito — trocar por S3 na Fase 2 sem tocar
 * nos módulos (ver docs/architecture.md).
 */

const ROOT = process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage");

export async function saveFile(opts: {
  institutionId: string;
  kind: string; // "materials" | "submissions" | "templates"
  originalName: string;
  data: Buffer;
}): Promise<string> {
  const safeName = opts.originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const key = `${opts.institutionId}/${opts.kind}/${crypto.randomBytes(8).toString("hex")}-${safeName}`;
  const full = path.join(ROOT, key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, opts.data);
  return key;
}

export async function readFile(key: string): Promise<Buffer | null> {
  // Bloqueia path traversal.
  const full = path.join(ROOT, key);
  if (!full.startsWith(path.resolve(ROOT))) return null;
  try {
    return await fs.readFile(full);
  } catch {
    return null;
  }
}
