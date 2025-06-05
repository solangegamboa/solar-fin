
# Solar Fin - Seu Aplicativo de Controle Financeiro Pessoal

Bem-vindo ao Solar Fin! Este é um aplicativo Next.js projetado para ajudá-lo a gerenciar suas finanças pessoais de forma eficaz. Com ele, você pode registrar transações, acompanhar empréstimos, gerenciar cartões de crédito e obter insights financeiros com a ajuda de inteligência artificial.

## Funcionalidades Principais

*   **Painel Financeiro:** Uma visão geral da sua saúde financeira, incluindo saldo, receitas, despesas e um calendário financeiro.
*   **Gerenciamento de Transações:** Registre suas receitas e despesas, categorizando-as para melhor organização.
*   **Controle de Empréstimos:** Acompanhe o progresso dos seus empréstimos, incluindo parcelas pagas e restantes.
*   **Gerenciamento de Cartões de Crédito:** Cadastre seus cartões, registre compras parceladas e visualize futuras faturas.
*   **Insights com IA:** Utilize a inteligência artificial (Genkit) para obter dicas personalizadas e um resumo da sua situação financeira.
*   **Autenticação de Usuários:** Sistema de cadastro e login para que múltiplos usuários possam gerenciar suas finanças de forma independente e segura.
*   **Tema Claro/Escuro:** Personalize a aparência do aplicativo de acordo com sua preferência.
*   **Armazenamento de Dados Flexível:** Suporte para armazenamento de dados em arquivo local (`db.json`) ou em um servidor PostgreSQL externo.

## Tech Stack

*   **Frontend:** Next.js (App Router), React, TypeScript
*   **UI:** ShadCN UI Components, Tailwind CSS
*   **Inteligência Artificial:** Genkit (Google AI)
*   **Autenticação:** JWT com Cookies HTTPOnly
*   **Banco de Dados (Opções):**
    *   Arquivo JSON local (`src/data/db.json`)
    *   PostgreSQL

## Rodando Localmente

Siga os passos abaixo para configurar e rodar o projeto em seu ambiente local.

### Pré-requisitos

*   **Node.js:** Versão 18.x ou superior. (Inclui npm)
*   **Git:** Para clonar o repositório.
*   **(Opcional) PostgreSQL:** Se você planeja usar o PostgreSQL como banco de dados.

### 1. Clone o Repositório

```bash
git clone <URL_DO_REPOSITORIO>
cd <NOME_DA_PASTA_DO_PROJETO>
```

### 2. Instale as Dependências

```bash
npm install
```

### 3. Configure as Variáveis de Ambiente

Crie um arquivo chamado `.env` na raiz do projeto. Este arquivo armazenará suas variáveis de ambiente.

```env
# .env

# Segredo para assinar os tokens JWT. Gere uma string aleatória forte.
# Exemplo: openssl rand -base64 32
JWT_SECRET=SEU_SEGREDO_JWT_AQUI

# Configuração do Banco de Dados (escolha uma das opções abaixo)

# Opção 1: Usar arquivo JSON local (padrão)
DATABASE_MODE=local
# DATABASE_URL não é necessário para o modo local

# Opção 2: Usar PostgreSQL
# DATABASE_MODE=postgres
# DATABASE_URL="postgresql://USUARIO:SENHA@HOST:PORTA/NOME_DO_BANCO"
# Exemplo: DATABASE_URL="postgresql://postgres:admin@localhost:5432/solar_fin_db"

# (Opcional) Chave da API do Google AI para Genkit (se for usar os fluxos de IA)
# GOOGLE_API_KEY=SUA_CHAVE_DA_API_DO_GOOGLE_AI_AQUI
```

**Notas sobre as variáveis:**

*   **`JWT_SECRET`:** **Obrigatório.** É crucial para a segurança da autenticação. Use uma string longa e aleatória.
*   **`DATABASE_MODE`:** Define se o sistema usará `local` (db.json) ou `postgres`.
*   **`DATABASE_URL`:** **Obrigatório se `DATABASE_MODE="postgres"`.** Forneça a string de conexão para seu servidor PostgreSQL.
*   **`GOOGLE_API_KEY`:** Necessário para as funcionalidades de IA que utilizam Genkit com o Google AI.

### 4. (Opcional) Configure o Banco de Dados PostgreSQL

Se você definiu `DATABASE_MODE="postgres"`:

1.  Certifique-se de que seu servidor PostgreSQL está rodando.
2.  Crie um banco de dados para o projeto (ex: `solar_fin_db`).
3.  Conecte-se ao seu banco de dados recém-criado usando uma ferramenta como `psql` ou um cliente de GUI.
4.  Execute o script `sql/init.sql` para criar todas as tabelas necessárias:
    ```sql
    -- Exemplo usando psql:
    -- psql -U SEU_USUARIO -d SEU_BANCO_DE_DADOS -f sql/init.sql
    ```
    Ou copie e cole o conteúdo do arquivo `sql/init.sql` no seu cliente SQL.

### 5. Rode o Servidor de Desenvolvimento

Para iniciar o aplicativo Next.js:

```bash
npm run dev
```

O aplicativo estará disponível em `http://localhost:9002` (ou a porta configurada).

### 6. (Opcional) Rode o Servidor de Desenvolvimento Genkit

Se você for trabalhar com os fluxos de IA (como a página de Insights), você precisará iniciar o servidor de desenvolvimento do Genkit em um terminal separado:

```bash
npm run genkit:dev
# ou para watch mode:
# npm run genkit:watch
```

O servidor Genkit geralmente roda na porta `3400`.

### Pronto!

Agora você pode acessar o aplicativo no seu navegador e começar a usá-lo. Se for seu primeiro acesso, crie uma conta através da página de cadastro.

## Estrutura do Projeto (Simplificada)

*   `src/app/`: Contém as rotas da aplicação (App Router).
    *   `(app)/`: Rotas protegidas da aplicação principal (Dashboard, Transações, etc.).
    *   `(auth)/`: Rotas de autenticação (Login, Signup).
    *   `api/`: Rotas de API (backend).
*   `src/components/`: Componentes React reutilizáveis.
    *   `core/`: Componentes centrais da aplicação (Header, Sidebar, Logo).
    *   `ui/`: Componentes ShadCN UI.
    *   Outras pastas para componentes específicos de funcionalidades (transações, empréstimos, etc.).
*   `src/contexts/`: Contextos React (AuthProvider, ThemeProvider).
*   `src/lib/`: Utilitários e lógica de negócios.
    *   `databaseService.ts`: Lógica de acesso ao banco de dados (JSON ou PostgreSQL).
*   `src/ai/`: Lógica relacionada à Inteligência Artificial com Genkit.
    *   `flows/`: Definições dos fluxos de IA.
*   `src/data/`: (Para modo local) Arquivo `db.json` que armazena os dados.
*   `sql/`: Scripts SQL para configuração do banco de dados.
*   `public/`: Arquivos estáticos.
