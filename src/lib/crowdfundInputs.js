const circomlibjs = require("circomlibjs");

const DONOR_COUNT = 4;

const DEFAULT_DONORS = [
    { amount: 10n, randomness: 99123n },
    { amount: 20n, randomness: 88412n },
    { amount: 5n, randomness: 17171n },
    { amount: 15n, randomness: 55555n },
];

function normalizeBigInts(values, label) {
    return values.map((value, index) => {
        try {
            return BigInt(value);
        } catch (err) {
            const context = `${label}[${index}]`;
            throw new Error(`Unable to interpret ${context} as an integer`);
        }
    });
}

async function createCrowdfundInput(amountsRaw, randomnessRaw, opts = {}) {
    if (!Array.isArray(amountsRaw) || !Array.isArray(randomnessRaw)) {
        throw new Error("amounts and randomness must be arrays");
    }

    if (amountsRaw.length !== randomnessRaw.length) {
        throw new Error("amounts and randomness must have the same length");
    }

    if (amountsRaw.length !== DONOR_COUNT) {
        throw new Error(
            `circuit expects ${DONOR_COUNT} donors, received ${amountsRaw.length}`
        );
    }

    const amounts = normalizeBigInts(amountsRaw, "amounts");
    const randomness = normalizeBigInts(randomnessRaw, "randomness");

    const poseidon =
        opts.poseidonInstance || (await circomlibjs.buildPoseidon());
    const F = poseidon.F;

    const commitments = [];
    for (let i = 0; i < DONOR_COUNT; i += 1) {
        const hash = poseidon([amounts[i], randomness[i]]);
        commitments.push(F.toString(hash));
    }

    let total = 0n;
    for (const amount of amounts) {
        total += amount;
    }

    const input = {
        total: total.toString(),
        commitments,
        amounts: amounts.map((value) => value.toString()),
        randomness: randomness.map((value) => value.toString()),
    };

    return {
        input,
        total,
        commitments,
    };
}

function getDefaultDonorsAsStrings() {
    return DEFAULT_DONORS.map(({ amount, randomness }) => ({
        amount: amount.toString(),
        randomness: randomness.toString(),
    }));
}

module.exports = {
    DONOR_COUNT,
    createCrowdfundInput,
    getDefaultDonorsAsStrings,
};
