import { z } from 'zod';

/**
 * Schema de validação para login
 */
export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email é obrigatório' })
    .email('Email inválido')
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: 'Senha é obrigatória' })
    .min(1, 'Senha é obrigatória'),
  twoFactorCode: z
    .string()
    .regex(/^\d{6}$/, 'Código 2FA deve conter 6 dígitos')
    .optional(),
});

/**
 * Schema de validação para criação de senha
 */
export const passwordSchema = z
  .string()
  .min(12, 'Senha deve ter pelo menos 12 caracteres')
  .max(128, 'Senha deve ter no máximo 128 caracteres')
  .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
  .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
  .regex(/[0-9]/, 'Senha deve conter pelo menos um número')
  .regex(/[^A-Za-z0-9]/, 'Senha deve conter pelo menos um caractere especial')
  .refine(
    (password) => !/(.)\1{2,}/.test(password),
    'Senha não pode conter caracteres repetidos consecutivamente'
  );

/**
 * Schema de validação para alteração de senha
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string({ required_error: 'Senha atual é obrigatória' }),
  newPassword: passwordSchema,
  confirmPassword: z.string({ required_error: 'Confirmação de senha é obrigatória' }),
}).refine(
  (data) => data.newPassword === data.confirmPassword,
  {
    message: 'Senhas não coincidem',
    path: ['confirmPassword'],
  }
);

/**
 * Schema de validação para setup de 2FA
 */
export const twoFactorSetupSchema = z.object({
  code: z
    .string({ required_error: 'Código é obrigatório' })
    .regex(/^\d{6}$/, 'Código deve conter 6 dígitos'),
  secret: z.string().min(16, 'Secret inválido').max(64, 'Secret inválido'),
});

/**
 * Schema de validação para verificação de 2FA
 */
export const twoFactorVerifySchema = z.object({
  code: z
    .string({ required_error: 'Código é obrigatório' })
    .min(6, 'Código deve ter pelo menos 6 caracteres')
    .max(8, 'Código deve ter no máximo 8 caracteres'),
});

/**
 * Schema de validação para refresh token
 */
export const refreshTokenSchema = z.object({
  refreshToken: z
    .string({ required_error: 'Refresh token é obrigatório' })
    .min(1, 'Refresh token é obrigatório'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type PasswordInput = z.infer<typeof passwordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type TwoFactorSetupInput = z.infer<typeof twoFactorSetupSchema>;
export type TwoFactorVerifyInput = z.infer<typeof twoFactorVerifySchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
