#!/bin/bash

# Script de setup pour le système de vérification de permis ZK
# Ce script compile le circuit, effectue le trusted setup et génère les clés

echo "🚀 Initialisation du système de vérification de permis ZK"
echo "=================================================="

# Vérifier que les outils nécessaires sont installés
check_dependencies() {
    echo "🔍 Vérification des dépendances..."
    
    if ! command -v circom &> /dev/null; then
        echo "❌ circom n'est pas installé"
        echo "Installez-le avec: npm install -g circom"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js n'est pas installé"
        exit 1
    fi
    
    echo "✅ Toutes les dépendances sont présentes"
}

# Installer les packages npm nécessaires
install_packages() {
    echo "📦 Installation des packages npm..."
    
    if [ ! -f "package.json" ]; then
        npm init -y
    fi
    
    npm install snarkjs circomlib ffjavascript
    
    echo "✅ Packages installés"
}

# Compiler le circuit
compile_circuit() {
    echo "🔨 Compilation du circuit..."
    
    # Créer le répertoire de sortie
    mkdir -p build
    
    # Compiler le circuit
    circom -l ./node_modules/ build/licenseA.circom --r1cs --wasm --sym -o build/ 
    
    if [ $? -eq 0 ]; then
        echo "✅ Circuit compilé avec succès"
    else
        echo "❌ Erreur lors de la compilation du circuit"
        exit 1
    fi
}

# Effectuer le trusted setup
trusted_setup() {
    echo "🔐 Trusted setup en cours..."
    
    cd build
    
    # Phase 1: Powers of Tau ceremony
    echo "Phase 1: Powers of Tau ceremony..."
    if [ ! -d "data/ptau" ]; then
        mkdir -p data/ptau
    fi
    if [ ! -f "data/ptau/pot18_0000.ptau" ]; then
        touch data/ptau/pot18_0000.ptau
    fi
    if [ ! -f "data/ptau/pot18_beacon.ptau" ]; then
        touch data/ptau/pot18_beacon.ptau
    fi
    if [ ! -f "data/ptau/pot18_final.ptau" ]; then

        cd data/ptau
        beacon_entropy="$(head -c 32 /dev/urandom | xxd -p -c 32)"
        echo "Création de la ceremony Powers of Tau..."
        snarkjs powersoftau new bn128 18 pot18_0000.ptau -v
        echo "Contribution 1..."
        snarkjs powersoftau contribute pot18_0000.ptau pot18_0001.ptau --name="Contrib 1" --entropy="$(head -c 64 /dev/urandom | base64)" -v
        echo "Contribution 2..."
        snarkjs powersoftau contribute pot18_0001.ptau pot18_0002.ptau --name="Contrib 2" --entropy="$(head -c 64 /dev/urandom | base64)" -v
        echo "Finalisation de la phase 1 avec le beacon..."
        snarkjs powersoftau beacon pot18_0002.ptau pot18_beacon.ptau  "$beacon_entropy" 10 -v
        echo "Préparation de la phase 2..."
        snarkjs powersoftau prepare phase2 pot18_beacon.ptau pot18_final.ptau -v
        echo "✅ Phase 1 terminée"
        cd ../..
    else
        echo "La ceremony Powers of Tau est déjà terminée."
    fi
    
    # Phase 2: Circuit-specific setup
    set -e  # Stop on error

    echo "🔧 Phase 2 : Circuit-specific setup..."
    
    # Définir les chemins
    R1CS="proof_of_license.r1cs"
    PTAU="data/ptau/pot18_final.ptau"
    ZKEY0="proof_of_license_0000.zkey"
    ZKEY1="proof_of_license_0001.zkey"
    ZKEY_FINAL="proof_of_license_final.zkey"
    VKEY_JSON="verification_key.json"

    if [ ! -f "$ZKEY_FINAL" ] || [ ! -f "$VKEY_JSON" ]; then
        
        # Étape 1 : Génération initiale du zkey
        echo "📦 Setup initial du circuit..."
        snarkjs zkey new $R1CS $PTAU $ZKEY0

        # Étape 2 : Contribution au zkey
        echo "🧑‍💻 Contribution au zkey..."
        snarkjs zkey contribute $ZKEY0 $ZKEY1 --name="Contribution circuit" --entropy="$(head -c 64 /dev/urandom | base64)"

        # Étape 3 : Beacon pour sécuriser le zkey final
        echo "⚡ Beacon pour finaliser le zkey..."
        snarkjs zkey beacon $ZKEY1 $ZKEY_FINAL \
        "$(head -c 32 /dev/urandom | xxd -p -c 32)" \
        10 -v

        # Étape 4 : Export de la clé de vérification
        echo "🔐 Export de la clé de vérification..."
        snarkjs zkey export verificationkey $ZKEY_FINAL $VKEY_JSON
        echo "✅ Phase 2 terminée avec succès"
        cd ..
    
        # Copier les fichiers nécessaires dans le répertoire principal
        cp build/proof_of_license_js/proof_of_license.wasm ./
        cp build/proof_of_license_final.zkey ./
        cp build/verification_key.json ./
    else
        echo "Les fichiers de setup existent déjà, aucune action nécessaire."
        cd ..
    fi

    
    
    
    echo "✅ Trusted setup terminé"
}

