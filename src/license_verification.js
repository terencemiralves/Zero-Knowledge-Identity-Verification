const fs = require('fs');
const path = require('path');
const circomlib = require('circomlib');
const crypto = require('crypto');
const snarkjs = require('snarkjs');

class LicenseVerificationSystem {
    constructor() {
        this.circuitWasm = null;
        this.circuitZkey = null;
        this.verificationKey = null;
    }

    /**
     * Initialise le système avec les clés de vérification
     */
    async initialize() {
        try {
            // Charger les fichiers générés par le processus de setup
            this.circuitWasm = path.join(__dirname, 'proof_of_license.wasm');
            this.circuitZkey = path.join(__dirname, 'proof_of_license_final.zkey');
            this.verificationKey = JSON.parse(
                fs.readFileSync(path.join(__dirname, 'verification_key.json'), 'utf8')
            );
            
            console.log('✅ Système initialisé avec succès');
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error.message);
            throw error;
        }
    }

    /**
     * Convertit une chaîne en tableau de codes ASCII avec padding
     */
    stringToAsciiArray(str, length) {
        const result = new Array(length).fill(0);
        for (let i = 0; i < Math.min(str.length, length); i++) {
            result[i] = str.charCodeAt(i);
        }
        return result;
    }

    /**
     * Convertit un hash hexadécimal en tableau de bits
     */
    hexToBitArray(hex) {
        const bits = [];
        for (let i = 0; i < hex.length; i += 2) {
            const byte = parseInt(hex.substr(i, 2), 16);
            for (let j = 7; j >= 0; j--) {
                bits.push((byte >> j) & 1);
            }
        }
        return bits;
    }

    /**
     * Génère un nonce aléatoire de 8 caractères
     */
    generateNonce() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Calcule le hash SHA256 des données complètes
     */
    calculateCommitment(name, surname, birthDate, license, expDate, nonce) {
        // Concaténer toutes les données
        const nameStr = name.padEnd(64, '\0');
        const surnameStr = surname.padEnd(64, '\0');
        const fullData = nameStr + surnameStr + birthDate + license + expDate + nonce;
        
        // Calculer le hash SHA256
        const hash = crypto.createHash('sha256');
        hash.update(fullData, 'utf8');
        return hash.digest('hex');
    }

    /**
     * Génère les inputs pour le circuit
     */
    generateCircuitInputs(userData) {
        const {
            name,
            surname,
            birthDate,
            license,
            expDate,
            nonce
        } = userData;

        // Calculer le commitment
        const commitmentHex = this.calculateCommitment(name, surname, birthDate, license, expDate, nonce);
        
        return {
            // Entrées publiques
            pubName: this.stringToAsciiArray(name, 64),
            pubSurname: this.stringToAsciiArray(surname, 64),
            commitment: this.hexToBitArray(commitmentHex),
            
            // Entrées privées
            privDate: this.stringToAsciiArray(birthDate, 10),
            privLicense: this.stringToAsciiArray(license, 1),
            privExpDate: this.stringToAsciiArray(expDate, 10),
            nonce: this.stringToAsciiArray(nonce, 8)
        };
    }

    /**
     * Génère une preuve ZK
     */
    async generateProof(userData) {
        try {
            console.log('🔄 Génération de la preuve...');
            
            // Générer un nonce si non fourni
            if (!userData.nonce) {
                userData.nonce = this.generateNonce();
            }

            // Générer les inputs du circuit
            const circuitInputs = this.generateCircuitInputs(userData);
            
            console.log('📝 Inputs générés:', {
                pubName: userData.name,
                pubSurname: userData.surname,
                commitment: this.calculateCommitment(
                    userData.name, userData.surname, userData.birthDate,
                    userData.license, userData.expDate, userData.nonce
                )
            });

            console.log('Generation du witness');
            // Générer le witness
            const { witness } = await snarkjs.wtns.calculate(circuitInputs, this.circuitWasm);
            console.log('Witness generer.');
            
            // Générer la preuve
            const { proof, publicSignals } = await snarkjs.groth16.prove(this.circuitZkey, witness);

            console.log('✅ Preuve générée avec succès');
            
            return {
                proof,
                publicSignals,
                commitment: this.calculateCommitment(
                    userData.name, userData.surname, userData.birthDate,
                    userData.license, userData.expDate, userData.nonce
                ),
                nonce: userData.nonce
            };

        } catch (error) {
            console.error('❌ Erreur lors de la génération de la preuve:', error.message);
            throw error;
        }
    }

    /**
     * Vérifie une preuve ZK
     */
    async verifyProof(proof, publicSignals) {
        try {
            console.log('🔍 Vérification de la preuve...');
            
            const isValid = await snarkjs.groth16.verify(this.verificationKey, publicSignals, proof);
            
            if (isValid) {
                console.log('✅ Preuve valide - Le détenteur possède bien un permis de type A');
            } else {
                console.log('❌ Preuve invalide');
            }
            
            return isValid;
        } catch (error) {
            console.error('❌ Erreur lors de la vérification:', error.message);
            throw error;
        }
    }

    /**
     * Démo complète du système
     */
    async demo() {
        console.log('🚀 Démonstration du système de vérification de permis ZK\n');

        // Données d'exemple
        const userData = {
            name: 'Jean',
            surname: 'Durand',
            birthDate: '2000-01-01',
            license: 'A',
            expDate: '2026-01-01'
        };

        console.log('👤 Données utilisateur:', userData);

        try {
            // Générer la preuve
            const proofData = await this.generateProof(userData);
            
            // Sauvegarder la preuve
            fs.writeFileSync(
                path.join(__dirname, 'generated_proof.json'),
                JSON.stringify(proofData, null, 2)
            );
            
            console.log('💾 Preuve sauvegardée dans generated_proof.json');

            // Vérifier la preuve
            const isValid = await this.verifyProof(proofData.proof, proofData.publicSignals);
            
            return {
                success: true,
                proofGenerated: true,
                proofValid: isValid,
                commitment: proofData.commitment
            };

        } catch (error) {
            console.error('❌ Erreur dans la démo:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Fonction utilitaire pour créer un utilisateur de test
function createTestUser(name, surname, birthDate, license, expDate) {
    return {
        name,
        surname,
        birthDate,
        license,
        expDate
    };
}

// Export pour utilisation en module
module.exports = {
    LicenseVerificationSystem,
    createTestUser
};

// Exécution directe du script
if (require.main === module) {
    async function main() {
        const system = new LicenseVerificationSystem();
        
        try {
            await system.initialize();
            await system.demo();
        } catch (error) {
            console.error('Erreur fatale:', error.message);
            process.exit(1);
        }
    }
    
    main();
}
