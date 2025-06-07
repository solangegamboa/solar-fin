
# Solar Fin - Seu Aplicativo de Controle Financeiro Pessoal

Bem-vindo ao Solar Fin! Este é um aplicativo Next.js projetado para ajudá-lo a gerenciar suas finanças pessoais de forma eficaz. Com ele, você pode registrar transações, acompanhar empréstimos, gerenciar cartões de crédito, definir metas financeiras, acompanhar investimentos e obter insights com a ajuda de inteligência artificial.

## Funcionalidades Principais

*   **Painel Financeiro:** Uma visão geral da sua saúde financeira, incluindo saldo atual (ajustado por despesas recorrentes e faturas de cartão do mês), receitas e despesas do mês selecionado (com navegação entre meses), um calendário financeiro interativo com resumo diário das movimentações, e lembretes de transações recorrentes agendadas.
*   **Gerenciamento de Transações:**
    *   Registre suas receitas e despesas, categorizando-as para melhor organização e permitindo a criação de novas categorias.
    *   Edite transações existentes para corrigir ou atualizar informações.
    *   Opção de anexar imagem de comprovante com extração automática de valor por IA.
    *   Marque transações como recorrentes e duplique-as facilmente para o mês atual.
    *   Importe múltiplas transações a partir de uma imagem de extrato bancário com auxílio de IA (Beta).
*   **Acompanhamento de Assinaturas e Despesas Recorrentes:**
    *   Visualize todas as suas despesas marcadas como recorrentes (mensais, semanais, anuais) em uma página dedicada.
    *   Edite os detalhes (valor, categoria, frequência, etc.) de suas despesas recorrentes.
    *   Identifique visualmente quais assinaturas já tiveram seu ciclo de pagamento no mês corrente.
*   **Controle de Empréstimos:**
    *   Cadastre seus empréstimos, edite-os e acompanhe o progresso de pagamento, visualizando o valor total, parcelas pagas, restantes e o status atual.
*   **Gerenciamento de Cartões de Crédito:**
    *   Cadastre seus cartões de crédito, com auxílio de IA para extrair informações como emissor e bandeira a partir de uma imagem do cartão. Edite cartões existentes.
    *   Navegue para uma página de detalhes para cada cartão, onde você pode visualizar todas as compras e faturas específicas daquele cartão.
    *   Registre compras parceladas (informando o valor da parcela), visualize um resumo consolidado das suas futuras faturas (mês a mês) e acompanhe estimativas das faturas atuais e próximas para cada cartão.
    *   Edite ou exclua compras parceladas existentes diretamente na página de detalhes do cartão.
    *   Importe múltiplas transações de uma fatura de cartão de crédito a partir de uma imagem com auxílio de IA (Beta).
*   **Gerenciamento de Metas Financeiras:**
    *   Cadastre, acompanhe, edite e gerencie suas metas financeiras de curto e longo prazo.
    *   Visualize o progresso de cada meta e defina datas alvo para alcançá-las.
*   **Acompanhamento de Investimentos:**
    *   Cadastre, edite e acompanhe seus investimentos em diferentes categorias (Ações, Poupança, Criptomoedas, Outros).
    *   Acompanhe o valor atual, valor inicial, quantidade, símbolo, instituição e performance.
*   **Calculadoras Financeiras:**
    *   Utilize calculadoras integradas para Juros Simples e Juros Compostos.
*   **Insights Financeiros com IA:**
    *   Utilize a inteligência artificial (Genkit) para obter um resumo da sua situação financeira e dicas personalizadas para economizar, baseado nos seus dados registrados.
*   **Notificações:**
    *   Ícone de notificações no cabeçalho que exibe lembretes de transações recorrentes agendadas para datas próximas (7 dias antes e 14 dias depois do dia atual).
    *   Indicador de notificações lidas/não lidas gerenciado localmente (via `localStorage`).
*   **Gerenciamento de Conta e Segurança:**
    *   Sistema de cadastro e login para que múltiplos usuários possam gerenciar suas finanças de forma independente e segura (usando JWT com localStorage).
    *   Altere seu nome de exibição e senha diretamente nas configurações.
    *   Opção para configurar preferência de recebimento de notificações por e-mail sobre transações agendadas (o envio real de e-mails requer configuração adicional no servidor e um sistema de cron job).
    *   Funcionalidade de backup local para salvar todos os seus dados (perfil, transações, cartões, empréstimos, categorias, metas, investimentos) em um arquivo JSON.
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
*   **Autenticação:** JWT com localStorage
*   **Banco de Dados (Opções):**
    *   Arquivo JSON local (`src/data/db.json`)
    *   PostgreSQL

