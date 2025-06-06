
-- Script de Inicialização do Banco de Dados PostgreSQL para Solar Fin

-- Função para atualizar o campo updated_at automaticamente
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    display_name VARCHAR(100),
    notify_by_email BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_login_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_email ON app_users(email);
DROP TRIGGER IF EXISTS set_timestamp_app_users ON app_users;
CREATE TRIGGER set_timestamp_app_users
BEFORE UPDATE ON app_users
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Tabela de Categorias de Usuário
CREATE TABLE IF NOT EXISTS user_categories (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_system_defined BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (user_id, name) -- Garante que o nome da categoria é único por usuário
);
CREATE INDEX IF NOT EXISTS idx_user_categories_user_id ON user_categories(user_id);
DROP TRIGGER IF EXISTS set_timestamp_user_categories ON user_categories;
CREATE TRIGGER set_timestamp_user_categories
BEFORE UPDATE ON user_categories
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Tabela de Transações
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
    amount NUMERIC(15, 2) NOT NULL,
    category VARCHAR(100) NOT NULL, -- Referencia user_categories.name (não uma FK direta para simplicidade, mas poderia ser)
    date DATE NOT NULL,
    description TEXT,
    recurrence_frequency VARCHAR(10) DEFAULT 'none' NOT NULL CHECK (recurrence_frequency IN ('none', 'monthly', 'weekly', 'annually')),
    receipt_image_uri TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
DROP TRIGGER IF EXISTS set_timestamp_transactions ON transactions;
CREATE TRIGGER set_timestamp_transactions
BEFORE UPDATE ON transactions
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Tabela de Empréstimos
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    bank_name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    installment_amount NUMERIC(15, 2) NOT NULL,
    installments_count INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);
DROP TRIGGER IF EXISTS set_timestamp_loans ON loans;
CREATE TRIGGER set_timestamp_loans
BEFORE UPDATE ON loans
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Tabela de Cartões de Crédito
CREATE TABLE IF NOT EXISTS credit_cards (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    limit_amount NUMERIC(15, 2) NOT NULL,
    due_date_day INTEGER NOT NULL CHECK (due_date_day >= 1 AND due_date_day <= 31),
    closing_date_day INTEGER NOT NULL CHECK (closing_date_day >= 1 AND closing_date_day <= 31),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_credit_cards_user_id ON credit_cards(user_id);
DROP TRIGGER IF EXISTS set_timestamp_credit_cards ON credit_cards;
CREATE TRIGGER set_timestamp_credit_cards
BEFORE UPDATE ON credit_cards
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Tabela de Compras no Cartão de Crédito
CREATE TABLE IF NOT EXISTS credit_card_purchases (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
    purchase_date DATE NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL, -- Referencia user_categories.name
    total_amount NUMERIC(15, 2) NOT NULL,
    installments INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
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
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    target_amount NUMERIC(15, 2) NOT NULL,
    current_amount NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    target_date DATE,
    description TEXT,
    icon VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'achieved', 'abandoned')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_financial_goals_user_id ON financial_goals(user_id);
DROP TRIGGER IF EXISTS set_timestamp_financial_goals ON financial_goals;
CREATE TRIGGER set_timestamp_financial_goals
BEFORE UPDATE ON financial_goals
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Tabela de Investimentos
CREATE TABLE IF NOT EXISTS investments (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('stock', 'savings', 'crypto', 'other')),
    initial_amount NUMERIC(15, 2),
    current_value NUMERIC(15, 2) NOT NULL,
    quantity NUMERIC(18, 8), -- Alta precisão para cripto
    symbol VARCHAR(20),
    institution VARCHAR(100),
    acquisition_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
DROP TRIGGER IF EXISTS set_timestamp_investments ON investments;
CREATE TRIGGER set_timestamp_investments
BEFORE UPDATE ON investments
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Adicionar categorias padrão para um usuário de exemplo (se necessário para teste)
-- INSERT INTO app_users (id, email, hashed_password, display_name) VALUES ('00000000-0000-0000-0000-000000000000', 'test@example.com', 'hashed_password_here', 'Test User') ON CONFLICT (id) DO NOTHING;
-- INSERT INTO user_categories (id, user_id, name, is_system_defined) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Alimentação', TRUE) ON CONFLICT (user_id, name) DO NOTHING;
-- ... e assim por diante para outras categorias padrão ...

COMMENT ON COLUMN transactions.category IS 'Should match a name in user_categories for that user_id.';
COMMENT ON COLUMN credit_card_purchases.category IS 'Should match a name in user_categories for that user_id.';

-- Você pode adicionar dados iniciais aqui se desejar, por exemplo, um usuário padrão e suas categorias
-- Exemplo de inserção de usuário (ajuste conforme necessário, especialmente a senha)
-- INSERT INTO app_users (id, email, hashed_password, display_name, notify_by_email)
-- VALUES (
--   '2a141a58-983f-4d63-83d5-605943ff7596', -- UUID fixo para o usuário padrão
--   'user@example.local',
--   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', -- Senha 'password'
--   'Usuário Local Padrão',
--   FALSE
-- ) ON CONFLICT (email) DO NOTHING;

-- Inserir categorias padrão para o usuário padrão, se ele foi criado
-- DO $$
-- DECLARE
--   default_user_id UUID := '2a141a58-983f-4d63-83d5-605943ff7596';
--   category_names TEXT[] := ARRAY[
--     'Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Educação', 'Lazer',
--     'Vestuário', 'Contas Fixas', 'Compras Online', 'Salário', 'Investimentos',
--     'Presentes', 'Cuidados Pessoais', 'Viagens', 'Serviços (Assinaturas)',
--     'Impostos', 'Outras Receitas', 'Outras Despesas', 'Importado', 'Fatura Cartão'
--   ];
--   cat_name TEXT;
-- BEGIN
--   IF EXISTS (SELECT 1 FROM app_users WHERE id = default_user_id) THEN
--     FOREACH cat_name IN ARRAY category_names
--     LOOP
--       INSERT INTO user_categories (id, user_id, name, is_system_defined, created_at, updated_at)
--       VALUES (gen_random_uuid(), default_user_id, cat_name, TRUE, NOW(), NOW())
--       ON CONFLICT (user_id, name) DO NOTHING;
--     END LOOP;
--   END IF;
-- END $$;

-- Adicionar a categoria 'Importado' e 'Fatura Cartão' para todos os usuários existentes se não tiverem
-- (Este tipo de lógica é mais para migração, mas pode ser útil aqui se o init.sql for rodado em um DB com usuários existentes sem essas categorias)
-- INSERT INTO user_categories (id, user_id, name, is_system_defined, created_at, updated_at)
-- SELECT gen_random_uuid(), u.id, 'Importado', FALSE, NOW(), NOW()
-- FROM app_users u
-- WHERE NOT EXISTS (
--   SELECT 1 FROM user_categories uc WHERE uc.user_id = u.id AND uc.name = 'Importado'
-- ) ON CONFLICT (user_id, name) DO NOTHING;

-- INSERT INTO user_categories (id, user_id, name, is_system_defined, created_at, updated_at)
-- SELECT gen_random_uuid(), u.id, 'Fatura Cartão', FALSE, NOW(), NOW()
-- FROM app_users u
-- WHERE NOT EXISTS (
--   SELECT 1 FROM user_categories uc WHERE uc.user_id = u.id AND uc.name = 'Fatura Cartão'
-- ) ON CONFLICT (user_id, name) DO NOTHING;
