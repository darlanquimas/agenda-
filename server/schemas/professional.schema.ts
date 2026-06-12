import { z } from 'zod';

/**
 * Schema de validação para criação de profissional
 */
export const createProfessionalSchema = z.object({
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
  bio: z
    .string()
    .max(1000, 'Biografia deve ter no máximo 1000 caracteres')
    .trim()
    .optional()
    .nullable(),
  specialty_ids: z
    .array(z.number().int().positive())
    .min(1, 'Selecione pelo menos uma especialidade')
    .optional(),
  service_ids: z
    .array(z.number().int().positive())
    .optional(),
});

/**
 * Schema de validação para atualização de profissional
 */
export const updateProfessionalSchema = createProfessionalSchema.partial();

/**
 * Schema de validação para ID de profissional
 */
export const professionalIdSchema = z.object({
  id: z.coerce.number().int().positive('ID inválido'),
});

/**
 * Schema de validação para disponibilidade
 */
export const availabilitySchema = z.object({
  weekday: z
    .number()
    .int()
    .min(0, 'Dia da semana inválido')
    .max(6, 'Dia da semana inválido'),
  start_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Horário de início inválido (formato HH:MM)'),
  end_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Horário de término inválido (formato HH:MM)'),
  active: z.boolean().optional().default(true),
}).refine(
  (data) => {
    const [startHour, startMin] = data.start_time.split(':').map(Number);
    const [endHour, endMin] = data.end_time.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes > startMinutes;
  },
  {
    message: 'Horário de término deve ser posterior ao horário de início',
    path: ['end_time'],
  }
);

/**
 * Schema de validação para múltiplas disponibilidades
 */
export const bulkAvailabilitySchema = z.object({
  availabilities: z.array(availabilitySchema),
});

export type CreateProfessionalInput = z.infer<typeof createProfessionalSchema>;
export type UpdateProfessionalInput = z.infer<typeof updateProfessionalSchema>;
export type ProfessionalIdInput = z.infer<typeof professionalIdSchema>;
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
export type BulkAvailabilityInput = z.infer<typeof bulkAvailabilitySchema>;
