
-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMPTZ,
    notify_by_email BOOLEAN DEFAULT FALSE -- Added for email notification preference
);

-- Tabela de Categorias do Usuário
CREATE TABLE IF NOT EXISTS user_categories (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_system_defined BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name) -- Garante que o nome da categoria seja único por usuário
);

-- Tabela de Transações
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
    amount NUMERIC(15, 2) NOT NULL,
    category VARCHAR(100) NOT NULL, -- No futuro, pode referenciar user_categories(name) ou id
    date DATE NOT NULL,
    description TEXT,
    recurrence_frequency VARCHAR(10) DEFAULT 'none' NOT NULL CHECK (recurrence_frequency IN ('none', 'monthly', 'weekly', 'annually')),
    receipt_image_uri TEXT, -- Armazena a Data URI da imagem
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Empréstimos
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    bank_name VARCHAR(100) NOT NULL,
    description TEXT,
    installment_amount NUMERIC(15, 2) NOT NULL,
    installments_count INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Cartões de Crédito
CREATE TABLE IF NOT EXISTS credit_cards (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    limit_amount NUMERIC(15, 2) NOT NULL,
    due_date_day INTEGER NOT NULL CHECK (due_date_day >= 1 AND due_date_day <= 31),
    closing_date_day INTEGER NOT NULL CHECK (closing_date_day >= 1 AND closing_date_day <= 31),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Compras no Cartão de Crédito
CREATE TABLE IF NOT EXISTS credit_card_purchases (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
    purchase_date DATE NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL, -- No futuro, pode referenciar user_categories(name) ou id
    total_amount NUMERIC(15, 2) NOT NULL,
    installments INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Metas Financeiras
CREATE TABLE IF NOT EXISTS financial_goals (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    target_amount NUMERIC(15, 2) NOT NULL,
    current_amount NUMERIC(15, 2) DEFAULT 0.00,
    target_date DATE,
    description TEXT,
    icon VARCHAR(50), -- Nome do ícone (ex: Lucide icon name)
    status VARCHAR(20) DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'achieved', 'abandoned')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Função para atualizar 'updated_at'
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Gatilhos para 'updated_at'
DO $$
DECLARE
    t_name TEXT;
BEGIN
    FOR t_name IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'updated_at' 
          AND table_schema = current_schema() -- or your specific schema
          AND table_name IN ('app_users', 'transactions', 'loans', 'credit_cards', 'credit_card_purchases', 'financial_goals', 'user_categories') -- Adicionar 'app_users' e 'user_categories' se tiverem 'updated_at'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS set_timestamp ON %I;', t_name);
        EXECUTE format('CREATE TRIGGER set_timestamp BEFORE UPDATE ON %I FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();', t_name);
    END LOOP;
END;
$$;

-- Adicionar um usuário padrão (opcional, para desenvolvimento local)
-- Verifique se o usuário já existe antes de tentar inserir para evitar erros em execuções repetidas.
-- INSERT INTO app_users (id, email, hashed_password, display_name)
-- VALUES ('your-uuid-here', 'user@example.com', 'hashed_password_here', 'Default User')
-- ON CONFLICT (email) DO NOTHING;

-- Adicionar categorias padrão para o usuário padrão (se ele foi inserido)
-- INSERT INTO user_categories (id, user_id, name, is_system_defined)
-- SELECT gen_random_uuid(), (SELECT id FROM app_users WHERE email = 'user@example.com'), category_name, TRUE
-- FROM (VALUES
--   ('Alimentação'), ('Transporte'), ('Moradia'), ('Saúde'), ('Educação'),
--   ('Lazer'), ('Vestuário'), ('Contas Fixas'), ('Compras Online'), ('Salário'),
--   ('Investimentos'), ('Presentes'), ('Cuidados Pessoais'), ('Viagens'),
--   ('Serviços (Assinaturas)'), ('Impostos'), ('Outras Receitas'), ('Outras Despesas')
-- ) AS c(category_name)
-- WHERE EXISTS (SELECT 1 FROM app_users WHERE email = 'user@example.com') -- só insere se o usuário existir
-- ON CONFLICT (user_id, name) DO NOTHING;
