# Moumix Finance — Dashboard de suivi de patrimoine

> Tableau de bord patrimonial personnel, single-file, self-hosted. Cours boursiers en temps réel, simulation d'intérêts composés, snapshot automatique quotidien. Pas de serveur, pas de framework, zéro dépendance frontend.

![HTML/JS](https://img.shields.io/badge/stack-HTML%20%2F%20JS%20vanilla-black) ![Supabase](https://img.shields.io/badge/base%20de%20données-Supabase-3ECF8E) ![Yahoo Finance](https://img.shields.io/badge/cours-Yahoo%20Finance-FF4466) ![Cloudflare Workers](https://img.shields.io/badge/proxy-Cloudflare%20Workers-F38020) ![GitHub Actions](https://img.shields.io/badge/snapshot-GitHub%20Actions-2088FF)

---

## Ce que ça fait

- 📊 **Patrimoine total en temps réel** — cours Yahoo Finance, P&L jour et total, counter animé
- 🏦 **Multi-comptes** — PEA, CTO, PEE, PER, AV, Crypto, Livret, Immo, Autre
- 📈 **Graphique d'évolution** — périodes 1S / 1M / 3M / 1A / Tout, tooltip interactif
- 🎯 **Simulateur d'intérêts composés** — 3 scénarios, presets Livret A / MSCI World / S&P 500
- 🌍 **Indices & taux en temps réel** — S&P 500, CAC 40, Euro Stoxx, Bitcoin, Or, EUR/USD
- ⏰ **Snapshot automatique quotidien** — GitHub Actions à minuit, persisté dans Supabase
- 📱 **PWA installable** — iOS et Android

---

## Stack

| Couche | Techno |
|---|---|
| Frontend | HTML + CSS + JS vanilla — 1 fichier unique, zéro dépendance |
| Auth & DB | Supabase (Auth + PostgreSQL + RLS) |
| Cours boursiers | Yahoo Finance API |
| Proxy CORS | Cloudflare Worker personnel (100k req/jour gratuit) |
| Snapshot | GitHub Actions — cron quotidien 22h UTC (minuit Paris) |
| Fonts | Inter · Plus Jakarta Sans · DM Mono |
| Hébergement | N'importe où — GitHub Pages, Netlify, NAS, clé USB… |

---

## Structure du projet

```
Moumix-Finance/
├── index.html                          # Toute l'app — HTML + CSS + JS
├── scripts/daily-snapshot.js           # Script Node.js snapshot GitHub Actions
├── .github/workflows/daily-snapshot.yml
├── package.json                        # @supabase/supabase-js (snapshot uniquement)
├── manifest.json                       # PWA manifest
├── apple-touch-icon.png                # Icône iOS
└── robots.txt
```

> L'intégralité du frontend tient dans `index.html`. Le reste ne sert qu'au snapshot automatique.

---

## Déploiement

### 1. Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. **SQL Editor** → créer les 6 tables (schéma ci-dessous)
3. Activer **Row Level Security** sur chaque table
4. **Settings > API** → noter `Project URL` et `anon public key`

#### Schéma des tables

```sql
-- Comptes
CREATE TABLE accounts (
  id TEXT, user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  name TEXT, type TEXT, solde NUMERIC DEFAULT 0
);

-- Positions
CREATE TABLE positions (
  id TEXT, user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  account_id TEXT, symbol TEXT, name TEXT, qty NUMERIC, pru NUMERIC, current NUMERIC
);

-- Prélèvements récurrents
CREATE TABLE prelevements (
  id TEXT, user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  name TEXT, amount NUMERIC, freq TEXT, cat TEXT
);

-- Transactions
CREATE TABLE transactions (
  id TEXT, user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  type TEXT, symbol TEXT, qty NUMERIC, price NUMERIC, ts TIMESTAMPTZ DEFAULT NOW()
);

-- Historique patrimoine (snapshot quotidien)
CREATE TABLE patrimoine_history (
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  date TEXT, value NUMERIC,
  UNIQUE(user_id, date)
);

-- Objectifs
CREATE TABLE goals (
  id TEXT, user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  name TEXT, target NUMERIC, current NUMERIC, emoji TEXT
);
```

Activer RLS + policy `auth.uid() = user_id` sur chaque table.

---

### 2. Cloudflare Worker (proxy Yahoo Finance)

Yahoo Finance bloque les proxies CORS publics. Un Worker Cloudflare personnel règle le problème (100k req/jour gratuit).

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → créer un Worker
2. Coller ce code :

```js
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = url.searchParams.get('url');
    if (!target) return new Response('Missing ?url= parameter', { status: 400 });
    if (!target.startsWith('https://query1.finance.yahoo.com') &&
        !target.startsWith('https://query2.finance.yahoo.com')) {
      return new Response('Forbidden', { status: 403 });
    }
    const response = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://finance.yahoo.com',
      }
    });
    return new Response(await response.text(), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
};
```

3. Déployer → noter l'URL du Worker

> Si le Worker est indisponible, l'app bascule automatiquement sur des proxies publics de fallback (`codetabs`, `corsproxy.io`, `allorigins`).

---

### 3. Configurer index.html

En haut du script dans `index.html`, renseigner :

```js
const SUPA_URL  = 'https://VOTRE_PROJET.supabase.co';
const SUPA_KEY  = 'VOTRE_ANON_KEY';
const YF_WORKER = 'https://yf-proxy.VOTRE_COMPTE.workers.dev';
```

---

### 4. GitHub Actions — snapshot quotidien

Le script `scripts/daily-snapshot.js` tourne chaque soir à **22h UTC (minuit Paris)** via GitHub Actions. Il récupère les cours en temps réel, calcule la valeur du patrimoine de chaque utilisateur et insère un point dans `patrimoine_history`.

Ajouter ces secrets dans **Settings > Secrets > Actions** du repo :

| Secret | Description |
|---|---|
| `SUPA_URL` | URL du projet Supabase |
| `SUPA_SERVICE_KEY` | Service Role Key Supabase (pas l'anon key) |
| `SNAPSHOT_USER_IDS` | UUIDs des utilisateurs séparés par une virgule |

Le workflow peut aussi être déclenché manuellement depuis l'onglet **Actions**.

---

### 5. Héberger et ouvrir

Ouvrir `index.html` directement dans un navigateur — ou déposer sur GitHub Pages, Netlify, un NAS, ou n'importe quel hébergement statique.

**iPhone (PWA)** — Safari → ouvrir le site → **↑** → **"Sur l'écran d'accueil"**

---

## Fonctionnalités détaillées

### Vue d'ensemble
- Patrimoine total avec animation compteur au chargement
- P&L jour et P&L total (gains/pertes en couleur)
- Filtres rapides par type de compte
- Graphique d'évolution interactif (SVG natif) avec tooltip et curseur
- Camembert d'allocation par type de compte
- Top / Flop positions
- Indices marché en temps réel avec flip animation à chaque mise à jour
- Taux EUR/USD en temps réel (masqué sur mobile)
- Banner hors-ligne automatique si la connexion est perdue

### Détails & Positions
- Gestion multi-comptes : PEA · CTO · PEE · PER · AV · Crypto · Livret · Immo · Autre
- Tableau de positions avec cours temps réel, PRU, P&L €, P&L %, sparklines 1M
- Tri par colonne (nom, quantité, valeur, P&L, variation)
- Recherche/filtre dans les positions
- Achat / vente avec recalcul automatique du PRU moyen pondéré
- Confirmation modale avant chaque transaction
- Prélèvements récurrents (courtage, frais, crédit) avec total mensuel et annuel calculé
- Historique complet des transactions avec animations

### Simulateur & Objectifs
- Simulation d'intérêts composés avec 3 scénarios simultanés (pessimiste / réaliste / optimiste)
- Presets : Livret A · Fonds € · MSCI World · S&P 500
- Affichage graphique ou tableau de projection année par année
- Objectifs d'épargne avec barre de progression et émoji personnalisable — persistés dans Supabase

### UX
- Dark mode exclusif, design haute densité
- Raccourcis clavier pour naviguer entre onglets
- Responsive mobile complet (colonnes masquées, layout adapté, bottom sheet modals)
- Animations fluides : compteur, flip indices, skeleton loader, transitions onglets
- Easter egg : un Shiba Inu en bas à droite commente ton patrimoine au chargement 🐕

---

## Base de données

```
auth.users
    │
    ├── accounts           (id, name, type, solde)
    ├── positions          (id, symbol, qty, pru, current, account_id)
    ├── prelevements       (id, name, amount, freq, cat)
    ├── transactions       (id, type, symbol, qty, price, ts)
    ├── patrimoine_history (date, value) — UNIQUE(user_id, date)
    └── goals              (id, name, target, current, emoji)
```

RLS activée sur les 6 tables — chaque utilisateur ne voit et ne modifie que ses propres données via `auth.uid() = user_id`.

---

## Notes techniques

**Proxy Yahoo Finance**
- Worker Cloudflare prioritaire (gratuit jusqu'à 100k req/jour)
- Fallback automatique sur 3 proxies publics si le Worker est indisponible
- Timeout + retry sur chaque appel de prix

**Comptes à solde fixe**
- Les types `Livret`, `Immo` et `Autre` n'ont pas de positions de marché
- Leur valeur est lue directement depuis le champ `solde` en base
- Le snapshot en tient compte correctement

**Sécurité**
- Authentification email/password via Supabase Auth
- Nettoyage automatique des tokens expirés au démarrage
- Isolation complète entre utilisateurs via RLS
- Gestion d'erreurs globale (`window.onerror` + `unhandledrejection`) avec toast et banner
