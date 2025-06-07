-- Script para atualizar o schema do banco de dados Solar Fin
-- Este script é projetado para ser idempotente e pode ser executado múltiplas vezes.

-- 1. Criar a função de trigger para timestamps (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_set_timestamp') THEN
        CREATE FUNCTION trigger_set_timestamp()
        RETURNS TRIGGER AS $func$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $func$ LANGUAGE plpgsql;
        RAISE NOTICE 'Function trigger_set_timestamp created.';
    ELSE
        RAISE NOTICE 'Function trigger_set_timestamp already exists.';
    END IF;
END $$;

-- 2. Atualizar tabela app_users
DO $$
BEGIN
    -- Criar tabela se não existir (improvável para update, mas para robustez)
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'app_users') THEN
        CREATE TABLE app_users (
            id UUID PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            hashed_password VARCHAR(255) NOT NULL,
            display_name VARCHAR(100),
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            last_login_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            notify_by_email BOOLEAN DEFAULT FALSE NOT NULL
        );
        RAISE NOTICE 'Table app_users created.';
    END IF;

    -- Adicionar coluna updated_at se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_users' AND column_name='updated_at') THEN
        ALTER TABLE app_users ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Column updated_at added to app_users.';
    END IF;

    -- Adicionar coluna notify_by_email se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_users' AND column_name='notify_by_email') THEN
        ALTER TABLE app_users ADD COLUMN notify_by_email BOOLEAN DEFAULT FALSE NOT NULL;
        RAISE NOTICE 'Column notify_by_email added to app_users.';
    END IF;

    -- Criar trigger para updated_at se não existir
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_app_users' AND tgrelid = 'app_users'::regclass) THEN
        CREATE TRIGGER set_timestamp_app_users
        BEFORE UPDATE ON app_users
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
        RAISE NOTICE 'Trigger set_timestamp_app_users created for app_users.';
    ELSE
        RAISE NOTICE 'Trigger set_timestamp_app_users already exists for app_users.';
    END IF;

    -- Criar índice para email se não existir
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'app_users' AND indexname = 'idx_app_users_email') THEN
        CREATE INDEX idx_app_users_email ON app_users(email);
        RAISE NOTICE 'Index idx_app_users_email created on app_users.';
    END IF;

END $$;


-- 3. Atualizar tabela user_categories
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'user_categories') THEN
        CREATE TABLE user_categories (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            is_system_defined BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (user_id, name)
        );
        RAISE NOTICE 'Table user_categories created.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_categories' AND column_name='updated_at') THEN
        ALTER TABLE user_categories ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Column updated_at added to user_categories.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_user_categories' AND tgrelid = 'user_categories'::regclass) THEN
        CREATE TRIGGER set_timestamp_user_categories
        BEFORE UPDATE ON user_categories
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
        RAISE NOTICE 'Trigger set_timestamp_user_categories created for user_categories.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'user_categories' AND indexname = 'idx_user_categories_user_id') THEN
        CREATE INDEX idx_user_categories_user_id ON user_categories(user_id);
        RAISE NOTICE 'Index idx_user_categories_user_id created on user_categories.';
    END IF;
END $$;

