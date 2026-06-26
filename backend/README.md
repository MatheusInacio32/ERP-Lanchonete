# 🍔 Lanchonete — Backend API

API REST em **Node.js + TypeScript + PostgreSQL 9.6**

---

## 📋 Pré-requisitos

- Node.js 18+ ([nodejs.org](https://nodejs.org))
- PostgreSQL 9.6 (já instalado)
- pgAdmin (já instalado)
- Git (opcional)

---

## 🗄️ Passo 1 — Criar o banco de dados no PostgreSQL

### Opção A — Via pgAdmin (interface gráfica)

1. Abra o **pgAdmin**
2. No painel esquerdo, clique com botão direito em **Databases**
3. Clique em **Create → Database...**
4. No campo **Database**, digite: `lanchonete`
5. Em **Owner**, selecione `postgres`
6. Clique em **Save**

### Opção B — Via CMD/PowerShell

```cmd
psql -U postgres -c "CREATE DATABASE lanchonete;"
```

Se pedir senha, use a senha do seu PostgreSQL.

---

## 📦 Passo 2 — Instalar dependências do backend

Abra o **CMD** ou **PowerShell** na pasta `lanchonete-backend`:

```cmd
cd lanchonete-backend
npm install
```

Aguarde o download de todas as dependências. Você verá no final:
```
added 87 packages in 15s
```

---

## ⚙️ Passo 3 — Configurar variáveis de ambiente

O arquivo `.env` já foi criado com valores padrão. Edite com seus dados:

```
Abrir: lanchonete-backend\.env
```

```env
# Servidor
PORT=3001
NODE_ENV=development

# PostgreSQL — EDITE AQUI COM SEUS DADOS
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lanchonete
DB_USER=postgres
DB_PASSWORD=SUA_SENHA_AQUI     ← troque pela sua senha

# CORS — URL do frontend
CORS_ORIGIN=http://localhost:5173

# Logs
LOG_LEVEL=debug
```

> **Atenção:** Substitua `SUA_SENHA_AQUI` pela senha que você configurou no PostgreSQL.
> Se não tem senha definida, deixe em branco: `DB_PASSWORD=`

---

## 🏗️ Passo 4 — Criar as tabelas (migration)

Este comando cria todas as tabelas, índices, views e funções no banco:

```cmd
npm run db:migrate
```

Você verá no CMD:
```
[MIGRATE] Executando migration...
[MIGRATE] ✓ Migration concluída com sucesso!
```

### O que foi criado no banco:

| Tabela                  | Descrição                                    |
|-------------------------|----------------------------------------------|
| `usuarios`              | Operadores do sistema                        |
| `configuracoes`         | Nome do estabelecimento, total de mesas, etc |
| `produtos`              | Cardápio com código, nome, categoria, preço  |
| `mesas`                 | Mesas com status livre/ocupada               |
| `caixas`                | Controle de abertura e fechamento de caixa   |
| `pedidos`               | Pedidos por mesa vinculados ao caixa         |
| `itens_pedido`          | Itens de cada pedido (snapshot do produto)   |
| `movimentacoes_caixa`   | Todas as entradas/saídas do caixa            |
| `vw_resumo_caixa`       | View com totais por forma de pagamento       |
| `vw_dashboard`          | View com estatísticas do dia                 |

> **Nota:** A migration é idempotente — pode rodar várias vezes sem duplicar dados.
> Os produtos de exemplo (X-Burguer, Coca-Cola, etc.) são inseridos automaticamente.

---

## 🚀 Passo 5 — Iniciar o servidor

### Modo desenvolvimento (com hot-reload e logs coloridos):

```cmd
npm run dev
```

Você verá no CMD:
```
╔══════════════════════════════════════════╗
║    🍔  LANCHONETE — API BACKEND          ║
║    Node.js + TypeScript + PostgreSQL     ║
╚══════════════════════════════════════════╝
  Ambiente:  development
  Porta:     3001
  Banco:     localhost:5432/lanchonete

22:15:30 [INFO ] Conectando ao PostgreSQL...
22:15:30 [INFO ] PostgreSQL conectado — servidor: 2024-01-15 22:15:30.123456
22:15:30 [INFO ] Servidor iniciado em http://localhost:3001/api
22:15:30 [INFO ] Health check: http://localhost:3001/api/health
22:15:30 [DEBUG] Modo debug ativo — todas as queries serão logadas
```

### Testar se está funcionando:

Abra o navegador ou Postman e acesse:
```
http://localhost:3001/api/health
```

Resposta esperada:
```json
{
  "success": true,
  "data": {
    "status": "online",
    "timestamp": "2024-01-15T22:15:30.000Z",
    "version": "1.0.0"
  }
}
```

---

## 🌐 Passo 6 — Rodar o frontend

Em outro CMD, na pasta do frontend:

```cmd
cd lanchonete-sistema
npm install
npm run dev
```

O frontend estará em: `http://localhost:5173`

> **Importante:** O frontend ainda usa localStorage por padrão.
> A integração com o backend requer a atualização dos services do frontend
> para chamar a API REST (troca de `localStorage` → `fetch`).

---

## 📡 Rotas da API

### Health
```
GET  /api/health
GET  /api/dashboard
```

### Configurações
```
GET   /api/configuracoes
PATCH /api/configuracoes
```

### Produtos
```
GET    /api/produtos                    → lista todos (ativos e inativos)
GET    /api/produtos?ativos=true        → apenas ativos
GET    /api/produtos/codigo/:codigo     → busca por código (p/ lançamento rápido)
POST   /api/produtos                    → cadastrar
PATCH  /api/produtos/:id                → editar
PATCH  /api/produtos/:id/inativar       → inativar
PATCH  /api/produtos/:id/reativar       → reativar
DELETE /api/produtos/:id                → excluir (só se nunca usado)
```

### Mesas
```
GET    /api/mesas                   → lista todas com status
POST   /api/mesas/:id/abrir         → abre a mesa (cria pedido vinculado ao caixa)
DELETE /api/mesas/:id/abrir         → cancela mesa vazia
```

### Pedidos
```
GET    /api/mesas/:mesaId/pedido            → pedido aberto da mesa (com itens)
POST   /api/mesas/:mesaId/fechar            → fecha conta
POST   /api/pedidos/:id/itens               → adicionar item
PATCH  /api/pedidos/:id/itens/:itemId       → alterar quantidade
PATCH  /api/pedidos/:id/itens/:itemId/obs   → editar observação
DELETE /api/pedidos/:id/itens/:itemId       → remover item
GET    /api/pedidos?data=2024-01-15         → pedidos por data
```

### Caixa
```
GET  /api/caixa                   → caixa atual (aberto)
POST /api/caixa/abrir             → abrir caixa
POST /api/caixa/fechar            → fechar caixa
GET  /api/caixa/resumo/:id        → resumo financeiro do caixa
GET  /api/caixa/resumo/atual      → resumo do caixa atual
GET  /api/caixa/historico         → histórico de caixas fechados
GET  /api/caixa/data?data=...     → caixas de uma data específica
```

---

## 💡 Exemplos de uso (Postman / curl)

### Abrir caixa
```http
POST http://localhost:3001/api/caixa/abrir
Content-Type: application/json

{
  "aberto_por": "João Silva",
  "valor_abertura": 50.00
}
```

### Abrir mesa
```http
POST http://localhost:3001/api/mesas/mesa-1/abrir
```

### Adicionar item
```http
POST http://localhost:3001/api/pedidos/{pedido_id}/itens
Content-Type: application/json

{
  "produto_id": "{uuid do produto}",
  "quantidade": 2,
  "observacao": "Sem cebola"
}
```

### Fechar conta
```http
POST http://localhost:3001/api/mesas/{mesa_id}/fechar
Content-Type: application/json

{
  "forma_pagamento": "dinheiro",
  "valor_recebido": 60.00
}
```

### Fechar caixa
```http
POST http://localhost:3001/api/caixa/fechar
Content-Type: application/json

{
  "fechado_por": "João Silva",
  "valor_contado": 185.50,
  "observacoes": "Caixa conferido sem divergências"
}
```

---

## 📂 Estrutura do projeto

```
lanchonete-backend/
├── src/
│   ├── server.ts              ← Entrada principal
│   ├── types/
│   │   └── index.ts           ← Interfaces TypeScript
│   ├── config/
│   │   ├── database.ts        ← Pool PostgreSQL + helpers
│   │   ├── migration.sql      ← Schema completo do banco
│   │   └── migrate.ts         ← Runner da migration
│   ├── utils/
│   │   └── logger.ts          ← Winston com logs coloridos
│   ├── middleware/
│   │   ├── errorHandler.ts    ← Tratamento de erros global
│   │   └── httpLogger.ts      ← Log de requisições HTTP
│   ├── services/
│   │   ├── produtoService.ts  ← Lógica de negócio: produtos
│   │   ├── mesaService.ts     ← Lógica de negócio: mesas
│   │   ├── pedidoService.ts   ← Lógica de negócio: pedidos
│   │   └── caixaService.ts    ← Lógica de negócio: caixa
│   ├── controllers/
│   │   └── index.ts           ← Handlers HTTP (request/response)
│   └── routes/
│       └── index.ts           ← Definição de todas as rotas
├── logs/                      ← Arquivos de log (criados automaticamente)
├── .env                       ← Variáveis de ambiente (NÃO commitar)
├── .env.example               ← Modelo do .env
├── package.json
└── tsconfig.json
```

---

## 🛑 Comandos úteis

| Comando              | O que faz                                          |
|----------------------|----------------------------------------------------|
| `npm run dev`        | Inicia em modo desenvolvimento com hot-reload      |
| `npm run build`      | Compila TypeScript para JavaScript na pasta dist/  |
| `npm start`          | Roda o build compilado (produção)                  |
| `npm run db:migrate` | Executa a migration SQL no banco                   |

---

## 🔧 Solução de problemas

### ❌ "password authentication failed for user postgres"
Verifique a senha no arquivo `.env` → `DB_PASSWORD=sua_senha`

### ❌ "connect ECONNREFUSED 127.0.0.1:5432"
O PostgreSQL não está rodando. Abra o **Services** do Windows e inicie o serviço `postgresql-x64-9.6` (ou similar).

### ❌ "database lanchonete does not exist"
Crie o banco conforme o Passo 1.

### ❌ Porta 3001 já em uso
Mude no `.env`: `PORT=3002` e reinicie.

### ✅ Ver logs de queries SQL
Certifique-se que no `.env` está `LOG_LEVEL=debug`. Cada query SQL aparecerá verde no CMD.
