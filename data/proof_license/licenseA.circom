pragma circom 2.1.4;

// Checks if two arrays of n signals are equal (returns 1 if equal, 0 otherwise)
template IsEqual(n) {
    signal input in[n];
    signal input constant[n];
    signal output out;

    var i;
    signal eq[n];

    for (i = 0; i < n; i++) {
        eq[i] <== 1 - (in[i] - constant[i]) * (in[i] - constant[i]);
    }

    var prod = 1;
    for (i = 0; i < n; i++) {
        prod *= eq[i];
    }
    out <== prod;
}

// LicenseA circuit
template LicenseA() {
    // Parameters: expected lengths (choose reasonable, e.g. 16 for name, 16 for surname, 10 for dob, 1 for license)
    signal input name[16];     // ASCII codes
    signal input surname[16];  // ASCII codes
    signal input dob[10];      // ASCII codes (yyyy-mm-dd)
    signal input license[1];   // ASCII code for 'A', 'B', or '/'

    signal output hasLicenseA;   // 1 if license is 'A', 0 otherwise

    // ASCII code for 'A' is 65
    component isA = IsEqual(1);
    isA.in[0] <== license[0];
    isA.constant[0] <== 65;

    hasLicenseA <== isA.out;
}

component main = LicenseA();
