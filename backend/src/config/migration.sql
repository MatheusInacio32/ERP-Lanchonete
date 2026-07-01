-- ============================================================
-- LANCHONETE — Schema PostgreSQL
-- Idempotente: todos os objetos usam IF NOT EXISTS / OR REPLACE
-- NUNCA faz DROP de tabelas — dados são preservados entre restarts
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── ENUMS ────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE status_mesa AS ENUM ('livre', 'ocupada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE forma_pagamento AS ENUM ('dinheiro', 'pix', 'cartao', 'debito', 'credito', 'voucher');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_pedido AS ENUM ('aberto', 'fechado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_caixa AS ENUM ('aberto', 'fechado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE categoria_produto AS ENUM (
    'Lanches', 'Bebidas', 'Porcoes', 'Sobremesas', 'Outros'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_movimentacao AS ENUM (
    'venda', 'abertura_caixa', 'fechamento_caixa', 'sangria', 'suprimento'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── TABELA: usuarios ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome          VARCHAR(100) NOT NULL,
  login         VARCHAR(50)  NOT NULL UNIQUE,
  senha_hash    VARCHAR(255) NOT NULL,
  ativo         BOOLEAN      NOT NULL DEFAULT true,
  criado_em     TIMESTAMP    NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ── TABELA: configuracoes ────────────────────────────────────
CREATE TABLE IF NOT EXISTS configuracoes (
  id                   SERIAL       PRIMARY KEY,
  nome_estabelecimento VARCHAR(150) NOT NULL DEFAULT 'Minha Lanchonete',
  total_mesas          INTEGER      NOT NULL DEFAULT 10,
  telefone             VARCHAR(20),
  endereco             VARCHAR(255),
  cor_tema             VARCHAR(20)  NOT NULL DEFAULT 'azul',
  atualizado_em        TIMESTAMP    NOT NULL DEFAULT NOW()
);

INSERT INTO configuracoes (nome_estabelecimento, total_mesas)
  SELECT 'Minha Lanchonete', 10
  WHERE NOT EXISTS (SELECT 1 FROM configuracoes);

-- ── TABELA: produtos ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS produtos (
  id            UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo        VARCHAR(20)       NOT NULL UNIQUE,
  nome          VARCHAR(100)      NOT NULL,
  categoria     categoria_produto NOT NULL DEFAULT 'Outros',
  preco         NUMERIC(10,2)     NOT NULL CHECK (preco > 0),
  ativo         BOOLEAN           NOT NULL DEFAULT true,
  criado_em     TIMESTAMP         NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP         NOT NULL DEFAULT NOW()
);

-- ── TABELA: mesas ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mesas (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero          INTEGER     NOT NULL UNIQUE CHECK (numero > 0),
  status          status_mesa NOT NULL DEFAULT 'livre',
  aberta_em       TIMESTAMP,
  pedido_atual_id UUID
);

-- ── TABELA: caixas ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS caixas (
  id             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  status         status_caixa  NOT NULL DEFAULT 'aberto',
  aberto_por     VARCHAR(100)  NOT NULL,
  aberto_em      TIMESTAMP     NOT NULL DEFAULT NOW(),
  fechado_por    VARCHAR(100),
  fechado_em     TIMESTAMP,
  valor_abertura NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (valor_abertura >= 0),
  valor_contado  NUMERIC(10,2) CHECK (valor_contado >= 0),
  diferenca      NUMERIC(10,2),
  observacoes    TEXT,
  criado_em      TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- ── TABELA: pedidos ──────────────────────────────────────────
-- mesa_numero: snapshot do número da mesa no momento de abertura
--   garante rastreabilidade mesmo se a mesa for renumerada/excluída
-- cancelado_por: quem cancelou o pedido
CREATE TABLE IF NOT EXISTS pedidos (
  id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  mesa_id         UUID            NOT NULL REFERENCES mesas(id),
  mesa_numero     INTEGER,
  caixa_id        UUID            REFERENCES caixas(id),
  status          status_pedido   NOT NULL DEFAULT 'aberto',
  total           NUMERIC(10,2)   NOT NULL DEFAULT 0 CHECK (total >= 0),
  desconto        NUMERIC(10,2)   NOT NULL DEFAULT 0 CHECK (desconto >= 0),
  acrescimo       NUMERIC(10,2)   NOT NULL DEFAULT 0 CHECK (acrescimo >= 0),
  forma_pagamento forma_pagamento,
  valor_recebido  NUMERIC(10,2),
  troco           NUMERIC(10,2),
  criado_em       TIMESTAMP       NOT NULL DEFAULT NOW(),
  fechado_em      TIMESTAMP,
  cancelado_em    TIMESTAMP,
  cancelado_por   VARCHAR(100),
  observacoes     TEXT
);

-- FK mesas → pedidos
DO $$
BEGIN
  ALTER TABLE mesas
    ADD CONSTRAINT fk_mesas_pedido_atual
    FOREIGN KEY (pedido_atual_id) REFERENCES pedidos(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── TABELA: itens_pedido ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS itens_pedido (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id     UUID          NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id    UUID          NOT NULL REFERENCES produtos(id),
  nome_produto  VARCHAR(100)  NOT NULL,
  preco_produto NUMERIC(10,2) NOT NULL,
  quantidade    INTEGER       NOT NULL CHECK (quantidade > 0),
  subtotal      NUMERIC(10,2) NOT NULL,
  observacao    TEXT,
  criado_em     TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- ── TABELA: movimentacoes_caixa ──────────────────────────────
CREATE TABLE IF NOT EXISTS movimentacoes_caixa (
  id         UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  caixa_id   UUID              NOT NULL REFERENCES caixas(id),
  pedido_id  UUID              REFERENCES pedidos(id),
  tipo       tipo_movimentacao NOT NULL,
  valor      NUMERIC(10,2)     NOT NULL,
  descricao  TEXT,
  operador   VARCHAR(100),
  criado_em  TIMESTAMP         NOT NULL DEFAULT NOW()
);

-- ── ÍNDICES ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_produtos_codigo      ON produtos(codigo);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo       ON produtos(ativo);
CREATE INDEX IF NOT EXISTS idx_mesas_numero         ON mesas(numero);
CREATE INDEX IF NOT EXISTS idx_mesas_status         ON mesas(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_mesa         ON pedidos(mesa_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_caixa        ON pedidos(caixa_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status       ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_criado_em    ON pedidos(criado_em);
CREATE INDEX IF NOT EXISTS idx_pedidos_fechado_em   ON pedidos(fechado_em);
CREATE INDEX IF NOT EXISTS idx_pedidos_mesa_numero  ON pedidos(mesa_numero);
CREATE INDEX IF NOT EXISTS idx_itens_pedido         ON itens_pedido(pedido_id);
CREATE INDEX IF NOT EXISTS idx_itens_produto        ON itens_pedido(produto_id);
CREATE INDEX IF NOT EXISTS idx_mov_caixa            ON movimentacoes_caixa(caixa_id);
CREATE INDEX IF NOT EXISTS idx_mov_criado_em        ON movimentacoes_caixa(criado_em);
CREATE INDEX IF NOT EXISTS idx_caixas_status        ON caixas(status);
CREATE INDEX IF NOT EXISTS idx_caixas_aberto_em     ON caixas(aberto_em);

-- ── VIEW: resumo_caixa ────────────────────────────────────────
DROP VIEW IF EXISTS vw_resumo_caixa;
CREATE VIEW vw_resumo_caixa AS
SELECT
  c.id,
  c.aberto_por,
  c.aberto_em,
  c.fechado_por,
  c.fechado_em,
  c.status,
  c.valor_abertura,
  c.valor_contado,
  c.diferenca,
  COUNT(p.id) FILTER (WHERE p.status = 'fechado')                                                  AS total_pedidos,
  COALESCE(SUM(p.total) FILTER (WHERE p.status = 'fechado'), 0)                                    AS total_vendas,
  COALESCE(SUM(p.total) FILTER (WHERE p.status = 'fechado' AND p.forma_pagamento = 'dinheiro'), 0) AS total_dinheiro,
  COALESCE(SUM(p.total) FILTER (WHERE p.status = 'fechado' AND p.forma_pagamento = 'pix'),      0) AS total_pix,
  -- cartao = legado (registros antigos antes de débito/crédito serem separados)
  COALESCE(SUM(p.total) FILTER (WHERE p.status = 'fechado' AND p.forma_pagamento = 'cartao'),   0) AS total_cartao,
  -- saldo_esperado em DINHEIRO no caixa físico:
  -- abertura + vendas em dinheiro + suprimentos − sangrias
  c.valor_abertura
    + COALESCE(SUM(p.total) FILTER (WHERE p.status = 'fechado' AND p.forma_pagamento = 'dinheiro'), 0)
    + COALESCE((SELECT SUM(m.valor) FROM movimentacoes_caixa m WHERE m.caixa_id = c.id AND m.tipo = 'suprimento'), 0)
    - COALESCE((SELECT SUM(m.valor) FROM movimentacoes_caixa m WHERE m.caixa_id = c.id AND m.tipo = 'sangria'),    0)
    AS saldo_esperado,
  c.observacoes,
  COUNT(p.id) FILTER (WHERE p.status = 'cancelado')                                               AS total_cancelados,
  COALESCE(SUM(p.total) FILTER (WHERE p.status = 'fechado' AND p.forma_pagamento = 'debito'),   0) AS total_debito,
  COALESCE(SUM(p.total) FILTER (WHERE p.status = 'fechado' AND p.forma_pagamento = 'credito'),  0) AS total_credito,
  COALESCE(SUM(p.total) FILTER (WHERE p.status = 'fechado' AND p.forma_pagamento = 'voucher'),  0) AS total_voucher,
  -- Movimentações manuais de caixa
  COALESCE((SELECT SUM(m.valor) FROM movimentacoes_caixa m WHERE m.caixa_id = c.id AND m.tipo = 'sangria'),    0) AS total_sangria,
  COALESCE((SELECT SUM(m.valor) FROM movimentacoes_caixa m WHERE m.caixa_id = c.id AND m.tipo = 'suprimento'), 0) AS total_suprimento,
  -- Descontos e acréscimos concedidos nas vendas
  COALESCE(SUM(p.desconto)  FILTER (WHERE p.status = 'fechado'), 0) AS total_desconto,
  COALESCE(SUM(p.acrescimo) FILTER (WHERE p.status = 'fechado'), 0) AS total_acrescimo
FROM caixas c
LEFT JOIN pedidos p ON p.caixa_id = c.id
GROUP BY c.id, c.aberto_por, c.aberto_em, c.fechado_por, c.fechado_em,
         c.status, c.valor_abertura, c.valor_contado, c.diferenca, c.observacoes;

-- ── VIEW: dashboard ───────────────────────────────────────────
DROP VIEW IF EXISTS vw_dashboard;
CREATE VIEW vw_dashboard AS
SELECT
  (SELECT COUNT(*) FROM mesas)                                    AS total_mesas,
  (SELECT COUNT(*) FROM mesas WHERE status = 'ocupada')           AS mesas_ocupadas,
  (SELECT COUNT(*) FROM mesas WHERE status = 'livre')             AS mesas_livres,
  (SELECT COALESCE(SUM(total), 0) FROM pedidos
    WHERE status = 'fechado'
    AND DATE(fechado_em) = CURRENT_DATE)                          AS total_vendido_hoje,
  (SELECT COUNT(*) FROM pedidos
    WHERE status = 'fechado'
    AND DATE(fechado_em) = CURRENT_DATE)                          AS pedidos_hoje,
  (SELECT id FROM caixas WHERE status = 'aberto' LIMIT 1)         AS caixa_aberto_id;

-- ── FUNÇÃO + TRIGGER: atualizar total do pedido ──────────────
CREATE OR REPLACE FUNCTION fn_atualizar_total_pedido()
RETURNS TRIGGER AS $$
DECLARE
  v_pedido_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_pedido_id := OLD.pedido_id;
  ELSE
    v_pedido_id := NEW.pedido_id;
  END IF;

  -- total final = soma dos itens − desconto + acréscimo (nunca negativo)
  UPDATE pedidos
     SET total = GREATEST(0,
       (SELECT COALESCE(SUM(subtotal), 0) FROM itens_pedido WHERE pedido_id = v_pedido_id)
       - COALESCE(desconto, 0) + COALESCE(acrescimo, 0)
     )
   WHERE id = v_pedido_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_atualizar_total ON itens_pedido;
CREATE TRIGGER trg_atualizar_total
  AFTER INSERT OR UPDATE OR DELETE ON itens_pedido
  FOR EACH ROW EXECUTE PROCEDURE fn_atualizar_total_pedido();

SELECT 'Schema aplicado com sucesso!' AS resultado;
