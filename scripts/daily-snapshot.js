// scripts/daily-snapshot.js
// Calcule la valeur du patrimoine en temps réel pour chaque utilisateur :
//   - Prix des positions boursières récupérés depuis Yahoo Finance
//   - Solde fixe des comptes Livret / Immo / Autre pris depuis Supabase
// Insère un point dans patrimoine_history (upsert sur user_id + date).
//
// Variables d'environnement requises :
//   SUPA_URL            → URL de ton projet Supabase
//   SUPA_KEY            → Service Role Key Supabase
//   SNAPSHOT_USER_IDS   → UUIDs séparés par une virgule

import { createClient } from '@supabase/supabase-js';

const SUPA_URL = process.env.SUPA_URL;
const SUPA_KEY = process.env.SUPA_KEY;
const USER_IDS = (process.env.USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

// Cloudflare Worker Yahoo Finance proxy
const YF_WORKER = 'https://yf-proxy.viqmusic-promo.workers.dev';
const YF_BASE   = 'https://query1.finance.yahoo.com';

// Types de comptes à solde fixe (pas de positions de marché)
const FIXED_ACCOUNT_TYPES = new Set(['Livret', 'Immo', 'Autre']);

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

// Récupère le prix actuel d'un symbole via Yahoo Finance
async function fetchPrice(symbol) {
  const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const url = YF_BASE + path;
  try {
    const res = await fetch(`${YF_WORKER}?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const price = result?.meta?.regularMarketPrice
               || result?.indicators?.quote?.[0]?.close?.slice(-1)[0];
    if (!price) throw new Error('prix introuvable');
    return price;
  } catch (e) {
    console.warn(`  ⚠ fetchPrice(${symbol}) → ${e.message}`);
    return null;
  }
}

async function snapshotUser(userId) {
  // 1. Récupérer les comptes
  const { data: accounts, error: accErr } = await sb
    .from('accounts')
    .select('id, type, solde')
    .eq('user_id', userId);
  if (accErr) throw new Error(`accounts error: ${accErr.message}`);

  // Somme des comptes à solde fixe
  const fixedTotal = accounts
    .filter(a => FIXED_ACCOUNT_TYPES.has(a.type))
    .reduce((s, a) => s + (parseFloat(a.solde) || 0), 0);

  const fixedIds = new Set(
    accounts.filter(a => FIXED_ACCOUNT_TYPES.has(a.type)).map(a => a.id)
  );

  // 2. Récupérer les positions de marché
  const { data: positions, error: posErr } = await sb
    .from('positions')
    .select('symbol, qty, account_id')
    .eq('user_id', userId);
  if (posErr) throw new Error(`positions error: ${posErr.message}`);

  const marketPositions = positions.filter(p => !fixedIds.has(p.account_id));

  // 3. Regrouper par symbole pour minimiser les appels Yahoo Finance
  const symbolMap = {};
  for (const p of marketPositions) {
    symbolMap[p.symbol] = (symbolMap[p.symbol] || 0) + parseFloat(p.qty || 0);
  }

  // 4. Récupérer les prix en parallèle
  const symbols = Object.keys(symbolMap);
  console.log(`  Fetching ${symbols.length} prix : ${symbols.join(', ')}`);

  const priceEntries = await Promise.all(
    symbols.map(async sym => [sym, await fetchPrice(sym)])
  );
  const prices = Object.fromEntries(priceEntries);

  // 5. Calculer la valeur totale
  let posTotal = 0;
  let missingPrices = 0;
  for (const [sym, qty] of Object.entries(symbolMap)) {
    const price = prices[sym];
    if (price == null) { missingPrices++; continue; }
    posTotal += price * qty;
  }

  if (missingPrices > 0) {
    console.warn(`  ⚠ ${missingPrices} symbole(s) sans prix — valeur partielle`);
  }

  const totalValue = Math.round((posTotal + fixedTotal) * 100) / 100;

  // 6. Upsert dans patrimoine_history
  const { error: upsertErr } = await sb
    .from('patrimoine_history')
    .upsert(
      { user_id: userId, date: today, value: totalValue },
      { onConflict: 'user_id,date' }
    );
  if (upsertErr) throw new Error(`upsert error: ${upsertErr.message}`);

  console.log(`✓ ${userId.slice(0, 8)}… → ${totalValue.toLocaleString('fr-FR')} € (${today})`);
  console.log(`  dont positions marché : ${Math.round(posTotal).toLocaleString('fr-FR')} € | fixe : ${Math.round(fixedTotal).toLocaleString('fr-FR')} €`);
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
