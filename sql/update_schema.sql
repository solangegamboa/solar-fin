
-- This script attempts to update an existing schema to include new features.
-- It's designed to be run on databases that might have an older schema version.
-- Errors about columns/tables/constraints already existing can typically be ignored.

-- Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add notify_by_email to app_users if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name='app_users' AND column_name='notify_by_email') THEN
        ALTER TABLE app_users ADD COLUMN notify_by_email BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name='app_users' AND column_name='updated_at') THEN
        ALTER TABLE app_users ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
         -- Add trigger for app_users updated_at
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp' AND tgrelid = 'app_users'::regclass) THEN
            CREATE TRIGGER set_timestamp
            BEFORE UPDATE ON app_users
            FOR EACH ROW
            EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
    END IF;
END $$;

-- Add recurrence_frequency and receipt_image_uri to transactions if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name='transactions' AND column_name='recurrence_frequency') THEN
        ALTER TABLE transactions ADD COLUMN recurrence_frequency TEXT CHECK (recurrence_frequency IN ('none', 'monthly', 'weekly', 'annually')) DEFAULT 'none';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name='transactions' AND column_name='receipt_image_uri') THEN
        ALTER TABLE transactions ADD COLUMN receipt_image_uri TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name='transactions' AND column_name='updated_at') THEN
        ALTER TABLE transactions ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp' AND tgrelid = 'transactions'::regclass) THEN
            CREATE TRIGGER set_timestamp
            BEFORE UPDATE ON transactions
            FOR EACH ROW
            EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
    END IF;
END $$;

-- Add updated_at to user_categories if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name='user_categories' AND column_name='updated_at') THEN
        ALTER TABLE user_categories ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp' AND tgrelid = 'user_categories'::regclass) THEN
            CREATE TRIGGER set_timestamp
            BEFORE UPDATE ON user_categories
            FOR EACH ROW
            EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
    END IF;
END $$;

-- Add updated_at to loans if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name='loans' AND column_name='updated_at') THEN
        ALTER TABLE loans ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp' AND tgrelid = 'loans'::regclass) THEN
            CREATE TRIGGER set_timestamp
            BEFORE UPDATE ON loans
            FOR EACH ROW
            EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
    END IF;
END $$;

-- Add updated_at to credit_cards if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name='credit_cards' AND column_name='updated_at') THEN
        ALTER TABLE credit_cards ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp' AND tgrelid = 'credit_cards'::regclass) THEN
            CREATE TRIGGER set_timestamp
            BEFORE UPDATE ON credit_cards
            FOR EACH ROW
            EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
    END IF;
END $$;

-- Add updated_at to credit_card_purchases if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name='credit_card_purchases' AND column_name='updated_at') THEN
        ALTER TABLE credit_card_purchases ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp' AND tgrelid = 'credit_card_purchases'::regclass) THEN
            CREATE TRIGGER set_timestamp
            BEFORE UPDATE ON credit_card_purchases
            FOR EACH ROW
            EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
    END IF;
END $$;

-- Ensure ON DELETE CASCADE for credit_card_purchases.card_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'credit_card_purchases_card_id_fkey' AND table_name = 'credit_card_purchases'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'credit_card_purchases_card_id_fkey' AND confdeltype = 'c' -- 'c' for CASCADE
    ) THEN
        ALTER TABLE credit_card_purchases DROP CONSTRAINT credit_card_purchases_card_id_fkey;
        ALTER TABLE credit_card_purchases 
        ADD CONSTRAINT credit_card_purchases_card_id_fkey 
        FOREIGN KEY (card_id) REFERENCES credit_cards(id) ON DELETE CASCADE;
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'credit_card_purchases_card_id_fkey' AND table_name = 'credit_card_purchases'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name='credit_card_purchases' AND column_name='card_id'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name='credit_cards'
    ) THEN
         ALTER TABLE credit_card_purchases 
         ADD CONSTRAINT credit_card_purchases_card_id_fkey 
         FOREIGN KEY (card_id) REFERENCES credit_cards(id) ON DELETE CASCADE;
    END IF;
END $$;


-- Create Financial Goals Table if it doesn't exist
CREATE TABLE IF NOT EXISTS financial_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_amount NUMERIC(12, 2) NOT NULL,
    current_amount NUMERIC(12, 2) DEFAULT 0,
    target_date DATE,
    description TEXT,
    icon TEXT,
    status TEXT CHECK (status IN ('active', 'achieved', 'abandoned')) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'financial_goals') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp' AND tgrelid = 'financial_goals'::regclass) THEN
            CREATE TRIGGER set_timestamp
            BEFORE UPDATE ON financial_goals
            FOR EACH ROW
            EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
    END IF;
END $$;

-- Create Investments Table if it doesn't exist
CREATE TABLE IF NOT EXISTS investments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('stock', 'savings', 'crypto', 'other')),
    initial_amount NUMERIC(12, 2),
    current_value NUMERIC(12, 2) NOT NULL,
    quantity NUMERIC(18, 8),
    symbol TEXT,
    institution TEXT,
    acquisition_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'investments') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp' AND tgrelid = 'investments'::regclass) THEN
            CREATE TRIGGER set_timestamp
            BEFORE UPDATE ON investments
            FOR EACH ROW
            EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
    END IF;
