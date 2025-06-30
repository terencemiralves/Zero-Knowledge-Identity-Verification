#!/usr/bin/env node

import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import * as snarkjs from 'snarkjs';
import { stringToAsciiArray, formatDateToAscii, validateDate, validateName } from './utils.js';
import { ProofGenerator } from './proof-generator.js';
import { ProofVerifier } from './proof-verifier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ZKPLicenseApp {
    constructor() {
        this.proofGenerator = new ProofGenerator();
        this.proofVerifier = new ProofVerifier();
        this.currentFiles = {
            wasm: null,
            zkey: null,
            vkey: null,
            witness: null
        };
    }

    async start() {
        console.clear();
        console.log(chalk.blue.bold('🔐 ZKP License Verification Application'));
        console.log(chalk.yellow.bold('📋 Mode: Script Witness Externe Exclusif'));
        console.log(chalk.gray('═'.repeat(50)));
        
        // Vérification de snarkjs (seulement pour la génération de preuve, pas le witness)
        try {
            if (snarkjs && snarkjs.groth16) {
                console.log(chalk.green('✅ SnarkJS chargé (pour génération de preuve uniquement)'));
            }
        } catch (error) {
            console.error(chalk.red('❌ Erreur de chargement de SnarkJS:', error.message));
            process.exit(1);
        }
        
        await this.checkRequiredFiles();
        await this.mainMenu();
    }

    async checkRequiredFiles() {
        const spinner = ora('Vérification des fichiers requis...').start();
        
        const filesToCheck = [
            { name: 'circuit.wasm', key: 'wasm', alt: ['LicenseA.wasm', 'LicenseB.wasm', 'LicenseC.wasm'], required: true },
            { name: 'circuit.zkey', key: 'zkey', alt: ['LicenseA.zkey', 'LicenseB.zkey', 'LicenseC.zkey'], required: true },
            { name: 'verification_key.json', key: 'vkey', alt: ['vkey.json'], required: true },
            { name: 'generate_witness.cjs', key: 'witness', alt: ['witness.js'], required: true }
        ];

        let requiredFound = 0;
        const status = [];

        for (const file of filesToCheck) {
            let found = false;
            const filePath = path.join(__dirname, file.name);
            
            // Vérifier le fichier principal
            if (await fs.pathExists(filePath)) {
                this.currentFiles[file.key] = filePath;
                status.push(chalk.green(`✅ ${file.name}`));
                found = true;
                requiredFound++;
            } else {
                // Vérifier les alternatives
                for (const altName of file.alt || []) {
                    const altPath = path.join(__dirname, altName);
                    if (await fs.pathExists(altPath)) {
                        this.currentFiles[file.key] = altPath;
                        status.push(chalk.green(`✅ ${altName}`));
                        found = true;
                        requiredFound++;
                        break;
                    }
                }
            }
            
            if (!found) {
                status.push(chalk.red(`❌ ${file.name} (REQUIS)`));
            }
        }

        spinner.stop();
        
        console.log(chalk.yellow('\nStatus des fichiers:'));
        status.forEach(s => console.log(`  ${s}`));
        
        if (requiredFound < 4) {
            console.log(chalk.red('\n⚠️  FICHIERS REQUIS MANQUANTS:'));
            
            if (!this.currentFiles.wasm) {
                console.log(chalk.red('  ❌ Fichier WASM du circuit (.wasm)'));
            }
            if (!this.currentFiles.zkey) {
                console.log(chalk.red('  ❌ Clé de preuve (.zkey)'));
            }
            if (!this.currentFiles.vkey) {
                console.log(chalk.red('  ❌ Clé de vérification (.json)'));
            }
            if (!this.currentFiles.witness) {
                console.log(chalk.red('  ❌ Script generate_witness.cjs (OBLIGATOIRE)'));
            }
            
            console.log(chalk.yellow('\n📋 Cette application nécessite TOUS les fichiers listés ci-dessus.'));
            console.log(chalk.yellow('   Placez-les dans le dossier de l\'application avant de continuer.'));
            
            if (!this.currentFiles.witness) {
                console.log(chalk.red('\n🚫 ATTENTION: Le script generate_witness.cjs est OBLIGATOIRE dans ce mode.'));
                console.log(chalk.yellow('   Aucun fallback snarkjs n\'est disponible.'));
            }
        } else {
            console.log(chalk.green('\n🎉 Tous les fichiers requis sont disponibles!'));
            console.log(chalk.cyan('🔧 Mode de fonctionnement: Script witness externe exclusif'));
        }
        
        console.log();
    }

    async mainMenu() {
        // Vérifier si tous les fichiers requis sont présents
        const allFilesPresent = this.currentFiles.wasm && 
                               this.currentFiles.zkey && 
                               this.currentFiles.vkey && 
                               this.currentFiles.witness;

        const choices = [
            { 
                name: '🏗️  Générer une preuve', 
                value: 'generate',
                disabled: !allFilesPresent ? 'Fichiers requis manquants' : false
            },
            { 
                name: '✅ Vérifier une preuve', 
                value: 'verify',
                disabled: !this.currentFiles.vkey ? 'Clé de vérification manquante' : false
            },
            { name: '📁 Gérer les fichiers', value: 'files' },
            { 
                name: '🔧 Test du script witness', 
                value: 'test',
                disabled: !allFilesPresent ? 'Fichiers requis manquants' : false
            },
            { name: '🔄 Rafraîchir le statut des fichiers', value: 'refresh' },
            { name: '❌ Quitter', value: 'exit' }
        ];

        const { action } = await inquirer.prompt({
            type: 'list',
            name: 'action',
            message: 'Que souhaitez-vous faire?',
            choices
        });

        switch (action) {
            case 'generate':
                await this.generateProofFlow();
                break;
            case 'verify':
                await this.verifyProofFlow();
                break;
            case 'files':
                await this.manageFilesFlow();
                break;
            case 'test':
                await this.testWitnessScript();
                break;
            case 'refresh':
                await this.checkRequiredFiles();
                break;
            case 'exit':
                console.log(chalk.cyan('👋 Au revoir!'));
                process.exit(0);
        }

        await this.mainMenu();
    }

    async generateProofFlow() {
        console.log(chalk.blue.bold('\n🏗️ Génération de Preuve'));
        console.log(chalk.yellow('🔧 Mode: Script witness externe exclusif'));
        console.log(chalk.gray('─'.repeat(40)));

        try {
            // Affichage des fichiers utilisés
            console.log(chalk.cyan('📁 Fichiers utilisés:'));
            console.log(chalk.gray(`   WASM: ${this.currentFiles.wasm}`));
            console.log(chalk.gray(`   zkey: ${this.currentFiles.zkey}`));
            console.log(chalk.gray(`   Script: ${this.currentFiles.witness}`));

            // Collecte des informations utilisateur
            const answers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'name',
                    message: 'Nom (max 16 caractères):',
                    default: 'John',
                    validate: validateName
                },
                {
                    type: 'input',
                    name: 'surname',
                    message: 'Prénom (max 16 caractères):',
                    default: 'Doe',
                    validate: validateName
                },
                {
                    type: 'input',
                    name: 'dob',
                    message: 'Date de naissance (YYYY-MM-DD):',
                    default: '1990-01-01',
                    validate: validateDate
                },
                {
                    type: 'list',
                    name: 'license',
                    message: 'Type de permis:',
                    choices: [
                        { name: 'Permis A (Moto)', value: 'A' },
                        { name: 'Permis B (Voiture)', value: 'B' },
                        { name: 'Permis C (Camion)', value: 'C' }
                    ],
                    default: 'A'
                }
            ]);

            const spinner = ora('Génération de la preuve avec script externe...').start();

            try {
                // Génération de la preuve avec script externe exclusivement
                const result = await this.proofGenerator.generateProof(
                    answers,
                    this.currentFiles
                );

                spinner.succeed('Preuve générée avec succès!');

                // Affichage du résultat
                console.log(chalk.green('\n📋 Résultat:'));
                console.log(JSON.stringify(result, null, 2));

                // Proposer de sauvegarder
                const { save } = await inquirer.prompt({
                    type: 'confirm',
                    name: 'save',
                    message: 'Voulez-vous sauvegarder la preuve dans un fichier?',
                    default: true
                });

                if (save) {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const filename = `proof_${timestamp}.json`;
                    await fs.writeJson(filename, result, { spaces: 2 });
                    console.log(chalk.green(`💾 Preuve sauvegardée dans: ${filename}`));
                }

            } catch (proofError) {
                spinner.fail('Génération de preuve échouée');
                throw proofError;
            }

        } catch (error) {
            console.error(chalk.red(`❌ Erreur: ${error.message}`));
            console.log(chalk.yellow('\n💡 Suggestions de dépannage:'));
            console.log('- Vérifiez que le script generate_witness.cjs fonctionne correctement');
            console.log('- Assurez-vous que tous les fichiers sont présents et corrects');
            console.log('- Testez le script avec l\'option "Test du script witness"');
            console.log('- Vérifiez les permissions d\'écriture dans le dossier');
        }

        await this.pressEnterToContinue();
    }

    async testWitnessScript() {
        console.log(chalk.blue.bold('\n🔧 Test du Script Witness'));
        console.log(chalk.gray('─'.repeat(30)));

        try {
            console.log(chalk.yellow('🧪 Test du script avec input minimal...'));
            
            const spinner = ora('Test en cours...').start();
            
            const success = await this.proofGenerator.testWitnessScript(this.currentFiles);
            
            if (success) {
                spinner.succeed('Script witness fonctionne correctement!');
                console.log(chalk.green('✅ Le script peut générer des fichiers witness'));
                
                // Test complet avec génération de preuve
                const { fullTest } = await inquirer.prompt({
                    type: 'confirm',
                    name: 'fullTest',
                    message: 'Voulez-vous effectuer un test complet (witness + preuve)?',
                    default: true
                });

                if (fullTest) {
                    const fullSpinner = ora('Test complet en cours...').start();
                    
                    try {
                        const testResult = await this.proofGenerator.generateProof(
                            { name: 'Test', surname: 'User', dob: '2000-01-01', license: 'A' },
                            this.currentFiles
                        );
                        
                        fullSpinner.succeed('Test complet réussi!');
                        console.log(chalk.green('✅ Génération complète fonctionnelle'));
                        console.log(chalk.cyan('📊 Résultat du test:'));
                        console.log(`- Preuve générée: ✅`);
                        console.log(`- Signaux publics: ${JSON.stringify(testResult.publicSignals)}`);
                        console.log(`- Méthode: ${testResult.metadata.method}`);
                        
                    } catch (fullTestError) {
                        fullSpinner.fail('Test complet échoué');
                        console.error(chalk.red(`❌ Erreur test complet: ${fullTestError.message}`));
                    }
                }
                
            } else {
                spinner.fail('Script witness ne fonctionne pas');
                console.error(chalk.red('❌ Le script n\'arrive pas à générer de witness'));
            }

        } catch (error) {
            console.error(chalk.red(`❌ Test échoué: ${error.message}`));
            console.log(chalk.yellow('\n💡 Vérifications à effectuer:'));
            console.log('- Le script generate_witness.cjs est-il présent?');
            console.log('- Le script a-t-il les bonnes permissions?');
            console.log('- Les fichiers WASM sont-ils corrects?');
            console.log('- Node.js est-il disponible dans le PATH?');
        }

        await this.pressEnterToContinue();
    }

    // ... (début du fichier reste identique jusqu'à verifyProofFlow)

    async verifyProofFlow() {
        console.log(chalk.blue.bold('\n✅ Vérification de Preuve'));
        console.log(chalk.gray('─'.repeat(30)));

        try {
            if (!this.currentFiles.vkey) {
                throw new Error('Fichier verification_key.json manquant');
            }

            const { inputMethod } = await inquirer.prompt({
                type: 'list',
                name: 'inputMethod',
                message: 'Comment voulez-vous fournir la preuve?',
                choices: [
                    { name: '📁 Charger depuis un fichier', value: 'file' },
                    { name: '✏️  Saisir manuellement', value: 'manual' }
                ]
            });

            let proofData;
            let publicSignals = null;

            if (inputMethod === 'file') {
                const { filename } = await inquirer.prompt({
                    type: 'input',
                    name: 'filename',
                    message: 'Chemin vers le fichier de preuve:',
                    validate: async (input) => {
                        if (await fs.pathExists(input)) {
                            return true;
                        }
                        return 'Fichier non trouvé';
                    }
                });

                console.log(chalk.cyan(`📁 Chargement du fichier: ${filename}`));
                const fileContent = await fs.readJson(filename);
                
                // Debug: afficher la structure du fichier
                console.log(chalk.yellow('🐛 Analyse du fichier chargé...'));
                this.proofVerifier.debugProofStructure(fileContent);
                
                // Vérifier si les signaux publics sont présents
                if (!fileContent.publicSignals && fileContent.pi_a) {
                    console.log(chalk.yellow('\n⚠️  Le fichier contient seulement la preuve, pas les signaux publics.'));
                    
                    const { inputSignals } = await inquirer.prompt({
                        type: 'input',
                        name: 'inputSignals',
                        message: 'Veuillez saisir les signaux publics au format JSON [0] ou [1]:',
                        default: '[1]',
                        validate: (input) => {
                            try {
                                const parsed = JSON.parse(input);
                                if (!Array.isArray(parsed)) {
                                    return 'Doit être un tableau JSON, ex: [1] ou [0]';
                                }
                                if (parsed.length === 0) {
                                    return 'Le tableau ne peut pas être vide';
                                }
                                return true;
                            } catch {
                                return 'Format JSON invalide. Utilisez [1] ou [0]';
                            }
                        }
                    });
                    
                    publicSignals = JSON.parse(inputSignals);
                    console.log(chalk.green(`✅ Signaux publics saisis: ${JSON.stringify(publicSignals)}`));
                }
                
                proofData = fileContent;
                
            } else {
                const answers = await inquirer.prompt([
                    {
                        type: 'editor',
                        name: 'proof',
                        message: 'Collez la preuve JSON:'
                    },
                    {
                        type: 'input',
                        name: 'publicSignals',
                        message: 'Signaux publics (format: [1] ou [0]):',
                        default: '[1]',
                        validate: (input) => {
                            try {
                                const parsed = JSON.parse(input);
                                return Array.isArray(parsed);
                            } catch {
                                return 'Format JSON invalide pour les signaux publics';
                            }
                        }
                    }
                ]);

                proofData = {
                    proof: JSON.parse(answers.proof),
                    publicSignals: JSON.parse(answers.publicSignals)
                };
            }

            const spinner = ora('Vérification de la preuve...').start();

            try {
                // Appel du vérificateur avec les données complètes
                const result = await this.proofVerifier.verifyProof(
                    proofData,
                    publicSignals, // Passer les signaux saisis si nécessaire
                    this.currentFiles.vkey
                );

                spinner.stop();

                // Affichage du résultat
                if (result.valid) {
                    console.log(chalk.green.bold('\n✅ PREUVE VALIDE'));
                    console.log(chalk.green(`🎫 Status: ${result.hasLicenseA ? 'Possède le permis A' : 'Ne possède pas le permis A'}`));
                } else {
                    console.log(chalk.red.bold('\n❌ PREUVE INVALIDE'));
                }

                console.log(chalk.cyan('\n📊 Détails:'));
                console.log(JSON.stringify(result, null, 2));

            } catch (verificationError) {
                spinner.fail('Vérification échouée');
                throw verificationError;
            }

        } catch (error) {
            console.error(chalk.red(`❌ Erreur: ${error.message}`));
            
            // Suggestions de dépannage spécifiques
            console.log(chalk.yellow('\n💡 Suggestions de dépannage:'));
            console.log('- Si votre fichier contient seulement la preuve (pi_a, pi_b, pi_c):');
            console.log('  → Les signaux publics vous seront demandés séparément');
            console.log('- Format des signaux publics: [1] si possède permis A, [0] sinon');
            console.log('- Vérifiez que la clé de vérification correspond au circuit');
            console.log('- Assurez-vous que la preuve a été générée avec le même circuit');
            
            if (error.message.includes('Signaux publics manquants')) {
                console.log(chalk.red('\n🚨 Les signaux publics sont obligatoires pour la vérification!'));
                console.log(chalk.yellow('   Ils indiquent si la personne possède le permis A (1) ou non (0)'));
            }
        }

        await this.pressEnterToContinue();
    }

