-- PATCH: Corrige trigger de atualização de total (compatível com PG 9.6)
-- Execute este arquivo UMA VEZ se o migrate já foi rodado anteriormente:
-- psql -U postgres -d lanchonete -f src/config/patch-trigger.sql

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

  UPDATE pedidos
     SET total = (
       SELECT COALESCE(SUM(subtotal), 0)
         FROM itens_pedido
        WHERE pedido_id = v_pedido_id
     )
   WHERE id = v_pedido_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_atualizar_total ON itens_pedido;
CREATE TRIGGER trg_atualizar_total
  AFTER INSERT OR UPDATE OR DELETE ON itens_pedido
  FOR EACH ROW EXECUTE PROCEDURE fn_atualizar_total_pedido();

SELECT 'Trigger corrigido com sucesso!' AS resultado;
