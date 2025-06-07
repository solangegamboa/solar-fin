DO $$
BEGIN
    -- Função para atualizar o timestamp da coluna updated_at
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_set_timestamp') THEN
        CREATE FUNCTION trigger_set_timestamp()
        RETURNS TRIGGER AS $func$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $func$ LANGUAGE plpgsql;

        -- Tenta definir o dono, ignora se falhar (usuário pode não ter permissão)
        BEGIN
            ALTER FUNCTION trigger_set_timestamp() OWNER TO solaruser;
        EXCEPTION
            WHEN insufficient_privilege THEN
                RAISE NOTICE 'Não foi possível definir o proprietário da função trigger_set_timestamp para solaruser. Permissões insuficientes.';
            WHEN undefined_object THEN
                RAISE NOTICE 'Usuário solaruser não encontrado para definir como proprietário da função trigger_set_timestamp.';
        END;
    END IF;
END
$$;

-- Função auxiliar para adicionar coluna se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'add_column_if_not_exists') THEN
        CREATE FUNCTION add_column_if_not_exists(
            p_table_name TEXT,
            p_column_name TEXT,
            p_column_type TEXT,
            p_default_value TEXT DEFAULT NULL
        )
        RETURNS VOID AS $func$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public' -- ou o schema que você estiver usando
                AND table_name = p_table_name
                AND column_name = p_column_name
            ) THEN
                EXECUTE 'ALTER TABLE ' || quote_ident(p_table_name) ||
                        ' ADD COLUMN ' || quote_ident(p_column_name) ||
                        ' ' || p_column_type ||
                        CASE WHEN p_default_value IS NOT NULL THEN ' DEFAULT ' || p_default_value ELSE '' END;
                RAISE NOTICE 'Coluna % adicionada à tabela %.', quote_ident(p_column_name), quote_ident(p_table_name);
            ELSE
                RAISE NOTICE 'Coluna % já existe na tabela %.', quote_ident(p_column_name), quote_ident(p_table_name);
            END IF;
        END;
        $func$ LANGUAGE plpgsql;
    END IF;
END
$$;

-- Função auxiliar para adicionar trigger se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'add_timestamp_trigger_if_not_exists') THEN
        CREATE FUNCTION add_timestamp_trigger_if_not_exists(p_table_name TEXT)
        RETURNS VOID AS $func$
        DECLARE
            trigger_name TEXT;
        BEGIN
            trigger_name := 'set_timestamp_' || p_table_name;
            IF NOT EXISTS (
                SELECT 1
                FROM pg_trigger
                WHERE tgname = trigger_name AND tgrelid = p_table_name::regclass
            ) THEN
                EXECUTE 'CREATE TRIGGER ' || quote_ident(trigger_name) ||
                        ' BEFORE UPDATE ON ' || quote_ident(p_table_name) ||
                        ' FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp()';
                RAISE NOTICE 'Trigger % adicionado à tabela %.', quote_ident(trigger_name), quote_ident(p_table_name);
            ELSE
                RAISE NOTICE 'Trigger % já existe na tabela %.', quote_ident(trigger_name), quote_ident(p_table_name);
            END IF;
        END;
        $func$ LANGUAGE plpgsql;
    END IF;
END
$$;

-- Tabela de Usuários (app_users)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'app_users') THEN
        CREATE TABLE app_users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            display_name VARCHAR(100),
            notify_by_email BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_login_at TIMESTAMPTZ
        );
        RAISE NOTICE 'Tabela app_users criada.';
    ELSE
        RAISE NOTICE 'Tabela app_users já existe.';
    END IF;
    PERFORM add_column_if_not_exists('app_users', 'display_name', 'VARCHAR(100)');
    PERFORM add_column_if_not_exists('app_users', 'notify_by_email', 'BOOLEAN', 'FALSE');
    PERFORM add_column_if_not_exists('app_users', 'updated_at', 'TIMESTAMPTZ', 'NOW()');
    PERFORM add_column_if_not_exists('app_users', 'last_login_at', 'TIMESTAMPTZ');
    PERFORM add_timestamp_trigger_if_not_exists('app_users');

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'app_users' AND indexname = 'idx_app_users_email') THEN
        CREATE INDEX idx_app_users_email ON app_users(email);
        RAISE NOTICE 'Índice idx_app_users_email criado.';
    END IF;
