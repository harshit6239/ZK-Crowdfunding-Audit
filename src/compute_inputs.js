// compute_inputs.js
//
// Generates input.json for the CrowdfundWithCommitments circuit.
// Uses circomlibjs Poseidon to compute commitments.

const fs = require("fs");
const circomlibjs = require("circomlibjs");

async function main() {
    // 1. Define donations and randomness
    const amounts = [10n, 20n, 5n, 15n]; // 4 donors
    const randomness = [99123n, 88412n, 17171n, 55555n];

    if (amounts.length !== randomness.length) {
        throw new Error("amounts and randomness must have same length");
    }

    // 2. Build Poseidon hash function
    const poseidon = await circomlibjs.buildPoseidon();
    const F = poseidon.F;

    // 3. Compute commitments[i] = Poseidon(amounts[i], randomness[i])
    const commitments = [];
    for (let i = 0; i < amounts.length; i++) {
        const hash = poseidon([amounts[i], randomness[i]]);
        const commitment = F.toString(hash); // decimal string for circom/snarkjs
        commitments.push(commitment);
    }

    // 4. Compute total = sum(amounts)
    let total = 0n;
    for (const a of amounts) {
        total += a;
    }

    // 5. Prepare JSON in the exact format circuit expects
    //
    // total: single value
    // commitments: array of strings
    // amounts: array of strings
    // randomness: array of strings
    const input = {
        total: total.toString(),
        commitments: commitments,
        amounts: amounts.map((a) => a.toString()),
        randomness: randomness.map((r) => r.toString()),
    };

    // 6. Write to input.json
    fs.writeFileSync(
        "./inputs/input.json",
        JSON.stringify(input, null, 2),
        "utf-8"
    );

    console.log("Generated input.json");
    console.log("total:", input.total);
    console.log("commitments:", input.commitments);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