-- 4. Atualizar tabela transactions
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'transactions') THEN
        CREATE TABLE transactions (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            type VARCHAR(10) NOT NULL,
            amount DECIMAL(12, 2) NOT NULL,
            category VARCHAR(100) NOT NULL,
            date DATE NOT NULL,
            description TEXT,
            recurrence_frequency VARCHAR(20) DEFAULT 'none',
            receipt_image_uri TEXT,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        RAISE NOTICE 'Table transactions created.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='updated_at') THEN
        ALTER TABLE transactions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Column updated_at added to transactions.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='recurrence_frequency') THEN
        ALTER TABLE transactions ADD COLUMN recurrence_frequency VARCHAR(20) DEFAULT 'none';
        RAISE NOTICE 'Column recurrence_frequency added to transactions.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='receipt_image_uri') THEN
        ALTER TABLE transactions ADD COLUMN receipt_image_uri TEXT;
        RAISE NOTICE 'Column receipt_image_uri added to transactions.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_transactions' AND tgrelid = 'transactions'::regclass) THEN
        CREATE TRIGGER set_timestamp_transactions
        BEFORE UPDATE ON transactions
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
        RAISE NOTICE 'Trigger set_timestamp_transactions created for transactions.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'transactions' AND indexname = 'idx_transactions_user_id') THEN
        CREATE INDEX idx_transactions_user_id ON transactions(user_id);
        RAISE NOTICE 'Index idx_transactions_user_id created on transactions.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'transactions' AND indexname = 'idx_transactions_date') THEN
        CREATE INDEX idx_transactions_date ON transactions(date);
        RAISE NOTICE 'Index idx_transactions_date created on transactions.';
    END IF;
END $$;

-- 5. Atualizar tabela loans
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'loans') THEN
        CREATE TABLE loans (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            bank_name VARCHAR(100) NOT NULL,
            description TEXT,
            installment_amount DECIMAL(12, 2) NOT NULL,
            installments_count INTEGER NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        RAISE NOTICE 'Table loans created.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='updated_at') THEN
        ALTER TABLE loans ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Column updated_at added to loans.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_loans' AND tgrelid = 'loans'::regclass) THEN
        CREATE TRIGGER set_timestamp_loans
        BEFORE UPDATE ON loans
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
        RAISE NOTICE 'Trigger set_timestamp_loans created for loans.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'loans' AND indexname = 'idx_loans_user_id') THEN
        CREATE INDEX idx_loans_user_id ON loans(user_id);
        RAISE NOTICE 'Index idx_loans_user_id created on loans.';
    END IF;
END $$;

-- 6. Atualizar tabela credit_cards
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'credit_cards') THEN
        CREATE TABLE credit_cards (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            limit_amount DECIMAL(12, 2) NOT NULL,
            due_date_day INTEGER NOT NULL,
            closing_date_day INTEGER NOT NULL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        RAISE NOTICE 'Table credit_cards created.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credit_cards' AND column_name='updated_at') THEN
        ALTER TABLE credit_cards ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Column updated_at added to credit_cards.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_credit_cards' AND tgrelid = 'credit_cards'::regclass) THEN
        CREATE TRIGGER set_timestamp_credit_cards
        BEFORE UPDATE ON credit_cards
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
        RAISE NOTICE 'Trigger set_timestamp_credit_cards created for credit_cards.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'credit_cards' AND indexname = 'idx_credit_cards_user_id') THEN
        CREATE INDEX idx_credit_cards_user_id ON credit_cards(user_id);
        RAISE NOTICE 'Index idx_credit_cards_user_id created on credit_cards.';
    END IF;
END $$;

-- 7. Atualizar tabela credit_card_purchases
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'credit_card_purchases') THEN
        CREATE TABLE credit_card_purchases (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
            purchase_date DATE NOT NULL,
            description TEXT NOT NULL,
            category VARCHAR(100) NOT NULL,
            total_amount DECIMAL(12, 2) NOT NULL,
            installments INTEGER NOT NULL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        RAISE NOTICE 'Table credit_card_purchases created.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credit_card_purchases' AND column_name='updated_at') THEN
        ALTER TABLE credit_card_purchases ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Column updated_at added to credit_card_purchases.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_credit_card_purchases' AND tgrelid = 'credit_card_purchases'::regclass) THEN
        CREATE TRIGGER set_timestamp_credit_card_purchases
        BEFORE UPDATE ON credit_card_purchases
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
        RAISE NOTICE 'Trigger set_timestamp_credit_card_purchases created for credit_card_purchases.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'credit_card_purchases' AND indexname = 'idx_credit_card_purchases_user_id') THEN
        CREATE INDEX idx_credit_card_purchases_user_id ON credit_card_purchases(user_id);
        RAISE NOTICE 'Index idx_credit_card_purchases_user_id created on credit_card_purchases.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'credit_card_purchases' AND indexname = 'idx_credit_card_purchases_card_id') THEN
        CREATE INDEX idx_credit_card_purchases_card_id ON credit_card_purchases(card_id);
        RAISE NOTICE 'Index idx_credit_card_purchases_card_id created on credit_card_purchases.';
    END IF;
