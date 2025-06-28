/**
 * Vérificateur de preuves ZK pour le système de permis
 * Ce module peut être utilisé de manière indépendante pour vérifier des preuves
 */

const fs = require('fs');
const path = require('path');
const snarkjs = require('snarkjs');

class ProofVerifier {
    constructor(verificationKeyPath = './verification_key.json') {
        this.verificationKeyPath = verificationKeyPath;
        this.verificationKey = null;
    }

    /**
     * Initialise le vérificateur en chargeant la clé de vérification
     */
    async initialize() {
        try {
            if (!fs.existsSync(this.verificationKeyPath)) {
                throw new Error(`Clé de vérification non trouvée: ${this.verificationKeyPath}`);
            }

            const keyData = fs.readFileSync(this.verificationKeyPath, 'utf8');
            this.verificationKey = JSON.parse(keyData);
            
            console.log('✅ Vérificateur initialisé avec succès');
            return true;
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation du vérificateur:', error.message);
            throw error;
        }
    }

    /**
     * Vérifie une preuve ZK
     */
    async verifyProof(proof, publicSignals) {
        if (!this.verificationKey) {
            throw new Error('Vérificateur non initialisé. Appelez initialize() d\'abord.');
        }

        try {
            console.log('🔍 Vérification de la preuve en cours...');
            
            const startTime = Date.now();
            const isValid = await snarkjs.groth16.verify(this.verificationKey, publicSignals, proof);
            const verificationTime = Date.now() - startTime;

            console.log(`⏱️  Temps de vérification: ${verificationTime}ms`);
            
            if (isValid) {
                console.log('✅ Preuve VALIDE - Le détenteur possède un permis de type A');
                return {
                    valid: true,
                    verificationTime,
                    message: 'Preuve valide'
                };
            } else {
                console.log('❌ Preuve INVALIDE');
                return {
                    valid: false,
                    verificationTime,
                    message: 'Preuve invalide'
                };
            }
        } catch (error) {
            console.error('❌ Erreur lors de la vérification:', error.message);
            return {
                valid: false,
                error: error.message,
                message: 'Erreur de vérification'
            };
        }
    }

    /**
     * Vérifie une preuve depuis un fichier JSON
     */
    async verifyProofFromFile(proofFilePath) {
        try {
            if (!fs.existsSync(proofFilePath)) {
                throw new Error(`Fichier de preuve non trouvé: ${proofFilePath}`);
            }

            const proofData = JSON.parse(fs.readFileSync(proofFilePath, 'utf8'));
            
            if (!proofData.proof || !proofData.publicSignals) {
                throw new Error('Format de fichier de preuve invalide');
            }

            console.log(`📂 Vérification de la preuve depuis: ${proofFilePath}`);
            return await this.verifyProof(proofData.proof, proofData.publicSignals);
            
        } catch (error) {
            console.error('❌ Erreur lors du chargement du fichier de preuve:', error.message);
            throw error;
        }
    }

    /**
     * Extrait les informations publiques d'une preuve
     */
    extractPublicInfo(publicSignals) {
        try {
            // Les signaux publics contiennent les informations non-sensibles
            // Dans notre cas: nom, prénom, et commitment
            
            const info = {
                publicName: this.signalsToString(publicSignals.slice(0, 64)),
                publicSurname: this.signalsToString(publicSignals.slice(64, 128)),
                commitment: this.signalsToBinaryString(publicSignals.slice(128, 384))
            };

            return info;
        } catch (error) {
            console.error('Erreur lors de l\'extraction des informations publiques:', error.message);
            return null;
        }
    }

    /**
     * Convertit des signaux en chaîne de caractères
     */
    signalsToString(signals) {
        return signals
            .map(signal => String.fromCharCode(parseInt(signal)))
            .join('')
            .replace(/\0/g, '');
    }

    /**
     * Convertit des signaux binaires en chaîne
     */
    signalsToBinaryString(signals) {
        return signals.map(s => s.toString()).join('');
    }