## Rodando Localmente

Siga os passos abaixo para configurar e rodar o projeto em seu ambiente local.

### Pré-requisitos

*   **Node.js:** Versão 18.x ou superior. (Inclui npm)
*   **Git:** Para clonar o repositório.
*   **(Opcional mas Recomendado) Docker e Docker Compose:** Se você planeja usar o PostgreSQL através do Docker Compose ou rodar a aplicação inteira em contêineres.
*   **(Opcional) PostgreSQL:** Se você planeja usar o PostgreSQL diretamente, sem Docker.

### 1. Clone o Repositório

```bash
git clone <URL_DO_REPOSITORIO>
cd <NOME_DA_PASTA_DO_PROJETO>
```

### 2. Instale as Dependências (Necessário mesmo se for usar Docker para o app)

```bash
npm install
```
Isso é importante para que seu editor de código tenha acesso às dependências para linting e autocompletar, mesmo que a aplicação rode no Docker.

### 3. Configure as Variáveis de Ambiente

Crie um arquivo chamado `.env` na raiz do projeto. Este arquivo armazenará suas variáveis de ambiente. Copie o conteúdo de `.env.example` (se existir) ou use o modelo abaixo:

```env
# .env

# Segredo para assinar os tokens JWT. Gere uma string aleatória forte.
# Exemplo: openssl rand -base64 32
JWT_SECRET=SEU_SEGREDO_JWT_AQUI

# Configuração do Banco de Dados (escolha uma das opções abaixo)

# Opção 1: Usar arquivo JSON local (padrão se DATABASE_URL não estiver definido ou DATABASE_MODE=local)
# DATABASE_MODE=local
# DATABASE_URL não é necessário para o modo local

# Opção 2: Usar PostgreSQL (recomendado para uso com Docker ou servidor PostgreSQL separado)
DATABASE_MODE=postgres
DATABASE_URL="postgresql://solaruser:solarpass@localhost:5433/solar_fin_db"
# A porta aqui é 5433 se você estiver acessando o PostgreSQL rodando no Docker (configurado no docker-compose.yml).
# Se estiver usando o docker-compose.yml fornecido, o host para o app dentro do Docker será 'db' e a porta 5432,
# mas para acesso externo ao banco (ex: via DBeaver), use 'localhost:5433'.
# A URL de conexão para o app dentro do Docker será sobrescrita no docker-compose.yml.


# (Opcional) Chave da API do Google AI para Genkit (se for usar os fluxos de IA)
# GOOGLE_API_KEY=SUA_CHAVE_DA_API_DO_GOOGLE_AI_AQUI
```

**Notas sobre as variáveis:**

*   **`JWT_SECRET`:** **Obrigatório.** É crucial para a segurança da autenticação. Use uma string longa e aleatória.
*   **`DATABASE_MODE`:** Define se o sistema usará `local` (db.json) ou `postgres`. Se `DATABASE_URL` estiver preenchido e `DATABASE_MODE` não, o sistema tentará usar `postgres`.
*   **`DATABASE_URL`:** **Obrigatório se `DATABASE_MODE="postgres"`.** Forneça a string de conexão para seu servidor PostgreSQL. Se estiver usando Docker Compose, esta URL (com `localhost:5433`) é para acesso externo; o contêiner do app usará uma URL interna (`db:5432`).
*   **`GOOGLE_API_KEY`:** Necessário para as funcionalidades de IA que utilizam Genkit com o Google AI.

### 4. Escolha como rodar o Projeto

#### Opção A: Rodando Tudo com Docker Compose (Recomendado)

Esta é a maneira mais fácil de ter a aplicação e o banco de dados PostgreSQL rodando juntos.

1.  Certifique-se de que Docker e Docker Compose estão instalados.
2.  No seu arquivo `.env`, a variável `DATABASE_URL` que você configurou (apontando para `localhost:5433`) será usada se você tentar acessar o banco de dados de fora dos contêineres Docker (ex: com um cliente SQL). O contêiner da aplicação (`app`) no `docker-compose.yml` já está configurado para usar a URL correta para se conectar ao contêiner do banco (`db`) na porta interna `5432`.
3.  Execute o seguinte comando no terminal, na raiz do projeto:
    ```bash
    docker-compose up --build
    ```
    Isso irá:
    *   Construir a imagem Docker para a aplicação Next.js.
    *   Iniciar um contêiner para a aplicação.
    *   Iniciar um contêiner para o banco de dados PostgreSQL.
    *   Na primeira vez que o contêiner do banco de dados for iniciado com um volume de dados vazio, o script `sql/init.sql` será executado para criar as tabelas.

    Consulte a seção **"Usando com Docker"** abaixo para mais detalhes sobre como interagir com os serviços e como atualizar o schema do banco.

