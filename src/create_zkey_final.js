const snarkjs = require('snarkjs');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

async function createZkeyFinal() {
    console.log('🔐 Creating zkey file for zero-knowledge proofs...');
    
    try {
        // Create necessary directories
        const buildDir = './build';
        const ptauDir = path.join(buildDir, 'ptau');
        
        if (!fs.existsSync(ptauDir)) {
            fs.mkdirSync(ptauDir, { recursive: true });
        }
        
        console.log('📥 Downloading pre-computed powers of tau using curl...');
        const ptauPath = path.join(ptauDir, 'powersOfTau28_hez_final_12.ptau');
        
        // Remove existing corrupted file if it exists
        if (fs.existsSync(ptauPath)) {
            fs.unlinkSync(ptauPath);
        }
        
        // Use curl to download the file
        const ptauUrl = 'https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau';
        
        try {
            console.log('  - Downloading with curl (this may take a few minutes)...');
            execSync(`curl -L -o "${ptauPath}" "${ptauUrl}"`, { stdio: 'inherit' });
            
            // Check if file was downloaded successfully
            const stats = fs.statSync(ptauPath);
            console.log(`  ✅ Downloaded ${(stats.size / (1024*1024)).toFixed(2)} MB`);
            
            if (stats.size < 1000000) { // Less than 1MB means probably an error page
                throw new Error('Downloaded file too small, probably an error');
            }
        } catch (error) {
            console.log('  ❌ Download failed, creating minimal powers of tau...');
            
            // Create a minimal powers of tau ceremony for testing
            console.log('  - Creating minimal powers of tau ceremony...');
            
            // Change to build directory
            process.chdir(buildDir);
            
            await snarkjs.powersOfTau.newAccumulator('ptau/pot12_minimal.ptau', 12, 1);
            await snarkjs.powersOfTau.contribute('ptau/pot12_minimal.ptau', 'ptau/pot12_final.ptau', 'test contribution', generateEntropy());
            
            // Use the minimal version
            var ptauFile = 'ptau/pot12_final.ptau';
        }
        
        if (!process.cwd().endsWith('build')) {
            process.chdir(buildDir);
        }
        
        console.log('📁 Working directory:', process.cwd());
        
        // Use the correct ptau file
        if (!ptauFile) {
            ptauFile = 'ptau/powersOfTau28_hez_final_12.ptau';
        }
        
        // Phase 2: Circuit-specific setup
        console.log('Phase 2: Circuit-specific setup...');
        
        // Create initial zkey
        console.log('  - Creating initial zkey...');
        await snarkjs.zKey.newZKey('proof_of_license.r1cs', ptauFile, 'proof_of_license_0000.zkey');
        
        // Contribute to zkey (first contribution)
        console.log('  - Making first contribution to zkey...');
        await snarkjs.zKey.contribute(
            'proof_of_license_0000.zkey', 
            'proof_of_license_0001.zkey', 
            'First contribution', 
            generateEntropy()
        );
        
        // Apply beacon to zkey (finalizes the trusted setup)
        console.log('  - Applying beacon to finalize zkey...');
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
        
        console.log('✅ Zkey creation completed');
        
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
        
        // Display file information
        console.log('');
        console.log('🎉 Zkey creation completed successfully!');
        console.log('');
        console.log('Generated files:');
        
        if (fs.existsSync('proof_of_license_final.zkey')) {
            const zkeyStats = fs.statSync('proof_of_license_final.zkey');
            console.log(`  - proof_of_license_final.zkey (${(zkeyStats.size / (1024*1024)).toFixed(2)} MB) - The proving key`);
        }
        
        if (fs.existsSync('verification_key.json')) {
            console.log('  - verification_key.json - The verification key');
        }
        
        if (fs.existsSync('proof_of_license.wasm')) {
            console.log('  - proof_of_license.wasm - The compiled circuit');
        }
        
        console.log('');
        console.log('🚀 Your zero-knowledge proof system is now ready to use!');
        console.log('');
        console.log('What you can do now:');
        console.log('  📝 Generate proofs: The zkey allows you to prove you have a type A license');
        console.log('  ✅ Verify proofs: The verification key allows others to verify your proofs');
        console.log('  🔒 Privacy preserved: Your personal data (birthdate, etc.) stays private');
        console.log('');
        console.log('Next steps:');
        console.log('  1. Run: node license_verification.js (see the demo)');
        console.log('  2. Run: npm test (run the test suite)');
        
    } catch (error) {
        console.error('❌ Error creating zkey:', error);
        console.error('');
        console.error('Troubleshooting:');
        console.error('  - Make sure you have internet connection for downloading powers of tau');
        console.error('  - Check that you have sufficient disk space');
        console.error('  - Ensure snarkjs is properly installed: npm install snarkjs');
        process.exit(1);
    }
}

function generateEntropy() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Run the setup
createZkeyFinal().catch(console.error);
