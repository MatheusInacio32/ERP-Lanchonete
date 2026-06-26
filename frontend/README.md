# 🍔 Sistema de Mesas — Lanchonete

Sistema web local para gerenciamento de mesas, pedidos e fechamento de contas.

## Funcionalidades

- **Dashboard** — visão geral: mesas ocupadas/livres, total vendido hoje
- **Gerenciamento de Mesas** — abre/fecha mesas, grid visual verde/vermelho
- **Cardápio / Produtos** — cadastro com nome, categoria, preço; busca e filtros
- **Pedidos** — adiciona itens, altera quantidade, observações por item
- **Fechamento de Conta** — escolha de pagamento (Dinheiro/PIX/Cartão)
- **Troco automático** — calcula e valida troco em tempo real
- **Impressão** — `window.print()` e geração de PDF via jsPDF
- **Persistência** — tudo no localStorage, dados mantidos entre sessões

## Como rodar

```bash
npm install
npm run dev
```

Acesse: http://localhost:5173

## Estrutura

```
src/
├── types/        # Tipagens TypeScript completas
├── hooks/        # useApp — lógica central de estado
├── services/     # storage.ts — camada localStorage (→ troca fácil por API)
├── utils/        # formatação, gerarPDF, imprimirConta, calcularTroco
├── components/
│   └── ui/       # Button, Card, Modal, Input, Select, Badge, StatCard...
└── pages/
    ├── Dashboard.tsx
    ├── Mesas.tsx
    ├── Produtos.tsx
    ├── PedidoModal.tsx
    ├── FechamentoConta.tsx
    └── Configuracoes.tsx
```

## Migração futura para API/SQLite

Todos os dados passam por `src/services/storage.ts`. Para migrar:
1. Substitua as funções de `MesaService`, `ProdutoService`, `PedidoService` por chamadas `fetch()`
2. O hook `useApp` e os componentes **não precisam mudar**

## Tecnologias

- React 19 + TypeScript
- Tailwind CSS 3
- jsPDF (geração de PDF)
- localStorage (persistência local)
- lucide-react (ícones)
