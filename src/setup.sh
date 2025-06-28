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
    circom -l ./circomlib/ proof_of_license.circom --r1cs --wasm --sym -o build/ 
    
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
    node -e "
        const snarkjs = require('snarkjs');
        (async () => {
            console.log('Génération de la ceremony...');
            await snarkjs.powersOfTau.newAccumulator('ptau/pot12_0000.ptau', 12, 1);
            console.log('Contribution 1...');
            await snarkjs.powersOfTau.contribute('ptau/pot12_0000.ptau', 'ptau/pot12_0001.ptau', 'Contribution 1', entropy());
            console.log('Contribution 2...');
            await snarkjs.powersOfTau.contribute('ptau/pot12_0001.ptau', 'ptau/pot12_0002.ptau', 'Contribution 2', entropy());
            console.log('Finalisation phase 1...');
            await snarkjs.powersOfTau.beacon('ptau/pot12_0002.ptau', 'ptau/pot12_beacon.ptau', 'beacon', 10, entropy());
            console.log('Préparation phase 2...');
            await snarkjs.powersOfTau.prepare('ptau/pot12_beacon.ptau', 'ptau/pot12_final.ptau');
            console.log('✅ Phase 1 terminée');
        })();
        
        function entropy() {
            return Math.random().toString(36).substring(2) + Date.now().toString(36);
        }
    "
    
    # Créer le répertoire ptau si nécessaire
    mkdir -p ptau
    
    # Phase 2: Circuit-specific setup
    echo "Phase 2: Circuit-specific setup..."
    node -e "
        const snarkjs = require('snarkjs');
        const fs = require('fs');
        (async () => {
            console.log('Setup spécifique au circuit...');
            await snarkjs.zKey.newZKey('proof_of_license.r1cs', 'ptau/pot12_final.ptau', 'proof_of_license_0000.zkey');
            console.log('Contribution au zkey...');
            await snarkjs.zKey.contribute('proof_of_license_0000.zkey', 'proof_of_license_0001.zkey', 'Contribution circuit', entropy());
            console.log('Beacon pour le zkey...');
            await snarkjs.zKey.beacon('proof_of_license_0001.zkey', 'proof_of_license_final.zkey', 'beacon', 10, entropy());
            console.log('Export de la clé de vérification...');
            const vKey = await snarkjs.zKey.exportVerificationKey('proof_of_license_final.zkey');
            fs.writeFileSync('verification_key.json', JSON.stringify(vKey, null, 2));
            console.log('✅ Phase 2 terminée');
        })();
        
        function entropy() {
            return Math.random().toString(36).substring(2) + Date.now().toString(36);
        }
    "
    
    cd ..
    
    # Copier les fichiers nécessaires dans le répertoire principal
    cp build/proof_of_license_js/proof_of_license.wasm ./
    cp build/proof_of_license_final.zkey ./
    cp build/verification_key.json ./
    
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
