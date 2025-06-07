-- Script para atualizar o schema do banco de dados PostgreSQL para o Solar Fin
-- Este script tenta ser idempotente e pode ser executado múltiplas vezes.
-- Adiciona tabelas e colunas que podem estar faltando. NÃO remove colunas ou tabelas.

-- Função para definir o campo updated_at automaticamente
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_set_timestamp') THEN
    CREATE FUNCTION trigger_set_timestamp()
    RETURNS TRIGGER AS $function$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $function$ LANGUAGE plpgsql;

    -- Tenta alterar o proprietário se a função foi criada.
    -- Se solaruser não tem permissão para criar a função, isso pode falhar.
    -- A melhor prática é executar este script como solaruser.
    BEGIN
      ALTER FUNCTION trigger_set_timestamp() OWNER TO solaruser;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Não foi possível alterar o proprietário da função trigger_set_timestamp(). Isso pode ser normal se solaruser já é o proprietário ou não tem permissão.';
    END;
  ELSE
    -- Se a função já existe, apenas tenta garantir o proprietário correto.
    BEGIN
      ALTER FUNCTION trigger_set_timestamp() OWNER TO solaruser;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Não foi possível alterar o proprietário da função trigger_set_timestamp() existente. Isso pode ser normal se solaruser já é o proprietário ou não tem permissão.';
    END;
  END IF;
END
$$;

-- Tabela de Usuários (app_users)
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_login_at TIMESTAMPTZ,
    notify_by_email BOOLEAN DEFAULT FALSE NOT NULL
);

-- Adicionar colunas faltantes à app_users se necessário
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_users' AND column_name='updated_at') THEN
    ALTER TABLE app_users ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_users' AND column_name='last_login_at') THEN
    ALTER TABLE app_users ADD COLUMN last_login_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_users' AND column_name='notify_by_email') THEN
    ALTER TABLE app_users ADD COLUMN notify_by_email BOOLEAN DEFAULT FALSE NOT NULL;
  END IF;
END $$;

-- Trigger para app_users.updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_app_users' AND tgrelid = 'app_users'::regclass) THEN
    CREATE TRIGGER set_timestamp_app_users
    BEFORE UPDATE ON app_users
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
  END IF;
END $$;


-- Tabela de Categorias (user_categories)
CREATE TABLE IF NOT EXISTS user_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_system_defined BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE (user_id, name)
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_categories' AND column_name='updated_at') THEN
    ALTER TABLE user_categories ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_user_categories' AND tgrelid = 'user_categories'::regclass) THEN
    CREATE TRIGGER set_timestamp_user_categories
    BEFORE UPDATE ON user_categories
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
  END IF;
END $$;


-- Tabela de Transações (transactions)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    category VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    description TEXT,
    receipt_image_uri TEXT,
    recurrence_frequency VARCHAR(20) DEFAULT 'none' NOT NULL CHECK (recurrence_frequency IN ('none', 'monthly', 'weekly', 'annually')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='updated_at') THEN
    ALTER TABLE transactions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='receipt_image_uri') THEN
    ALTER TABLE transactions ADD COLUMN receipt_image_uri TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='recurrence_frequency') THEN
    ALTER TABLE transactions ADD COLUMN recurrence_frequency VARCHAR(20) DEFAULT 'none' NOT NULL CHECK (recurrence_frequency IN ('none', 'monthly', 'weekly', 'annually'));
  END IF;
  -- Adicionar constraint CHECK para amount se não existir
  IF NOT EXISTS (
      SELECT 1 FROM information_schema.constraint_column_usage ccu
      JOIN information_schema.table_constraints tc ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'transactions' AND tc.constraint_type = 'CHECK' AND ccu.column_name = 'amount'
  ) THEN
      ALTER TABLE transactions ADD CONSTRAINT transactions_amount_check CHECK (amount > 0);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_transactions' AND tgrelid = 'transactions'::regclass) THEN
    CREATE TRIGGER set_timestamp_transactions
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
  END IF;
END $$;


-- Tabela de Cartões de Crédito (credit_cards)
CREATE TABLE IF NOT EXISTS credit_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    limit_amount NUMERIC(12, 2) NOT NULL CHECK (limit_amount >= 0),
    due_date_day INTEGER NOT NULL CHECK (due_date_day >= 1 AND due_date_day <= 31),
    closing_date_day INTEGER NOT NULL CHECK (closing_date_day >= 1 AND closing_date_day <= 31),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credit_cards' AND column_name='updated_at') THEN
    ALTER TABLE credit_cards ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_credit_cards' AND tgrelid = 'credit_cards'::regclass) THEN
    CREATE TRIGGER set_timestamp_credit_cards
    BEFORE UPDATE ON credit_cards
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
  END IF;
END $$;


