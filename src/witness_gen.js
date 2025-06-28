/**
 * Générateur de témoins (witnesses) pour le circuit ProofOfLicense
 * Ce fichier contient des utilitaires pour créer et manipuler les témoins
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class WitnessGenerator {
    /**
     * Génère un témoin pour le circuit ProofOfLicense
     */
    static generateWitness(userData) {
        const {
            name,
            surname,
            birthDate,
            license,
            expDate,
            nonce = WitnessGenerator.generateNonce()
        } = userData;

        // Validation des données
        WitnessGenerator.validateUserData(userData);

        // Génération des inputs
        const inputs = {
            // Entrées publiques
            pubName: WitnessGenerator.stringToFixedArray(name, 64),
            pubSurname: WitnessGenerator.stringToFixedArray(surname, 64),
            commitment: WitnessGenerator.calculateCommitmentBits(name, surname, birthDate, license, expDate, nonce),
            
            // Entrées privées
            privDate: WitnessGenerator.stringToFixedArray(birthDate, 10),
            privLicense: WitnessGenerator.stringToFixedArray(license, 1),
            privExpDate: WitnessGenerator.stringToFixedArray(expDate, 10),
            nonce: WitnessGenerator.stringToFixedArray(nonce, 8)
        };

        return {
            inputs,
            nonce,
            commitment: WitnessGenerator.calculateCommitmentHex(name, surname, birthDate, license, expDate, nonce)
        };
    }

    /**
     * Valide les données utilisateur
     */
    static validateUserData(userData) {
        const { name, surname, birthDate, license, expDate } = userData;

        if (!name || name.length === 0) {
            throw new Error('Le nom est requis');
        }
        if (!surname || surname.length === 0) {
            throw new Error('Le prénom est requis');
        }
        if (!birthDate || !WitnessGenerator.isValidDate(birthDate)) {
            throw new Error('Date de naissance invalide (format attendu: YYYY-MM-DD)');
        }
        if (!license || license.length !== 1) {
            throw new Error('Type de permis invalide (un seul caractère attendu)');
        }
        if (!expDate || !WitnessGenerator.isValidDate(expDate)) {
            throw new Error('Date d\'expiration invalide (format attendu: YYYY-MM-DD)');
        }

        // Vérification de la longueur maximale
        if (name.length > 64) {
            throw new Error('Le nom ne peut pas dépasser 64 caractères');
        }
        if (surname.length > 64) {
            throw new Error('Le prénom ne peut pas dépasser 64 caractères');
        }
    }

    /**
     * Vérifie si une date est valide au format YYYY-MM-DD
     */
    static isValidDate(dateString) {
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!regex.test(dateString)) return false;
        
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date) && date.toISOString().slice(0, 10) === dateString;
    }

    /**
     * Convertit une chaîne en tableau de codes ASCII avec padding
     */
    static stringToFixedArray(str, length) {
        const result = new Array(length).fill(0);
        for (let i = 0; i < Math.min(str.length, length); i++) {
            result[i] = str.charCodeAt(i);
        }
        return result;
    }

    /**
     * Génère un nonce aléatoire
     */
    static generateNonce(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Calcule le commitment en hexadécimal
     */
    static calculateCommitmentHex(name, surname, birthDate, license, expDate, nonce) {
        const nameStr = name.padEnd(64, '\0');
        const surnameStr = surname.padEnd(64, '\0');
        const fullData = nameStr + surnameStr + birthDate + license + expDate + nonce;
        
        const hash = crypto.createHash('sha256');
        hash.update(fullData, 'utf8');
        return hash.digest('hex');
    }

    /**
     * Calcule le commitment sous forme de tableau de bits
     */
    static calculateCommitmentBits(name, surname, birthDate, license, expDate, nonce) {
        const hex = WitnessGenerator.calculateCommitmentHex(name, surname, birthDate, license, expDate, nonce);
        return WitnessGenerator.hexToBitArray(hex);
    }

    /**
     * Convertit un hash hexadécimal en tableau de bits
     */
    static hexToBitArray(hex) {
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
     * Convertit un tableau de bits en hexadécimal
     */
    static bitArrayToHex(bits) {
        let hex = '';
        for (let i = 0; i < bits.length; i += 8) {
            let byte = 0;
            for (let j = 0; j < 8; j++) {
                if (i + j < bits.length) {
                    byte += bits[i + j] * Math.pow(2, 7 - j);
                }
            }
            hex += byte.toString(16).padStart(2, '0');
        }
        return hex;
    }

    /**
     * Sauvegarde un témoin dans un fichier JSON
     */
    static saveWitness(witness, filename = 'witness.json') {
        const witnessData = {
            timestamp: new Date().toISOString(),
            inputs: witness.inputs,
            nonce: witness.nonce,
            commitment: witness.commitment
        };

        fs.writeFileSync(filename, JSON.stringify(witnessData, null, 2));
        console.log(`✅ Témoin sauvegardé dans ${filename}`);
    }

    /**
     * Charge un témoin depuis un fichier JSON
     */
    static loadWitness(filename = 'witness.json') {
        if (!fs.existsSync(filename)) {
            throw new Error(`Le fichier ${filename} n'existe pas`);
        }

        const data = fs.readFileSync(filename, 'utf8');
        const witnessData = JSON.parse(data);
        
        return {
            inputs: witnessData.inputs,
            nonce: witnessData.nonce,
            commitment: witnessData.commitment,
            timestamp: witnessData.timestamp
        };
    }

    /**
     * Génère plusieurs témoins pour des tests
     */
    static generateTestWitnesses() {
        const testCases = [
            {
                name: 'Jean',
                surname: 'Durand',
                birthDate: '2000-01-01',
                license: 'A',
                expDate: '2026-01-01'
            },
            {
                name: 'Marie',
                surname: 'Martin',
                birthDate: '1995-05-15',
                license: 'A',
                expDate: '2025-12-31'
            },
            {
                name: 'Pierre',
                surname: 'Dubois',
                birthDate: '1990-03-20',
                license: 'A',
                expDate: '2027-03-20'
            }
        ];

        const witnesses = [];
        testCases.forEach((testCase, index) => {
            const witness = WitnessGenerator.generateWitness(testCase);
            witnesses.push(witness);
            WitnessGenerator.saveWitness(witness, `test_witness_${index + 1}.json`);
        });

        console.log(`✅ ${witnesses.length} témoins de test générés`);
        return witnesses;
    }

    /**
     * Affiche les détails d'un témoin
     */
    static displayWitness(witness) {
        console.log('📋 Détails du témoin:');
        console.log('--------------------');
        console.log(`Nom: ${String.fromCharCode(...witness.inputs.pubName).replace(/\0/g, '')}`);
        console.log(`Prénom: ${String.fromCharCode(...witness.inputs.pubSurname).replace(/\0/g, '')}`);
        console.log(`Date de naissance: ${String.fromCharCode(...witness.inputs.privDate)}`);
        console.log(`Type de permis: ${String.fromCharCode(...witness.inputs.privLicense)}`);
        console.log(`Date d'expiration: ${String.fromCharCode(...witness.inputs.privExpDate)}`);
        console.log(`Nonce: ${witness.nonce}`);
        console.log(`Commitment: ${witness.commitment}`);
        console.log('--------------------');
    }

    /**
     * Vérifie la cohérence d'un témoin
     */
    static validateWitness(witness) {
        try {
            const name = String.fromCharCode(...witness.inputs.pubName).replace(/\0/g, '');
            const surname = String.fromCharCode(...witness.inputs.pubSurname).replace(/\0/g, '');
            const birthDate = String.fromCharCode(...witness.inputs.privDate);
            const license = String.fromCharCode(...witness.inputs.privLicense);
            const expDate = String.fromCharCode(...witness.inputs.privExpDate);
            const nonce = witness.nonce;

            // Recalculer le commitment
            const expectedCommitment = WitnessGenerator.calculateCommitmentHex(
                name, surname, birthDate, license, expDate, nonce
            );

            if (expectedCommitment === witness.commitment) {
                console.log('✅ Témoin valide');
                return true;
            } else {
                console.log('❌ Témoin invalide - commitment ne correspond pas');
                console.log(`Attendu: ${expectedCommitment}`);
                console.log(`Obtenu: ${witness.commitment}`);
                return false;
            }
        } catch (error) {
            console.log('❌ Erreur lors de la validation du témoin:', error.message);
            return false;
        }
    }
}

// Export pour utilisation en module
module.exports = WitnessGenerator;

// Exécution directe du script pour des tests
if (require.main === module) {
    console.log('🔧 Générateur de témoins - Mode test');
    console.log('====================================');

    try {
        // Générer un témoin de test
        const testUser = {
            name: 'Jean',
            surname: 'Durand',
            birthDate: '2000-01-01',
            license: 'A',
            expDate: '2026-01-01'
        };

        console.log('\n📝 Génération d\'un témoin de test...');
        const witness = WitnessGenerator.generateWitness(testUser);
        
        WitnessGenerator.displayWitness(witness);
        
        console.log('\n🔍 Validation du témoin...');
        WitnessGenerator.validateWitness(witness);
        
        console.log('\n💾 Sauvegarde du témoin...');
        WitnessGenerator.saveWitness(witness, 'example_witness.json');
        
        console.log('\n📂 Génération de témoins de test multiples...');
        WitnessGenerator.generateTestWitnesses();
        
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}
