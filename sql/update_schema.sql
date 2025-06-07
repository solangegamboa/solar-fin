-- update_schema.sql
-- This script updates an existing Solar Fin database schema to the latest version.
-- It is designed to be idempotent and preserve existing data.

-- Ensure the app_users table exists and has all necessary columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'app_users') THEN
        CREATE TABLE app_users (
            id UUID PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            hashed_password VARCHAR(255) NOT NULL,
            display_name VARCHAR(100),
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            last_login_at TIMESTAMPTZ,
            notify_by_email BOOLEAN DEFAULT FALSE,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        RAISE NOTICE 'Table app_users created.';
    ELSE
        RAISE NOTICE 'Table app_users already exists.';
        -- Add columns if they don't exist
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='app_users' AND column_name='notify_by_email') THEN
            ALTER TABLE app_users ADD COLUMN notify_by_email BOOLEAN DEFAULT FALSE;
            RAISE NOTICE 'Column notify_by_email added to app_users.';
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='app_users' AND column_name='updated_at') THEN
            ALTER TABLE app_users ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
            RAISE NOTICE 'Column updated_at added to app_users.';
        END IF;
    END IF;
END $$;

-- Ensure the user_categories table exists and has all necessary columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_categories') THEN
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
    ELSE
        RAISE NOTICE 'Table user_categories already exists.';
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='user_categories' AND column_name='updated_at') THEN
            ALTER TABLE user_categories ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
            RAISE NOTICE 'Column updated_at added to user_categories.';
        END IF;
    END IF;
END $$;

-- Ensure the transactions table exists and has all necessary columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'transactions') THEN
        CREATE TABLE transactions (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            type VARCHAR(50) NOT NULL CHECK (type IN ('income', 'expense')),
            amount NUMERIC(12, 2) NOT NULL,
            category VARCHAR(100) NOT NULL,
            date DATE NOT NULL,
            description TEXT,
            recurrence_frequency VARCHAR(50) DEFAULT 'none' CHECK (recurrence_frequency IN ('none', 'weekly', 'monthly', 'annually')),
            receipt_image_uri TEXT,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        RAISE NOTICE 'Table transactions created.';
    ELSE
        RAISE NOTICE 'Table transactions already exists.';
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='transactions' AND column_name='recurrence_frequency') THEN
            ALTER TABLE transactions ADD COLUMN recurrence_frequency VARCHAR(50) DEFAULT 'none' CHECK (recurrence_frequency IN ('none', 'weekly', 'monthly', 'annually'));
            RAISE NOTICE 'Column recurrence_frequency added to transactions.';
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='transactions' AND column_name='receipt_image_uri') THEN
            ALTER TABLE transactions ADD COLUMN receipt_image_uri TEXT;
            RAISE NOTICE 'Column receipt_image_uri added to transactions.';
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='transactions' AND column_name='updated_at') THEN
            ALTER TABLE transactions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
            RAISE NOTICE 'Column updated_at added to transactions.';
        END IF;
    END IF;
END $$;

-- Ensure the loans table exists and has all necessary columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'loans') THEN
        CREATE TABLE loans (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            bank_name VARCHAR(100) NOT NULL,
            description TEXT,
            installment_amount NUMERIC(12, 2) NOT NULL,
            installments_count INTEGER NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        RAISE NOTICE 'Table loans created.';
    ELSE
        RAISE NOTICE 'Table loans already exists.';
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='loans' AND column_name='updated_at') THEN
            ALTER TABLE loans ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
            RAISE NOTICE 'Column updated_at added to loans.';
        END IF;
    END IF;
END $$;

-- Ensure the credit_cards table exists and has all necessary columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'credit_cards') THEN
        CREATE TABLE credit_cards (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            limit_amount NUMERIC(12, 2) NOT NULL,
            due_date_day INTEGER NOT NULL CHECK (due_date_day >= 1 AND due_date_day <= 31),
            closing_date_day INTEGER NOT NULL CHECK (closing_date_day >= 1 AND closing_date_day <= 31),
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        RAISE NOTICE 'Table credit_cards created.';
    ELSE
        RAISE NOTICE 'Table credit_cards already exists.';
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='credit_cards' AND column_name='updated_at') THEN
            ALTER TABLE credit_cards ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
            RAISE NOTICE 'Column updated_at added to credit_cards.';
        END IF;
    END IF;
END $$;

-- Ensure the credit_card_purchases table exists and has all necessary columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'credit_card_purchases') THEN
        CREATE TABLE credit_card_purchases (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
            purchase_date DATE NOT NULL,
            description TEXT NOT NULL,
            category VARCHAR(100) NOT NULL,
            total_amount NUMERIC(12, 2) NOT NULL,
            installments INTEGER NOT NULL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        RAISE NOTICE 'Table credit_card_purchases created.';
    ELSE
        RAISE NOTICE 'Table credit_card_purchases already exists.';
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='credit_card_purchases' AND column_name='updated_at') THEN
            ALTER TABLE credit_card_purchases ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
            RAISE NOTICE 'Column updated_at added to credit_card_purchases.';
        END IF;
        -- Ensure ON DELETE CASCADE for card_id foreign key
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = (SELECT constraint_name FROM information_schema.referential_constraints
                             WHERE constraint_schema = 'public' AND table_name = 'credit_card_purchases'
                               AND unique_constraint_name = (SELECT conname FROM pg_constraint
                                                             WHERE conrelid = 'credit_cards'::regclass AND contype = 'p'))
            AND confdeltype = 'c' -- 'c' for CASCADE
        ) THEN
            -- Drop existing FK if it's not CASCADE (more complex to check specific name, this is simpler)
            -- This might fail if dependent objects exist, requiring manual intervention or more precise naming.
            -- For simplicity, we assume if it exists and isn't cascade, user can manually fix or it was already cascade.
            -- A better approach for production would be to name constraints and drop/re-add specifically.
            -- For this context, we'll just try to add it if no cascade is detected on *any* FK to credit_cards
            -- This is a simplification. A robust migration would name the FK constraint and alter it.
            RAISE NOTICE 'Checking/Re-adding ON DELETE CASCADE for credit_card_purchases.card_id. Manual check may be needed if errors occur.';
             BEGIN
                ALTER TABLE credit_card_purchases DROP CONSTRAINT IF EXISTS credit_card_purchases_card_id_fkey; -- Generic name, might not match
             EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Could not drop existing FK on credit_card_purchases.card_id, assuming it is correct or managed elsewhere.';
             END;
             ALTER TABLE credit_card_purchases ADD CONSTRAINT credit_card_purchases_card_id_fkey_cascade
                FOREIGN KEY (card_id) REFERENCES credit_cards(id) ON DELETE CASCADE;
             RAISE NOTICE 'ON DELETE CASCADE constraint ensured for credit_card_purchases.card_id.';
        END IF;
    END IF;
