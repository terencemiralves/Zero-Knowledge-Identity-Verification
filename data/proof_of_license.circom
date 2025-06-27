pragma circom 2.0.0;

include "circomlib/circuits/sha256/sha256.circom";
include "circomlib/circuits/bitify.circom";

template ProofOfLicense() {
    // Entrées publiques
    signal input pubName[4];     // "Jean"
    signal input pubSurname[6];  // "Durand"
    signal input commitment[256]; // Hash SHA256 complet (256 bits)
    
    // Entrées privées
    signal input privDate[10];       // "2000-01-01"
    signal input privLicense[1];     // "A"
    signal input privExpDate[10];    // "2026-01-01"
    signal input nonce[8];           // exemple : "x7Tr9sP0"
    
    // Concaténation des données sous forme d'un tableau de bits
    // Chaque caractère ASCII = 8 bits, donc 39 caractères = 312 bits
    signal fullInputBits[312]; // 39 * 8 = 312 bits
    
    // Composant SHA256 avec 312 bits d'entrée
    component hash = Sha256(312);
    
    // Conversion des caractères ASCII en bits
    component charToBits[39];
    for (var i = 0; i < 39; i++) {
        charToBits[i] = Num2Bits(8);
    }
    
    // Concaténation des données
    signal fullInput[39];
    
    // Nom (4 caractères)
    for (var i = 0; i < 4; i++) {
        fullInput[i] <== pubName[i];
    }
    
    // Prénom (6 caractères)
    for (var i = 0; i < 6; i++) {
        fullInput[4 + i] <== pubSurname[i];
    }
    
    // Date de naissance (10 caractères)
    for (var i = 0; i < 10; i++) {
        fullInput[10 + i] <== privDate[i];
    }
    
    // Type de permis (1 caractère)
    fullInput[20] <== privLicense[0];
    
    // Date d'expiration (10 caractères)
    for (var i = 0; i < 10; i++) {
        fullInput[21 + i] <== privExpDate[i];
    }
    
    // Nonce (8 caractères)
    for (var i = 0; i < 8; i++) {
        fullInput[31 + i] <== nonce[i];
    }
    
    // Conversion en bits
    for (var i = 0; i < 39; i++) {
        charToBits[i].in <== fullInput[i];
        for (var j = 0; j < 8; j++) {
            fullInputBits[i * 8 + j] <== charToBits[i].out[j];
        }
    }
    
    // Hash SHA256
    hash.in <== fullInputBits;
    
    // Vérification du hash
    for (var i = 0; i < 256; i++) {
        hash.out[i] === commitment[i];
    }
    
    // Condition ZKP — permis A
    privLicense[0] === 65;  // ASCII("A") = 65
}

component main = ProofOfLicense();