// ... (reste du fichier identique)

    async manageFilesFlow() {
        console.log(chalk.blue.bold('\n📁 Gestion des Fichiers'));
        console.log(chalk.yellow('🔧 Mode: Script externe obligatoire'));
        console.log(chalk.gray('─'.repeat(35)));

        const choices = [
            { name: '📋 Afficher le statut des fichiers', value: 'status' },
            { name: '🔧 Changer le chemin d\'un fichier', value: 'change' },
            { name: '🔍 Rechercher automatiquement', value: 'search' },
            { name: '↩️  Retour au menu principal', value: 'back' }
        ];

        const { action } = await inquirer.prompt({
            type: 'list',
            name: 'action',
            message: 'Options de gestion des fichiers:',
            choices
        });

        switch (action) {
            case 'status':
                await this.showFileStatus();
                break;
            case 'change':
                await this.changeFilePath();
                break;
            case 'search':
                await this.searchFiles();
                break;
            case 'back':
                return;
        }

        await this.manageFilesFlow();
    }

    async showFileStatus() {
        console.log(chalk.yellow('\n📋 Status des fichiers (tous requis):'));
        
        const fileInfo = [
            { key: 'wasm', name: 'Fichier WASM', required: true },
            { key: 'zkey', name: 'Fichier zkey', required: true },
            { key: 'vkey', name: 'Clé de vérification', required: true },
            { key: 'witness', name: 'Script witness', required: true }
        ];

        for (const info of fileInfo) {
            const filePath = this.currentFiles[info.key];
            if (filePath && await fs.pathExists(filePath)) {
                console.log(chalk.green(`  ✅ ${info.name}: ${filePath}`));
            } else {
                console.log(chalk.red(`  ❌ ${info.name}: MANQUANT (REQUIS)`));
            }
        }
    }

    async changeFilePath() {
        const { fileType } = await inquirer.prompt({
            type: 'list',
            name: 'fileType',
            message: 'Quel fichier voulez-vous configurer?',
            choices: [
                { name: 'Fichier WASM (requis)', value: 'wasm' },
                { name: 'Fichier zkey (requis)', value: 'zkey' },
                { name: 'Clé de vérification (requis)', value: 'vkey' },
                { name: 'Script witness (requis)', value: 'witness' }
            ]
        });

        const { filePath } = await inquirer.prompt({
            type: 'input',
            name: 'filePath',
            message: 'Chemin vers le fichier:',
            validate: async (input) => {
                if (await fs.pathExists(input)) {
                    return true;
                }
                return 'Fichier non trouvé';
            }
        });

        this.currentFiles[fileType] = filePath;
        console.log(chalk.green(`✅ Fichier ${fileType} configuré: ${filePath}`));
    }

    async searchFiles() {
        const spinner = ora('Recherche automatique des fichiers...').start();
        
        const searchPaths = [
            __dirname,
            path.join(__dirname, 'circuits'),
            path.join(__dirname, 'build'),
            path.join(__dirname, 'assets')
        ];

        const filePatterns = {
            wasm: ['*.wasm', 'circuit.wasm', 'LicenseA.wasm', 'LicenseB.wasm', 'LicenseC.wasm'],
            zkey: ['*.zkey', 'circuit.zkey', 'LicenseA.zkey', 'LicenseB.zkey', 'LicenseC.zkey'],
            vkey: ['verification_key.json', 'vkey.json'],
            witness: ['generate_witness.cjs', 'witness.js']
        };

        let found = 0;

        for (const searchPath of searchPaths) {
            if (await fs.pathExists(searchPath)) {
                for (const [fileType, patterns] of Object.entries(filePatterns)) {
                    if (!this.currentFiles[fileType]) {
                        for (const pattern of patterns) {
                            const fullPath = path.join(searchPath, pattern);
                            if (await fs.pathExists(fullPath)) {
                                this.currentFiles[fileType] = fullPath;
                                found++;
                                break;
                            }
                        }
                    }
                }
            }
        }

        spinner.succeed(`Recherche terminée. ${found} fichier(s) trouvé(s)`);
        await this.showFileStatus();
    }

    async pressEnterToContinue() {
        await inquirer.prompt({
            type: 'input',
            name: 'continue',
            message: chalk.gray('Appuyez sur Entrée pour continuer...')
        });
    }
}

const app = new ZKPLicenseApp();
app.start().catch(console.error);