
-- Função para atualizar o timestamp da coluna updated_at
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    display_name VARCHAR(100),
    notify_by_email BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);
DROP TRIGGER IF EXISTS set_timestamp_app_users ON app_users;
CREATE TRIGGER set_timestamp_app_users
BEFORE UPDATE ON app_users
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Tabela de Categorias do Usuário
CREATE TABLE IF NOT EXISTS user_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_system_defined BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_user_categories_user_id ON user_categories(user_id);
DROP TRIGGER IF EXISTS set_timestamp_user_categories ON user_categories;
CREATE TRIGGER set_timestamp_user_categories
BEFORE UPDATE ON user_categories
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Tabela de Transações
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
    amount NUMERIC(12, 2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    description TEXT,
    recurrence_frequency VARCHAR(20) DEFAULT 'none' CHECK (recurrence_frequency IN ('none', 'monthly', 'weekly', 'annually')),
    receipt_image_uri TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_recurrence ON transactions(recurrence_frequency);
DROP TRIGGER IF EXISTS set_timestamp_transactions ON transactions;
CREATE TRIGGER set_timestamp_transactions
BEFORE UPDATE ON transactions
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Tabela de Empréstimos
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    bank_name VARCHAR(100) NOT NULL,
    description TEXT,
    installment_amount NUMERIC(12, 2) NOT NULL,
    installments_count INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);
DROP TRIGGER IF EXISTS set_timestamp_loans ON loans;
CREATE TRIGGER set_timestamp_loans
BEFORE UPDATE ON loans
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Tabela de Cartões de Crédito
CREATE TABLE IF NOT EXISTS credit_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    limit_amount NUMERIC(12, 2) NOT NULL,
    due_date_day INTEGER NOT NULL CHECK (due_date_day >= 1 AND due_date_day <= 31),
    closing_date_day INTEGER NOT NULL CHECK (closing_date_day >= 1 AND closing_date_day <= 31),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_credit_cards_user_id ON credit_cards(user_id);
DROP TRIGGER IF EXISTS set_timestamp_credit_cards ON credit_cards;
CREATE TRIGGER set_timestamp_credit_cards
BEFORE UPDATE ON credit_cards
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Tabela de Compras no Cartão de Crédito
CREATE TABLE IF NOT EXISTS credit_card_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
    purchase_date DATE NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    installments INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_credit_card_purchases_user_id ON credit_card_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_card_purchases_card_id ON credit_card_purchases(card_id);
DROP TRIGGER IF EXISTS set_timestamp_credit_card_purchases ON credit_card_purchases;
CREATE TRIGGER set_timestamp_credit_card_purchases
BEFORE UPDATE ON credit_card_purchases
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Tabela de Metas Financeiras
CREATE TABLE IF NOT EXISTS financial_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    target_amount NUMERIC(12, 2) NOT NULL,
    current_amount NUMERIC(12, 2) DEFAULT 0,
    target_date DATE,
    description TEXT,
    icon VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'abandoned')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_financial_goals_user_id ON financial_goals(user_id);
DROP TRIGGER IF EXISTS set_timestamp_financial_goals ON financial_goals;
CREATE TRIGGER set_timestamp_financial_goals
BEFORE UPDATE ON financial_goals
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Tabela de Investimentos
CREATE TABLE IF NOT EXISTS investments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('stock', 'savings', 'crypto', 'other')),
    initial_amount NUMERIC(12, 2),
    current_value NUMERIC(12, 2) NOT NULL,
    quantity NUMERIC(18, 8),
    symbol VARCHAR(20),
    institution VARCHAR(100),
    acquisition_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
DROP TRIGGER IF EXISTS set_timestamp_investments ON investments;
CREATE TRIGGER set_timestamp_investments
BEFORE UPDATE ON investments
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Inserir categorias padrão após a criação das tabelas (se necessário, adaptar para ser idempotente se rodar múltiplas vezes)
-- No init.sql, a criação de categorias para usuários específicos é feita via lógica da aplicação.
-- Este script é para a estrutura inicial do banco.

-- Exemplo de como definir o dono da função, se necessário (executar como superusuário ou dono do banco)
-- ALTER FUNCTION trigger_set_timestamp() OWNER TO solaruser;

-- Grant permissions (exemplo, ajuste conforme sua configuração de roles/usuários)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO solaruser;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO solaruser;
-- GRANT EXECUTE