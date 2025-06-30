import fs from 'fs-extra';
import * as snarkjs from 'snarkjs';
import { parsePublicSignals } from './utils.js';

export class ProofVerifier {
    async verifyProof(proofInput, publicSignalsInput, vkeyPath) {
        try {
            // Extraction intelligente des données selon le format
            const { proof, publicSignals } = this.extractProofData(proofInput, publicSignalsInput);
            
            // Validation préalable
            await this.validateProofConsistency(proof, publicSignals, vkeyPath);

            // Chargement de la clé de vérification
            const vkeyData = await fs.readJson(vkeyPath);

            console.log('🔍 Vérification de la preuve...');
            console.log('📋 Debug - Signaux publics utilisés:', JSON.stringify(publicSignals));

            // Vérification avec snarkjs
            const isValid = await snarkjs.groth16.verify(
                vkeyData,
                publicSignals,
                proof
            );

            // Analyse des signaux publics
            const signalInfo = parsePublicSignals(publicSignals);

            // Préparation du résultat
            const result = {
                valid: isValid,
                publicSignals: publicSignals,
                hasLicenseA: signalInfo.hasLicenseA,
                verification_time: new Date().toISOString(),
                status: isValid ? 'PREUVE VALIDE ✅' : 'PREUVE INVALIDE ❌',
                metadata: {
                    verifier_version: '1.0.0',
                    snarkjs_version: '0.7.4',
                    verification_key: vkeyPath,
                    proof_format: this.detectProofFormat(proofInput)
                }
            };

            return result;

        } catch (error) {
            throw new Error(`Erreur lors de la vérification: ${error.message}`);
        }
    }

    /**
     * Extrait intelligemment les données de preuve selon le format
     */
    extractProofData(proofInput, publicSignalsInput) {
        let proof, publicSignals;

        // Cas 1: proofInput contient déjà tout (fichier complet)
        if (proofInput && typeof proofInput === 'object') {
            if (proofInput.proof && proofInput.publicSignals) {
                // Format: { proof: {...}, publicSignals: [...], ... }
                console.log('📋 Format détecté: Fichier complet avec proof et publicSignals');
                proof = proofInput.proof;
                publicSignals = proofInput.publicSignals;
            } else if (proofInput.pi_a && proofInput.pi_b && proofInput.pi_c) {
                // Format: { pi_a: [...], pi_b: [...], pi_c: [...] }
                console.log('📋 Format détecté: Preuve directe');
                proof = proofInput;
                
                // Utiliser publicSignalsInput s'il est fourni, sinon indiquer qu'il manque
                if (publicSignalsInput && Array.isArray(publicSignalsInput)) {
                    publicSignals = publicSignalsInput;
                } else {
                    // Retourner un objet spécial pour indiquer que les signaux manquent
                    return { 
                        proof, 
                        publicSignals: null, 
                        missingPublicSignals: true 
                    };
                }
            } else {
                throw new Error('Format de preuve non reconnu. Fichier doit contenir pi_a, pi_b, pi_c ou proof/publicSignals');
            }
        } else {
            throw new Error('Données de preuve invalides');
        }

        return { proof, publicSignals };
    }

    /**
     * Détecte le format de la preuve pour les logs
     */
    detectProofFormat(proofInput) {
        if (proofInput.proof && proofInput.publicSignals) {
            return 'complete_file';
        } else if (proofInput.pi_a) {
            return 'proof_only';
        } else {
            return 'unknown';
        }
    }

