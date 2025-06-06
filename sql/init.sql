-- Arquivo de inicialização do banco de dados PostgreSQL para Solar Fin

-- Criação do usuário/role se não existir (geralmente feito pelo docker-compose, mas incluído para scripts manuais)
-- DO $$
-- BEGIN
--    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'solaruser') THEN
--       CREATE ROLE solaruser LOGIN PASSWORD 'solarpass';
--    END IF;
-- END
-- $$;

-- Criação do banco de dados se não existir (geralmente feito pelo docker-compose)
-- CREATE DATABASE solar_fin_db OWNER solaruser;

-- Conecte-se ao banco solar_fin_db antes de executar o restante do script
-- \c solar_fin_db;

-- Garante que o usuário tem permissões no schema public
-- GRANT ALL ON SCHEMA public TO solaruser;


-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    notify_by_email BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);

-- Tabela de Categorias de Transações (personalizadas por usuário)
CREATE TABLE IF NOT EXISTS user_categories (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_system_defined BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, name) -- Garante que o nome da categoria seja único por usuário
);
CREATE INDEX IF NOT EXISTS idx_user_categories_user_id ON user_categories(user_id);

-- Tabela de Transações
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')), -- 'income' ou 'expense'
    amount NUMERIC(15, 2) NOT NULL,
    category VARCHAR(100) NOT NULL, -- Referencia o nome da categoria, não o ID diretamente aqui
    date DATE NOT NULL,
    description TEXT,
    recurrence_frequency VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (recurrence_frequency IN ('none', 'monthly', 'weekly', 'annually')),
    receipt_image_uri TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);


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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);

-- Tabela de Cartões de Crédito
CREATE TABLE IF NOT EXISTS credit_cards (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    limit_amount NUMERIC(15, 2) NOT NULL,
    due_date_day INTEGER NOT NULL CHECK (due_date_day >= 1 AND due_date_day <= 31),
    closing_date_day INTEGER NOT NULL CHECK (closing_date_day >= 1 AND closing_date_day <= 31),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_credit_cards_user_id ON credit_cards(user_id);

-- Tabela de Compras Parceladas no Cartão de Crédito
CREATE TABLE IF NOT EXISTS credit_card_purchases (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
    purchase_date DATE NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL, -- Referencia o nome da categoria
    total_amount NUMERIC(15, 2) NOT NULL,
    installments INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_credit_card_purchases_user_id ON credit_card_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_card_purchases_card_id ON credit_card_purchases(card_id);

-- Tabela de Metas Financeiras
CREATE TABLE IF NOT EXISTS financial_goals (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    target_amount NUMERIC(15, 2) NOT NULL,
    current_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    target_date DATE,
    description TEXT,
    icon VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'abandoned')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_financial_goals_user_id ON financial_goals(user_id);

-- Tabela de Investimentos
CREATE TABLE IF NOT EXISTS investments (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('stock', 'savings', 'crypto', 'other')),
    initial_amount NUMERIC(15, 2),
    current_value NUMERIC(15, 2) NOT NULL,
    quantity NUMERIC(18, 8), -- Maior precisão para cripto ou frações de ações
    symbol VARCHAR(20),
    institution VARCHAR(100),
    acquisition_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_type ON investments(type);

-- Função para atualizar o campo updated_at automaticamente
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar o trigger para todas as tabelas que possuem `updated_at`
DO $$
DECLARE
  t_name TEXT;
BEGIN
  FOR t_name IN 
    SELECT table_name 
    FROM information_schema.columns 
    WHERE column_name = 'updated_at' 
      AND table_schema = 'public' -- ou o schema que você está usando
      AND table_name IN ('app_users', 'user_categories', 'transactions', 'loans', 'credit_cards', 'credit_card_purchases', 'financial_goals', 'investments')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_timestamp_trigger ON %I;', t_name);
    EXECUTE format('CREATE TRIGGER set_timestamp_trigger
                    BEFORE UPDATE ON %I
                    FOR EACH ROW
                    EXECUTE FUNCTION trigger_set_timestamp();', t_name);
  END LOOP;
END;
$$;


-- Grant all privileges on new tables to solaruser
GRANT ALL PRIVILEGES ON TABLE app_users TO solaruser;
GRANT ALL PRIVILEGES ON TABLE user_categories TO solaruser;
GRANT ALL PRIVILEGES ON TABLE transactions TO solaruser;
GRANT ALL PRIVILEGES ON TABLE loans TO solaruser;
GRANT ALL PRIVILEGES ON TABLE credit_cards TO solaruser;
GRANT ALL PRIVILEGES ON TABLE credit_card_purchases TO solaruser;
GRANT ALL PRIVILEGES ON TABLE financial_goals TO solaruser;
GRANT ALL PRIVILEGES ON TABLE investments TO solaruser;

-- Grant usage on sequences if any were auto-created for SERIAL types (not used here as UUIDs are primary keys)
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO solaruser;

-- Nota: Se você estiver executando este script pela primeira vez em um banco de dados existente
-- que já possui algumas dessas tabelas com uma estrutura diferente, você pode precisar
-- executar comandos ALTER TABLE para adicionar as colunas faltantes ou modificar tipos.
-- Este script é ideal para um banco de dados novo ou após um `docker-compose down -v`.
-- Exemplo de ALTER TABLE (executar manualmente se necessário):
-- ALTER TABLE app_users ADD COLUMN IF NOT EXISTS notify_by_email BOOLEAN NOT NULL DEFAULT FALSE;
-- ALTER TABLE app_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- ALTER TABLE transactions ADD COLUMN IF NOT EXISTS recurrence_frequency VARCHAR(20) NOT NULL DEFAULT 'none';
-- ALTER TABLE transactions ADD COLUMN IF NOT EXISTS receipt_image_uri TEXT;
-- ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- etc.
