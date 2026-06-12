/**
 * Módulo de sanitização de entrada para prevenir ataques XSS
 */

/**
 * Sanitiza uma string removendo caracteres perigosos
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';

  return input
    .replace(/[<>]/g, '') // Remove < e >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers (onclick=, etc)
    .trim();
}

/**
 * Sanitiza HTML permitindo apenas tags seguras
 */
export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string') return '';

  const allowedTags = ['b', 'i', 'u', 'strong', 'em', 'p', 'br'];
  
  let sanitized = input;
  
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  
  return sanitized;
}

/**
 * Sanitiza email removendo caracteres perigosos
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') return '';
  
  return email
    .toLowerCase()
    .trim()
    .replace(/[<>;"']/g, '');
}

/**
 * Sanitiza número de telefone mantendo apenas dígitos e caracteres permitidos
 */
export function sanitizePhone(phone: string): string {
  if (typeof phone !== 'string') return '';
  
  return phone
    .trim()
    .replace(/[^0-9+\-\s()]/g, '');
}

/**
 * Sanitiza CPF/CNPJ mantendo apenas dígitos
 */
export function sanitizeDocument(document: string): string {
  if (typeof document !== 'string') return '';
  
  return document.replace(/\D/g, '');
}

/**
 * Sanitiza objeto recursivamente
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized = {} as T;

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];

      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value) as any;
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'string' ? sanitizeString(item) : 
          typeof item === 'object' ? sanitizeObject(item) : item
        ) as any;
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
}

/**
 * Sanitiza entrada baseado no tipo de campo
 */
export function sanitizeField(value: any, fieldType: 'string' | 'email' | 'phone' | 'document' | 'html'): string {
  if (!value) return '';

  switch (fieldType) {
    case 'email':
      return sanitizeEmail(value);
    case 'phone':
      return sanitizePhone(value);
    case 'document':
      return sanitizeDocument(value);
    case 'html':
      return sanitizeHtml(value);
    case 'string':
    default:
      return sanitizeString(value);
  }
}

/**
 * Valida e sanitiza dados de entrada de cliente
 */
export function sanitizeClientData(data: any) {
  return {
    name: sanitizeString(data.name || ''),
    email: data.email ? sanitizeEmail(data.email) : null,
    phone: data.phone ? sanitizePhone(data.phone) : null,
    document: data.document ? sanitizeDocument(data.document) : null,
    address: data.address ? sanitizeString(data.address) : null,
    notes: data.notes ? sanitizeString(data.notes) : null,
  };
}

/**
 * Valida e sanitiza dados de entrada de profissional
 */
export function sanitizeProfessionalData(data: any) {
  return {
    name: sanitizeString(data.name || ''),
    email: data.email ? sanitizeEmail(data.email) : null,
    phone: data.phone ? sanitizePhone(data.phone) : null,
    bio: data.bio ? sanitizeString(data.bio) : null,
  };
}

/**
 * Valida e sanitiza dados de entrada de serviço
 */
export function sanitizeServiceData(data: any) {
  return {
    name: sanitizeString(data.name || ''),
    description: data.description ? sanitizeString(data.description) : null,
    duration_minutes: Number(data.duration_minutes) || 60,
    price: Number(data.price) || 0,
  };
}

/**
 * Valida e sanitiza dados de entrada de agendamento
 */
export function sanitizeAppointmentData(data: any) {
  return {
    title: sanitizeString(data.title || ''),
    description: data.description ? sanitizeString(data.description) : null,
    customer_name: data.customer_name ? sanitizeString(data.customer_name) : null,
    customer_email: data.customer_email ? sanitizeEmail(data.customer_email) : null,
    customer_phone: data.customer_phone ? sanitizePhone(data.customer_phone) : null,
  };
}
