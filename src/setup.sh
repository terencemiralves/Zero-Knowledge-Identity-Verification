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
    circom -l ./node_modules/ ./data/proof_license/licenseA.circom --r1cs --wasm --sym -o build/ 
    
    if [ $? -eq 0 ]; then
        echo "✅ Circuit compilé avec succès"
    else
        echo "❌ Erreur lors de la compilation du circuit"
        exit 1
    fi

    circom -l ./node_modules/ ./data/Is18/Is18.circom --r1cs --wasm --sym -o build/ 
    
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
    if [ ! -d "ptau" ]; then
        mkdir -p ptau
    fi
    if [ ! -f "ptau/pot18_0000.ptau" ]; then
        touch ptau/pot18_0000.ptau
    fi
    if [ ! -f "ptau/pot18_beacon.ptau" ]; then
        touch ptau/pot18_beacon.ptau
    fi
    if [ ! -f "ptau/pot18_final.ptau" ]; then

        cd ptau
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
        # wget https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_18.ptau -O pot18_final.ptau

        cd ..
    else
        echo "La ceremony Powers of Tau est déjà terminée."
    fi
    
    # Phase 2: Circuit-specific setup
    set -e  # Stop on error

    echo "🔧 Phase 2 : Circuit-specific setup..."
    
    # Définir les chemins
    R1CS="licenseA.r1cs"
    PTAU="ptau/pot18_final.ptau"
    ZKEY0="key_0000.zkey"
    ZKEY1="key_0001.zkey"
    ZKEY_FINAL="key_final.zkey"
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
        cp build/licenseA_js/licenseA.wasm data/proof_license/circuit.wasm
        cp build/key_final.zkey data/proof_license/circuit.zkey
        cp build/verification_key.json data/proof_license/verification_key.json
        cp build/licenseA_js/generate_witness.js data/proof_license/generate_witness.cjs
        cp build/licenseA_js/witness_calculator.js data/proof_license/witness_calculator.cjs
        sed -i 's|require("./witness_calculator.js")|require("./witness_calculator.cjs")|' data/proof_license/generate_witness.cjs
    else
        echo "Les fichiers de setup existent déjà, aucune action nécessaire."
        cd ..
    fi

    R1CS="Is18.r1cs"
    PTAU="ptau/pot18_final.ptau"
    ZKEY0="is18_key_0000.zkey"
    ZKEY1="is18_key_0001.zkey"
    ZKEY_FINAL="is18_key_final.zkey"
    VKEY_JSON="is18_verification_key.json"

    if [ ! -f "$ZKEY_FINAL" ] || [ ! -f "$VKEY_JSON" ]; then
        cd build
        
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
        cp build/Is18_js/Is18.wasm data/Is18/circuit.wasm
        cp build/is18_key_final.zkey data/Is18/circuit.zkey
        cp build/is18_verification_key.json data/Is18/verification_key.json
        cp build/Is18_js/generate_witness.js data/Is18/generate_witness.cjs
        cp build/Is18_js/witness_calculator.js data/Is18/witness_calculator.cjs
        sed -i 's|require("./witness_calculator.js")|require("./witness_calculator.cjs")|' data/Is18/generate_witness.cjs
    else
        echo "Les fichiers de setup existent déjà, aucune action nécessaire."
    fi
    echo "✅ Trusted setup terminé"
}


# Fonction principale
main() {
    check_dependencies
    install_packages
    compile_circuit
    trusted_setup    
    echo ""
    echo "🎉 Setup terminé avec succès!"
    echo "=================================================="
    echo "Fichiers générés:"
    echo "  - circuit.wasm (circuit compilé)"
    echo "  - circuit.zkey (clé de proving)"
    echo "  - verification_key.json (clé de vérification)"
    echo ""
    echo "Pour tester le système:"
    echo "  npm start       # Démonstration complète"
    echo ""
    echo "Le système est prêt à être utilisé! 🚀"
}

# Exécuter le script principal
main
