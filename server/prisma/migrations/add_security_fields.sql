-- Migration: Adicionar campos de segurança
-- Data: 2026-06-11
-- Descrição: Adiciona campos para 2FA, refresh tokens e segurança adicional

-- Campos de autenticação de dois fatores
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT;

-- Campos de gerenciamento de tokens e sessões
ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token_version INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP DEFAULT NOW();

-- Campos de segurança e bloqueio de conta
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_locked BOOLEAN DEFAULT false;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_tenant_id ON activity_log(tenant_id);

-- Comentários para documentação
COMMENT ON COLUMN users.two_factor_secret IS 'Secret TOTP para autenticação de dois fatores';
COMMENT ON COLUMN users.two_factor_enabled IS 'Indica se 2FA está habilitado para o usuário';
COMMENT ON COLUMN users.two_factor_backup_codes IS 'JSON com códigos de backup para 2FA';
COMMENT ON COLUMN users.refresh_token_version IS 'Versão do refresh token, incrementada para invalidar tokens antigos';
COMMENT ON COLUMN users.last_login_at IS 'Timestamp do último login bem-sucedido';
COMMENT ON COLUMN users.password_changed_at IS 'Timestamp da última alteração de senha';
COMMENT ON COLUMN users.failed_login_attempts IS 'Contador de tentativas de login falhadas';
COMMENT ON COLUMN users.locked_until IS 'Timestamp até quando a conta está bloqueada';
COMMENT ON COLUMN users.account_locked IS 'Indica se a conta está permanentemente bloqueada';
