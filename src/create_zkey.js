const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

async function createZkey() {
    console.log('🔐 Creating zkey file for the circuit...');
    
    try {
        // Create necessary directories
        const buildDir = './build';
        const ptauDir = path.join(buildDir, 'ptau');
        
        if (!fs.existsSync(ptauDir)) {
            fs.mkdirSync(ptauDir, { recursive: true });
        }
        
        // Change to build directory
        process.chdir(buildDir);
        
        console.log('📁 Working directory:', process.cwd());
        
        // Step 1: Powers of Tau ceremony (Phase 1)
        console.log('Phase 1: Powers of Tau ceremony...');
        
        // Start new accumulator with power 12 (supports up to 2^12 = 4096 constraints)
        console.log('  - Creating new accumulator...');
        await snarkjs.powersOfTau.newAccumulator('ptau/pot12_0000.ptau', 12, 1);
        
        // Make contributions
        console.log('  - Making contribution 1...');
        await snarkjs.powersOfTau.contribute(
            'ptau/pot12_0000.ptau', 
            'ptau/pot12_0001.ptau', 
            'First contribution', 
            generateEntropy()
        );
        
        console.log('  - Making contribution 2...');
        await snarkjs.powersOfTau.contribute(
            'ptau/pot12_0001.ptau', 
            'ptau/pot12_0002.ptau', 
            'Second contribution', 
            generateEntropy()
        );
        
        // Apply beacon
        console.log('  - Applying beacon...');
        await snarkjs.powersOfTau.beacon(
            'ptau/pot12_0002.ptau', 
            'ptau/pot12_beacon.ptau', 
            'Final beacon', 
            10, 
            generateEntropy()
        );
        
        // Prepare for phase 2
        console.log('  - Preparing for phase 2...');
        await snarkjs.powersOfTau.prepare('ptau/pot12_beacon.ptau', 'ptau/pot12_final.ptau');
        
        console.log('✅ Phase 1 completed');
        
        // Step 2: Circuit-specific setup (Phase 2)
        console.log('Phase 2: Circuit-specific setup...');
        
        // Create initial zkey
        console.log('  - Creating initial zkey...');
        await snarkjs.zKey.newZKey('proof_of_license.r1cs', 'ptau/pot12_final.ptau', 'proof_of_license_0000.zkey');
        
        // Contribute to zkey
        console.log('  - Contributing to zkey...');
        await snarkjs.zKey.contribute(
            'proof_of_license_0000.zkey', 
            'proof_of_license_0001.zkey', 
            'Circuit contribution', 
            generateEntropy()
        );
        
        // Apply beacon to zkey
        console.log('  - Applying beacon to zkey...');
        await snarkjs.zKey.beacon(
            'proof_of_license_0001.zkey', 
            'proof_of_license_final.zkey', 
            'Final beacon', 
            10, 
            generateEntropy()
        );
        
        // Export verification key
        console.log('  - Exporting verification key...');
        const vKey = await snarkjs.zKey.exportVerificationKey('proof_of_license_final.zkey');
        fs.writeFileSync('verification_key.json', JSON.stringify(vKey, null, 2));
        
        console.log('✅ Phase 2 completed');
        
        // Go back to parent directory
        process.chdir('..');
        
        // Copy necessary files to root
        console.log('📋 Copying files to project root...');
        if (fs.existsSync('build/proof_of_license_final.zkey')) {
            fs.copyFileSync('build/proof_of_license_final.zkey', 'proof_of_license_final.zkey');
            console.log('  ✅ Copied proof_of_license_final.zkey');
        }
        
        if (fs.existsSync('build/verification_key.json')) {
            fs.copyFileSync('build/verification_key.json', 'verification_key.json');
            console.log('  ✅ Copied verification_key.json');
        }
        
        console.log('🎉 Zkey creation completed successfully!');
        console.log('');
        console.log('Generated files:');
        console.log('  - proof_of_license_final.zkey (proving key)');
        console.log('  - verification_key.json (verification key)');
        console.log('');
        console.log('Your zero-knowledge proof system is now ready to use! 🚀');
        
    } catch (error) {
        console.error('❌ Error creating zkey:', error);
        process.exit(1);
    }
}

function generateEntropy() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Run the setup
createZkey().catch(console.error);
