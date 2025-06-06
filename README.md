
# Solar Fin - Seu Aplicativo de Controle Financeiro Pessoal

Bem-vindo ao Solar Fin! Este é um aplicativo Next.js projetado para ajudá-lo a gerenciar suas finanças pessoais de forma eficaz. Com ele, você pode registrar transações, acompanhar empréstimos, gerenciar cartões de crédito, definir metas financeiras e obter insights com a ajuda de inteligência artificial.

## Funcionalidades Principais

*   **Painel Financeiro:** Uma visão geral da sua saúde financeira, incluindo saldo atual, receitas e despesas do mês selecionado (com navegação entre meses), um calendário financeiro interativo com resumo diário das movimentações, e lembretes de transações recorrentes agendadas.
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
*   **Gerenciamento de Metas Financeiras:**
    *   Cadastre, acompanhe e gerencie suas metas financeiras de curto e longo prazo.
    *   Visualize o progresso de cada meta e defina datas alvo para alcançá-las.
*   **Insights Financeiros com IA:**
    *   Utilize a inteligência artificial (Genkit) para obter um resumo da sua situação financeira e dicas personalizadas para economizar, baseado nos seus dados registrados.
*   **Notificações:**
    *   Ícone de notificações no cabeçalho que exibe lembretes de transações recorrentes agendadas para datas próximas (7 dias antes e 14 dias depois do dia atual).
    *   Indicador de notificações lidas/não lidas gerenciado localmente.
*   **Gerenciamento de Conta e Segurança:**
    *   Sistema de cadastro e login para que múltiplos usuários possam gerenciar suas finanças de forma independente e segura (usando JWT com Cookies HTTPOnly).
    *   Altere seu nome de exibição e senha diretamente nas configurações.
    *   Opção para configurar preferência de recebimento de notificações por e-mail sobre transações agendadas (o envio real de e-mails requer configuração adicional no servidor e um sistema de cron job).
    *   Funcionalidade de backup local para salvar todos os seus dados (perfil, transações, cartões, empréstimos, categorias, metas) em um arquivo JSON.
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
    *   Na primeira vez que o contêiner do banco de dados for iniciado, o script `sql/init.sql` será executado para criar as tabelas.

    Consulte a seção **"Usando com Docker"** abaixo para mais detalhes sobre como interagir com os serviços.

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

### Pronto!

Agora você pode acessar o aplicativo no seu navegador e começar a usá-lo. Se for seu primeiro acesso, crie uma conta através da página de cadastro.

## Estrutura do Projeto (Simplificada)

*   `src/app/`: Contém as rotas da aplicação (App Router).
    *   `(app)/`: Rotas protegidas da aplicação principal (Dashboard, Transações, Empréstimos, Cartões, Metas, etc.).
    *   `(auth)/`: Rotas de autenticação (Login, Signup).
    *   `api/`: Rotas de API (backend).
*   `src/components/`: Componentes React reutilizáveis.
    *   `core/`: Componentes centrais da aplicação (Header, Sidebar, Logo, NotificationBell).
    *   `ui/`: Componentes ShadCN UI.
    *   Outras pastas para componentes específicos de funcionalidades (transações, empréstimos, cartões, metas, etc.).
*   `src/contexts/`: Contextos React (AuthProvider, ThemeProvider).
*   `src/hooks/`: Hooks customizados (ex: `useNotifications.ts`).
*   `src/lib/`: Utilitários e lógica de negócios.
    *   `databaseService.ts`: Lógica de acesso ao banco de dados (JSON ou PostgreSQL).
*   `src/ai/`: Lógica relacionada à Inteligência Artificial com Genkit.
    *   `flows/`: Definições dos fluxos de IA.
*   `src/data/`: (Para modo local) Arquivo `db.json` que armazena os dados.
*   `sql/`: Scripts SQL para configuração do banco de dados PostgreSQL.
*   `public/`: Arquivos estáticos.
*   `docker-compose.yml`: Define os serviços Docker para a aplicação e o banco de dados.
*   `Dockerfile`: Define como construir a imagem Docker para a aplicação Next.js.


    