#### Opção B: Rodando o App Localmente e o Banco de Dados PostgreSQL Separado (Manualmente ou Docker)

Se você prefere rodar a aplicação Next.js diretamente na sua máquina (sem Docker para o app), mas quer usar PostgreSQL:

1.  **Configurar PostgreSQL:**
    *   **PostgreSQL Manual:** Se você tem PostgreSQL instalado localmente, certifique-se de que está rodando. Crie um banco de dados (ex: `solar_fin_db`), um usuário (ex: `solaruser` com senha `solarpass`). Conecte-se ao banco e execute o script `sql/init.sql` (ex: `psql -U solaruser -d solar_fin_db -f sql/init.sql`). Ajuste `DATABASE_URL` no `.env` para `postgresql://solaruser:solarpass@localhost:5432/solar_fin_db` (ou a porta que seu PostgreSQL local estiver usando).
    *   **PostgreSQL com Docker (apenas o banco):** Você pode iniciar apenas o serviço do banco de dados do `docker-compose.yml`:
        ```bash
        docker-compose up -d db
        ```
        Isso iniciará o PostgreSQL. O `sql/init.sql` será executado na primeira vez. A URL de conexão no seu `.env` (`DATABASE_URL="postgresql://solaruser:solarpass@localhost:5433/solar_fin_db"`) permitirá que seu app local se conecte a ele na porta `5433` do host.

2.  **Rode o Servidor de Desenvolvimento Next.js:**
    Após configurar o PostgreSQL e o `.env` (com `DATABASE_MODE=postgres` e a `DATABASE_URL` correta para o seu caso), inicie o app Next.js:
    ```bash
    npm run dev
    ```
    O aplicativo estará disponível em `http://localhost:9002`.

#### Opção C: Rodando o App Localmente com Banco de Dados JSON

Se você quer a configuração mais simples, usando o arquivo `db.json`:

1.  No seu arquivo `.env`, configure:
    ```env
    DATABASE_MODE=local
    # DATABASE_URL não é necessário
    ```
2.  Rode o Servidor de Desenvolvimento Next.js:
    ```bash
    npm run dev
    ```
    O aplicativo estará disponível em `http://localhost:9002`.

### 5. (Opcional) Rode o Servidor de Desenvolvimento Genkit

Se você for trabalhar com os fluxos de IA (como a página de Insights), você precisará iniciar o servidor de desenvolvimento do Genkit em um terminal separado:

```bash
npm run genkit:dev
# ou para watch mode:
# npm run genkit:watch
```

O servidor Genkit geralmente roda na porta `3400` e é independente de como você está rodando a aplicação principal (localmente ou Docker).

## Usando com Docker

Se você utilizou `docker-compose up --build` (Opção 4A):

*   **Acessando a Aplicação Solar Fin:**
    *   A aplicação Next.js estará disponível no seu navegador em: `http://localhost:9002`

*   **Acessando o Banco de Dados PostgreSQL:**
    *   O banco de dados PostgreSQL estará acessível externamente na porta `5433` do seu `localhost`.
    *   Você pode usar um cliente SQL (como DBeaver, pgAdmin, DataGrip) para se conectar a ele usando:
        *   Host: `localhost`
        *   Porta: `5433`
        *   Usuário: `solaruser` (definido no `docker-compose.yml`)
        *   Senha: `solarpass` (definido no `docker-compose.yml`)
        *   Banco de Dados: `solar_fin_db` (definido no `docker-compose.yml`)
    *   Lembre-se que o script `sql/init.sql` é executado automaticamente na primeira vez para criar as tabelas.

*   **Logs dos Contêineres:**
    *   Você verá os logs de ambos os serviços (`app` e `db`) no terminal onde executou `docker-compose up`.
    *   Para ver logs de um serviço específico em outro terminal:
        ```bash
        docker-compose logs -f app
        docker-compose logs -f db
        ```

