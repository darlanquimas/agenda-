/**
 * Utilitários de segurança para mascaramento e validação
 */

/**
 * Mascara número de telefone nos logs
 * Exemplo: 22999887766 -> 22****7766
 */
export function maskPhone(phone: string | undefined | null): string {
  if (!phone) return '***';
  
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length < 4) return '***';
  if (cleaned.length <= 8) return cleaned.substring(0, 2) + '***';
  
  return cleaned.substring(0, 2) + '****' + cleaned.substring(cleaned.length - 4);
}

/**
 * Mascara email nos logs
 * Exemplo: user@example.com -> u***@e***.com
 */
export function maskEmail(email: string | undefined | null): string {
  if (!email) return '***';
  
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  
  const maskedLocal = local.length > 1 ? local[0] + '***' : '***';
  const [domainName, tld] = domain.split('.');
  const maskedDomain = domainName.length > 1 ? domainName[0] + '***' : '***';
  
  return `${maskedLocal}@${maskedDomain}.${tld || 'com'}`;
}

/**
 * Mascara token nos logs (mostra apenas primeiros e últimos caracteres)
 * Exemplo: A7K9M2X4 -> A7****X4
 */
export function maskToken(token: string | undefined | null): string {
  if (!token) return '***';
  if (token.length < 4) return '***';
  
  return token.substring(0, 2) + '****' + token.substring(token.length - 2);
}

/**
 * Valida se o número é de origem WhatsApp válida
 */
export function isValidWhatsAppOrigin(remoteJid: string | undefined): boolean {
  if (!remoteJid) return false;
  
  // Formato válido: número@s.whatsapp.net
  return remoteJid.endsWith('@s.whatsapp.net');
}

/**
 * Extrai número de telefone limpo do remoteJid
 */
export function extractPhoneFromJid(remoteJid: string | undefined): string | null {
  if (!remoteJid || !isValidWhatsAppOrigin(remoteJid)) return null;
  
  return remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
}

/**
 * Valida formato de token de confirmação
 * Deve ser exatamente 8 caracteres alfanuméricos maiúsculos
 */
export function isValidTokenFormat(token: string | undefined | null): boolean {
  if (!token) return false;
  
  return /^[A-Z0-9]{8}$/.test(token);
}

/**
 * Remove informações sensíveis de objetos antes de logar
 */
export function sanitizeForLog(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized: any = Array.isArray(obj) ? [] : {};
  
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    
    const value = obj[key];
    
    // Campos sensíveis que devem ser mascarados
    if (key.toLowerCase().includes('phone')) {
      sanitized[key] = maskPhone(value);
    } else if (key.toLowerCase().includes('email')) {
      sanitized[key] = maskEmail(value);
    } else if (key.toLowerCase().includes('token') && typeof value === 'string') {
      sanitized[key] = maskToken(value);
    } else if (key.toLowerCase().includes('password') || key.toLowerCase().includes('secret')) {
      sanitized[key] = '***';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLog(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}