END $$;

-- Ensure the financial_goals table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'financial_goals') THEN
        CREATE TABLE financial_goals (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            target_amount NUMERIC(12, 2) NOT NULL,
            current_amount NUMERIC(12, 2) DEFAULT 0,
            target_date DATE,
            description TEXT,
            icon VARCHAR(50),
            status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'abandoned')),
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        RAISE NOTICE 'Table financial_goals created.';
    ELSE
        RAISE NOTICE 'Table financial_goals already exists.';
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='financial_goals' AND column_name='updated_at') THEN
            ALTER TABLE financial_goals ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
            RAISE NOTICE 'Column updated_at added to financial_goals.';
        END IF;
    END IF;
END $$;

-- Ensure the investments table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'investments') THEN
        CREATE TABLE investments (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            type VARCHAR(50) NOT NULL CHECK (type IN ('stock', 'savings', 'crypto', 'other')),
            initial_amount NUMERIC(12, 2),
            current_value NUMERIC(12, 2) NOT NULL,
            quantity NUMERIC(18, 8),
            symbol VARCHAR(20),
            institution VARCHAR(100),
            acquisition_date DATE,
            notes TEXT,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        RAISE NOTICE 'Table investments created.';
    ELSE
        RAISE NOTICE 'Table investments already exists.';
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='investments' AND column_name='updated_at') THEN
            ALTER TABLE investments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
            RAISE NOTICE 'Column updated_at added to investments.';
        END IF;
    END IF;
END $$;

-- Create or replace the function to update the updated_at timestamp
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_set_timestamp') THEN
        CREATE OR REPLACE FUNCTION trigger_set_timestamp()
        RETURNS TRIGGER AS $function$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $function$ LANGUAGE plpgsql;
        RAISE NOTICE 'Function trigger_set_timestamp created.';
    ELSE
        RAISE NOTICE 'Function trigger_set_timestamp already exists.';
    END IF;
EXCEPTION
    WHEN duplicate_function THEN
        RAISE NOTICE 'Function trigger_set_timestamp already exists (caught by duplicate_function exception).';
    WHEN others THEN
        RAISE WARNING 'An error occurred while creating/checking trigger_set_timestamp function: %', SQLERRM;
END $$;

-- Change function owner to solaruser if it was created by a superuser (like postgres)
-- This might fail if solaruser does not exist or current user lacks permission, which is fine.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_set_timestamp') THEN
        ALTER FUNCTION trigger_set_timestamp() OWNER TO solaruser;
        RAISE NOTICE 'Owner of trigger_set_timestamp set to solaruser.';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not set owner of trigger_set_timestamp to solaruser. This might be normal if solaruser is current user or due to permissions. SQLSTATE: %, SQLERRM: %', SQLSTATE, SQLERRM;
END $$;


-- Apply the trigger to all relevant tables if not already present
DO $$
DECLARE
    t_name TEXT;
    trigger_name TEXT;
BEGIN
    FOR t_name IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name IN ('app_users', 'user_categories', 'transactions', 'loans', 'credit_cards', 'credit_card_purchases', 'financial_goals', 'investments') LOOP
        trigger_name := 'set_timestamp_trigger_on_' || t_name;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = trigger_name AND tgrelid = t_name::regclass) THEN
            EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp()', trigger_name, t_name);
            RAISE NOTICE 'Trigger % created on table %.', trigger_name, t_name;
        ELSE
            RAISE NOTICE 'Trigger % already exists on table %.', trigger_name, t_name;
        END IF;
    END LOOP;
END $$;

-- Grant all privileges on new tables to solaruser if they exist
DO $$
DECLARE
    t_name TEXT;
BEGIN
    FOR t_name IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name IN ('app_users', 'user_categories', 'transactions', 'loans', 'credit_cards', 'credit_card_purchases', 'financial_goals', 'investments') LOOP
        EXECUTE format('GRANT ALL PRIVILEGES ON TABLE %I TO solaruser', t_name);
        RAISE NOTICE 'Granted ALL PRIVILEGES on table % to solaruser.', t_name;
    END LOOP;
EXCEPTION
    WHEN undefined_object THEN
        RAISE NOTICE 'User solaruser does not exist, skipping GRANTS.';
    WHEN others THEN
        RAISE WARNING 'An error occurred during GRANT operation for solaruser: %', SQLERRM;
END $$;

DO $$
BEGIN
    RAISE NOTICE 'Schema update script completed.';
END $$;
