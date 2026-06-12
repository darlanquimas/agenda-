import { z } from 'zod';

/**
 * Schema de validação para criação de cliente
 */
export const createClientSchema = z.object({
  name: z
    .string({ required_error: 'Nome é obrigatório' })
    .min(3, 'Nome deve ter pelo menos 3 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .trim(),
  email: z
    .string()
    .email('Email inválido')
    .toLowerCase()
    .trim()
    .optional()
    .nullable(),
  phone: z
    .string()
    .regex(/^\+?[\d\s\-()]+$/, 'Telefone inválido')
    .min(10, 'Telefone deve ter pelo menos 10 dígitos')
    .max(20, 'Telefone deve ter no máximo 20 caracteres')
    .optional()
    .nullable(),
  document: z
    .string()
    .regex(/^\d{11}(\d{3})?$/, 'CPF/CNPJ inválido (apenas números)')
    .optional()
    .nullable(),
  address: z
    .string()
    .max(500, 'Endereço deve ter no máximo 500 caracteres')
    .trim()
    .optional()
    .nullable(),
  notes: z
    .string()
    .max(1000, 'Observações devem ter no máximo 1000 caracteres')
    .trim()
    .optional()
    .nullable(),
});

/**
 * Schema de validação para atualização de cliente
 */
export const updateClientSchema = createClientSchema.partial();

/**
 * Schema de validação para ID de cliente
 */
export const clientIdSchema = z.object({
  id: z.coerce.number().int().positive('ID inválido'),
});

/**
 * Schema de validação para busca de clientes
 */
export const clientSearchSchema = z.object({
  search: z.string().optional(),
  active: z.enum(['true', 'false', 'all']).optional().default('true'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ClientIdInput = z.infer<typeof clientIdSchema>;
export type ClientSearchInput = z.infer<typeof clientSearchSchema>;
