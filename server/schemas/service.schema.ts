import { z } from 'zod';

/**
 * Schema de validação para criação de serviço
 */
export const createServiceSchema = z.object({
  name: z
    .string({ required_error: 'Nome é obrigatório' })
    .min(3, 'Nome deve ter pelo menos 3 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .trim(),
  description: z
    .string()
    .max(500, 'Descrição deve ter no máximo 500 caracteres')
    .trim()
    .optional()
    .nullable(),
  duration_minutes: z
    .number({ required_error: 'Duração é obrigatória' })
    .int()
    .min(15, 'Duração mínima é 15 minutos')
    .max(480, 'Duração máxima é 480 minutos (8 horas)'),
  price: z
    .number({ required_error: 'Preço é obrigatório' })
    .nonnegative('Preço deve ser maior ou igual a zero')
    .max(999999.99, 'Preço máximo é R$ 999.999,99'),
});

/**
 * Schema de validação para atualização de serviço
 */
export const updateServiceSchema = createServiceSchema.partial();

/**
 * Schema de validação para ID de serviço
 */
export const serviceIdSchema = z.object({
  id: z.coerce.number().int().positive('ID inválido'),
});

/**
 * Schema de validação para especialidade
 */
export const createSpecialtySchema = z.object({
  name: z
    .string({ required_error: 'Nome é obrigatório' })
    .min(3, 'Nome deve ter pelo menos 3 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .trim(),
  description: z
    .string()
    .max(500, 'Descrição deve ter no máximo 500 caracteres')
    .trim()
    .optional()
    .nullable(),
});

/**
 * Schema de validação para atualização de especialidade
 */
export const updateSpecialtySchema = createSpecialtySchema.partial();

/**
 * Schema de validação para ID de especialidade
 */
export const specialtyIdSchema = z.object({
  id: z.coerce.number().int().positive('ID inválido'),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type ServiceIdInput = z.infer<typeof serviceIdSchema>;
export type CreateSpecialtyInput = z.infer<typeof createSpecialtySchema>;
export type UpdateSpecialtyInput = z.infer<typeof updateSpecialtySchema>;
export type SpecialtyIdInput = z.infer<typeof specialtyIdSchema>;
