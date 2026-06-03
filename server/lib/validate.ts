const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function validatePassword(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Senha deve ter pelo menos 8 caracteres';
  }
  return null;
}

export function parseId(raw: string | undefined, label = 'ID'): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    const err = new Error(`${label} inválido`) as Error & { status: number };
    err.status = 400;
    throw err;
  }
  return n;
}

export function capLimit(raw: string | undefined, defaultVal = 20, max = 100): number {
  const n = parseInt(raw ?? String(defaultVal), 10);
  return Math.min(Math.max(1, isNaN(n) ? defaultVal : n), max);
}
