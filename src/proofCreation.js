import { sha256 } from 'js-sha256';
import * as snarkjs from 'snarkjs';

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

function dateToUnix(date) {
    return Math.floor(new Date(date).getTime() / 1000);
}

export default generateProof;