import { createRouter } from '../lib/router';
import twoFactorService from '../services/twoFactorService';
import tokenService from '../services/tokenService';
import { validateSchema } from '../middleware/validateSchema';
import { twoFactorSetupSchema, twoFactorVerifySchema } from '../schemas/auth.schema';
import logger from '../lib/logger';

const router = createRouter();

/**
 * GET /api/two-factor/setup
 * Inicia configuração do 2FA gerando secret e QR code URL
 */
router.get('/setup', async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;

    const is2FAEnabled = await twoFactorService.isTwoFactorEnabled(userId);
    if (is2FAEnabled) {
      return res.status(400).json({ error: '2FA já está habilitado' });
    }

    const secret = twoFactorService.generateSecret();
    const otpAuthUrl = twoFactorService.generateOtpAuthUrl(userEmail, secret);

    logger.info(`Usuário ${userId} iniciou configuração 2FA`);

    res.json({
      secret,
      otpAuthUrl,
      message: 'Escaneie o QR code com seu aplicativo de autenticação',
    });
  } catch (error: any) {
    logger.error('Erro ao configurar 2FA', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Erro ao configurar 2FA' });
  }
});

/**
 * POST /api/two-factor/enable
 * Confirma e habilita 2FA verificando código TOTP
 */
router.post('/enable', validateSchema(twoFactorSetupSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { code, secret } = req.body;

    const isValid = twoFactorService.verifyTOTP(secret, code);
    if (!isValid) {
      return res.status(400).json({ error: 'Código inválido' });
    }

    const backupCodes = tokenService.generateBackupCodes();
    await twoFactorService.enableTwoFactor(userId, secret, backupCodes);

    logger.info(`Usuário ${userId} habilitou 2FA com sucesso`);

    res.json({
      message: '2FA habilitado com sucesso',
      backupCodes,
      warning: 'Guarde estes códigos em local seguro. Eles serão exibidos apenas uma vez',
    });
  } catch (error: any) {
    logger.error('Erro ao habilitar 2FA', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Erro ao habilitar 2FA' });
  }
});

/**
 * POST /api/two-factor/verify
 * Verifica código 2FA durante login
 */
router.post('/verify', validateSchema(twoFactorVerifySchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    const secret = await twoFactorService.getSecret(userId);
    if (!secret) {
      return res.status(400).json({ error: '2FA não configurado' });
    }

    let isValid = twoFactorService.verifyTOTP(secret, code);

    if (!isValid) {
      isValid = await twoFactorService.verifyBackupCode(userId, code);
      if (isValid) {
        logger.warn(`Usuário ${userId} usou código de backup para 2FA`);
      }
    }

    if (!isValid) {
      logger.warn(`Tentativa falha de 2FA para usuário ${userId}`);
      return res.status(400).json({ error: 'Código inválido' });
    }

    logger.info(`Usuário ${userId} verificou 2FA com sucesso`);

    res.json({ message: '2FA verificado com sucesso' });
  } catch (error: any) {
    logger.error('Erro ao verificar 2FA', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Erro ao verificar 2FA' });
  }
});

/**
 * POST /api/two-factor/disable
 * Desabilita 2FA (requer confirmação de senha)
 */
router.post('/disable', async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Senha é obrigatória' });
    }

    const bcrypt = require('bcryptjs');
    const prisma = require('../lib/prisma').default;
    
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    await twoFactorService.disableTwoFactor(userId);
    await tokenService.revokeAllTokens(userId);

    logger.warn(`Usuário ${userId} desabilitou 2FA`);

    res.json({ message: '2FA desabilitado. Todos os tokens foram revogados' });
  } catch (error: any) {
    logger.error('Erro ao desabilitar 2FA', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Erro ao desabilitar 2FA' });
  }
});

/**
 * POST /api/two-factor/regenerate-backup-codes
 * Regenera códigos de backup
 */
router.post('/regenerate-backup-codes', async (req, res) => {
  try {
    const userId = req.user.id;

    const is2FAEnabled = await twoFactorService.isTwoFactorEnabled(userId);
    if (!is2FAEnabled) {
      return res.status(400).json({ error: '2FA não está habilitado' });
    }

    const newCodes = await twoFactorService.regenerateBackupCodes(userId);

    logger.info(`Usuário ${userId} regenerou códigos de backup`);

    res.json({
      backupCodes: newCodes,
      message: 'Novos códigos de backup gerados',
      warning: 'Os códigos antigos não funcionarão mais',
    });
  } catch (error: any) {
    logger.error('Erro ao regenerar códigos', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Erro ao regenerar códigos' });
  }
});

/**
 * GET /api/two-factor/status
 * Retorna status do 2FA do usuário
 */
router.get('/status', async (req, res) => {
  try {
    const userId = req.user.id;
    const isEnabled = await twoFactorService.isTwoFactorEnabled(userId);

    res.json({ 
      enabled: isEnabled,
      userId,
    });
  } catch (error: any) {
    logger.error('Erro ao verificar status 2FA', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Erro ao verificar status' });
  }
});

export default router;
