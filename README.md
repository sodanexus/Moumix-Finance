# 💰 Moumix Finance

> Dashboard de suivi de patrimoine personnel — single-file, self-hosted, zéro dépendance.

![Static Badge](https://img.shields.io/badge/stack-HTML%20%2F%20JS%20%2F%20Supabase-00e5a0?style=flat-square) ![Static Badge](https://img.shields.io/badge/auth-Supabase%20RLS-0070f3?style=flat-square) ![Static Badge](https://img.shields.io/badge/data-Yahoo%20Finance-ff4466?style=flat-square) ![Static Badge](https://img.shields.io/badge/users-2-ffb400?style=flat-square)

---

## 🧠 C'est quoi

Un fichier HTML unique qui tourne dans le navigateur et qui me permet de suivre l'ensemble de mon patrimoine en temps réel. Pas de serveur, pas de framework, pas de build step. Juste un fichier.

Les données sont persistées dans **Supabase** (PostgreSQL) avec isolation complète par utilisateur via **Row Level Security**. Les cours boursiers sont récupérés en temps réel via **Yahoo Finance** (proxy CORS).

---

## ✨ Fonctionnalités

### 📊 Vue d'ensemble
- Patrimoine total avec compteur animé
- P&L jour et P&L total
- Filtres par type de compte (PEA, CTO, Crypto, Livret…)
- Graphique d'évolution avec périodes 1S / 1M / 3M / 1A / Tout
- Camembert d'allocation interactif
- Répartition par compte

### 📁 Détails
- Gestion multi-comptes (PEA, CTO, PEE, PER, AV, Crypto, Livret, Immo)
- Positions avec cours en temps réel, PRU, P&L, sparklines
- Achat / vente avec recalcul automatique du PRU moyen
- Prélèvements récurrents (courtage, frais, crédit…) avec total mensuel/annuel
- Historique des transactions

### 📈 Simulateur & Objectifs
- Simulateur d'intérêts composés avec 3 scénarios (pessimiste / réaliste / optimiste)
- Presets : Livret A, Fonds €, MSCI World, S&P 500
- Graphique ou tableau de projection
- Objectifs d'épargne avec barre de progression (persistés en Supabase)

### 📰 Actualités
- Feed RSS financier en temps réel (Google News Finance)
- Indices rapides : S&P 500, CAC 40, Euro Stoxx, Bitcoin, Or

---

## 🗄️ Stack technique

| Couche | Techno |
|---|---|
| Frontend | HTML / CSS / Vanilla JS |
| Auth & BDD | Supabase (PostgreSQL + RLS) |
| Prix temps réel | Yahoo Finance API (via proxy CORS) |
| Fonts | Inter, Plus Jakarta Sans, DM Mono |
| Hébergement | N'importe où (fichier statique) |

---

## 🗃️ Schéma base de données

```
auth.users
    │
    ├── accounts          (id text, name, type, solde)
    ├── positions         (id text, symbol, qty, price, current…)
    ├── prelevements      (id text, name, amount, freq, cat)
    ├── transactions      (id text, type, symbol, qty, price, ts)
    ├── patrimoine_history (date text, value numeric) — unique(user_id, date)
    └── goals             (id text, name, target, current, emoji)
```

**RLS activé sur toutes les tables** — chaque utilisateur ne voit et ne modifie que ses propres données.

---

## 🔐 Sécurité

- Authentification par email/mot de passe via Supabase Auth
- Row Level Security sur les 6 tables : `auth.uid() = user_id`
- Nettoyage automatique des tokens expirés au démarrage
- Isolation complète entre les 2 utilisateurs
- Timeout + retry sur le chargement des données

---

## 📂 Structure du projet

```
moumix_finance.html   ← tout est là
README.md
supabase_add_goals.sql  ← migration goals (déjà exécutée)
```

---

## ⚙️ Configuration

Les constantes Supabase sont en haut du script :

```js
const SUPA_URL = 'https://xxxx.supabase.co';
const SUPA_KEY = 'eyJ...';  // anon key publique
```

Les proxies CORS pour Yahoo Finance sont tentés dans l'ordre :
1. `allorigins.win`
2. `corsproxy.io`
3. `thingproxy.freeboard.io`

---

## 🚀 Déploiement

Ouvrir `moumix_finance.html` dans un navigateur. C'est tout.

Peut aussi être hébergé sur GitHub Pages, Netlify, un NAS, une clé USB…

---

## 🐾 Easter egg

Il y a un Shiba Inu en bas à droite qui résume ton patrimoine au chargement. Clique dessus.