END $$;

-- 8. Tabela financial_goals
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'financial_goals') THEN
        CREATE TABLE financial_goals (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            target_amount DECIMAL(12, 2) NOT NULL,
            current_amount DECIMAL(12, 2) DEFAULT 0.00,
            target_date DATE,
            description TEXT,
            icon VARCHAR(50),
            status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'abandoned')),
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        RAISE NOTICE 'Table financial_goals created.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='financial_goals' AND column_name='updated_at') THEN
        ALTER TABLE financial_goals ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Column updated_at added to financial_goals.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_financial_goals' AND tgrelid = 'financial_goals'::regclass) THEN
        CREATE TRIGGER set_timestamp_financial_goals
        BEFORE UPDATE ON financial_goals
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
        RAISE NOTICE 'Trigger set_timestamp_financial_goals created for financial_goals.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'financial_goals' AND indexname = 'idx_financial_goals_user_id') THEN
        CREATE INDEX idx_financial_goals_user_id ON financial_goals(user_id);
        RAISE NOTICE 'Index idx_financial_goals_user_id created on financial_goals.';
    END IF;
END $$;

-- 9. Tabela investments
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'investments') THEN
        CREATE TABLE investments (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            type VARCHAR(20) NOT NULL, -- 'stock', 'savings', 'crypto', 'other'
            initial_amount DECIMAL(12, 2),
            current_value DECIMAL(12, 2) NOT NULL,
            quantity DECIMAL(18, 8),
            symbol VARCHAR(20),
            institution VARCHAR(100),
            acquisition_date DATE,
            notes TEXT,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        RAISE NOTICE 'Table investments created.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='investments' AND column_name='updated_at') THEN
        ALTER TABLE investments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Column updated_at added to investments.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_investments' AND tgrelid = 'investments'::regclass) THEN
        CREATE TRIGGER set_timestamp_investments
        BEFORE UPDATE ON investments
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
        RAISE NOTICE 'Trigger set_timestamp_investments created for investments.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'investments' AND indexname = 'idx_investments_user_id') THEN
        CREATE INDEX idx_investments_user_id ON investments(user_id);
        RAISE NOTICE 'Index idx_investments_user_id created on investments.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'investments' AND indexname = 'idx_investments_type') THEN
        CREATE INDEX idx_investments_type ON investments(type);
        RAISE NOTICE 'Index idx_investments_type created on investments.';
    END IF;
END $$;

-- Alter function owner (IF EXISTS guard is not standard here, rely on create or replace being run by superuser or owner)
-- This command should be run by a user with appropriate permissions or a superuser.
-- The CREATE OR REPLACE FUNCTION already handles existence.
-- It's generally better to set ownership during CREATE FUNCTION if possible, or ensure the executing user is the intended owner.
-- For this script, assuming `solaruser` is the intended owner and the script executor has rights:
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_set_timestamp') THEN
        ALTER FUNCTION trigger_set_timestamp() OWNER TO solaruser;
        RAISE NOTICE 'Owner of trigger_set_timestamp set to solaruser (if not already).';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE WARNING 'Could not change owner of trigger_set_timestamp. This might be okay if already owned by solaruser or due to permissions. SQLSTATE: %, SQLERRM: %', SQLSTATE, SQLERRM;
END $$;

DO $$
BEGIN
  RAISE NOTICE 'Schema update script completed.';
END $$;