END
$$;

-- Tabela de Categorias do Usuário (user_categories)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'user_categories') THEN
        CREATE TABLE user_categories (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL, -- Constraint adicionada abaixo
            name VARCHAR(100) NOT NULL,
            is_system_defined BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        RAISE NOTICE 'Tabela user_categories criada.';
    ELSE
        RAISE NOTICE 'Tabela user_categories já existe.';
    END IF;
    PERFORM add_column_if_not_exists('user_categories', 'updated_at', 'TIMESTAMPTZ', 'NOW()');
    PERFORM add_timestamp_trigger_if_not_exists('user_categories');

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_categories_user_id_fkey' AND table_name = 'user_categories') THEN
        ALTER TABLE user_categories ADD CONSTRAINT user_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Constraint FK user_categories_user_id_fkey criada.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_categories_user_id_name_key' AND table_name = 'user_categories') THEN
        ALTER TABLE user_categories ADD CONSTRAINT user_categories_user_id_name_key UNIQUE (user_id, name);
        RAISE NOTICE 'Constraint UNIQUE user_categories_user_id_name_key criada.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'user_categories' AND indexname = 'idx_user_categories_user_id') THEN
        CREATE INDEX idx_user_categories_user_id ON user_categories(user_id);
        RAISE NOTICE 'Índice idx_user_categories_user_id criado.';
    END IF;
END
$$;

-- Tabela de Transações (transactions)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'transactions') THEN
        CREATE TABLE transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            type VARCHAR(10) NOT NULL,
            amount NUMERIC(12, 2) NOT NULL,
            category VARCHAR(100) NOT NULL,
            date DATE NOT NULL,
            description TEXT,
            recurrence_frequency VARCHAR(20) DEFAULT 'none',
            receipt_image_uri TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        RAISE NOTICE 'Tabela transactions criada.';
    ELSE
        RAISE NOTICE 'Tabela transactions já existe.';
    END IF;
    PERFORM add_column_if_not_exists('transactions', 'recurrence_frequency', 'VARCHAR(20)', '''none''');
    PERFORM add_column_if_not_exists('transactions', 'receipt_image_uri', 'TEXT');
    PERFORM add_column_if_not_exists('transactions', 'updated_at', 'TIMESTAMPTZ', 'NOW()');
    PERFORM add_timestamp_trigger_if_not_exists('transactions');

    IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE table_name = 'transactions' AND constraint_name = 'transactions_type_check') THEN
        ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ('income', 'expense'));
        RAISE NOTICE 'Constraint CHECK transactions_type_check criada.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE table_name = 'transactions' AND constraint_name = 'transactions_recurrence_frequency_check') THEN
        ALTER TABLE transactions ADD CONSTRAINT transactions_recurrence_frequency_check CHECK (recurrence_frequency IN ('none', 'monthly', 'weekly', 'annually'));
        RAISE NOTICE 'Constraint CHECK transactions_recurrence_frequency_check criada.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'transactions_user_id_fkey' AND table_name = 'transactions') THEN
        ALTER TABLE transactions ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Constraint FK transactions_user_id_fkey criada.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'transactions' AND indexname = 'idx_transactions_user_id') THEN
        CREATE INDEX idx_transactions_user_id ON transactions(user_id);
        RAISE NOTICE 'Índice idx_transactions_user_id criado.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'transactions' AND indexname = 'idx_transactions_date') THEN
        CREATE INDEX idx_transactions_date ON transactions(date);
        RAISE NOTICE 'Índice idx_transactions_date criado.';
    END IF;
END
$$;

