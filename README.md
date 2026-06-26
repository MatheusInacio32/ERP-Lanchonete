# 🍔 Sistema de Mesas — Lanchonete

Sistema completo: React + Node.js + TypeScript + PostgreSQL 9.6

```
lanchonete-app/
├── frontend/    → React + TypeScript + Tailwind CSS (Vite)
└── backend/     → Node.js + TypeScript + Express + PostgreSQL 9.6
```

---

## ✅ Pré-requisitos

| Software | Versão mínima | Download |
|---|---|---|
| Node.js | 18+ | https://nodejs.org |
| PostgreSQL | 9.6 | já instalado |
| pgAdmin | qualquer | já instalado |

---

## 🗄️ PRIMEIRA VEZ — Configuração inicial

### Passo 1 — Criar o banco de dados (apenas 1x)

**Via pgAdmin:**
1. Clique com botão direito em **Databases → Create → Database**
2. Nome: `lanchonete` | Owner: `postgres` | Clique **Save**

**Via CMD:**
```cmd
psql -U postgres -c "CREATE DATABASE lanchonete;"
```

### Passo 2 — Instalar dependências

Abra **dois CMDs** e execute:

**CMD 1 — Backend:**
```cmd
cd lanchonete-app\backend
npm install
copy .env.example .env
```

Edite o `.env` com sua senha do PostgreSQL:
```env
PORT=3001
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lanchonete
DB_USER=postgres
DB_PASSWORD=SUA_SENHA_AQUI
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=debug
```

**CMD 2 — Frontend:**
```cmd
cd lanchonete-app\frontend
npm install
```

### Passo 3 — Criar tabelas no banco (apenas 1x)

```cmd
cd lanchonete-app\backend
npm run db:migrate
```

Resultado esperado:
```
[MIGRATE] Executando migration...
[MIGRATE] ✓ Migration concluida com sucesso!
```

Tabelas criadas: `usuarios`, `configuracoes`, `produtos`, `mesas`,
`caixas`, `pedidos`, `itens_pedido`, `movimentacoes_caixa`

> ⚠️ **Após o migrate, faça um backup imediato** (ver seção Backup abaixo).
> Da próxima vez você restaura o backup em vez de rodar o migrate.

---

## 🚀 DIA A DIA — Como usar normalmente

Abra **dois CMDs** e execute:

**CMD 1 — Backend** (porta 3001):
```cmd
cd lanchonete-app\backend
npm run dev
```

Você verá logs coloridos em tempo real:
```
╔══════════════════════════════════════════╗
║    🍔  LANCHONETE — API BACKEND          ║
╚══════════════════════════════════════════╝
22:15:30 [INFO ] PostgreSQL conectado
22:15:30 [INFO ] Servidor iniciado em http://localhost:3001/api

// Ao abrir caixa:
22:16:02 [INFO ] [Caixa] 🟢 ABERTO por "João" — Troco inicial: R$ 50.00

// Ao abrir mesa:
22:16:15 [INFO ] [Mesa] 🔓 Mesa 3 ABERTA — pedido abc-123

// Ao adicionar item:
22:16:30 [INFO ] [Pedido] ➕ Item: 2x "X-Burguer" = R$ 37.80

// Ao fechar conta:
22:17:00 [INFO ] [Pedido] 💰 CONTA FECHADA — Total: R$ 37.80 | DINHEIRO | Troco: R$ 12.20

// Ao fechar caixa:
22:20:00 [INFO ] [Caixa] 🔒 FECHADO — Total vendas: R$ 285.50 | 8 pedidos
```

**CMD 2 — Frontend** (porta 5173):
```cmd
cd lanchonete-app\frontend
npm run dev
```

Acesse: **http://localhost:5173**

> O frontend também loga todas as chamadas à API no console do navegador (F12):
> ```
> [API] GET /mesas ✓ 12ms
> [API] POST /caixa/abrir ✓ 8ms
> [API] POST /pedidos/abc/itens ✓ 5ms
> ```

---

## 💾 BACKUP — Exportar e importar dados

### Exportar backup

1. Acesse o sistema no navegador
2. Vá em **Config → Backup do Banco de Dados → Exportar Backup**
3. Será baixado um arquivo `backup-lanchonete-YYYY-MM-DD.json`
4. **Guarde este arquivo em local seguro**

O backup contém todos os dados: produtos, mesas, caixas, pedidos, histórico.

### Importar backup (nova máquina ou reinstalação)

1. Rode a migration **uma vez**: `npm run db:migrate`
2. Inicie o backend: `npm run dev`
3. Acesse o sistema
4. Vá em **Config → Backup do Banco de Dados → Importar Backup**
5. Selecione o arquivo `.json`
6. Aguarde a mensagem de sucesso — a página recarrega automaticamente

> Após importar, **não precisa rodar `db:migrate` novamente** nas próximas vezes.
> Basta iniciar o backend + frontend e importar o backup.

---

## 📡 API REST — Referência de rotas

