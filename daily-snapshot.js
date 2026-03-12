// scripts/daily-snapshot.js
// Calcule la valeur du patrimoine pour chaque utilisateur et insère un point
// dans patrimoine_history (upsert sur user_id + date → pas de doublon).
//
// Dépendances : @supabase/supabase-js
// Variables d'environnement requises :
//   SUPA_URL            → URL de ton projet Supabase
//   SUPA_KEY            → Service Role Key (pas l'anon key — elle bypasse le RLS)
//   SNAPSHOT_USER_IDS   → IDs des utilisateurs séparés par une virgule
//                         ex: "uuid-user1,uuid-user2"

import { createClient } from '@supabase/supabase-js';

const SUPA_URL = process.env.SUPA_URL;
const SUPA_KEY = process.env.SUPA_KEY;
const USER_IDS = (process.env.USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

if (!SUPA_URL || !SUPA_KEY) {
  console.error('SUPA_URL ou SUPA_KEY manquant');
  process.exit(1);
}
if (USER_IDS.length === 0) {
  console.error('SNAPSHOT_USER_IDS manquant ou vide');
  process.exit(1);
}

const sb = createClient(SUPA_URL, SUPA_KEY, {
  auth: { persistSession: false }
});

const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

async function snapshotUser(userId) {
  // 1. Récupérer toutes les positions de l'utilisateur
  const { data: positions, error: posErr } = await sb
    .from('positions')
    .select('qty, current, accountId')
    .eq('user_id', userId);

  if (posErr) throw new Error(`positions error for ${userId}: ${posErr.message}`);

  // 2. Récupérer les comptes à solde fixe (Livret, Immo, etc.)
  const { data: accounts, error: accErr } = await sb
    .from('accounts')
    .select('type, solde')
    .eq('user_id', userId);

  if (accErr) throw new Error(`accounts error for ${userId}: ${accErr.message}`);

  // Types de comptes à solde fixe (pas de positions boursières)
  const FIXED_TYPES = ['Livret', 'Immo', 'Autre'];
  const fixedTotal = accounts
    .filter(a => FIXED_TYPES.includes(a.type))
    .reduce((s, a) => s + (parseFloat(a.solde) || 0), 0);

  // IDs des comptes fixes pour les exclure du calcul positions
  const { data: fixedAccounts } = await sb
    .from('accounts')
    .select('id')
    .eq('user_id', userId)
    .in('type', FIXED_TYPES);

  const fixedIds = new Set((fixedAccounts || []).map(a => a.id));

  const posTotal = positions
    .filter(p => !fixedIds.has(p.accountId))
    .reduce((s, p) => s + (parseFloat(p.current) || 0) * (parseFloat(p.qty) || 0), 0);

  const totalValue = Math.round((posTotal + fixedTotal) * 100) / 100;

  // 3. Upsert dans patrimoine_history
  const { error: upsertErr } = await sb
    .from('patrimoine_history')
    .upsert(
      { user_id: userId, date: today, value: totalValue },
      { onConflict: 'user_id,date' }
    );

  if (upsertErr) throw new Error(`upsert error for ${userId}: ${upsertErr.message}`);

  console.log(`✓ ${userId.slice(0, 8)}… → ${totalValue.toLocaleString('fr-FR')} € (${today})`);
}

(async () => {
  console.log(`Snapshot du ${today} pour ${USER_IDS.length} utilisateur(s)…\n`);
  let ok = 0;
  for (const uid of USER_IDS) {
    try {
      await snapshotUser(uid);
      ok++;
    } catch (e) {
      console.error(`✗ ${uid.slice(0, 8)}… → ${e.message}`);
    }
  }
  console.log(`\n${ok}/${USER_IDS.length} snapshot(s) OK`);
  if (ok < USER_IDS.length) process.exit(1);
})();
