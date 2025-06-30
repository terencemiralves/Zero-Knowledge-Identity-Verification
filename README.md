# ZKP License Verification JS

Application Node.js pour la vérification de permis utilisant des preuves à divulgation nulle de connaissance (Zero-Knowledge Proofs).

## 🚀 Installation

```bash
# Cloner le repository
git clone <repository-url>
cd Zero-Knowledge-Identity-Verification

# Installer les dépendances
npm install

# Démarrer l'application
npm start
```

## 📁 Fichiers requis

Placez ces fichiers dans le dossier racine de l'application :

- `circuit.wasm` ou `LicenseA.wasm` - Fichier WASM du circuit
- `circuit.zkey` - Clé de preuve
- `verification_key.json` - Clé de vérification  
- `generate_witness.js` - Script de génération de witness

## 🎯 Fonctionnalités

### Génération de Preuve
- Interface interactive pour saisir les informations (nom, prénom, date de naissance, type de permis)
- Validation automatique des entrées
- Génération de preuves ZKP compatibles avec l'interface HTML
- Sauvegarde optionnelle des preuves générées

### Vérification de Preuve
- Chargement de preuves depuis des fichiers ou saisie manuelle
- Vérification cryptographique des preuves
- Analyse des signaux publics
- Rapport détaillé de vérification

### Gestion des Fichiers
- Détection automatique des fichiers requis
- Configuration manuelle des chemins de fichiers
- Recherche automatique dans plusieurs dossiers
- Status en temps réel des fichiers

## 💻 Utilisation

L'application propose un menu interactif avec les options suivantes :

1. **Générer une preuve** - Créer une nouvelle preuve ZKP
2. **Vérifier une preuve** - Vérifier une preuve existante
3. **Gérer les fichiers** - Configurer les chemins des fichiers requis
4. **Rafraîchir le statut** - Vérifier à nouveau les fichiers requis

## 🔧 Configuration

### Formats d'entrée

- **Nom/Prénom** : Maximum 16 caractères ASCII
- **Date de naissance** : Format YYYY-MM-DD
- **Type de permis** : A (Moto), B (Voiture), C (Camion)

## 🛠️ Développement

### Scripts disponibles

```bash
npm run setup     # Pour regénérer les fichiers nécessaires
npm start     # Démarrer l'application
npm run dev   # Mode développement avec auto-reload
```

### Structure du projet

```
src/
├── app.js                 # Application principale
├── proof-generator.js     # Générateur de preuves
├── proof-verifier.js      # Vérificateur de preuves
└── utils.js              # Fonctions utilitaires
data/
├── circuit.wasm           # Fichier WASM du circuit
├── circuit.zkey           # Clé de preuve
├── verification_key.json  # Clé de vérification
├── generate_witness.cjs    # Script de génération de witness
└── witness_calculator.cjs # Calculateur de witness
```

## 🔒 Sécurité

- Validation stricte de tous les inputs
- Gestion sécurisée des fichiers cryptographiques
- Vérification de l'intégrité des preuves
- Aucune donnée sensible stockée en mémoire

## 🐛 Dépannage

### Erreurs communes

1. **Fichiers manquants** : Vérifiez que tous les fichiers requis sont dans le bon dossier
2. **Format invalide** : Respectez les formats d'entrée spécifiés
3. **Erreur de circuit** : Assurez-vous que les fichiers WASM et zkey correspondent

### Logs et debugging

L'application affiche des logs détaillés pour faciliter le debugging. Utilisez `npm run dev` pour le mode développement.
