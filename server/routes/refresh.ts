import { createRouter } from '../lib/router';
import { markPublic } from '../middleware/publicRoute';
import tokenService from '../services/tokenService';
import config from '../config';
import logger from '../lib/logger';
import { setCsrfCookie } from '../middleware/csrf';

const router = createRouter();

/**
 * POST /api/auth/refresh
 * Atualiza access token usando refresh token
 */
router.post('/refresh', ...markPublic(async (req, res) => {
  try {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token não fornecido' });
    }

    const tokens = await tokenService.refreshTokens(refreshToken);

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

    logger.info('Token atualizado com sucesso');

    res.json({ 
      message: 'Token atualizado',
      expiresIn: Math.floor(config.jwtExpiresInMs / 1000),
    });
  } catch (error: any) {
    logger.error('Erro ao atualizar token', { error: error.message });
    
    const cookieOpts = { httpOnly: true, secure: config.cookieSecure, sameSite: config.cookieSameSite, domain: config.cookieDomain } as const;
    res.clearCookie('access_token', cookieOpts);
    res.clearCookie('refresh_token', cookieOpts);

    res.status(401).json({ error: 'Refresh token inválido ou expirado' });
  }
}));

/**
 * POST /api/auth/logout
 * Faz logout removendo cookies e revogando tokens.
 * Rota pública para funcionar mesmo com access token expirado —
 * usa o refresh token para identificar e revogar a sessão.
 */
router.post('/logout', ...markPublic(async (req, res) => {
  try {
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
      try {
        const decoded = await tokenService.verifyRefreshToken(refreshToken);
        await tokenService.revokeAllTokens(decoded.sub);
        logger.info(`Usuário ${decoded.sub} fez logout`);
      } catch {
        // refresh token inválido/expirado — só limpa os cookies
      }
    }

    const cookieOpts = { httpOnly: true, secure: config.cookieSecure, sameSite: config.cookieSameSite, domain: config.cookieDomain } as const;
    res.clearCookie('access_token', cookieOpts);
    res.clearCookie('refresh_token', cookieOpts);
    res.clearCookie('csrf_token', { secure: config.cookieSecure, sameSite: config.cookieSameSite, domain: config.cookieDomain });

    res.json({ message: 'Logout realizado com sucesso' });
  } catch (error: any) {
    logger.error('Erro ao fazer logout', { error: error.message });
    res.status(500).json({ error: 'Erro ao fazer logout' });
  }
}));

export default router;
