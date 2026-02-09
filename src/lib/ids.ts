export function id(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

export function nowIso() {
  return new Date().toISOString();
}
