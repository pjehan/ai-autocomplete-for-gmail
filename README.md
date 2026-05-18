# AI autocomplete for Gmail

Extension Chrome qui ajoute de l'autocomplétion intelligente dans la fenêtre de rédaction de Gmail, en s'appuyant sur un modèle de langage au choix :

- **Gemini Nano** — modèle intégré au navigateur, aucune clé API requise
- **Claude (Anthropic)** — modèle externe via l'API Anthropic

## Fonctionnement

Pendant la rédaction d'un email, l'extension envoie au modèle :

- l'**identité Gmail** de l'utilisateur,
- le **sujet** de l'email,
- le **fil de conversation** (messages précédents cités),
- le **brouillon en cours** avec la position exacte du curseur.

La suggestion apparaît en **texte fantôme** (gris clair) directement dans la zone de saisie :

- **Tab** → accepter la suggestion
- **Échap** → refuser / annuler
- Toute frappe → annule la suggestion et replanifie une nouvelle génération

Un indicateur visuel (petit rond animé) apparaît à côté du curseur pendant la génération. Le badge de l'icône de l'extension reflète l'état du modèle.

## Prérequis

### Gemini Nano (modèle intégré)

Requiert **Chrome 127+** avec le Prompt API activé :

1. `chrome://flags/#optimization-guide-on-device-model` → **Enabled BypassPerfRequirement**
2. `chrome://flags/#prompt-api-for-gemini-nano` → **Enabled**
3. Redémarrer Chrome
4. Attendre le téléchargement du modèle — vérifiable via `chrome://components` → *Optimization Guide On Device Model*

### Claude (Anthropic)

Une clé API Anthropic est nécessaire. Elle se configure dans **Paramètres du modèle** (page d'options de l'extension).

## Installation

1. Télécharger ou cloner ce dépôt
2. Dans Chrome, aller sur `chrome://extensions`
3. Activer le **Mode développeur** (interrupteur en haut à droite)
4. Cliquer sur **Charger l'extension non empaquetée**
5. Sélectionner le dossier du projet

Aucune étape de build n'est nécessaire — l'extension est en JavaScript vanilla.

## Utilisation

1. Ouvrir Gmail dans Chrome
2. Commencer à rédiger un email ou répondre à une conversation
3. En mode **automatique** : après le délai configuré (défaut : 600 ms), une suggestion apparaît en gris dans la zone de saisie
4. En mode **manuel** : appuyer sur **Ctrl+Espace** pour déclencher une suggestion
5. Appuyer sur **Tab** pour insérer la suggestion, ou continuer à taper pour l'ignorer

## Configuration

Cliquer sur l'icône de l'extension pour accéder aux réglages rapides :

| Paramètre | Description | Défaut |
|-----------|-------------|--------|
| Déclenchement | Automatique ou manuel (Ctrl+Espace) | Automatique |
| Délai automatique | Millisecondes après la dernière frappe | 600 ms |
| Langue de sortie | Langue des suggestions générées | Automatique |

Cliquer sur **Paramètres du modèle →** pour configurer le fournisseur LLM :

| Paramètre | Description |
|-----------|-------------|
| Fournisseur | Gemini Nano (navigateur) ou Claude (Anthropic) |
| Clé API Claude | Clé API Anthropic (si fournisseur Claude) |
| Modèle Claude | Haiku 4.5 / Sonnet 4.6 / Opus 4.7 |

Les paramètres sont synchronisés via `chrome.storage.sync` et s'appliquent immédiatement.

## Structure des fichiers

```
chrome-extension-email-autocomplete/
├── manifest.json      # Manifest V3 de l'extension
├── content.js         # Script injecté dans Gmail — logique principale
├── background.js      # Service worker — gestion du badge de l'icône
├── popup.html         # Interface du popup (clic sur l'icône)
├── popup.js           # Script du popup
├── options.html       # Page de paramètres du modèle LLM
├── options.js         # Script de la page de paramètres
├── styles.css         # Styles du texte fantôme et de l'indicateur
└── README.md
```

## Compatibilité

- Chrome 127+ (Gemini Nano) ou tout Chrome récent (Claude)
- Interface web Gmail (`mail.google.com`)
- Ne nécessite pas Gmail Labs

## Licence

MIT
