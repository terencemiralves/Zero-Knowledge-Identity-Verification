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
        this.currentCircuit = null; // 'license' ou 'age18'
        this.circuits = {
            license: {
                name: 'Preuve de Permis',
                description: 'Prouver qu\'on possède un permis A, B ou C',
                basePath: '../data/proof_license',
                files: { wasm: null, zkey: null, vkey: null, witness: null }
            },
            age18: {
                name: 'Preuve d\'Âge (18 ans)',
                description: 'Prouver qu\'on a 18 ans ou plus',
                basePath: '../data/Is18',
                files: { wasm: null, zkey: null, vkey: null, witness: null }
            }
        };
    }

    async start() {
        console.clear();
        console.log(chalk.blue.bold('🔐 ZKP Multi-Circuit Verification Application'));
        console.log(chalk.yellow.bold('📋 Mode: Preuves de Permis et d\'Âge'));
        console.log(chalk.gray('═'.repeat(60)));
        
        // Vérification de snarkjs
        try {
            if (snarkjs && snarkjs.groth16) {
                console.log(chalk.green('✅ SnarkJS chargé'));
            }
        } catch (error) {
            console.error(chalk.red('❌ Erreur de chargement de SnarkJS:', error.message));
            process.exit(1);
        }
        
        await this.checkAllCircuits();
        await this.mainMenu();
    }

    async checkAllCircuits() {
        console.log(chalk.cyan('\n🔍 Vérification des circuits disponibles...'));
        
        for (const [circuitType, circuit] of Object.entries(this.circuits)) {
            console.log(chalk.yellow(`\n📋 Circuit: ${circuit.name}`));
            await this.checkCircuitFiles(circuitType);
        }
    }

    async checkCircuitFiles(circuitType) {
        const circuit = this.circuits[circuitType];
        const spinner = ora(`Vérification ${circuit.name}...`).start();
        
        const filesToCheck = [
            { name: 'circuit.wasm', key: 'wasm', alt: ['LicenseA.wasm', 'LicenseB.wasm', 'LicenseC.wasm', 'age18.wasm'], required: true },
            { name: 'circuit.zkey', key: 'zkey', alt: ['LicenseA.zkey', 'LicenseB.zkey', 'LicenseC.zkey', 'age18.zkey'], required: true },
            { name: 'verification_key.json', key: 'vkey', alt: ['vkey.json'], required: true },
            { name: 'generate_witness.cjs', key: 'witness', alt: ['witness.js'], required: true }
        ];

        let requiredFound = 0;
        const status = [];

        for (const file of filesToCheck) {
            let found = false;
            const filePath = path.join(__dirname, circuit.basePath, file.name);
            
            // Vérifier le fichier principal
            if (await fs.pathExists(filePath)) {
                circuit.files[file.key] = filePath;
                status.push(chalk.green(`✅ ${file.name}`));
                found = true;
                requiredFound++;
            } else {
                // Vérifier les alternatives
                for (const altName of file.alt || []) {
                    const altPath = path.join(__dirname, circuit.basePath, altName);
                    if (await fs.pathExists(altPath)) {
                        circuit.files[file.key] = altPath;
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
        
        status.forEach(s => console.log(`  ${s}`));
        
        if (requiredFound < 4) {
            console.log(chalk.red(`⚠️  Circuit ${circuit.name}: INCOMPLET (${requiredFound}/4 fichiers)`));
            circuit.available = false;
        } else {
            console.log(chalk.green(`🎉 Circuit ${circuit.name}: DISPONIBLE`));
            circuit.available = true;
        }
    }

    async mainMenu() {
        // Vérifier quels circuits sont disponibles
        const licenseAvailable = this.circuits.license.available;
        const ageAvailable = this.circuits.age18.available;

        const choices = [
            { 
                name: '🎫 Preuve de Permis (A, B, C)', 
                value: 'license',
                disabled: !licenseAvailable ? 'Circuit de permis non disponible' : false
            },
            { 
                name: '🎂 Preuve d\'Âge (18 ans+)', 
                value: 'age18',
                disabled: !ageAvailable ? 'Circuit d\'âge non disponible' : false
            },
            { name: '✅ Vérifier une preuve existante', value: 'verify' },
            { name: '📁 Gérer les fichiers de circuits', value: 'files' },
            { name: '🔄 Rafraîchir les circuits', value: 'refresh' },
            { name: '❌ Quitter', value: 'exit' }
        ];

        console.log(chalk.blue.bold('\n🏠 Menu Principal'));
        console.log(chalk.gray('─'.repeat(30)));

        const { action } = await inquirer.prompt({
            type: 'list',
            name: 'action',
            message: 'Que souhaitez-vous faire?',
            choices
        });

        switch (action) {
            case 'license':
                this.currentCircuit = 'license';
                await this.circuitMenu('license');
                break;
            case 'age18':
                this.currentCircuit = 'age18';
                await this.circuitMenu('age18');
                break;
            case 'verify':
                await this.verifyProofFlow();
                break;
            case 'files':
                await this.manageFilesFlow();
                break;
            case 'refresh':
                await this.checkAllCircuits();
                break;
            case 'exit':
                console.log(chalk.cyan('👋 Au revoir!'));
                process.exit(0);
        }

        await this.mainMenu();
    }

    async circuitMenu(circuitType) {
        const circuit = this.circuits[circuitType];
        
        console.log(chalk.blue.bold(`\n${circuit.name}`));
        console.log(chalk.cyan(circuit.description));
        console.log(chalk.gray('─'.repeat(40)));

        const choices = [
            { name: '🏗️ Générer une preuve', value: 'generate' },
            { name: '✅ Vérifier une preuve', value: 'verify' },
            { name: '🔧 Tester le circuit', value: 'test' },
            { name: '↩️ Retour au menu principal', value: 'back' }
        ];

        const { action } = await inquirer.prompt({
            type: 'list',
            name: 'action',
            message: `Options pour ${circuit.name}:`,
            choices
        });

        switch (action) {
            case 'generate':
                await this.generateProofFlow(circuitType);
                break;
            case 'verify':
                await this.verifyProofFlow(circuitType);
                break;
            case 'test':
                await this.testCircuit(circuitType);
                break;
            case 'back':
                return;
        }

        await this.circuitMenu(circuitType);
    }

    async generateProofFlow(circuitType) {
        const circuit = this.circuits[circuitType];
        
        console.log(chalk.blue.bold(`\n🏗️ Génération de Preuve - ${circuit.name}`));
        console.log(chalk.gray('─'.repeat(50)));

        try {
            // Affichage des fichiers utilisés
            console.log(chalk.cyan('📁 Fichiers utilisés:'));
            console.log(chalk.gray(`   WASM: ${circuit.files.wasm}`));
            console.log(chalk.gray(`   zkey: ${circuit.files.zkey}`));
            console.log(chalk.gray(`   Script: ${circuit.files.witness}`));

            let answers;

            if (circuitType === 'license') {
                // Collecte des informations pour preuve de permis
                answers = await inquirer.prompt([
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
            } else if (circuitType === 'age18') {
                // Collecte des informations pour preuve d'âge
                answers = await inquirer.prompt([
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
                        default: '2000-01-01',
                        validate: validateDate
                    }
                ]);

                // Calculer automatiquement l'âge
                const today = new Date();
                const birthDate = new Date(answers.dob);
                const age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }

                console.log(chalk.cyan(`📅 Âge calculé: ${age} ans`));
                answers.age = age;
            }

            const spinner = ora(`Génération de la preuve ${circuit.name}...`).start();

            try {
                // Génération de la preuve avec le circuit approprié
                const result = await this.proofGenerator.generateProofForCircuit(
                    answers,
                    circuit.files,
                    circuitType
                );

                spinner.succeed('Preuve générée avec succès!');

                // Affichage du résultat
                // console.log(chalk.green('\n📋 Résultat:'));
                // console.log(JSON.stringify(result, null, 2));

                // Proposer de sauvegarder
                const { save } = await inquirer.prompt({
                    type: 'confirm',
                    name: 'save',
                    message: 'Voulez-vous sauvegarder la preuve dans un fichier?',
                    default: true
                });

                if (save) {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const filename = `proof_${circuitType}_${timestamp}.json`;
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
            console.log('- Testez le circuit avec l\'option "Tester le circuit"');
        }

        await this.pressEnterToContinue();
    }

    async verifyProofFlow(circuitType = null) {
        console.log(chalk.blue.bold('\n✅ Vérification de Preuve'));
        console.log(chalk.gray('─'.repeat(30)));

        try {
            let selectedCircuit = circuitType;

            // Si pas de circuit spécifié, demander lequel utiliser
            if (!selectedCircuit) {
                const availableCircuits = Object.entries(this.circuits)
                    .filter(([_, circuit]) => circuit.available)
                    .map(([key, circuit]) => ({ name: circuit.name, value: key }));

                if (availableCircuits.length === 0) {
                    throw new Error('Aucun circuit disponible pour la vérification');
                }

                const { circuit } = await inquirer.prompt({
                    type: 'list',
                    name: 'circuit',
                    message: 'Quel type de preuve voulez-vous vérifier?',
                    choices: availableCircuits
                });

                selectedCircuit = circuit;
            }

            const circuit = this.circuits[selectedCircuit];

            if (!circuit.files.vkey) {
                throw new Error(`Fichier verification_key.json manquant pour ${circuit.name}`);
            }

            const { inputMethod } = await inquirer.prompt({
                type: 'list',
                name: 'inputMethod',
                message: 'Comment voulez-vous fournir la preuve?',
                choices: [
                    { name: '📁 Charger depuis un fichier', value: 'file' },
                    { name: '✏️ Saisir manuellement', value: 'manual' }
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
                this.proofVerifier.debugProofStructure(fileContent);
                
                // Vérifier si les signaux publics sont présents
                if (!fileContent.publicSignals && fileContent.pi_a) {
                    console.log(chalk.yellow('\n⚠️ Le fichier contient seulement la preuve, pas les signaux publics.'));
                    
                    let signalDescription;
                    if (selectedCircuit === 'license') {
                        signalDescription = 'Les signaux publics indiquent si la personne possède le permis A:\n   [1] = Possède le permis A\n   [0] = Ne possède pas le permis A';
                    } else if (selectedCircuit === 'age18') {
                        signalDescription = 'Les signaux publics indiquent si la personne a 18 ans ou plus:\n   [1] = A 18 ans ou plus\n   [0] = Moins de 18 ans';
                    }
                    
                    console.log(chalk.cyan(`💡 ${signalDescription}`));
                    
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
                    // console.log(chalk.green(`✅ Signaux publics saisis: ${JSON.stringify(publicSignals)}`));
                }
                
                proofData = fileContent;
                
            } else {
                // Saisie manuelle (reste identique)
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

            const spinner = ora(`Vérification de la preuve ${circuit.name}...`).start();

            try {
                // Appel du vérificateur avec les données complètes
                const result = await this.proofVerifier.verifyProof(
                    proofData,
                    publicSignals,
                    circuit.files.vkey
                );

                spinner.stop();

                // Affichage du résultat spécifique au circuit
                if (result.valid) {
                    console.log(chalk.green.bold('\n✅ PREUVE VALIDE'));
                    
                    if (selectedCircuit === 'license') {
                        console.log(chalk.green(`🎫 Status: ${result.hasLicenseA ? 'Possède le permis A' : 'Ne possède pas le permis A'}`));
                    } else if (selectedCircuit === 'age18') {
                        console.log(chalk.green(`🎂 Status: ${result.publicSignals[0] === '1' ? 'A 18 ans ou plus' : 'Moins de 18 ans'}`));
                    }
                } else {
                    console.log(chalk.red.bold('\n❌ PREUVE INVALIDE'));
                }

                // console.log(chalk.cyan('\n📊 Détails:'));
                // console.log(JSON.stringify(result, null, 2));

            } catch (verificationError) {
                spinner.fail('Vérification échouée');
                throw verificationError;
            }

        } catch (error) {
            console.error(chalk.red(`❌ Erreur: ${error.message}`));
        }

        await this.pressEnterToContinue();
    }

    async testCircuit(circuitType) {
        const circuit = this.circuits[circuitType];
        
        console.log(chalk.blue.bold(`\n🔧 Test du Circuit - ${circuit.name}`));
        console.log(chalk.gray('─'.repeat(40)));

        try {
            console.log(chalk.yellow('🧪 Test avec données minimales...'));
            
            const spinner = ora('Test en cours...').start();
            
            let testData;
            if (circuitType === 'license') {
                testData = { name: 'Test', surname: 'User', dob: '2000-01-01', license: 'A' };
            } else if (circuitType === 'age18') {
                testData = { name: 'Test', surname: 'User', dob: '2000-01-01', age: 24 };
            }

            const success = await this.proofGenerator.testCircuit(circuit.files, circuitType, testData);
            
            if (success) {
                spinner.succeed(`Circuit ${circuit.name} fonctionne correctement!`);
                console.log(chalk.green(`✅ Le circuit ${circuitType} est opérationnel`));
            } else {
                spinner.fail(`Circuit ${circuit.name} ne fonctionne pas`);
            }

        } catch (error) {
            console.error(chalk.red(`❌ Test échoué: ${error.message}`));
        }

        await this.pressEnterToContinue();
    }

    // ... (garder les autres méthodes: manageFilesFlow, showFileStatus, etc. mais adapter pour les deux circuits)

    async manageFilesFlow() {
        console.log(chalk.blue.bold('\n📁 Gestion des Fichiers de Circuits'));
        console.log(chalk.gray('─'.repeat(40)));

        const choices = [
            { name: '📋 Afficher le statut de tous les circuits', value: 'status' },
            { name: '🎫 Gérer le circuit de Permis', value: 'license' },
            { name: '🎂 Gérer le circuit d\'Âge', value: 'age18' },
            { name: '🔍 Rechercher automatiquement', value: 'search' },
            { name: '↩️ Retour au menu principal', value: 'back' }
        ];

        const { action } = await inquirer.prompt({
            type: 'list',
            name: 'action',
            message: 'Options de gestion des fichiers:',
            choices
        });

        switch (action) {
            case 'status':
                await this.showAllCircuitStatus();
                break;
            case 'license':
            case 'age18':
                await this.manageCircuitFiles(action);
                break;
            case 'search':
                await this.searchAllFiles();
                break;
            case 'back':
                return;
        }

        await this.manageFilesFlow();
    }

    async showAllCircuitStatus() {
        console.log(chalk.yellow('\n📋 Status de tous les circuits:'));
        
        for (const [circuitType, circuit] of Object.entries(this.circuits)) {
            console.log(chalk.cyan(`\n${circuit.name}:`));
            
            const fileInfo = [
                { key: 'wasm', name: 'Fichier WASM' },
                { key: 'zkey', name: 'Fichier zkey' },
                { key: 'vkey', name: 'Clé de vérification' },
                { key: 'witness', name: 'Script witness' }
            ];

            for (const info of fileInfo) {
                const filePath = circuit.files[info.key];
                if (filePath && await fs.pathExists(filePath)) {
                    console.log(chalk.green(`  ✅ ${info.name}: ${path.basename(filePath)}`));
                } else {
                    console.log(chalk.red(`  ❌ ${info.name}: MANQUANT`));
                }
            }
        }
    }

    async manageCircuitFiles(circuitType) {
        const circuit = this.circuits[circuitType];
        
        console.log(chalk.blue.bold(`\n📁 Gestion ${circuit.name}`));
        console.log(chalk.cyan(`Dossier: ${circuit.basePath}`));
        console.log(chalk.gray('─'.repeat(30)));

        const choices = [
            { name: '📋 Afficher le statut', value: 'status' },
            { name: '🔧 Changer un fichier', value: 'change' },
            { name: '🔍 Rechercher dans le dossier', value: 'search' },
            { name: '↩️ Retour', value: 'back' }
        ];

        const { action } = await inquirer.prompt({
            type: 'list',
            name: 'action',
            message: `Options pour ${circuit.name}:`,
            choices
        });

        switch (action) {
            case 'status':
                await this.showCircuitStatus(circuitType);
                break;
            case 'change':
                await this.changeCircuitFile(circuitType);
                break;
            case 'search':
                await this.searchCircuitFiles(circuitType);
                break;
            case 'back':
                return;
        }

        await this.manageCircuitFiles(circuitType);
    }

    async showCircuitStatus(circuitType) {
        const circuit = this.circuits[circuitType];
        console.log(chalk.yellow(`\n📋 Status ${circuit.name}:`));
        
        const fileInfo = [
            { key: 'wasm', name: 'Fichier WASM' },
            { key: 'zkey', name: 'Fichier zkey' },
            { key: 'vkey', name: 'Clé de vérification' },
            { key: 'witness', name: 'Script witness' }
        ];

        for (const info of fileInfo) {
            const filePath = circuit.files[info.key];
            if (filePath && await fs.pathExists(filePath)) {
                console.log(chalk.green(`  ✅ ${info.name}: ${filePath}`));
            } else {
                console.log(chalk.red(`  ❌ ${info.name}: MANQUANT`));
            }
        }
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