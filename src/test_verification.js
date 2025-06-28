const { LicenseVerificationSystem, createTestUser } = require('./license_verification.js');

async function testSystem() {
    console.log('🧪 Test du système de vérification');
    
    const system = new LicenseVerificationSystem();
    await system.initialize();
    
    // Test avec un utilisateur valide (permis A)
    console.log('\n--- Test utilisateur valide ---');
    const validUser = createTestUser('Jean', 'Durand', '2000-01-01', 'A', '2026-01-01');
    const result1 = await system.demo();
    console.log('Résultat:', result1);
    
    // Test avec un utilisateur invalide (permis B)
    console.log('\n--- Test utilisateur invalide ---');
    try {
        const invalidUser = createTestUser('Marie', 'Martin', '1995-05-15', 'B', '2025-12-31');
        const proofData = await system.generateProof(invalidUser);
        const isValid = await system.verifyProof(proofData.proof, proofData.publicSignals);
        console.log('Résultat preuve permis B:', isValid); // Devrait être false
    } catch (error) {
        console.log('✅ Erreur attendue pour permis B:', error.message);
    }
}

testSystem().catch(console.error);