# Créer un fichier de test
create_test_file() {
    echo "📝 Création du fichier de test..."
    
    cat > test_verification.js << 'EOF'
const { LicenseVerificationSystem, createTestUser } = require('./license_verification.js');

async function testSystem() {
    console.log('🧪 Test du système de vérification');
    
    const system = new LicenseVerificationSystem();
    await system.initialize();
    
    // Test avec un utilisateur valide (permis A)
    console.log('\n--- Test utilisateur valide ---');
    const validUser = createTestUser('Jean', 'Durand', '2000-01-01', 'A', '2026-01-01');
    const result1 = await system.demo();
    console.log('Résultat:', result1);
    
    // Test avec un utilisateur invalide (permis B)
    console.log('\n--- Test utilisateur invalide ---');
    try {
        const invalidUser = createTestUser('Marie', 'Martin', '1995-05-15', 'B', '2025-12-31');
        const proofData = await system.generateProof(invalidUser);
        const isValid = await system.verifyProof(proofData.proof, proofData.publicSignals);
        console.log('Résultat preuve permis B:', isValid); // Devrait être false
    } catch (error) {
        console.log('✅ Erreur attendue pour permis B:', error.message);
    }
}

testSystem().catch(console.error);
EOF
    
    echo "✅ Fichier de test créé"
}

# Créer le package.json s'il n'existe pas
create_package_json() {
    if [ ! -f "package.json" ]; then
        cat > package.json << 'EOF'
{
  "name": "zk-license-verification",
  "version": "1.0.0",
  "description": "Système de vérification de permis zero-knowledge",
  "main": "license_verification.js",
  "scripts": {
    "setup": "./setup.sh",
    "test": "node test_verification.js",
    "demo": "node license_verification.js"
  },
  "dependencies": {
    "snarkjs": "^0.7.0",
    "circomlib": "^2.0.5",
    "ffjavascript": "^0.2.60"
  },
  "keywords": ["zero-knowledge", "zk-snarks", "identity", "verification"],
  "author": "Assistant",
  "license": "MIT"
}
EOF
    fi
}

# Fonction principale
main() {
    check_dependencies
    create_package_json
    install_packages
    compile_circuit
    trusted_setup
    create_test_file
    
    echo ""
    echo "🎉 Setup terminé avec succès!"
    echo "=================================================="
    echo "Fichiers générés:"
    echo "  - proof_of_license.wasm (circuit compilé)"
    echo "  - proof_of_license_final.zkey (clé de proving)"
    echo "  - verification_key.json (clé de vérification)"
    echo "  - license_verification.js (système principal)"
    echo "  - test_verification.js (tests)"
    echo ""
    echo "Pour tester le système:"
    echo "  npm run demo    # Démonstration complète"
    echo "  npm test        # Tests approfondis"
    echo ""
    echo "Le système est prêt à être utilisé! 🚀"
}

# Exécuter le script principal
main
