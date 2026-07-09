import "server-only";
import QRCode from "qrcode";

/** URL pública de um slug de material/aula (alvo dos QR codes — PRD M4). */
export function publicUrl(slug: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base}/m/${slug}`;
}

/** QR code como data URL (PNG) para exibição/projeção. */
export async function qrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { margin: 1, width: 320 });
}
