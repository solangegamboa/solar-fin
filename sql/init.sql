
-- Script to initialize the Solar Fin PostgreSQL database

-- Drop tables if they exist to start fresh (optional, use with caution in dev)
-- DROP TABLE IF EXISTS credit_card_purchases CASCADE;
-- DROP TABLE IF EXISTS credit_cards CASCADE;
-- DROP TABLE IF EXISTS loans CASCADE;
-- DROP TABLE IF EXISTS transactions CASCADE;
-- DROP TABLE IF EXISTS user_categories CASCADE;
-- DROP TABLE IF EXISTS app_users CASCADE;

-- Table for Users
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMPTZ
);

-- Table for User Categories
CREATE TABLE IF NOT EXISTS user_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_system_defined BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name) -- Each user has unique category names
);

-- Table for Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')), -- 'income' or 'expense'
    amount DECIMAL(12, 2) NOT NULL,
    category VARCHAR(100) NOT NULL, -- References name in user_categories, not a strict FK for simplicity now but could be
    date DATE NOT NULL,
    description TEXT,
    is_recurring BOOLEAN DEFAULT FALSE,
    receipt_image_uri TEXT, -- Store Data URI or path to image
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table for Loans
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    bank_name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    installment_amount DECIMAL(12, 2) NOT NULL,
    installments_count INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL, -- Calculated: startDate + installmentsCount months
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table for Credit Cards
CREATE TABLE IF NOT EXISTS credit_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    limit_amount DECIMAL(12, 2) NOT NULL,
    due_date_day INTEGER NOT NULL CHECK (due_date_day >= 1 AND due_date_day <= 31),
    closing_date_day INTEGER NOT NULL CHECK (closing_date_day >= 1 AND closing_date_day <= 31),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table for Credit Card Purchases
CREATE TABLE IF NOT EXISTS credit_card_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
    purchase_date DATE NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL, -- References name in user_categories
    total_amount DECIMAL(12, 2) NOT NULL,
    installments INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for faster queries (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_loans_user_start_date ON loans(user_id, start_date ASC);
CREATE INDEX IF NOT EXISTS idx_credit_cards_user ON credit_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_card_purchases_user_date ON credit_card_purchases(user_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_categories_user_name ON user_categories(user_id, name);

-- Note on Categories:
-- For simplicity, 'category' fields in transactions and credit_card_purchases are VARCHAR.
-- In a more complex setup, you might make these foreign keys to user_categories(id).
-- However, managing category renames/deletions becomes more complex then.
-- Storing the name directly is simpler for this application's current scope.

-- Default categories will be added by the application logic (createUser function in databaseService.ts)
-- when a new user is created.

-- End of script
SELECT 'Database schema initialized successfully (if tables did not exist or were empty).' AS status;
