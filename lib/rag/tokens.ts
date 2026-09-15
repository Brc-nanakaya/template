const STOP = new Set(["この", "こと", "ため", "について", "における", "および"]);

export function tokenize(text: string): string[] {
  return text
    .split(/[\s、。．，,.!！?？「」『』（）()【】・]/)
    .flatMap((part) => part.match(/[一-龯ァ-ヴーa-zA-Z0-9]{2,}/g) ?? [])
    .filter((t) => !STOP.has(t));
}
