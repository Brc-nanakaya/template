/** 条例名やファイル名から安定した lawId を作る */
export function lawIdFromName(name: string): string {
  const base = name
    .normalize("NFKC")
    .replace(/\.(pdf|md|txt)$/i, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || `ordinance-${Date.now()}`;
}
