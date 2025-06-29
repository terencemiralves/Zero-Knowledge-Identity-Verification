// This script generates an input for the LicenseA.circom circuit and outputs a valid witness.
// Usage: node generateWitness.js

const fs = require("fs");

// Converts a string to an array of ASCII codes, padded with zeros to length
function strToAsciiArr(str, len) {
    const arr = [];
    for (let i = 0; i < len; i++) {
        arr.push(i < str.length ? str.charCodeAt(i) : 0);
    }
    return arr;
}

function makeInput(name, surname, dob, license) {
    return {
        name: strToAsciiArr(name, 16),
        surname: strToAsciiArr(surname, 16),
        dob: strToAsciiArr(dob, 10),
        license: strToAsciiArr(license, 1)
    };
}

// Example user
const input = makeInput(
    "John",          // name
    "Doe",           // surname
    "1990-01-01",    // dob
    "B"              // license (must be 'A' for a valid witness)
);

// Output witness input as JSON (for circom/wasm, use snarkjs wtns)
fs.writeFileSync("input.json", JSON.stringify(input, null, 2));
console.log("Input for witness generation written to input.json");