END $$;

-- Create Indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_transactions_user_id_date ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_cards_user_id ON credit_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_card_purchases_user_id ON credit_card_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_card_purchases_card_id ON credit_card_purchases(card_id);
CREATE INDEX IF NOT EXISTS idx_financial_goals_user_id ON financial_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_categories_user_id ON user_categories(user_id);

-- Grant usage on schema public to postgres user if it was revoked (common in some environments)
-- This might be necessary for the 'solaruser' to operate if it doesn't own the schema but has privileges.
-- However, typically the user creating tables owns them or has schema privileges.
-- This is more of a safety net, might not be needed if solaruser owns the objects or schema.
-- GRANT USAGE ON SCHEMA public TO solaruser; -- Assuming your user is solaruser
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO solaruser; -- Be cautious with this in production

ALTER TABLE IF EXISTS app_users ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE IF EXISTS user_categories ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE IF EXISTS transactions ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE IF EXISTS loans ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE IF EXISTS credit_cards ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE IF EXISTS credit_card_purchases ALTER COLUMN id SET DEFAULT uuid_generate_v4();
-- financial_goals and investments already have DEFAULT in their CREATE IF NOT EXISTS above

ALTER TABLE IF EXISTS app_users ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE IF EXISTS app_users ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE IF EXISTS app_users ALTER COLUMN notify_by_email SET DEFAULT FALSE;

ALTER TABLE IF EXISTS user_categories ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE IF EXISTS user_categories ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE IF EXISTS user_categories ALTER COLUMN is_system_defined SET DEFAULT FALSE;

ALTER TABLE IF EXISTS transactions ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE IF EXISTS transactions ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE IF EXISTS transactions ALTER COLUMN recurrence_frequency SET DEFAULT 'none';

ALTER TABLE IF EXISTS loans ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE IF EXISTS loans ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE IF EXISTS credit_cards ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE IF EXISTS credit_cards ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE IF EXISTS credit_card_purchases ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE IF EXISTS credit_card_purchases ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE IF EXISTS financial_goals ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE IF EXISTS financial_goals ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE IF EXISTS financial_goals ALTER COLUMN current_amount SET DEFAULT 0;
ALTER TABLE IF EXISTS financial_goals ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE IF EXISTS investments ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE IF EXISTS investments ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;


-- Ensure unique constraint on user_categories (user_id, name)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_categories_user_id_name_key' 
        AND conrelid = 'user_categories'::regclass
    ) THEN
        ALTER TABLE user_categories ADD CONSTRAINT user_categories_user_id_name_key UNIQUE (user_id, name);
    END IF;
END $$;


-- Ensure foreign key from user_categories to app_users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_categories_user_id_fkey' 
        AND conrelid = 'user_categories'::regclass
    ) THEN
        ALTER TABLE user_categories 
        ADD CONSTRAINT user_categories_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Ensure foreign key from transactions to app_users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'transactions_user_id_fkey' 
        AND conrelid = 'transactions'::regclass
    ) THEN
        ALTER TABLE transactions 
        ADD CONSTRAINT transactions_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Ensure foreign key from loans to app_users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'loans_user_id_fkey' 
        AND conrelid = 'loans'::regclass
    ) THEN
        ALTER TABLE loans 
        ADD CONSTRAINT loans_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Ensure foreign key from credit_cards to app_users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'credit_cards_user_id_fkey' 
        AND conrelid = 'credit_cards'::regclass
    ) THEN
        ALTER TABLE credit_cards 
        ADD CONSTRAINT credit_cards_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Ensure foreign key from financial_goals to app_users (if table was created)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'financial_goals') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'financial_goals_user_id_fkey' 
            AND conrelid = 'financial_goals'::regclass
        ) THEN
            ALTER TABLE financial_goals 
            ADD CONSTRAINT financial_goals_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- Ensure foreign key from investments to app_users (if table was created)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'investments') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'investments_user_id_fkey' 
            AND conrelid = 'investments'::regclass
        ) THEN
            ALTER TABLE investments 
            ADD CONSTRAINT investments_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

ALTER TABLE IF EXISTS app_users OWNER TO solaruser;
ALTER TABLE IF EXISTS user_categories OWNER TO solaruser;
ALTER TABLE IF EXISTS transactions OWNER TO solaruser;
ALTER TABLE IF EXISTS loans OWNER TO solaruser;
ALTER TABLE IF EXISTS credit_cards OWNER TO solaruser;
ALTER TABLE IF EXISTS credit_card_purchases OWNER TO solaruser;
ALTER TABLE IF EXISTS financial_goals OWNER TO solaruser;
ALTER TABLE IF EXISTS investments OWNER TO solaruser;

ALTER FUNCTION IF EXISTS trigger_set_timestamp() OWNER TO solaruser;

GRANT ALL ON ALL TABLES IN SCHEMA public TO solaruser;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO solaruser;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO solaruser;

-- Example of changing owner of a specific table if it already exists
-- DO $$
-- BEGIN
--     IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'app_users' AND table_schema = current_schema()) THEN
--         ALTER TABLE app_users OWNER TO solaruser;
--     END IF;
-- END $$;
-- Repeat for other tables as needed


