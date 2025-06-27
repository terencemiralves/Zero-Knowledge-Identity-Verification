import generateProof from './proofCreation.js';  // note the .js extension

async function main() {
  const { proof, publicSignals, input } = await generateProof({
    name: 'John Doe',
    dob: '1990-01-01',
    licsense: 'ABC123456',
    familyName: 'Doe',
    expirationDate: '2025-09-09'
  });

  console.log('Proof:', proof);
  console.log('Public Signals:', publicSignals);
  console.log('Input:', input);
}

main();