    /**
     * Valide le format de la preuve
     */
    validateProofFormat(proof) {
        const requiredFields = ['pi_a', 'pi_b', 'pi_c'];
        
        for (const field of requiredFields) {
            if (!proof[field]) {
                throw new Error(`Champ manquant dans la preuve: ${field}`);
            }
        }

        // Validation supplémentaire de la structure
        if (!Array.isArray(proof.pi_a) || proof.pi_a.length !== 3) {
            throw new Error('Format invalide pour pi_a (doit être un tableau de 3 éléments)');
        }
        if (!Array.isArray(proof.pi_b) || proof.pi_b.length !== 3 || !Array.isArray(proof.pi_b[0])) {
            throw new Error('Format invalide pour pi_b (doit être un tableau de 3 tableaux)');
        }
        if (!Array.isArray(proof.pi_c) || proof.pi_c.length !== 3) {
            throw new Error('Format invalide pour pi_c (doit être un tableau de 3 éléments)');
        }

        return true;
    }

    /**
     * Valide le format des signaux publics
     */
    validatePublicSignals(signals) {
        if (!signals) {
            throw new Error('Signaux publics manquants');
        }
        
        if (!Array.isArray(signals)) {
            throw new Error('Les signaux publics doivent être un tableau');
        }

        if (signals.length === 0) {
            throw new Error('Aucun signal public fourni');
        }

        // Validation que tous les signaux sont des nombres ou des chaînes numériques
        for (let i = 0; i < signals.length; i++) {
            const signal = signals[i];
            if (typeof signal !== 'string' && typeof signal !== 'number') {
                throw new Error(`Signal public à l'index ${i} doit être un nombre ou une chaîne numérique`);
            }
            
            // Si c'est une chaîne, vérifier qu'elle représente un nombre
            if (typeof signal === 'string' && !/^\d+$/.test(signal)) {
                throw new Error(`Signal public à l'index ${i} contient une chaîne non numérique: "${signal}"`);
            }
        }

        return true;
    }

    /**
     * Vérifie la cohérence entre preuve et signaux
     */
    async validateProofConsistency(proof, publicSignals, vkeyPath) {
        try {
            this.validateProofFormat(proof);
            this.validatePublicSignals(publicSignals);

            // Vérification que la clé de vérification existe
            const vkeyExists = await fs.pathExists(vkeyPath);
            if (!vkeyExists) {
                throw new Error('Fichier de clé de vérification non trouvé');
            }

            // Validation de la clé de vérification
            try {
                const vkeyData = await fs.readJson(vkeyPath);
                if (!vkeyData.vk_alpha_1 || !vkeyData.vk_beta_2 || !vkeyData.vk_gamma_2 || !vkeyData.vk_delta_2) {
                    throw new Error('Structure de clé de vérification invalide');
                }
            } catch (jsonError) {
                throw new Error(`Erreur de lecture de la clé de vérification: ${jsonError.message}`);
            }

            return true;
        } catch (error) {
            throw new Error(`Validation échouée: ${error.message}`);
        }
    }

    /**
     * Affiche les informations de debug pour le dépannage
     */
    debugProofStructure(proofInput) {
        console.log('🐛 Debug - Structure de l\'input:');
        
        if (typeof proofInput === 'object') {
            const keys = Object.keys(proofInput);
            console.log(`   Clés disponibles: ${keys.join(', ')}`);
            
            if (proofInput.proof) {
                console.log('   Contient une propriété "proof"');
                console.log(`   Type de proof: ${typeof proofInput.proof}`);
                if (typeof proofInput.proof === 'object') {
                    console.log(`   Clés de proof: ${Object.keys(proofInput.proof).join(', ')}`);
                }
            }
            
            if (proofInput.publicSignals) {
                console.log('   Contient une propriété "publicSignals"');
                console.log(`   Type: ${typeof proofInput.publicSignals}`);
                console.log(`   Longueur: ${Array.isArray(proofInput.publicSignals) ? proofInput.publicSignals.length : 'N/A'}`);
            } else {
                console.log('   ⚠️  Pas de propriété "publicSignals" trouvée');
            }
            
            if (proofInput.pi_a) {
                console.log('   Contient pi_a directement');
                console.log('   ⚠️  Signaux publics requis séparément');
            }
        }
    }
}