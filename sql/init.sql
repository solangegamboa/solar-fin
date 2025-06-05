
-- SQL Initialization Script for Solar Fin PostgreSQL Database

-- Note: Database creation is typically done manually or by a superuser.
-- If you need to create the database, uncomment and run the following line:
-- CREATE DATABASE solar_fin_db;

-- Connect to your database (e.g., solar_fin_db) before running the rest of this script.
-- \c solar_fin_db

-- Enable UUID generation if not available (PostgreSQL 13+ has gen_random_uuid() built-in)
-- For older versions, you might need:
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table for Users
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  hashed_password TEXT NOT NULL,
  photo_url TEXT, -- For future use, not currently implemented in UI
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE app_users IS 'Stores user account information.';
COMMENT ON COLUMN app_users.id IS 'Unique identifier for the user.';
COMMENT ON COLUMN app_users.email IS 'User''s email address, used for login.';
COMMENT ON COLUMN app_users.display_name IS 'User''s chosen display name.';
COMMENT ON COLUMN app_users.hashed_password IS 'User''s securely hashed password.';
COMMENT ON COLUMN app_users.photo_url IS 'URL to the user''s profile picture.';
COMMENT ON COLUMN app_users.created_at IS 'Timestamp of when the user account was created.';
COMMENT ON COLUMN app_users.last_login_at IS 'Timestamp of the user''s last login.';

-- Table for Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount NUMERIC(12, 2) NOT NULL,
  category TEXT NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE transactions IS 'Stores individual financial transactions (income or expense).';
COMMENT ON COLUMN transactions.user_id IS 'Foreign key referencing the user who owns this transaction.';
COMMENT ON COLUMN transactions.type IS 'Type of transaction, either ''income'' or ''expense''.';
COMMENT ON COLUMN transactions.amount IS 'Monetary value of the transaction.';
COMMENT ON COLUMN transactions.category IS 'Category of the transaction (e.g., Salary, Groceries).';
COMMENT ON COLUMN transactions.date IS 'Date when the transaction occurred.';
COMMENT ON COLUMN transactions.description IS 'Optional description for the transaction.';
COMMENT ON COLUMN transactions.is_recurring IS 'Flag indicating if the transaction is recurring.';
COMMENT ON COLUMN transactions.created_at IS 'Timestamp of when the transaction was recorded.';

-- Table for Loans
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  description TEXT,
  installment_amount NUMERIC(12, 2) NOT NULL,
  installments_count INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL, -- Calculated based on start_date and installments_count
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE loans IS 'Stores information about user loans.';
COMMENT ON COLUMN loans.user_id IS 'Foreign key referencing the user who owns this loan.';
COMMENT ON COLUMN loans.bank_name IS 'Name of the bank or financial institution.';
COMMENT ON COLUMN loans.description IS 'Description of the loan (e.g., Car Loan, Mortgage).';
COMMENT ON COLUMN loans.installment_amount IS 'Amount of each loan installment.';
COMMENT ON COLUMN loans.installments_count IS 'Total number of installments for the loan.';
COMMENT ON COLUMN loans.start_date IS 'Date when the first installment is due.';
COMMENT ON COLUMN loans.end_date IS 'Calculated date when the last installment is due.';
COMMENT ON COLUMN loans.created_at IS 'Timestamp of when the loan was recorded.';

-- Table for Credit Cards
CREATE TABLE IF NOT EXISTS credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  limit_amount NUMERIC(12, 2) NOT NULL,
  due_date_day INTEGER NOT NULL CHECK (due_date_day >= 1 AND due_date_day <= 31),
  closing_date_day INTEGER NOT NULL CHECK (closing_date_day >= 1 AND closing_date_day <= 31),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE credit_cards IS 'Stores information about user''s credit cards.';
COMMENT ON COLUMN credit_cards.user_id IS 'Foreign key referencing the user who owns this card.';
COMMENT ON COLUMN credit_cards.name IS 'Name of the credit card (e.g., Visa Platinum).';
COMMENT ON COLUMN credit_cards.limit_amount IS 'Credit limit of the card.';
COMMENT ON COLUMN credit_cards.due_date_day IS 'Day of the month when the credit card bill is due.';
COMMENT ON COLUMN credit_cards.closing_date_day IS 'Day of the month when the credit card statement closes.';
COMMENT ON COLUMN credit_cards.created_at IS 'Timestamp of when the credit card was recorded.';

-- Table for Credit Card Purchases
CREATE TABLE IF NOT EXISTS credit_card_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  purchase_date DATE NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL,
  installments INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE credit_card_purchases IS 'Stores purchases made with credit cards, including installment details.';
COMMENT ON COLUMN credit_card_purchases.user_id IS 'Foreign key referencing the user who made the purchase.';
COMMENT ON COLUMN credit_card_purchases.card_id IS 'Foreign key referencing the credit card used for the purchase.';
COMMENT ON COLUMN credit_card_purchases.purchase_date IS 'Date when the purchase was made.';
COMMENT ON COLUMN credit_card_purchases.description IS 'Description of the purchase.';
COMMENT ON COLUMN credit_card_purchases.category IS 'Category of the purchase.';
COMMENT ON COLUMN credit_card_purchases.total_amount IS 'Total amount of the purchase.';
COMMENT ON COLUMN credit_card_purchases.installments IS 'Number of installments for the purchase.';
COMMENT ON COLUMN credit_card_purchases.created_at IS 'Timestamp of when the purchase was recorded.';

-- You can add indexes here for frequently queried columns to improve performance, e.g.:
-- CREATE INDEX IF NOT EXISTS idx_transactions_user_id_date ON transactions(user_id, date DESC);
-- CREATE INDEX IF NOT EXISTS idx_loans_user_id_start_date ON loans(user_id, start_date ASC);
-- CREATE INDEX IF NOT EXISTS idx_credit_cards_user_id ON credit_cards(user_id);
-- CREATE INDEX IF NOT EXISTS idx_credit_card_purchases_user_id_card_id_date ON credit_card_purchases(user_id, card_id, purchase_date DESC);

-- Example of adding the first user if needed (ensure to hash the password appropriately)
-- INSERT INTO app_users (id, email, display_name, hashed_password)
-- VALUES ('your-predefined-uuid', 'user@example.local', 'Usuário Local Padrão', '$2a$10$YOUR_BCRYPT_HASH_FOR_PASSWORD_HERE')
-- ON CONFLICT (email) DO NOTHING;

SELECT 'Database initialization script completed.' AS status;
