
-- Script de ATUALIZAÇÃO do Banco de Dados PostgreSQL para Solar Fin
-- Este script tenta adicionar tabelas, colunas e outros objetos que podem
-- estar faltando em uma versão mais antiga do schema.
-- É projetado para ser o mais idempotente possível.

BEGIN;

-- 0. Função para atualizar o campo updated_at automaticamente (se não existir)
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Tabela app_users
ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS notify_by_email BOOLEAN DEFAULT FALSE NOT NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_app_users') THEN
        CREATE TRIGGER set_timestamp_app_users
        BEFORE UPDATE ON app_users
        FOR EACH ROW
        EXECUTE PROCEDURE trigger_set_timestamp();
    END IF;
END $$;

-- 2. Tabela user_categories
ALTER TABLE user_categories
    ADD COLUMN IF NOT EXISTS is_system_defined BOOLEAN DEFAULT FALSE NOT NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

-- Adicionar restrição UNIQUE IF NOT EXISTS (é mais complexo, requer checagem)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'user_categories_user_id_name_key' AND table_name = 'user_categories'
    ) THEN
        ALTER TABLE user_categories ADD CONSTRAINT user_categories_user_id_name_key UNIQUE (user_id, name);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_user_categories') THEN
        CREATE TRIGGER set_timestamp_user_categories
        BEFORE UPDATE ON user_categories
        FOR EACH ROW
        EXECUTE PROCEDURE trigger_set_timestamp();
    END IF;
END $$;

-- 3. Tabela transactions
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS recurrence_frequency VARCHAR(10) DEFAULT 'none' NOT NULL,
    ADD COLUMN IF NOT EXISTS receipt_image_uri TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_name = 'transactions' AND constraint_name = 'transactions_recurrence_frequency_check'
    ) THEN
        ALTER TABLE transactions ADD CONSTRAINT transactions_recurrence_frequency_check
        CHECK (recurrence_frequency IN ('none', 'monthly', 'weekly', 'annually'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_transactions') THEN
        CREATE TRIGGER set_timestamp_transactions
        BEFORE UPDATE ON transactions
        FOR EACH ROW
        EXECUTE PROCEDURE trigger_set_timestamp();
    END IF;
END $$;

-- 4. Tabela loans
ALTER TABLE loans
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_loans') THEN
        CREATE TRIGGER set_timestamp_loans
        BEFORE UPDATE ON loans
        FOR EACH ROW
        EXECUTE PROCEDURE trigger_set_timestamp();
    END IF;
END $$;

-- 5. Tabela credit_cards
ALTER TABLE credit_cards
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_credit_cards') THEN
        CREATE TRIGGER set_timestamp_credit_cards
        BEFORE UPDATE ON credit_cards
        FOR EACH ROW
        EXECUTE PROCEDURE trigger_set_timestamp();
    END IF;
END $$;

-- 6. Tabela credit_card_purchases
ALTER TABLE credit_card_purchases
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_credit_card_purchases') THEN
        CREATE TRIGGER set_timestamp_credit_card_purchases
        BEFORE UPDATE ON credit_card_purchases
        FOR EACH ROW
        EXECUTE PROCEDURE trigger_set_timestamp();
    END IF;
END $$;

-- 7. Tabela financial_goals (Cria se não existir)
CREATE TABLE IF NOT EXISTS financial_goals (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    target_amount NUMERIC(15, 2) NOT NULL,
    current_amount NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    target_date DATE,
    description TEXT,
    icon VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_financial_goals_user_id ON financial_goals(user_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_name = 'financial_goals' AND constraint_name = 'financial_goals_status_check'
    ) THEN
        ALTER TABLE financial_goals ADD CONSTRAINT financial_goals_status_check
        CHECK (status IN ('active', 'achieved', 'abandoned'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_financial_goals') THEN
        CREATE TRIGGER set_timestamp_financial_goals
        BEFORE UPDATE ON financial_goals
        FOR EACH ROW
        EXECUTE PROCEDURE trigger_set_timestamp();
    END IF;
END $$;

-- 8. Tabela investments (Cria se não existir)
CREATE TABLE IF NOT EXISTS investments (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL,
    initial_amount NUMERIC(15, 2),
    current_value NUMERIC(15, 2) NOT NULL,
    quantity NUMERIC(18, 8),
    symbol VARCHAR(20),
    institution VARCHAR(100),
    acquisition_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_name = 'investments' AND constraint_name = 'investments_type_check'
    ) THEN
        ALTER TABLE investments ADD CONSTRAINT investments_type_check
        CHECK (type IN ('stock', 'savings', 'crypto', 'other'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_investments') THEN
        CREATE TRIGGER set_timestamp_investments
        BEFORE UPDATE ON investments
        FOR EACH ROW
        EXECUTE PROCEDURE trigger_set_timestamp();
    END IF;
END $$;

-- Adicionar categorias 'Importado' e 'Fatura Cartão' para usuários existentes se não as tiverem
-- Usar is_system_defined = FALSE para estas, pois são adicionadas por migração/lógica de app
INSERT INTO user_categories (id, user_id, name, is_system_defined, created_at, updated_at)
SELECT gen_random_uuid(), u.id, 'Importado', FALSE, NOW(), NOW()
FROM app_users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_categories uc WHERE uc.user_id = u.id AND uc.name = 'Importado'
) ON CONFLICT (user_id, name) DO NOTHING;

INSERT INTO user_categories (id, user_id, name, is_system_defined, created_at, updated_at)
SELECT gen_random_uuid(), u.id, 'Fatura Cartão', FALSE, NOW(), NOW()
FROM app_users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_categories uc WHERE uc.user_id = u.id AND uc.name = 'Fatura Cartão'
) ON CONFLICT (user_id, name) DO NOTHING;


-- Adicionar as categorias padrão (is_system_defined = TRUE) para cada usuário se ainda não existirem.
-- Isso garante que todos os usuários tenham o conjunto básico de categorias do sistema.
DO $$
DECLARE
  default_user RECORD;
  category_names TEXT[] := ARRAY[
    'Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Educação', 'Lazer',
    'Vestuário', 'Contas Fixas', 'Compras Online', 'Salário', 'Investimentos',
    'Presentes', 'Cuidados Pessoais', 'Viagens', 'Serviços (Assinaturas)',
    'Impostos', 'Outras Receitas', 'Outras Despesas'
  ];
  cat_name TEXT;
BEGIN
  FOR default_user IN SELECT id FROM app_users LOOP
    FOREACH cat_name IN ARRAY category_names
    LOOP
      INSERT INTO user_categories (id, user_id, name, is_system_defined, created_at, updated_at)
      VALUES (gen_random_uuid(), default_user.id, cat_name, TRUE, NOW(), NOW())
      ON CONFLICT (user_id, name) DO NOTHING; -- Não faz nada se já existir
    END LOOP;
  END LOOP;
END $$;

COMMIT;

COMMENT ON COLUMN transactions.recurrence_frequency IS 'Frequency of recurrence: none, monthly, weekly, annually.';
COMMENT ON TABLE financial_goals IS 'Stores user-defined financial goals.';
COMMENT ON TABLE investments IS 'Stores user-defined investments.';

SELECT 'Schema update script executed.';
