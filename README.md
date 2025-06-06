
# Solar Fin - Seu Aplicativo de Controle Financeiro Pessoal

Bem-vindo ao Solar Fin! Este é um aplicativo Next.js projetado para ajudá-lo a gerenciar suas finanças pessoais de forma eficaz. Com ele, você pode registrar transações, acompanhar empréstimos, gerenciar cartões de crédito e obter insights financeiros com a ajuda de inteligência artificial.

## Funcionalidades Principais

*   **Painel Financeiro:** Uma visão geral da sua saúde financeira, incluindo saldo atual, receitas e despesas do mês selecionado, e um calendário financeiro interativo com resumo diário.
*   **Gerenciamento de Transações:**
    *   Registre suas receitas e despesas, categorizando-as para melhor organização e permitindo a criação de novas categorias.
    *   Opção de anexar imagem de comprovante com extração automática de valor por IA.
    *   Marque transações como recorrentes e duplique-as facilmente para o mês atual.
*   **Controle de Empréstimos:**
    *   Cadastre seus empréstimos e acompanhe o progresso de pagamento, visualizando o valor total, parcelas pagas, restantes e o status atual.
*   **Gerenciamento de Cartões de Crédito:**
    *   Cadastre seus cartões de crédito, com auxílio de IA para extrair informações como emissor e bandeira a partir de uma imagem do cartão.
    *   Registre compras parceladas e visualize um resumo consolidado das suas futuras faturas, mês a mês.
    *   Acompanhe estimativas das faturas atuais e próximas para cada cartão.
*   **Insights Financeiros com IA:**
    *   Utilize a inteligência artificial (Genkit) para obter um resumo da sua situação financeira e dicas personalizadas para economizar, baseado nos seus dados registrados.
*   **Gerenciamento de Conta e Segurança:**
    *   Sistema de cadastro e login para que múltiplos usuários possam gerenciar suas finanças de forma independente e segura.
    *   Altere seu nome de exibição e senha diretamente nas configurações.
    *   Funcionalidade de backup local para salvar todos os seus dados (perfil, transações, cartões, empréstimos, categorias) em um arquivo JSON.
    *   Restaure seus dados a partir de um arquivo de backup local (substituindo os dados atuais).
*   **Personalização:**
    *   Escolha entre os temas Claro, Escuro ou o padrão do Sistema para ajustar a aparência do aplicativo.
*   **Armazenamento de Dados Flexível:**
    *   Suporte para armazenamento de dados em arquivo JSON local (`src/data/db.json`), ideal para desenvolvimento e uso pessoal simples.
    *   Suporte para um servidor PostgreSQL externo, para maior robustez e escalabilidade. (Configurável via variáveis de ambiente).

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
*   **(Opcional) Docker e Docker Compose:** Se você planeja usar o PostgreSQL através do Docker Compose.
*   **(Opcional) PostgreSQL:** Se você planeja usar o PostgreSQL diretamente sem Docker.

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

# Opção 1: Usar arquivo JSON local (padrão se DATABASE_URL não estiver definido ou DATABASE_MODE=local)
DATABASE_MODE=local
# DATABASE_URL não é necessário para o modo local

# Opção 2: Usar PostgreSQL
# DATABASE_MODE=postgres
# DATABASE_URL="postgresql://USUARIO:SENHA@HOST:PORTA/NOME_DO_BANCO"
# Exemplo: DATABASE_URL="postgresql://postgres:admin@localhost:5432/solar_fin_db"
# Se estiver usando o docker-compose.yml fornecido, a URL será:
# DATABASE_URL="postgresql://solaruser:solarpass@localhost:5432/solar_fin_db"
# (Note que dentro do Docker, o host para o app será 'db', mas para acesso externo é 'localhost')


# (Opcional) Chave da API do Google AI para Genkit (se for usar os fluxos de IA)
# GOOGLE_API_KEY=SUA_CHAVE_DA_API_DO_GOOGLE_AI_AQUI
```

**Notas sobre as variáveis:**

*   **`JWT_SECRET`:** **Obrigatório.** É crucial para a segurança da autenticação. Use uma string longa e aleatória.
*   **`DATABASE_MODE`:** Define se o sistema usará `local` (db.json) ou `postgres`. Se `DATABASE_URL` estiver preenchido e `DATABASE_MODE` não, o sistema tentará usar `postgres`.
*   **`DATABASE_URL`:** **Obrigatório se `DATABASE_MODE="postgres"`.** Forneça a string de conexão para seu servidor PostgreSQL.
*   **`GOOGLE_API_KEY`:** Necessário para as funcionalidades de IA que utilizam Genkit com o Google AI.

### 4. Opções para Banco de Dados PostgreSQL

#### Opção A: Usando Docker Compose (Recomendado para facilidade)

Se você tem Docker e Docker Compose instalados:

1.  Certifique-se de que o arquivo `docker-compose.yml` está na raiz do projeto.
2.  Se for usar esta opção, no seu arquivo `.env`, configure:
    ```env
    DATABASE_MODE=postgres
    DATABASE_URL="postgresql://solaruser:solarpass@localhost:5432/solar_fin_db" 
    # (O app dentro do Docker usará 'db:5432', mas você acessa externamente por 'localhost:5432')
    ```
3.  Execute o seguinte comando no terminal, na raiz do projeto:
    ```bash
    docker-compose up --build
    ```
    Isso irá construir a imagem do aplicativo e iniciar os contêineres do app e do banco de dados PostgreSQL. O script `sql/init.sql` será executado automaticamente na primeira vez para criar as tabelas.
    O aplicativo Next.js estará disponível em `http://localhost:9002` e o PostgreSQL em `localhost:5432`.

#### Opção B: Configurando PostgreSQL Manualmente

Se você definiu `DATABASE_MODE="postgres"` e não está usando Docker Compose:

1.  Certifique-se de que seu servidor PostgreSQL está rodando.
2.  Crie um banco de dados para o projeto (ex: `solar_fin_db`).
3.  Conecte-se ao seu banco de dados recém-criado usando uma ferramenta como `psql` ou um cliente de GUI.
4.  Execute o script `sql/init.sql` para criar todas as tabelas necessárias:
    ```sql
    -- Exemplo usando psql:
    -- psql -U SEU_USUARIO -d SEU_BANCO_DE_DADOS -f sql/init.sql
    ```
    Ou copie e cole o conteúdo do arquivo `sql/init.sql` no seu cliente SQL.

### 5. Rode o Servidor de Desenvolvimento (se não estiver usando Docker para o app)

Se você configurou o PostgreSQL manualmente (Opção 4B) ou está usando o banco de dados local (JSON), para iniciar o aplicativo Next.js:

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
```
