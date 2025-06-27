import { sha256 } from 'js-sha256';
import * as snarkjs from 'snarkjs';

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
    dob,
    licsense
}) {
    const nonce = crypto.randomUUID();

    const rawString = name + dob + licsense + nonce;
    const hash = sha256(rawString);

    const input = {
        name,
        dob: dateToUnix(dob),
        licsense,
        nonce,
        hash
    };
    // FIXME - Modifier le nom des circuits une fois qu'il seront créés
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, 'circuit.wasm', 'circuit_final.zkey');

    return {
        proof,
        publicSignals,
        input
    };
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