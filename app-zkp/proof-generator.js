import fs from 'fs-extra';
import * as snarkjs from 'snarkjs';
import { stringToAsciiArray, formatDateToAscii } from './utils.js';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ProofGenerator {
    async generateProof(userInput, files) {
        try {
            // Validation des inputs
            this.validateInputs(userInput);

            // Vérification que le script witness est disponible
            if (!files.witness || !await fs.pathExists(files.witness)) {
                throw new Error('Script generate_witness.js requis mais non trouvé. Cette application nécessite le script externe.');
            }

            // Préparation des inputs pour le circuit
            const input = {
                name: stringToAsciiArray(userInput.name, 16),
                surname: stringToAsciiArray(userInput.surname, 16),
                dob: formatDateToAscii(userInput.dob),
                license: [userInput.license.charCodeAt(0)]
            };

            console.log('📝 Input préparé:', JSON.stringify(input, null, 2));

            // Génération de la preuve avec script externe uniquement
            const result = await this.generateProofWithExternalScript(input, files, userInput);

            return result;

        } catch (error) {
            throw new Error(`Erreur lors de la génération de preuve: ${error.message}`);
        }
    }

    async generateProofWithExternalScript(input, files, originalInput) {
        try {
            console.log('🔧 Génération avec script externe exclusivement...');
            
            // Vérification que tous les fichiers requis existent
            const requiredFiles = {
                wasm: files.wasm,
                zkey: files.zkey,
                witness: files.witness
            };

            for (const [key, filePath] of Object.entries(requiredFiles)) {
                if (!filePath || !await fs.pathExists(filePath)) {
                    throw new Error(`Fichier ${key} requis mais introuvable: ${filePath || 'non spécifié'}`);
                }
            }

            // Création du dossier temporaire
            const tempDir = path.join(__dirname, 'temp');
            await fs.ensureDir(tempDir);
            
            const timestamp = Date.now();
            const inputFile = path.join(tempDir, `input_${timestamp}.json`);
            const witnessFile = path.join(tempDir, `witness_${timestamp}.wtns`);

            try {
                // Écriture du fichier d'input
                await fs.writeJson(inputFile, input, { spaces: 2 });
                console.log(`📁 Input écrit dans: ${inputFile}`);

                // Génération du witness avec votre script
                console.log('🔧 Génération du witness avec script externe...');
                await this.generateWitnessWithExternalScript(
                    files.wasm, 
                    inputFile, 
                    witnessFile, 
                    files.witness
                );

                // Lecture du witness généré
                const witnessBuffer = await fs.readFile(witnessFile);
                console.log(`✅ Witness généré (${witnessBuffer.length} bytes)`);

                // Génération de la preuve avec snarkjs (seulement pour la preuve, pas le witness)
                console.log('🔐 Génération de la preuve avec snarkjs...');
                const zkeyBuffer = await fs.readFile(files.zkey);
                const { proof, publicSignals } = await snarkjs.groth16.prove(
                    zkeyBuffer,
                    witnessBuffer
                );

                console.log('✅ Preuve générée avec succès!');

                // Préparation du résultat
                const result = {
                    proof: proof,
                    publicSignals: publicSignals,
                    timestamp: new Date().toISOString(),
                    input_info: {
                        name: originalInput.name,
                        surname: originalInput.surname,
                        dob: originalInput.dob,
                        license: originalInput.license,
                        hasLicenseA: publicSignals[0] === '1'
                    },
                    metadata: {
                        circuit_files: {
                            wasm: files.wasm,
                            zkey: files.zkey,
                            witness_script: files.witness
                        },
                        snarkjs_version: '0.7.4',
                        method: 'external_witness_script_only',
                        witness_generator: 'custom_script'
                    }
                };

                // Nettoyage des fichiers temporaires
                await this.cleanupTempFiles([inputFile, witnessFile]);

                return result;

            } catch (error) {
                // Nettoyage en cas d'erreur
                await this.cleanupTempFiles([inputFile, witnessFile]);
                throw error;
            }

        } catch (error) {
            throw new Error(`Génération de preuve échouée: ${error.message}`);
        }
    }

    async generateWitnessWithExternalScript(wasmFile, inputFile, outputFile, witnessScript) {
        try {
            console.log(`🔧 Exécution du script witness: ${witnessScript}`);
            console.log(`📄 WASM: ${wasmFile}`);
            console.log(`📄 Input: ${inputFile}`);
            console.log(`📄 Output: ${outputFile}`);

            // Construction de la commande
            const command = `node "${witnessScript}" "${wasmFile}" "${inputFile}" "${outputFile}"`;
            console.log(`🚀 Commande: ${command}`);

            // Exécution du script avec timeout étendu
            const { stdout, stderr } = await execAsync(command, {
                cwd: path.dirname(witnessScript),
                timeout: 60000, // 60 secondes timeout
                maxBuffer: 1024 * 1024 * 10 // 10MB buffer
            });

            // Affichage des logs du script
            if (stdout && stdout.trim()) {
                console.log(`📜 Script output: ${stdout.trim()}`);
            }
            if (stderr && stderr.trim()) {
                console.log(`⚠️ Script stderr: ${stderr.trim()}`);
            }

            // Vérification que le fichier witness a été créé
            if (!await fs.pathExists(outputFile)) {
                throw new Error('Le script n\'a pas généré le fichier witness. Vérifiez que le script fonctionne correctement.');
            }

            // Vérification de la taille du fichier
            const stats = await fs.stat(outputFile);
            if (stats.size === 0) {
                throw new Error('Le fichier witness généré est vide');
            }

            console.log(`✅ Witness généré avec succès (${stats.size} bytes)`);

        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error('Node.js non trouvé dans le PATH. Assurez-vous que Node.js est installé et accessible.');
            } else if (error.signal === 'SIGTERM') {
                throw new Error('Timeout: Le script de génération de witness a pris plus de 60 secondes');
            } else if (error.code === 'EMFILE' || error.code === 'ENFILE') {
                throw new Error('Trop de fichiers ouverts. Redémarrez l\'application.');
            } else {
                throw new Error(`Erreur lors de l'exécution du script witness: ${error.message}\n\nVérifiez que:\n- Le script generate_witness.js fonctionne correctement\n- Les fichiers WASM et input sont valides\n- Vous avez les permissions d'écriture`);
            }
        }
    }

    async cleanupTempFiles(files) {
        for (const file of files) {
            try {
                if (await fs.pathExists(file)) {
                    await fs.remove(file);
                    console.log(`🗑️ Fichier temporaire supprimé: ${path.basename(file)}`);
                }
            } catch (error) {
                console.warn(`⚠️ Impossible de supprimer ${file}: ${error.message}`);
            }
        }
    }

    /**
     * Valide les inputs avant génération
     */
    validateInputs(userInput) {
        const errors = [];

        if (!userInput.name || userInput.name.length > 16) {
            errors.push('Nom invalide (max 16 caractères)');
        }

        if (!userInput.surname || userInput.surname.length > 16) {
            errors.push('Prénom invalide (max 16 caractères)');
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(userInput.dob)) {
            errors.push('Date de naissance invalide (format YYYY-MM-DD)');
        }

        if (!['A', 'B', 'C'].includes(userInput.license)) {
            errors.push('Type de permis invalide (A, B, ou C)');
        }

        if (errors.length > 0) {
            throw new Error(`Erreurs de validation:\n${errors.join('\n')}`);
        }

        return true;
    }

    /**
     * Teste le script witness avec un input minimal
     */
    async testWitnessScript(files) {
        const testInput = {
            name: stringToAsciiArray('Test', 16),
            surname: stringToAsciiArray('User', 16),
            dob: formatDateToAscii('2000-01-01'),
            license: ['A'.charCodeAt(0)]
        };

        console.log('🧪 Test du script witness...');
        
        const tempDir = path.join(__dirname, 'temp');
        await fs.ensureDir(tempDir);
        
        const testInputFile = path.join(tempDir, 'test_input.json');
        const testWitnessFile = path.join(tempDir, 'test_witness.wtns');

        try {
            await fs.writeJson(testInputFile, testInput);
            await this.generateWitnessWithExternalScript(
                files.wasm,
                testInputFile,
                testWitnessFile,
                files.witness
            );
            
            const exists = await fs.pathExists(testWitnessFile);
            await this.cleanupTempFiles([testInputFile, testWitnessFile]);
            
            return exists;
        } catch (error) {
            await this.cleanupTempFiles([testInputFile, testWitnessFile]);
            throw error;
        }
    }

    /**
     * Debug: affiche les inputs formatés
     */
    debugInputs(input) {
        console.log('🐛 Debug inputs:');
        console.log('- name:', input.name, '->', input.name.map(x => String.fromCharCode(x)).join('').replace(/\0+$/, ''));
        console.log('- surname:', input.surname, '->', input.surname.map(x => String.fromCharCode(x)).join('').replace(/\0+$/, ''));
        console.log('- dob:', input.dob, '->', input.dob.map(x => String.fromCharCode(x)).join(''));
        console.log('- license:', input.license, '->', String.fromCharCode(input.license[0]));
    }
}