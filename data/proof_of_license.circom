pragma circom 2.0.0;

include "circomlib/sha256.circom";

template ProofOfLicense() {
    // Entrées publiques
    signal input pubName[4];     // "Jean"
    signal input pubSurname[6];  // "Durand"
    signal input commitment[2];  // Hash SHA256 en deux parties 128 bits

    // Entrées privées
    signal input privDate[10];       // "2000-01-01"
    signal input privLicense[1];     // "A"
    signal input privExpDate[10];    // "2026-01-01"
    signal input nonce[8];           // exemple : "x7Tr9sP0"

    // Concaténation des données sous forme d’un tableau
    signal fullInput[39]; // 4+6+10+1+10+8 = 39 caractères ASCII

    component hash = Sha256();

    // Étape 1 : concaténation
    for (var i = 0; i < 4; i++) {
        fullInput[i] = pubName[i];
    }
    for (var i = 0; i < 6; i++) {
        fullInput[4 + i] = pubSurname[i];
    }
    for (var i = 0; i < 10; i++) {
        fullInput[10 + i] = privDate[i];
    }
    fullInput[20] = privLicense[0];
    for (var i = 0; i < 10; i++) {
        fullInput[21 + i] = privExpDate[i];
    }
    for (var i = 0; i < 8; i++) {
        fullInput[31 + i] = nonce[i];
    }

    // Étape 2 : hash SHA256
    hash.in <== fullInput;
    for (var i = 0; i < 2; i++) {
        hash.out[i] === commitment[i];  // Vérifie que le hash correspond
    }

    // Étape 3 : condition ZKP — permis A
    privLicense[0] === 65;  // ASCII("A") = 65
}

component main = ProofOfLicense();
