// compute_inputs.js
//
// Generates input.json for the CrowdfundWithCommitments circuit.
// Uses circomlibjs Poseidon to compute commitments.

const fs = require("fs");
const {
    createCrowdfundInput,
    getDefaultDonorsAsStrings,
} = require("./lib/crowdfundInputs");

async function main() {
    const defaultDonors = getDefaultDonorsAsStrings();
    const amounts = defaultDonors.map((donor) => donor.amount);
    const randomness = defaultDonors.map((donor) => donor.randomness);

    const { input, total, commitments } = await createCrowdfundInput(
        amounts,
        randomness
    );

    fs.writeFileSync(
        "./inputs/input.json",
        JSON.stringify(input, null, 2),
        "utf-8"
    );

    console.log("Generated input.json");
    console.log("total:", total.toString());
    console.log("commitments:", commitments);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
