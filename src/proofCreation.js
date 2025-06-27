import { sha256 } from 'js-sha256';
import * as snarkjs from 'snarkjs';
import crypto from 'crypto';

/*
 * @description Generates a zk-SNARK proof based on the provided user data.
 * @param {Object} params - The parameters for proof generation.
 * @param {string} params.name - The name of the user.
 * @param {string} params.dob - The date of birth of the user in YYYY-MM-DD format.
 * @param {string} params.licsense - The license number of the user.
 * @returns {Promise<Object>} - A promise that resolves to an object containing the proof, public signals, and input data.
 * @throws {Error} - Throws an error if the proof generation fails.
 */
async function generateProof({
  name,
  familyName,
  dob,
  licsense,
  expirationDate
}) {
  const nonce = crypto.randomUUID().slice(0, 8); // 8 chars nonce

  const rawString = name + familyName + dob + licsense + expirationDate + nonce;
  const hash = sha256(rawString);

  const input = {
    pubName: stringToAsciiArray(name, 4),
    pubSurname: stringToAsciiArray(familyName, 6),
    privDate: stringToAsciiArray(dob, 10),
    privLicense: [licsense.charCodeAt(0)],
    privExpDate: stringToAsciiArray(expirationDate, 10),
    nonce: stringToAsciiArray(nonce, 8),
    commitment: hashToBitArray(hash),
  };

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    '../data/proof_of_license_js/proof_of_license.wasm',
    '../data/circuit_final.zkey'
  );

  return { proof, publicSignals, input };
}

function stringToAsciiArray(str, length) {
  const arr = new Array(length).fill(0);
  for (let i = 0; i < str.length && i < length; i++) {
    arr[i] = str.charCodeAt(i);
  }
  return arr;
}

function hexToBitArray(hexStr) {
  const bits = [];
  for (let i = 0; i < hexStr.length; i++) {
    const nibble = parseInt(hexStr[i], 16);
    // Convert each hex digit (4 bits) to bits array
    bits.push((nibble & 8) >> 3);
    bits.push((nibble & 4) >> 2);
    bits.push((nibble & 2) >> 1);
    bits.push(nibble & 1);
  }
  return bits;
}

function hashToBitArray(hash) {
  const bits = hexToBitArray(hash);
  // The circuit expects commitment[256], so slice to 256 bits:
  return bits.slice(0, 256);
}


/*
* @description Converts a date string in YYYY-MM-DD format to a Unix timestamp.
* @param {string} date - The date string to convert.
* @returns {number} - The Unix timestamp corresponding to the date.
*/
function dateToUnix(date) {
    return Math.floor(new Date(date).getTime() / 1000);
}

export default generateProof;