-- Tabela de Compras no Cartão de Crédito (credit_card_purchases)
CREATE TABLE IF NOT EXISTS credit_card_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
    purchase_date DATE NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
    installments INTEGER NOT NULL CHECK (installments >= 1),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credit_card_purchases' AND column_name='updated_at') THEN
    ALTER TABLE credit_card_purchases ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL;
  END IF;
  -- Adicionar constraint ON DELETE CASCADE para card_id se não existir
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='credit_card_purchases' AND constraint_name='credit_card_purchases_card_id_fkey' AND constraint_type='FOREIGN KEY') THEN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.referential_constraints 
        WHERE constraint_name = 'credit_card_purchases_card_id_fkey' 
        AND delete_rule = 'CASCADE'
    ) THEN
        ALTER TABLE credit_card_purchases DROP CONSTRAINT credit_card_purchases_card_id_fkey;
        ALTER TABLE credit_card_purchases ADD CONSTRAINT credit_card_purchases_card_id_fkey
            FOREIGN KEY (card_id) REFERENCES credit_cards(id) ON DELETE CASCADE;
    END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='credit_card_purchases' AND constraint_name='credit_card_purchases_card_id_fkey' AND constraint_type='FOREIGN KEY') THEN
     ALTER TABLE credit_card_purchases ADD CONSTRAINT credit_card_purchases_card_id_fkey
            FOREIGN KEY (card_id) REFERENCES credit_cards(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_credit_card_purchases' AND tgrelid = 'credit_card_purchases'::regclass) THEN
    CREATE TRIGGER set_timestamp_credit_card_purchases
    BEFORE UPDATE ON credit_card_purchases
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
  END IF;
END $$;


-- Tabela de Empréstimos (loans)
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    bank_name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    installment_amount NUMERIC(12, 2) NOT NULL CHECK (installment_amount > 0),
    installments_count INTEGER NOT NULL CHECK (installments_count >= 1),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='updated_at') THEN
    ALTER TABLE loans ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_loans' AND tgrelid = 'loans'::regclass) THEN
    CREATE TRIGGER set_timestamp_loans
    BEFORE UPDATE ON loans
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
  END IF;
END $$;


-- Tabela de Metas Financeiras (financial_goals)
CREATE TABLE IF NOT EXISTS financial_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    target_amount NUMERIC(15, 2) NOT NULL CHECK (target_amount > 0),
    current_amount NUMERIC(15, 2) DEFAULT 0 NOT NULL CHECK (current_amount >= 0),
    target_date DATE,
    description TEXT,
    icon VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'achieved', 'abandoned')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='financial_goals' AND column_name='updated_at') THEN
    ALTER TABLE financial_goals ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_financial_goals' AND tgrelid = 'financial_goals'::regclass) THEN
    CREATE TRIGGER set_timestamp_financial_goals
    BEFORE UPDATE ON financial_goals
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
  END IF;
END $$;


-- Tabela de Investimentos (investments)
CREATE TABLE IF NOT EXISTS investments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('stock', 'savings', 'crypto', 'other')),
    initial_amount NUMERIC(15, 2),
    current_value NUMERIC(15, 2) NOT NULL CHECK (current_value >= 0),
    quantity NUMERIC(20, 8), -- Maior precisão para cripto
    symbol VARCHAR(20),
    institution VARCHAR(100),
    acquisition_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='investments' AND column_name='updated_at') THEN
    ALTER TABLE investments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_investments' AND tgrelid = 'investments'::regclass) THEN
    CREATE TRIGGER set_timestamp_investments
    BEFORE UPDATE ON investments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
  END IF;
END $$;


-- Índices para colunas frequentemente usadas em buscas e joins
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_transactions_user_id_date') THEN
    CREATE INDEX idx_transactions_user_id_date ON transactions(user_id, date DESC);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_credit_card_purchases_user_id_card_id') THEN
    CREATE INDEX idx_credit_card_purchases_user_id_card_id ON credit_card_purchases(user_id, card_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_loans_user_id') THEN
    CREATE INDEX idx_loans_user_id ON loans(user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_financial_goals_user_id') THEN
    CREATE INDEX idx_financial_goals_user_id ON financial_goals(user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_investments_user_id') THEN
    CREATE INDEX idx_investments_user_id ON investments(user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_categories_user_id') THEN
    CREATE INDEX idx_user_categories_user_id ON user_categories(user_id);
  END IF;
END $$;


-- Grant permissions to solaruser for new objects
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO solaruser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO solaruser;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO solaruser;

-- Set ownership of new tables if they were created by a superuser (e.g., during initdb)
-- This assumes the script might be run by a superuser initially, then solaruser
-- For a script run *by* solaruser, these might be redundant or fail if solaruser doesn't own them yet.
DO $$
DECLARE
  tbl_name TEXT;
BEGIN
  FOR tbl_name IN 
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tableowner <> 'solaruser'
      AND tablename IN ('app_users', 'user_categories', 'transactions', 'credit_cards', 'credit_card_purchases', 'loans', 'financial_goals', 'investments')
  LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(tbl_name) || ' OWNER TO solaruser;';
    RAISE NOTICE 'Changed owner of % to solaruser', tbl_name;
  END LOOP;
END $$;

RAISE NOTICE 'Schema update script completed.';
