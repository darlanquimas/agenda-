const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/**
 * Valida senha com requisitos de segurança fortes
 * - Mínimo 12 caracteres
 * - Pelo menos uma letra maiúscula
 * - Pelo menos uma letra minúscula
 * - Pelo menos um número
 * - Pelo menos um caractere especial
 * - Não pode conter senhas comuns
 */
export function validatePassword(password: unknown): string | null {
  if (typeof password !== 'string') {
    return 'Senha inválida';
  }

  if (password.length < 12) {
    return 'Senha deve ter pelo menos 12 caracteres';
  }

  if (!/[A-Z]/.test(password)) {
    return 'Senha deve conter pelo menos uma letra maiúscula';
  }

  if (!/[a-z]/.test(password)) {
    return 'Senha deve conter pelo menos uma letra minúscula';
  }

  if (!/[0-9]/.test(password)) {
    return 'Senha deve conter pelo menos um número';
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Senha deve conter pelo menos um caractere especial (!@#$%^&*()_+-=[]{}|;:,.<>?)';
  }

  const commonPasswords = [
    'password123456',
    'admin123456',
    '123456789012',
    'qwerty123456',
    'welcome123456',
    'letmein123456',
    'Passw0rd!123',
  ];

  const lowerPassword = password.toLowerCase();
  for (const common of commonPasswords) {
    if (lowerPassword.includes(common.toLowerCase())) {
      return 'Senha muito comum. Escolha uma senha mais segura';
    }
  }

  if (/(.)\1{2,}/.test(password)) {
    return 'Senha não pode conter caracteres repetidos consecutivamente';
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

export function sanitizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits || null;
}
