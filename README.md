# Moumix Finance

Tableau de bord personnel de suivi de patrimoine : comptes, positions, historique, prélèvements, projections et objectifs. Le frontend reste en HTML/CSS/JavaScript vanilla, avec Supabase pour l'authentification et les données.

## Mise à jour sans perte de données

Cette version ne lance aucune migration et ne modifie pas automatiquement le schéma Supabase.

- Les identifiants et colonnes existants sont conservés.
- Aucune commande `DROP TABLE`, `TRUNCATE` ou suppression globale n'est utilisée.
- Une sauvegarde ne supprime plus les lignes absentes de l'état local.
- Les suppressions sont explicites et vérifiées côté Supabase avant de modifier l'interface.
- Le fichier `supabase_shema.sql` sert uniquement à une **nouvelle installation**. Ne pas l'exécuter aveuglément sur une base existante.
- Les corrections du snapshot quotidien concernent uniquement les futurs points d'historique.

Pour remplacer une version déjà en ligne, il suffit donc de déployer les fichiers statiques et le script GitHub Actions. Aucun SQL n'est requis.

## Fonctionnalités

- Vue d'ensemble avec total, capital investi, plus-value et filtres par type de compte
- Allocation cohérente avec les filtres actifs
- Historique global du patrimoine, import manuel ou CSV et jalons patrimoniaux
- Comptes PEA, CTO, PEE, PER, assurance-vie, crypto, livret, immobilier et autres
- Positions avec recherche, tri, PRU, cours, valeur, P&L et tendance
- Achats, ventes au prix réellement exécuté et historique des transactions
- Prélèvements récurrents avec répartition et totaux mensuel/annuel
- Projections d'intérêts composés et objectifs d'épargne
- Export local de toutes les données au format JSON
- Interface responsive, navigation mobile fixe, zones sûres iOS et raccourcis clavier
- Manifest et service worker pour l'installation comme application
- Snapshot quotidien en EUR, compatible avec les changements d'heure Paris

Les cours proviennent de Yahoo Finance. Ils peuvent être différés selon le marché : l'interface parle donc de « dernier cours » et conserve l'ancienne valeur lorsqu'une cotation est indisponible.

## Structure

```text
Moumix-Finance/
├── index.html
├── manifest.json
├── sw.js
├── apple-touch-icon.png
├── icon-192.png
├── icon-512.png
├── CHANGELOG_MODIFS.md
├── supabase_shema.sql
├── scripts/
│   └── daily-snapshot.js
├── .github/workflows/
│   └── daily-snapshot.yml
├── package.json
└── robots.txt
```

## Déploiement

### 1. Base Supabase

Pour une nouvelle base vide :

1. Créer un projet sur [Supabase](https://supabase.com).
2. Ouvrir le SQL Editor.
3. Exécuter `supabase_shema.sql` une seule fois.
4. Vérifier que l'authentification email/mot de passe est activée.

Le schéma crée les six tables utilisées par l'application, les index, les clés étrangères, les politiques RLS et les droits du rôle `authenticated`.

Pour une base Moumix déjà utilisée, ne rien exécuter : cette mise à jour frontend est compatible avec les données présentes.

### 2. Configuration du frontend

Dans `index.html`, renseigner les constantes :

```js
const SUPA_URL = 'https://VOTRE_PROJET.supabase.co';
const SUPA_KEY = 'VOTRE_CLE_ANON';
const YF_WORKER = 'https://yf-proxy.VOTRE_COMPTE.workers.dev';
```

La clé publique `anon` est prévue pour être utilisée dans le navigateur. La protection des données repose sur les politiques RLS. Ne jamais placer la Service Role Key dans `index.html`.

### 3. Proxy Yahoo Finance

Le frontend et le snapshot utilisent un Worker Cloudflare pour appeler Yahoo Finance :

```js
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = url.searchParams.get('url');
    if (!target) return new Response('Missing ?url=', { status: 400 });

    const allowed = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];
    if (!allowed.some(origin => target.startsWith(origin))) {
      return new Response('Forbidden', { status: 403 });
    }

    const response = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
        'Referer': 'https://finance.yahoo.com'
      }
    });

    return new Response(await response.text(), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
```

Remplacer ensuite `YF_WORKER` dans `index.html` et dans `scripts/daily-snapshot.js`.

### 4. Snapshot GitHub Actions

Ajouter ces secrets au dépôt :

| Secret | Valeur |
| --- | --- |
| `SUPA_URL` | URL du projet Supabase |
| `SUPA_SERVICE_KEY` | Service Role Key, uniquement dans GitHub Actions |
| `SNAPSHOT_USER_IDS` | UUID des utilisateurs, séparés par des virgules |

Le workflow se déclenche à 22 h 15 et 23 h 15 UTC. Le script détecte le fuseau `Europe/Paris` et n'écrit que lors du passage correspondant à minuit local, été comme hiver. Un lancement manuel reste possible depuis l'onglet Actions.

Le snapshot :

1. charge les comptes et positions ;
2. récupère chaque cours avec timeout et nouvelles tentatives ;
3. convertit les devises en EUR, y compris les cotations en pence ;
4. annule l'écriture si un cours ou un taux manque ;
5. effectue un upsert sur `(user_id, date)`.

Il ne réécrit jamais les anciens points d'historique.

### 5. Hébergement

Déployer le dossier sur un hébergement statique HTTPS : GitHub Pages, Netlify, Cloudflare Pages ou équivalent. Le service worker n'est pas enregistré depuis une URL `file://`.

Sur iPhone : Safari → Partager → Sur l'écran d'accueil.

## Navigation et raccourcis

- `1`, `2`, `3` : changer d'onglet
- `N` : nouvelle position
- `R` : actualiser les cours
- `/` ou `F` : rechercher une position
- `Échap` : fermer la boîte de dialogue active

Sur mobile, toucher une ligne de position affiche le compte, le type, la quantité, le PRU, le cours et le P&L sans imposer un tableau trop large.

## Import d'historique

Formats acceptés :

```text
2024-05-01;42 730,20
2024-06-01<TAB>48951.53
2024-07-01,50911.21
```

La date peut aussi être saisie sous les formes `DD/MM/YYYY`, `MM/YYYY` ou `mai-25`. Une prévisualisation est affichée avant l'enregistrement.

## Limite du modèle actuel

Moumix suit la valeur des actifs, mais ne tient pas encore un compte espèces automatique : un achat n'en déduit pas le coût et une vente n'ajoute pas son produit à un solde cash. Ajouter ce mécanisme nécessiterait une évolution explicite du modèle de données ; il n'est volontairement pas inclus dans cette mise à jour sans migration.