*   **Parando os Contêineres:**
    *   No terminal onde `docker-compose up` está rodando, pressione `Ctrl+C`.
    *   Para parar e remover os contêineres:
        ```bash
        docker-compose down
        ```
    *   Se você quiser remover também os volumes (incluindo os dados do banco PostgreSQL persistidos na pasta `pgdata`):
        ```bash
        docker-compose down -v
        ```
        **Atenção:** `docker-compose down -v` apagará todos os dados do seu banco de dados PostgreSQL. Use com cuidado.

*   **Variáveis de Ambiente e `.env`:**
    *   O serviço `app` no `docker-compose.yml` está configurado para usar o arquivo `.env` da raiz do seu projeto. Certifique-se de que `JWT_SECRET` está definido nele.
    *   As variáveis `DATABASE_MODE=postgres` e `DATABASE_URL=postgresql://solaruser:solarpass@db:5432/solar_fin_db` são definidas diretamente no `docker-compose.yml` para o contêiner `app`, garantindo que ele se conecte ao contêiner `db` usando a rede interna do Docker (onde o `db` escuta na porta `5432`).

*   **Desenvolvimento Genkit (IA):**
    *   O servidor de desenvolvimento do Genkit (`npm run genkit:dev`) ainda precisa ser rodado separadamente na sua máquina local, pois ele não está incluído na configuração do Docker Compose. A aplicação dentro do Docker se conectará ao servidor Genkit rodando em `localhost:3400` da sua máquina host (o Docker geralmente permite essa conexão por padrão).

*   **Atualizando o Schema do Banco de Dados com Docker:**
    *   **Para novas instalações ou para recriar o banco com o schema mais recente (PERDE DADOS):**
        1.  Pare todos os contêineres: `docker-compose down`
        2.  Remova o volume de dados do PostgreSQL (apagará dados existentes): `docker-compose down -v`
        3.  Inicie os contêineres: `docker-compose up --build`
        Isso fará com que o PostgreSQL inicialize com um volume de dados vazio, e o script `sql/init.sql` (que deve conter o schema completo e atualizado) será executado.

    *   **Para aplicar atualizações a um banco de dados EXISTENTE sem perder dados:**
        1.  Certifique-se de que seus contêineres estão rodando (`docker-compose up -d db` se só o banco, ou `docker-compose up -d` para tudo).
        2.  Copie o script `sql/update_schema.sql` para dentro do contêiner do banco. O nome do contêiner do banco, conforme definido no `docker-compose.yml`, é `solar-fin-db`.
            ```bash
            docker cp ./sql/update_schema.sql solar-fin-db:/tmp/update_schema.sql
            ```
        3.  Execute o script de atualização dentro do contêiner usando `docker exec` e `psql`:
            ```bash
            docker exec -it solar-fin-db psql -U solaruser -d solar_fin_db -f /tmp/update_schema.sql
            ```
            Você pode ser solicitado a inserir a senha `solarpass`.
            Este script `sql/update_schema.sql` é projetado para adicionar novas tabelas e colunas que podem estar faltando, tentando ser idempotente. Ele não removerá colunas ou tabelas.

        **Nota:** O script `sql/update_schema.sql` é para adicionar funcionalidades. Se você precisar de migrações mais complexas (ex: renomear colunas, alterar tipos de dados com dados existentes), um sistema de migração de banco de dados dedicado (como Flyway, Liquibase) seria mais apropriado, o que está fora do escopo da configuração atual.

### Pronto!

Agora você pode acessar o aplicativo no seu navegador e começar a usá-lo. Se for seu primeiro acesso, crie uma conta através da página de cadastro.

## Estrutura do Projeto (Simplificada)

*   `src/app/`: Contém as rotas da aplicação (App Router).
    *   `(app)/`: Rotas protegidas da aplicação principal (Dashboard, Transações, Assinaturas, Empréstimos, Cartões, Metas, Investimentos, Calculadoras, Configurações, etc.).
        *   `credit-cards/[cardId]/`: Página de detalhes para um cartão de crédito específico.
    *   `(auth)/`: Rotas de autenticação (Login, Signup).
    *   `api/`: Rotas de API (backend).
        *   `auth/`: Endpoints para login, signup, logout, e verificação de sessão (`me`).
        *   `transactions/`: Endpoint para adicionar e listar transações.
        *   `transactions/[transactionId]/`: Endpoint para atualizar e excluir transações específicas.
        *   `loans/`: Endpoints para criar e listar empréstimos.
        *   `loans/[loanId]/`: Endpoints para atualizar e excluir empréstimos específicos.
        *   `credit-cards/`: Endpoints para criar e listar cartões de crédito.
        *   `credit-cards/[cardId]/`: Endpoints para atualizar e excluir cartões específicos (o GET pode ser usado pela página de detalhes do cartão, embora a página também possa buscar todos e filtrar).
        *   `goals/`: Endpoints para criar e listar metas financeiras.
        *   `goals/[goalId]/`: Endpoints para atualizar e excluir metas específicas.
        *   `investments/`: Endpoints para criar e listar investimentos.
        *   `investments/[investmentId]/`: Endpoints para atualizar e excluir investimentos específicos.
        *   `credit-card-purchases/`: Endpoints para criar e listar compras de cartão de crédito.
        *   `credit-card-purchases/[purchaseId]/`: Endpoint para atualizar e excluir compras de cartão específicas.
        *   `user/`: Endpoints para gerenciamento de perfil do usuário (atualizar nome, senha, backup, restauração, preferências de e-mail).
        *   `system/`: Endpoint para informações do sistema (ex: modo do banco de dados).