Base URL: `http://localhost:3001/api`

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Status do servidor |
| GET | `/dashboard` | Resumo do dia |
| GET/PATCH | `/configuracoes` | Configurações |
| GET | `/produtos` | Listar todos |
| GET | `/produtos/codigo/:codigo` | Buscar por código |
| POST | `/produtos` | Cadastrar |
| PATCH | `/produtos/:id` | Editar |
| PATCH | `/produtos/:id/inativar` | Inativar |
| PATCH | `/produtos/:id/reativar` | Reativar |
| DELETE | `/produtos/:id` | Excluir (apenas nunca usados) |
| GET | `/mesas` | Listar mesas |
| POST | `/mesas/:id/abrir` | Abrir mesa |
| DELETE | `/mesas/:id/abrir` | Cancelar mesa vazia |
| GET | `/mesas/:mesaId/pedido` | Pedido ativo da mesa |
| POST | `/mesas/:mesaId/fechar` | Fechar conta |
| POST | `/pedidos/:id/itens` | Adicionar item |
| PATCH | `/pedidos/:id/itens/:itemId` | Alterar quantidade |
| PATCH | `/pedidos/:id/itens/:itemId/obs` | Editar observação |
| DELETE | `/pedidos/:id/itens/:itemId` | Remover item |
| GET | `/pedidos?data=YYYY-MM-DD` | Pedidos por data |
| GET | `/caixa` | Caixa atual |
| POST | `/caixa/abrir` | Abrir caixa |
| POST | `/caixa/fechar` | Fechar caixa |
| GET | `/caixa/resumo/:id` | Relatório do caixa |
| GET | `/caixa/historico` | Histórico de caixas |
| GET | `/caixa/data?data=YYYY-MM-DD` | Caixas por data |
| GET | `/backup` | Exportar tudo |
| POST | `/backup/importar` | Importar backup |

---

## 🛑 Solução de problemas

**❌ "password authentication failed"**
→ Verifique `DB_PASSWORD` no `.env`

**❌ "connect ECONNREFUSED 127.0.0.1:5432"**
→ PostgreSQL não está rodando — abra Services do Windows e inicie `postgresql-x64-9.6`

**❌ "database lanchonete does not exist"**
→ Crie o banco conforme o Passo 1

**❌ "syntax error at or near FUNCTION"**
→ Use o arquivo `migration.sql` da versão correta (compatível com PG 9.6)

**❌ Frontend mostra "Sem conexão com o servidor"**
→ Inicie o backend primeiro: `cd backend && npm run dev`

**❌ Porta 3001 em uso**
→ Mude no `.env`: `PORT=3002`

---

## 🗂️ Estrutura dos arquivos

```
lanchonete-app/
├── README.md
│
├── frontend/
│   └── src/
│       ├── App.tsx                  ← Roteamento + loading/erro de conexão
│       ├── hooks/useApp.ts          ← Estado global async (toda lógica)
│       ├── services/
│       │   ├── api.ts               ← Cliente HTTP com logs no console
│       │   ├── storage.ts           ← Métodos da API (sem localStorage)
│       │   └── folderStorage.ts     ← Pasta automática (Chrome/Edge)
│       ├── pages/
│       │   ├── Dashboard.tsx        ← Resumo do dia
│       │   ├── Mesas.tsx            ← Grid de mesas + input numérico
│       │   ├── PedidoModal.tsx      ← Modal de pedido (lançamento/cardápio/fechar)
│       │   ├── FechamentoConta.tsx  ← Troco automático + impressão/PDF
│       │   ├── Produtos.tsx         ← CRUD de produtos com inativar/excluir
│       │   ├── Caixa.tsx            ← Controle de caixa + relatório
│       │   ├── Relatorios.tsx       ← Histórico por data agrupado por caixa
│       │   └── Configuracoes.tsx    ← Configurações + backup export/import
│       ├── components/
│       │   ├── ui/index.tsx         ← Button, Card, Modal, Input, Badge...
│       │   └── QuickCodeInput.tsx   ← Input rápido por código de produto
│       ├── types/index.ts           ← Todas as interfaces TypeScript
│       └── utils/index.ts           ← formatMoeda, gerarPDF, imprimirConta...
│
└── backend/
    └── src/
        ├── server.ts                ← Express + graceful shutdown + banner
        ├── config/
        │   ├── database.ts          ← Pool PostgreSQL + helper query()
        │   ├── migration.sql        ← Schema completo (PG 9.6 compatível)
        │   └── migrate.ts           ← Runner da migration
        ├── utils/logger.ts          ← Winston — logs coloridos no CMD
        ├── middleware/
        │   ├── errorHandler.ts      ← Erros globais + helpers ok()/created()
        │   └── httpLogger.ts        ← Log de cada requisição HTTP
        ├── types/index.ts           ← Interfaces TypeScript do banco
        ├── services/
        │   ├── produtoService.ts    ← CRUD produtos + validação de uso
        │   ├── mesaService.ts       ← Abrir/cancelar mesas + sincronizar
        │   ├── pedidoService.ts     ← Itens, fechamento, movimentações
        │   └── caixaService.ts      ← Abrir/fechar caixa + dashboard
        ├── controllers/
        │   ├── index.ts             ← Controllers de todas as entidades
        │   └── backupController.ts  ← Export/import completo do banco
        └── routes/index.ts          ← Todas as rotas da API
```