-- Tabela de Empréstimos (loans)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'loans') THEN
        CREATE TABLE loans (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            bank_name VARCHAR(100) NOT NULL,
            description TEXT,
            installment_amount NUMERIC(12, 2) NOT NULL,
            installments_count INTEGER NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        RAISE NOTICE 'Tabela loans criada.';
    ELSE
        RAISE NOTICE 'Tabela loans já existe.';
    END IF;
    PERFORM add_column_if_not_exists('loans', 'updated_at', 'TIMESTAMPTZ', 'NOW()');
    PERFORM add_timestamp_trigger_if_not_exists('loans');

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'loans_user_id_fkey' AND table_name = 'loans') THEN
        ALTER TABLE loans ADD CONSTRAINT loans_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Constraint FK loans_user_id_fkey criada.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'loans' AND indexname = 'idx_loans_user_id') THEN
        CREATE INDEX idx_loans_user_id ON loans(user_id);
        RAISE NOTICE 'Índice idx_loans_user_id criado.';
    END IF;
END
$$;

-- Tabela de Cartões de Crédito (credit_cards)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'credit_cards') THEN
        CREATE TABLE credit_cards (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            name VARCHAR(100) NOT NULL,
            limit_amount NUMERIC(12, 2) NOT NULL,
            due_date_day INTEGER NOT NULL,
            closing_date_day INTEGER NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        RAISE NOTICE 'Tabela credit_cards criada.';
    ELSE
        RAISE NOTICE 'Tabela credit_cards já existe.';
    END IF;
    PERFORM add_column_if_not_exists('credit_cards', 'updated_at', 'TIMESTAMPTZ', 'NOW()');
    PERFORM add_timestamp_trigger_if_not_exists('credit_cards');

    IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE table_name = 'credit_cards' AND constraint_name = 'credit_cards_due_date_day_check') THEN
        ALTER TABLE credit_cards ADD CONSTRAINT credit_cards_due_date_day_check CHECK (due_date_day >= 1 AND due_date_day <= 31);
        RAISE NOTICE 'Constraint CHECK credit_cards_due_date_day_check criada.';
    END IF;
     IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE table_name = 'credit_cards' AND constraint_name = 'credit_cards_closing_date_day_check') THEN
        ALTER TABLE credit_cards ADD CONSTRAINT credit_cards_closing_date_day_check CHECK (closing_date_day >= 1 AND closing_date_day <= 31);
        RAISE NOTICE 'Constraint CHECK credit_cards_closing_date_day_check criada.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'credit_cards_user_id_fkey' AND table_name = 'credit_cards') THEN
        ALTER TABLE credit_cards ADD CONSTRAINT credit_cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Constraint FK credit_cards_user_id_fkey criada.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'credit_cards' AND indexname = 'idx_credit_cards_user_id') THEN
        CREATE INDEX idx_credit_cards_user_id ON credit_cards(user_id);
        RAISE NOTICE 'Índice idx_credit_cards_user_id criado.';
    END IF;
END
$$;

