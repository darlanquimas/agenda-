import crypto from 'crypto';

/**
 * Gera um token único para confirmação de agendamento
 * Formato: 8 caracteres alfanuméricos (maiúsculas)
 * Exemplo: A7K9M2X4
 */
export function generateConfirmationToken(): string {
  // Gerar 8 bytes aleatórios e converter para base36
  const randomBytes = crypto.randomBytes(6);
  const token = randomBytes.toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .substring(0, 8);
  
  return token;
}

/**
 * Gera um token único garantido (com verificação de colisão)
 * Passa uma função de verificação que retorna true se o token já existe
 */
export async function generateUniqueToken(
  checkExists: (token: string) => Promise<boolean>
): Promise<string> {
  let token: string;
  let attempts = 0;
  const maxAttempts = 10;
  
  do {
    token = generateConfirmationToken();
    attempts++;
    
    if (attempts >= maxAttempts) {
      throw new Error('Não foi possível gerar um token único após múltiplas tentativas');
    }
  } while (await checkExists(token));
  
  return token;
}
