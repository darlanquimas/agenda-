import crypto from 'crypto';
import prisma from '../lib/prisma';

/**
 * Serviço de autenticação de dois fatores (2FA)
 * 
 * Implementa TOTP (Time-based One-Time Password) compatível com
 * Google Authenticator, Microsoft Authenticator, Authy, etc.
 */
export class TwoFactorService {
  /**
   * Gera um secret aleatório para TOTP
   */
  generateSecret(): string {
    return crypto.randomBytes(20).toString('base64').replace(/[^A-Z2-7]/gi, '').substring(0, 32);
  }

  /**
   * Gera a URL otpauth:// para QR Code
   */
  generateOtpAuthUrl(email: string, secret: string, issuer = 'Agenda+'): string {
    const encodedEmail = encodeURIComponent(email);
    const encodedIssuer = encodeURIComponent(issuer);
    return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
  }

  /**
   * Gera código TOTP de 6 dígitos baseado em timestamp
   */
  generateTOTP(secret: string, timeStep = 30, timestamp?: number): string {
    const time = timestamp || Math.floor(Date.now() / 1000);
    const counter = Math.floor(time / timeStep);
    
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64BE(BigInt(counter));
    
    const decodedSecret = Buffer.from(secret, 'base64');
    const hmac = crypto.createHmac('sha1', decodedSecret);
    hmac.update(buffer);
    const hash = hmac.digest();
    
    const offset = hash[hash.length - 1] & 0xf;
    const binary =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);
    
    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
  }

  /**
   * Verifica se um código TOTP é válido
   * Aceita códigos com ±1 time window para lidar com clock skew
   */
  verifyTOTP(secret: string, token: string, window = 1): boolean {
    const time = Math.floor(Date.now() / 1000);
    const timeStep = 30;

    for (let i = -window; i <= window; i++) {
      const adjustedTime = time + i * timeStep;
      const expectedToken = this.generateTOTP(secret, timeStep, adjustedTime);
      
      if (expectedToken === token) {
        return true;
      }
    }

    return false;
  }

  /**
   * Habilita 2FA para um usuário
   */
  async enableTwoFactor(userId: number, secret: string, backupCodes: string[]): Promise<void> {
    const hashedCodes = backupCodes.map(code => 
      crypto.createHash('sha256').update(code).digest('hex')
    );

    await prisma.user.update({
      where: { id: userId },
      data: {
        two_factor_secret: secret,
        two_factor_enabled: true,
        two_factor_backup_codes: JSON.stringify(hashedCodes),
      },
    });
  }

  /**
   * Desabilita 2FA para um usuário
   */
  async disableTwoFactor(userId: number): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        two_factor_secret: null,
        two_factor_enabled: false,
        two_factor_backup_codes: null,
      },
    });
  }

  /**
   * Verifica código de backup e remove após uso
   */
  async verifyBackupCode(userId: number, code: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { two_factor_backup_codes: true },
    });

    if (!user || !user.two_factor_backup_codes) {
      return false;
    }

    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
    const backupCodes = JSON.parse(user.two_factor_backup_codes) as string[];

    const index = backupCodes.indexOf(hashedCode);
    if (index === -1) {
      return false;
    }

    backupCodes.splice(index, 1);

    await prisma.user.update({
      where: { id: userId },
      data: {
        two_factor_backup_codes: JSON.stringify(backupCodes),
      },
    });

    return true;
  }

  /**
   * Regenera códigos de backup
   */
  async regenerateBackupCodes(userId: number): Promise<string[]> {
    const newCodes: string[] = [];
    for (let i = 0; i < 10; i++) {
      newCodes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }

    const hashedCodes = newCodes.map(code =>
      crypto.createHash('sha256').update(code).digest('hex')
    );

    await prisma.user.update({
      where: { id: userId },
      data: {
        two_factor_backup_codes: JSON.stringify(hashedCodes),
      },
    });

    return newCodes;
  }

  /**
   * Verifica se usuário tem 2FA habilitado
   */
  async isTwoFactorEnabled(userId: number): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { two_factor_enabled: true },
    });

    return user?.two_factor_enabled || false;
  }

  /**
   * Obtém secret para verificação
   */
  async getSecret(userId: number): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { two_factor_secret: true },
    });

    return user?.two_factor_secret || null;
  }
}

export default new TwoFactorService();