*   `src/components/`: Componentes React reutilizáveis.
    *   `core/`: Componentes centrais da aplicação (Header, Sidebar, Logo, NotificationBell).
    *   `ui/`: Componentes ShadCN UI.
    *   Outras pastas para componentes específicos de funcionalidades (transações, empréstimos, cartões, metas, investimentos, calculadoras, etc.).
*   `src/contexts/`: Contextos React (AuthProvider, ThemeProvider).
*   `src/hooks/`: Hooks customizados (ex: `useNotifications.ts`, `useIsMobile.ts`).
*   `src/lib/`: Utilitários e lógica de negócios.
    *   `databaseService.ts`: Lógica de acesso ao banco de dados (JSON ou PostgreSQL).
    *   `authUtils.ts`: Utilitários de autenticação para API routes.
*   `src/ai/`: Lógica relacionada à Inteligência Artificial com Genkit.
    *   `flows/`: Definições dos fluxos de IA.
*   `src/data/`: (Para modo local) Arquivo `db.json` que armazena os dados.
*   `sql/`: Scripts SQL para configuração do banco de dados PostgreSQL (contém `init.sql` e `update_schema.sql`).
*   `public/`: Arquivos estáticos (incluindo `manifest.json` e ícones).
*   `docker-compose.yml`: Define os serviços Docker para a aplicação e o banco de dados.
*   `Dockerfile`: Define como construir a imagem Docker para a aplicação Next.js.

## Testes Unitários

Este projeto visa incluir testes unitários para garantir a qualidade e a estabilidade do código. Os exemplos de testes e a estrutura sugerida utilizam ferramentas comuns no ecossistema JavaScript/React.

### Ferramentas Sugeridas

*   **Framework de Teste:** [Jest](https://jestjs.io/) ou [Vitest](https://vitest.dev/) são escolhas populares para testar aplicações React e Node.js.
*   **Testes de Componentes React:** [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) é recomendada para testar componentes React de uma forma que se assemelha a como os usuários interagem com eles.
*   **Mocks:** Para isolar unidades de código, você precisará mockar (simular) dependências, como chamadas de API (`fetch`), módulos de banco de dados, ou outros serviços. Jest e Vitest possuem funcionalidades de mocking embutidas.

### Rodando os Testes

Para executar os testes unitários, você normalmente usará um script definido no seu arquivo `package.json`. Se ainda não estiver configurado, você pode adicionar um script como:

```json
// package.json
"scripts": {
  // ... outros scripts
  "test": "jest" // ou "vitest", dependendo do framework escolhido
},
```

Depois, você pode rodar os testes com o comando:

```bash
npm test
# ou
yarn test
```

### Dependências de Desenvolvimento

Certifique-se de instalar as dependências de desenvolvimento necessárias para os testes. Por exemplo, para Jest:

```bash
npm install --save-dev jest @types/jest ts-jest @testing-library/react @testing-library/jest-dom
# ou com yarn
yarn add --dev jest @types/jest ts-jest @testing-library/react @testing-library/jest-dom
```
(Adapte os pacotes conforme o framework escolhido, por exemplo, `vitest` e `@vitest/ui` para Vitest).

### Nota sobre os Exemplos de Teste

Os exemplos de código de teste fornecidos nas interações com o AI são conceituais e servem como um guia. Eles podem precisar de adaptações para se integrarem perfeitamente à sua configuração de teste específica, incluindo a configuração de mocks e a interação detalhada com os componentes da UI (especialmente componentes ShadCN UI que podem ter estruturas DOM específicas).

```