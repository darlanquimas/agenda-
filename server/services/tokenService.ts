import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config';
import prisma from '../lib/prisma';

/**
 * Interface para payload do Access Token
 */
interface AccessTokenPayload {
  sub: number;
  type: 'access';
  iat?: number;
  exp?: number;
}

/**
 * Interface para payload do Refresh Token
 */
interface RefreshTokenPayload {
  sub: number;
  version: number;
  type: 'refresh';
  iat?: number;
  exp?: number;
}

/**
 * Serviço de gerenciamento de tokens JWT com suporte a refresh tokens
 */
export class TokenService {
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';

  /**
   * Gera um par de tokens (access + refresh) para um usuário
   */
  async generateTokenPair(userId: number): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, refresh_token_version: true, active: true },
    });

    if (!user || !user.active) {
      throw new Error('Usuário inválido ou inativo');
    }

    const accessToken = this.generateAccessToken(userId);
    const refreshToken = this.generateRefreshToken(userId, user.refresh_token_version);

    return { accessToken, refreshToken };
  }

  /**
   * Gera um access token de curta duração
   */
  private generateAccessToken(userId: number): string {
    const payload: AccessTokenPayload = {
      sub: userId,
      type: 'access',
    };

    const opts: SignOptions = {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    };

    return jwt.sign(payload, config.jwtSecret, opts);
  }

  /**
   * Gera um refresh token de longa duração
   */
  private generateRefreshToken(userId: number, version: number): string {
    const payload: RefreshTokenPayload = {
      sub: userId,
      version,
      type: 'refresh',
    };

    const opts: SignOptions = {
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
    };

    return jwt.sign(payload, config.jwtSecret, opts);
  }

  /**
   * Valida e decodifica um access token
   */
  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as AccessTokenPayload;
      
      if (decoded.type !== 'access') {
        throw new Error('Tipo de token inválido');
      }

      return decoded;
    } catch (error) {
      throw new Error('Token de acesso inválido ou expirado');
    }
  }

  /**
   * Valida e decodifica um refresh token
   */
  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as RefreshTokenPayload;

      if (decoded.type !== 'refresh') {
        throw new Error('Tipo de token inválido');
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
        select: { refresh_token_version: true, active: true },
      });

      if (!user || !user.active) {
        throw new Error('Usuário inválido ou inativo');
      }

      if (decoded.version !== user.refresh_token_version) {
        throw new Error('Refresh token revogado');
      }

      return decoded;
    } catch (error) {
      throw new Error('Token de atualização inválido ou expirado');
    }
  }

  /**
   * Atualiza o par de tokens usando um refresh token válido
   */
  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const decoded = await this.verifyRefreshToken(refreshToken);
    
    await prisma.user.update({
      where: { id: decoded.sub },
      data: { last_login_at: new Date() },
    });

    return this.generateTokenPair(decoded.sub);
  }

  /**
   * Revoga todos os tokens de um usuário incrementando a versão
   */
  async revokeAllTokens(userId: number): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        refresh_token_version: { increment: 1 },
      },
    });
  }

  /**
   * Gera códigos de backup para 2FA (10 códigos de 8 caracteres)
   */
  generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  /**
   * Hash de código de backup para armazenamento seguro
   */
  hashBackupCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  /**
   * Verifica se um código de backup é válido
   */
  verifyBackupCode(code: string, hashedCodes: string[]): boolean {
    const hash = this.hashBackupCode(code);
    return hashedCodes.includes(hash);
  }
}

export default new TokenService();