    /**
     * Vérifie plusieurs preuves en lot
     */
    async batchVerify(proofs) {
        console.log(`🔄 Vérification en lot de ${proofs.length} preuves...`);
        
        const results = [];
        let validCount = 0;
        const startTime = Date.now();

        for (let i = 0; i < proofs.length; i++) {
            console.log(`\n--- Preuve ${i + 1}/${proofs.length} ---`);
            
            try {
                const result = await this.verifyProof(proofs[i].proof, proofs[i].publicSignals);
                results.push({
                    index: i,
                    ...result
                });
                
                if (result.valid) {
                    validCount++;
                }
            } catch (error) {
                results.push({
                    index: i,
                    valid: false,
                    error: error.message
                });
            }
        }

        const totalTime = Date.now() - startTime;
        
        console.log(`\n📊 Résultats de la vérification en lot:`);
        console.log(`Total: ${proofs.length} preuves`);
        console.log(`Valides: ${validCount}`);
        console.log(`Invalides: ${proofs.length - validCount}`);
        console.log(`Temps total: ${totalTime}ms`);
        console.log(`Temps moyen par preuve: ${(totalTime / proofs.length).toFixed(2)}ms`);

        return {
            total: proofs.length,
            valid: validCount,
            invalid: proofs.length - validCount,
            totalTime,
            averageTime: totalTime / proofs.length,
            results
        };
    }

    /**
     * Génère un rapport de vérification
     */
    generateVerificationReport(verificationResult, outputPath = './verification_report.json') {
        const report = {
            timestamp: new Date().toISOString(),
            verificationResult,
            verifier: 'ProofVerifier v1.0',
            summary: {
                isValid: verificationResult.valid,
                verificationTime: verificationResult.verificationTime || 0,
                message: verificationResult.message
            }
        };

        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
        console.log(`📄 Rapport de vérification sauvegardé: ${outputPath}`);
        
        return report;
    }

    /**
     * Utilitaire pour vérifier le format d'une preuve
     */
    static validateProofFormat(proofData) {
        const requiredFields = ['proof', 'publicSignals'];
        const proofFields = ['pi_a', 'pi_b', 'pi_c'];

        // Vérifier la structure principale
        for (const field of requiredFields) {
            if (!proofData[field]) {
                return { valid: false, error: `Champ manquant: ${field}` };
            }
        }

        // Vérifier la structure de la preuve
        for (const field of proofFields) {
            if (!proofData.proof[field]) {
                return { valid: false, error: `Champ de preuve manquant: ${field}` };
            }
        }

        // Vérifier que publicSignals est un tableau
        if (!Array.isArray(proofData.publicSignals)) {
            return { valid: false, error: 'publicSignals doit être un tableau' };
        }

        return { valid: true };
    }
}

// Utilitaire pour créer un vérificateur rapide
async function quickVerify(proofFilePath, verificationKeyPath = './verification_key.json') {
    const verifier = new ProofVerifier(verificationKeyPath);
    await verifier.initialize();
    return await verifier.verifyProofFromFile(proofFilePath);
}

// Export pour utilisation en module
module.exports = {
    ProofVerifier,
    quickVerify
};

// Exécution directe du script
if (require.main === module) {
    async function main() {
        console.log('🔍 Vérificateur de preuves ZK - Mode test');
        console.log('==========================================');

        const verifier = new ProofVerifier();
        
        try {
            await verifier.initialize();
            
            // Chercher des preuves à vérifier
            const proofFiles = [
                './generated_proof.json',
                './test_proof.json',
                './example_proof.json'
            ];

            let foundProofs = false;
            
            for (const proofFile of proofFiles) {
                if (fs.existsSync(proofFile)) {
                    console.log(`\n📂 Vérification de ${proofFile}...`);
                    
                    try {
                        const result = await verifier.verifyProofFromFile(proofFile);
                        verifier.generateVerificationReport(result, `${proofFile}_report.json`);
                        foundProofs = true;
                    } catch (error) {
                        console.error(`❌ Erreur avec ${proofFile}:`, error.message);
                    }
                }
            }
            
            if (!foundProofs) {
                console.log('ℹ️  Aucune preuve trouvée pour la vérification');
                console.log('   Générez d\'abord une preuve avec: node license_verification.js');
            }
            
        } catch (error) {
            console.error('❌ Erreur fatale:', error.message);
            process.exit(1);
        }
    }
    
    main().catch(console.error);
}
