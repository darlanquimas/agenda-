import bcrypt from 'bcryptjs';
import config from '../config';
import prisma from '../lib/prisma';
import { createRouter } from '../lib/router';
import { markPublic } from '../middleware/publicRoute';
import { USER_SELECT, rowToAuthUser } from '../middleware/auth';
import { serializeUser } from '../lib/userSerializer';
import tokenService from '../services/tokenService';
import twoFactorService from '../services/twoFactorService';
import { validateSchema } from '../middleware/validateSchema';
import { loginSchema, changePasswordSchema } from '../schemas/auth.schema';
import { validatePassword } from '../lib/validate';
import logger from '../lib/logger';
import { setCsrfCookie } from '../middleware/csrf';

const router = createRouter();

/**
 * POST /api/auth/login
 * Autenticação com suporte a 2FA e proteção contra brute force
 */
router.post('/login', validateSchema(loginSchema), ...markPublic(async (req, res) => {
  const { email, password, twoFactorCode } = req.body;

  try {
    const user = await prisma.user.findUnique({ 
      where: { email },
      select: {
        ...USER_SELECT,
        password: true,
        two_factor_secret: true,
        failed_login_attempts: true,
        locked_until: true,
      },
    });

    if (!user) {
      logger.warn(`Tentativa de login com email inexistente: ${email}`);
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Verificar se conta está bloqueada temporariamente
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
      logger.warn(`Tentativa de login em conta bloqueada: ${email}`);
      return res.status(403).json({ 
        error: `Conta bloqueada. Tente novamente em ${minutesLeft} minutos` 
      });
    }

    // Verificar se conta está bloqueada permanentemente
    if (user.account_locked) {
      logger.warn(`Tentativa de login em conta permanentemente bloqueada: ${email}`);
      return res.status(403).json({ error: 'Conta bloqueada. Entre em contato com o suporte' });
    }

    // Verificar usuário ativo
    if (!user.active) {
      logger.warn(`Tentativa de login em conta inativa: ${email}`);
      return res.status(401).json({ error: 'Usuário inativo' });
    }

    // Verificar senha
    const isPasswordValid = bcrypt.compareSync(password, user.password);
    
    if (!isPasswordValid) {
      // Incrementar contador de falhas
      const failedAttempts = user.failed_login_attempts + 1;
      
      const updateData: any = {
        failed_login_attempts: failedAttempts,
      };

      // Bloquear conta após N tentativas
      if (failedAttempts >= config.maxLoginAttempts) {
        const lockoutUntil = new Date();
        lockoutUntil.setMinutes(lockoutUntil.getMinutes() + config.lockoutDurationMinutes);
        updateData.locked_until = lockoutUntil;
        
        logger.warn(`Conta bloqueada por excesso de tentativas: ${email}`);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      logger.warn(`Tentativa de login com senha incorreta: ${email} (tentativa ${failedAttempts})`);
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Verificar 2FA se habilitado
    if (user.two_factor_enabled) {
      if (!twoFactorCode) {
        return res.status(200).json({ 
          requires2FA: true,
          message: 'Digite o código de autenticação de dois fatores',
        });
      }

      const secret = user.two_factor_secret;
      if (!secret) {
        logger.error(`2FA habilitado mas secret não encontrado para: ${email}`);
        return res.status(500).json({ error: 'Erro de configuração 2FA' });
      }

      let is2FAValid = twoFactorService.verifyTOTP(secret, twoFactorCode);

      if (!is2FAValid) {
        is2FAValid = await twoFactorService.verifyBackupCode(user.id, twoFactorCode);
        if (is2FAValid) {
          logger.info(`Código de backup usado no login: ${email}`);
        }
      }

      if (!is2FAValid) {
        logger.warn(`Código 2FA inválido no login: ${email}`);
        return res.status(401).json({ error: 'Código 2FA inválido' });
      }
    }

    // Login bem-sucedido - resetar contadores e gerar tokens
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: new Date(),
      },
    });

    const tokens = await tokenService.generateTokenPair(user.id);

    // Configurar cookies httpOnly
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: config.cookieSameSite,
      maxAge: config.jwtExpiresInMs,
      domain: config.cookieDomain,
    });

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: config.cookieSameSite,
      maxAge: config.jwtRefreshExpiresInMs,
      domain: config.cookieDomain,
    });

    setCsrfCookie(res);

    const userResponse = serializeUser(rowToAuthUser(user));

    logger.info(`Login bem-sucedido: ${email}`);

    res.json({
      user: userResponse,
      message: 'Login realizado com sucesso',
    });
  } catch (error: any) {
    logger.error('Erro no processo de login', { error: error.message, email });
    res.status(500).json({ error: 'Erro ao processar login' });
  }
}));

/**
 * GET /api/auth/me
 * Retorna dados do usuário autenticado
 */
router.get('/me', (req, res) => {
  res.json(serializeUser(req.user));
});

/**
 * PUT /api/auth/me
 * Atualiza nome do usuário autenticado
 */
router.put('/me', async (req, res) => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) return res.status(400).json({ error: 'Nome obrigatório' });

  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: { name: name.trim() },
    select: USER_SELECT,
  });

  res.json(serializeUser(rowToAuthUser(updated)));
});

/**
 * POST /api/auth/change-password
 * Altera senha do usuário autenticado
 */
router.post('/change-password', validateSchema(changePasswordSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ 
      where: { id: userId },
      select: { password: true },
    });

    if (!user || !bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }

    const validation = validatePassword(newPassword);
    if (validation) {
      return res.status(400).json({ error: validation });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        password_changed_at: new Date(),
        refresh_token_version: { increment: 1 },
      },
    });

    logger.info(`Usuário ${userId} alterou a senha`);

    const cookieOpts = { httpOnly: true, secure: config.cookieSecure, sameSite: config.cookieSameSite, domain: config.cookieDomain } as const;
    res.clearCookie('access_token', cookieOpts);
    res.clearCookie('refresh_token', cookieOpts);

    res.json({ 
      message: 'Senha alterada com sucesso. Faça login novamente',
    });
  } catch (error: any) {
    logger.error('Erro ao alterar senha', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Erro ao alterar senha' });
  }
});

export default router;
