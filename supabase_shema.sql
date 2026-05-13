-- ============================================================
-- schema.sql — Moumix Finance · Schéma Supabase
-- À exécuter dans l'éditeur SQL de votre projet Supabase
-- ============================================================


-- ── TABLE : accounts ─────────────────────────────────────────
-- Comptes patrimoniaux (PEA, CTO, Livret, Immo, Autre…)
CREATE TABLE IF NOT EXISTS accounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('PEA', 'CTO', 'Livret', 'Immo', 'Autre')),
  solde       NUMERIC(15, 2) NOT NULL DEFAULT 0,  -- Solde fixe (pour comptes non-marché)
  currency    TEXT NOT NULL DEFAULT 'EUR',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounts_user_isolation" ON accounts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ── TABLE : positions ─────────────────────────────────────────
-- Positions boursières (ETF, actions…) rattachées à un compte
CREATE TABLE IF NOT EXISTS positions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  symbol      TEXT NOT NULL,       -- Ticker Yahoo Finance (ex: "IWDA.AS")
  qty         NUMERIC(15, 6) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_positions_user_id    ON positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_account_id ON positions(account_id);
CREATE INDEX IF NOT EXISTS idx_positions_symbol     ON positions(symbol);

ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "positions_user_isolation" ON positions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ── TABLE : patrimoine_history ────────────────────────────────
-- Historique journalier de la valeur totale du patrimoine
-- Alimenté automatiquement par le script GitHub Actions daily-snapshot.js
CREATE TABLE IF NOT EXISTS patrimoine_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  value       NUMERIC(15, 2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Un seul snapshot par utilisateur par jour
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_patrimoine_user_date ON patrimoine_history(user_id, date DESC);

ALTER TABLE patrimoine_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patrimoine_user_isolation" ON patrimoine_history
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ── Triggers updated_at ───────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_positions_updated_at
  BEFORE UPDATE ON positions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── Grants explicites (requis depuis mai 2026) ────────────────
-- Accès service_role uniquement (GitHub Actions via SUPA_KEY)
-- Les utilisateurs accèdent via RLS avec le rôle authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.positions          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patrimoine_history TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts           TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.positions          TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patrimoine_history TO service_role;