-- Tabela de Compras no Cartão de Crédito (credit_card_purchases)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'credit_card_purchases') THEN
        CREATE TABLE credit_card_purchases (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            card_id UUID NOT NULL,
            purchase_date DATE NOT NULL,
            description TEXT NOT NULL,
            category VARCHAR(100) NOT NULL,
            total_amount NUMERIC(12, 2) NOT NULL,
            installments INTEGER NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        RAISE NOTICE 'Tabela credit_card_purchases criada.';
    ELSE
        RAISE NOTICE 'Tabela credit_card_purchases já existe.';
    END IF;
    PERFORM add_column_if_not_exists('credit_card_purchases', 'updated_at', 'TIMESTAMPTZ', 'NOW()');
    PERFORM add_timestamp_trigger_if_not_exists('credit_card_purchases');

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'credit_card_purchases_user_id_fkey' AND table_name = 'credit_card_purchases') THEN
        ALTER TABLE credit_card_purchases ADD CONSTRAINT credit_card_purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Constraint FK credit_card_purchases_user_id_fkey criada.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'credit_card_purchases_card_id_fkey' AND table_name = 'credit_card_purchases') THEN
        ALTER TABLE credit_card_purchases ADD CONSTRAINT credit_card_purchases_card_id_fkey FOREIGN KEY (card_id) REFERENCES credit_cards(id) ON DELETE CASCADE;
        RAISE NOTICE 'Constraint FK credit_card_purchases_card_id_fkey criada.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'credit_card_purchases' AND indexname = 'idx_credit_card_purchases_user_id') THEN
        CREATE INDEX idx_credit_card_purchases_user_id ON credit_card_purchases(user_id);
        RAISE NOTICE 'Índice idx_credit_card_purchases_user_id criado.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'credit_card_purchases' AND indexname = 'idx_credit_card_purchases_card_id') THEN
        CREATE INDEX idx_credit_card_purchases_card_id ON credit_card_purchases(card_id);
        RAISE NOTICE 'Índice idx_credit_card_purchases_card_id criado.';
    END IF;
END
$$;

-- Tabela de Metas Financeiras (financial_goals)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'financial_goals') THEN
        CREATE TABLE financial_goals (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            name VARCHAR(100) NOT NULL,
            target_amount NUMERIC(12, 2) NOT NULL,
            current_amount NUMERIC(12, 2) DEFAULT 0,
            target_date DATE,
            description TEXT,
            icon VARCHAR(50),
            status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        RAISE NOTICE 'Tabela financial_goals criada.';
    ELSE
        RAISE NOTICE 'Tabela financial_goals já existe.';
    END IF;
    PERFORM add_column_if_not_exists('financial_goals', 'updated_at', 'TIMESTAMPTZ', 'NOW()');
    PERFORM add_timestamp_trigger_if_not_exists('financial_goals');
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE table_name = 'financial_goals' AND constraint_name = 'financial_goals_status_check') THEN
        ALTER TABLE financial_goals ADD CONSTRAINT financial_goals_status_check CHECK (status IN ('active', 'achieved', 'abandoned'));
        RAISE NOTICE 'Constraint CHECK financial_goals_status_check criada.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'financial_goals_user_id_fkey' AND table_name = 'financial_goals') THEN
        ALTER TABLE financial_goals ADD CONSTRAINT financial_goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Constraint FK financial_goals_user_id_fkey criada.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'financial_goals' AND indexname = 'idx_financial_goals_user_id') THEN
        CREATE INDEX idx_financial_goals_user_id ON financial_goals(user_id);
        RAISE NOTICE 'Índice idx_financial_goals_user_id criado.';
    END IF;
END
$$;

-- Tabela de Investimentos (investments)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'investments') THEN
        CREATE TABLE investments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            name VARCHAR(100) NOT NULL,
            type VARCHAR(50) NOT NULL,
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
        RAISE NOTICE 'Tabela investments criada.';
    ELSE
        RAISE NOTICE 'Tabela investments já existe.';
    END IF;
    PERFORM add_column_if_not_exists('investments', 'updated_at', 'TIMESTAMPTZ', 'NOW()');
    PERFORM add_timestamp_trigger_if_not_exists('investments');

    IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE table_name = 'investments' AND constraint_name = 'investments_type_check') THEN
        ALTER TABLE investments ADD CONSTRAINT investments_type_check CHECK (type IN ('stock', 'savings', 'crypto', 'other'));
        RAISE NOTICE 'Constraint CHECK investments_type_check criada.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'investments_user_id_fkey' AND table_name = 'investments') THEN
        ALTER TABLE investments ADD CONSTRAINT investments_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Constraint FK investments_user_id_fkey criada.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'investments' AND indexname = 'idx_investments_user_id') THEN
        CREATE INDEX idx_investments_user_id ON investments(user_id);
        RAISE NOTICE 'Índice idx_investments_user_id criado.';
    END IF;
END
$$;

RAISE NOTICE 'Schema update/check script completed.';
```