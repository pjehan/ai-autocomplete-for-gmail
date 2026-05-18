# Chrome Extension Email Autocomplete

Extension Chrome qui ajoute de l'autocomplétion intelligente dans la fenêtre de rédaction de Gmail, en s'appuyant sur le modèle de langage **intégré au navigateur** (`LanguageModel` API) — aucun appel à un service externe.

## Fonctionnement

Pendant la rédaction d'un email, l'extension interroge le modèle local du navigateur avec :

- le **sujet** de l'email,
- les **messages cités** (réponses/transferts),
- le **brouillon en cours** avec la position exacte du curseur.

La suggestion apparaît en **texte fantôme** (gris clair) directement dans la zone de saisie :

- **Tab** → accepter la suggestion
- **Échap** → refuser / annuler
- Toute frappe → annule la suggestion en cours et replanifie une nouvelle génération après le délai configuré

Un indicateur visuel (petit rond coloré) dans la fenêtre de rédaction ainsi que le badge de l'icône d'extension reflètent l'état du modèle :

| Couleur | Signification |
|---------|---------------|
| Vert | Modèle disponible |
| Jaune (tournant) | Génération en cours |
| Rouge | Modèle indisponible |

## Prérequis

L'extension requiert **Chrome avec l'API `LanguageModel` activée** (modèle Gemini Nano embarqué).

Pour vérifier et activer cette fonctionnalité :

1. Ouvrir `chrome://flags/#optimization-guide-on-device-model` → **Enabled BypassPerfRequirement**
2. Ouvrir `chrome://flags/#prompt-api-for-gemini-nano` → **Enabled**
3. Redémarrer Chrome
4. Attendre le téléchargement du modèle (peut prendre quelques minutes) — vérifiable via `chrome://components` → *Optimization Guide On Device Model*

## Installation

1. Télécharger ou cloner ce dépôt
2. Dans Chrome, aller sur `chrome://extensions`
3. Activer le **Mode développeur** (interrupteur en haut à droite)
4. Cliquer sur **Charger l'extension non empaquetée**
5. Sélectionner le dossier du projet

Aucune étape de build n'est nécessaire — l'extension est en JavaScript vanilla.

## Utilisation

1. Ouvrir Gmail dans Chrome
2. Commencer à rédiger un email
3. Après le délai configuré (défaut : 600 ms), une suggestion apparaît en gris dans la zone de saisie
4. Appuyer sur **Tab** pour insérer la suggestion, ou continuer à taper pour l'ignorer

## Configuration

Cliquer sur l'icône de l'extension → **Settings** pour accéder aux réglages :

- **Trigger Delay** : délai en millisecondes après la dernière frappe avant de déclencher une suggestion (défaut : 600 ms)
- **Language** : langue cible pour les suggestions générées (défaut : automatique)

Les paramètres sont synchronisés via `chrome.storage.sync` et s'appliquent immédiatement sans recharger la page.

## Structure des fichiers

```
chrome-extension-email-autocomplete/
├── manifest.json      # Manifest V3 de l'extension
├── content.js         # Script injecté dans Gmail — logique principale
├── background.js      # Service worker — gestion du badge de l'icône
├── popup.html         # Interface du popup (clic sur l'icône)
├── popup.js           # Script du popup
├── options.html       # Page de paramètres
├── options.js         # Script de la page de paramètres
├── styles.css         # Styles du texte fantôme et de l'indicateur
└── README.md
```

## Compatibilité

- Chrome avec le **Prompt API / LanguageModel** disponible (voir Prérequis)
- Interface web Gmail (`mail.google.com`)
- Ne nécessite pas Gmail Labs

## Problèmes connus

- Si le modèle n'est pas encore téléchargé (`LanguageModel.availability()` retourne `'downloading'`), l'indicateur reste en état de chargement jusqu'à disponibilité.
- Certains thèmes Gmail peuvent nécessiter un rechargement de la page après installation de l'extension.

## Bugs connus dans le code

Quelques anomalies identifiées lors de l'analyse :

- **`options.js:52`** — faute de syntaxe : `{ triggerDelay, language]` (crochet fermant au lieu d'accolade)
- **`options.js`** — délai par défaut `500` ms incohérent avec `content.js` qui utilise `600` ms
- **`options.html`** — l'option `auto` est absente du sélecteur de langue alors que c'est la valeur par défaut dans `content.js`
- **`popup.js:26`** — précédence des opérateurs : `tab && tab.url.includes(…) || tab.url.includes(…)` ne protège pas correctement le second `includes` d'un `tab` nul
- **`popup.html:61`** — balise `<div>` non fermée dans le bloc de statut
- **`manifest.json`** — la permission `tabs` est manquante alors que `popup.js` appelle `chrome.tabs.query`

## Licence

MIT
