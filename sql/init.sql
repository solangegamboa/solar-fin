
-- Function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION set_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Users Table
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMPTZ,
    notify_by_email BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER trigger_set_timestamp_app_users
BEFORE UPDATE ON app_users
FOR EACH ROW
EXECUTE PROCEDURE set_updated_at_column();

-- Categories Table
CREATE TABLE IF NOT EXISTS user_categories (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_system_defined BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);
CREATE INDEX idx_user_categories_user_id ON user_categories(user_id);
CREATE TRIGGER trigger_set_timestamp_user_categories
BEFORE UPDATE ON user_categories
FOR EACH ROW
EXECUTE PROCEDURE set_updated_at_column();

-- Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL, -- 'income' or 'expense'
    amount NUMERIC(15, 2) NOT NULL,
    category VARCHAR(100) NOT NULL, -- Should match a name in user_categories
    date DATE NOT NULL,
    description TEXT,
    recurrence_frequency VARCHAR(20) DEFAULT 'none', -- 'none', 'monthly', 'weekly', 'annually'
    receipt_image_uri TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE TRIGGER trigger_set_timestamp_transactions
BEFORE UPDATE ON transactions
FOR EACH ROW
EXECUTE PROCEDURE set_updated_at_column();

-- Loans Table
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
    bank_name VARCHAR(100) NOT NULL,
    description TEXT,
    installment_amount NUMERIC(15, 2) NOT NULL,
    installments_count INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_loans_user_id ON loans(user_id);
CREATE TRIGGER trigger_set_timestamp_loans
BEFORE UPDATE ON loans
FOR EACH ROW
EXECUTE PROCEDURE set_updated_at_column();

-- Credit Cards Table
CREATE TABLE IF NOT EXISTS credit_cards (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    limit_amount NUMERIC(15, 2) NOT NULL,
    due_date_day INTEGER NOT NULL,
    closing_date_day INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_credit_cards_user_id ON credit_cards(user_id);
CREATE TRIGGER trigger_set_timestamp_credit_cards
BEFORE UPDATE ON credit_cards
FOR EACH ROW
EXECUTE PROCEDURE set_updated_at_column();

-- Credit Card Purchases Table
CREATE TABLE IF NOT EXISTS credit_card_purchases (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
    card_id UUID REFERENCES credit_cards(id) ON DELETE CASCADE,
    purchase_date DATE NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL, -- Should match a name in user_categories
    total_amount NUMERIC(15, 2) NOT NULL,
    installments INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_credit_card_purchases_user_id ON credit_card_purchases(user_id);
CREATE INDEX idx_credit_card_purchases_card_id ON credit_card_purchases(card_id);
CREATE TRIGGER trigger_set_timestamp_credit_card_purchases
BEFORE UPDATE ON credit_card_purchases
FOR EACH ROW
EXECUTE PROCEDURE set_updated_at_column();

-- Financial Goals Table
CREATE TABLE IF NOT EXISTS financial_goals (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    target_amount NUMERIC(15, 2) NOT NULL,
    current_amount NUMERIC(15, 2) DEFAULT 0,
    target_date DATE,
    description TEXT,
    icon VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'achieved', 'abandoned'
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_financial_goals_user_id ON financial_goals(user_id);
CREATE TRIGGER trigger_set_timestamp_financial_goals
BEFORE UPDATE ON financial_goals
FOR EACH ROW
EXECUTE PROCEDURE set_updated_at_column();

-- Investments Table (NEW)
CREATE TABLE IF NOT EXISTS investments (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'stock', 'savings', 'crypto', 'other'
    initial_amount NUMERIC(15, 2),
    current_value NUMERIC(15, 2) NOT NULL,
    quantity NUMERIC(20, 8), -- Increased precision for crypto
    symbol VARCHAR(20),
    institution VARCHAR(100),
    acquisition_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_investments_user_id ON investments(user_id);
CREATE TRIGGER trigger_set_timestamp_investments
BEFORE UPDATE ON investments
FOR EACH ROW
EXECUTE PROCEDURE set_updated_at_column();

-- Default user for local development (if you reset db.json and use Docker)
-- INSERT INTO app_users (id, email, hashed_password, display_name, created_at, last_login_at)
-- VALUES ('2a141a58-983f-4d63-83d5-605943ff7596', 'user@example.local', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Usuário Local Padrão', NOW(), NOW())
-- ON CONFLICT (email) DO NOTHING;

-- Note: Default categories will be added by the application logic if missing for a user.
