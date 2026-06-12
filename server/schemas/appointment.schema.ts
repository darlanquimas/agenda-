import { z } from 'zod';

/**
 * Schema de validação para criação de agendamento
 */
export const createAppointmentSchema = z.object({
  client_id: z
    .number({ required_error: 'Cliente é obrigatório' })
    .int()
    .positive('Cliente inválido'),
  professional_id: z
    .number()
    .int()
    .positive('Profissional inválido')
    .optional()
    .nullable(),
  service_id: z
    .number()
    .int()
    .positive('Serviço inválido')
    .optional()
    .nullable(),
  title: z
    .string({ required_error: 'Título é obrigatório' })
    .min(3, 'Título deve ter pelo menos 3 caracteres')
    .max(200, 'Título deve ter no máximo 200 caracteres')
    .trim(),
  description: z
    .string()
    .max(1000, 'Descrição deve ter no máximo 1000 caracteres')
    .trim()
    .optional()
    .nullable(),
  scheduled_at: z
    .string({ required_error: 'Data/hora é obrigatória' })
    .datetime('Data/hora inválida'),
  status: z
    .enum(['scheduled', 'running', 'finished', 'failed', 'cancelled'])
    .optional()
    .default('scheduled'),
  customer_name: z
    .string()
    .min(3, 'Nome deve ter pelo menos 3 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .trim()
    .optional()
    .nullable(),
  customer_email: z
    .string()
    .email('Email inválido')
    .toLowerCase()
    .trim()
    .optional()
    .nullable(),
  customer_phone: z
    .string()
    .regex(/^\+?[\d\s\-()]+$/, 'Telefone inválido')
    .min(10, 'Telefone deve ter pelo menos 10 dígitos')
    .optional()
    .nullable(),
});

/**
 * Schema de validação para agendamento público (sem cliente_id)
 */
export const publicBookingSchema = z.object({
  professional_id: z
    .number({ required_error: 'Profissional é obrigatório' })
    .int()
    .positive('Profissional inválido'),
  service_id: z
    .number({ required_error: 'Serviço é obrigatório' })
    .int()
    .positive('Serviço inválido'),
  date: z
    .string({ required_error: 'Data é obrigatória' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (formato YYYY-MM-DD)'),
  time: z
    .string({ required_error: 'Horário é obrigatório' })
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Horário inválido (formato HH:MM)'),
  customer_name: z
    .string({ required_error: 'Nome é obrigatório' })
    .min(3, 'Nome deve ter pelo menos 3 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .trim(),
  customer_email: z
    .string({ required_error: 'Email é obrigatório' })
    .email('Email inválido')
    .toLowerCase()
    .trim(),
  customer_phone: z
    .string({ required_error: 'Telefone é obrigatório' })
    .regex(/^\+?[\d\s\-()]+$/, 'Telefone inválido')
    .min(10, 'Telefone deve ter pelo menos 10 dígitos')
    .max(20, 'Telefone deve ter no máximo 20 caracteres'),
});

/**
 * Schema de validação para atualização de agendamento
 */
export const updateAppointmentSchema = createAppointmentSchema.partial();

/**
 * Schema de validação para ID de agendamento
 */
export const appointmentIdSchema = z.object({
  id: z.coerce.number().int().positive('ID inválido'),
});

/**
 * Schema de validação para filtros de agendamento
 */
export const appointmentFiltersSchema = z.object({
  status: z.enum(['scheduled', 'running', 'finished', 'failed', 'cancelled', 'all']).optional(),
  professional_id: z.coerce.number().int().positive().optional(),
  service_id: z.coerce.number().int().positive().optional(),
  client_id: z.coerce.number().int().positive().optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

/**
 * Schema de validação para consulta de slots disponíveis
 */
export const availableSlotsSchema = z.object({
  professionalId: z.coerce.number().int().positive('Profissional inválido'),
  serviceId: z.coerce.number().int().positive('Serviço inválido'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (formato YYYY-MM-DD)'),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type PublicBookingInput = z.infer<typeof publicBookingSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type AppointmentIdInput = z.infer<typeof appointmentIdSchema>;
export type AppointmentFiltersInput = z.infer<typeof appointmentFiltersSchema>;
export type AvailableSlotsInput = z.infer<typeof availableSlotsSchema>;
