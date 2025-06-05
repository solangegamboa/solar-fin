
-- Create app_users table
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  hashed_password TEXT NOT NULL,
  photo_url TEXT, -- Currently not used, but available for future
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'income' or 'expense'
  amount NUMERIC(12, 2) NOT NULL,
  category TEXT NOT NULL, -- References name in user_categories, not a direct FK to allow flexibility
  date DATE NOT NULL,
  description TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create loans table
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  description TEXT,
  installment_amount NUMERIC(12, 2) NOT NULL,
  installments_count INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL, -- Calculated: start_date + (installments_count - 1) months
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create credit_cards table
CREATE TABLE IF NOT EXISTS credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  limit_amount NUMERIC(12, 2) NOT NULL, -- Renamed from 'limit' to avoid SQL keyword clash
  due_date_day INTEGER NOT NULL,
  closing_date_day INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create credit_card_purchases table
CREATE TABLE IF NOT EXISTS credit_card_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  card_id UUID REFERENCES credit_cards(id) ON DELETE CASCADE,
  purchase_date DATE NOT NULL, -- Renamed from 'date'
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- References name in user_categories
  total_amount NUMERIC(12, 2) NOT NULL,
  installments INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_categories table
CREATE TABLE IF NOT EXISTS user_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_system_defined BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name) -- Ensure unique category names per user
);

-- Optional: Add indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_transactions_user_id_date ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_cards_user_id ON credit_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_card_purchases_user_id ON credit_card_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_user_categories_user_id ON user_categories(user_id);
