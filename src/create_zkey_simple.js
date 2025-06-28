const snarkjs = require('snarkjs');
const fs = require('fs');
const https = require('https');
const path = require('path');

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        console.log(`  - Downloading ${path.basename(dest)}...`);
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`  ✅ Downloaded ${path.basename(dest)}`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {}); // Delete the file on error
            reject(err);
        });
    });
}

async function createZkeySimple() {
    console.log('🔐 Creating zkey file using pre-computed powers of tau...');
    
    try {
        // Create necessary directories
        const buildDir = './build';
        const ptauDir = path.join(buildDir, 'ptau');
        
        if (!fs.existsSync(ptauDir)) {
            fs.mkdirSync(ptauDir, { recursive: true });
        }
        
        // Download pre-computed powers of tau file
        console.log('📥 Downloading pre-computed powers of tau...');
        const ptauUrl = 'https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau';
        const ptauPath = path.join(ptauDir, 'powersOfTau28_hez_final_12.ptau');
        
        if (!fs.existsSync(ptauPath)) {
            await downloadFile(ptauUrl, ptauPath);
        } else {
            console.log('  ✅ Powers of tau file already exists');
        }
        
        // Change to build directory
        process.chdir(buildDir);
        console.log('📁 Working directory:', process.cwd());
        
        // Phase 2: Circuit-specific setup
        console.log('Phase 2: Circuit-specific setup...');
        
        // Create initial zkey
        console.log('  - Creating initial zkey...');
        await snarkjs.zKey.newZKey('proof_of_license.r1cs', 'ptau/powersOfTau28_hez_final_12.ptau', 'proof_of_license_0000.zkey');
        
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
            console.log(`  - proof_of_license_final.zkey (${(zkeyStats.size / (1024*1024)).toFixed(2)} MB)`);
        }
        
        if (fs.existsSync('verification_key.json')) {
            console.log('  - verification_key.json');
        }
        
        console.log('');
        console.log('Your zero-knowledge proof system is now ready to use! 🚀');
        console.log('');
        console.log('Next steps:');
        console.log('  1. Run: node license_verification.js (demo)');
        console.log('  2. Run: npm test (run tests)');
        
    } catch (error) {
        console.error('❌ Error creating zkey:', error);
        process.exit(1);
    }
}

function generateEntropy() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Run the setup
createZkeySimple().catch(console.error);
