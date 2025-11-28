const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const snarkjs = require("snarkjs");
const circomlibjs = require("circomlibjs");
const {
    DONOR_COUNT,
    createCrowdfundInput,
    getDefaultDonorsAsStrings,
} = require("./lib/crowdfundInputs");

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json({ limit: "1mb" }));

const publicDir = path.join(__dirname, "../public");
app.use(express.static(publicDir));

const wasmPath = path.join(
    __dirname,
    "../build/crowdfund_commit_js/crowdfund_commit.wasm"
);
const zkeyPath = path.join(__dirname, "../keys/crowdfund_commit_final.zkey");
const verificationKeyPath = path.join(
    __dirname,
    "../keys/verification_key.json"
);

let verificationKey = null;
let poseidonInstance = null;

function ensureFileExists(targetPath, label) {
    if (!fs.existsSync(targetPath)) {
        throw new Error(`Missing ${label} at ${targetPath}`);
    }
}

function generateEntropy() {
    return BigInt(`0x${crypto.randomBytes(8).toString("hex")}`).toString();
}

app.get("/api/config", (req, res) => {
    res.json({
        donorCount: DONOR_COUNT,
        sampleDonors: getDefaultDonorsAsStrings(),
    });
});

app.post("/api/proof", async (req, res) => {
    try {
        const { donors } = req.body || {};

        if (!Array.isArray(donors)) {
            throw new Error("donors array is required in the request body");
        }

        if (donors.length !== DONOR_COUNT) {
            throw new Error(
                `circuit expects ${DONOR_COUNT} donors, received ${donors.length}`
            );
        }

        const normalizedDonors = donors.map((donor, index) => {
            if (donor == null) {
                throw new Error(`donor[${index}] is missing`);
            }

            const amountValue = donor.amount;
            const randomnessValue = donor.randomness;

            if (
                amountValue === undefined ||
                amountValue === null ||
                `${amountValue}`.trim() === ""
            ) {
                throw new Error(`donor[${index}].amount must be provided`);
            }

            const randomnessFinal =
                randomnessValue && `${randomnessValue}`.trim() !== ""
                    ? `${randomnessValue}`.trim()
                    : generateEntropy();

            return {
                amount: `${amountValue}`.trim(),
                randomness: randomnessFinal,
            };
        });

        const amounts = normalizedDonors.map((donor) => donor.amount);
        const randomness = normalizedDonors.map((donor) => donor.randomness);

        const { input, total, commitments } = await createCrowdfundInput(
            amounts,
            randomness,
            {
                poseidonInstance,
            }
        );

        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input,
            wasmPath,
            zkeyPath
        );

        const publicTotal = publicSignals[0];
        const publicCommitments = publicSignals.slice(1);

        if (publicCommitments.length !== commitments.length) {
            throw new Error(
                "unexpected public signals length returned by prover"
            );
        }

        const mismatchCommitmentIndex = publicCommitments.findIndex(
            (value, index) => value !== commitments[index]
        );
        if (
            publicTotal !== total.toString() ||
            mismatchCommitmentIndex !== -1
        ) {
            throw new Error("public signals do not match computed values");
        }

        const verified = await snarkjs.groth16.verify(
            verificationKey,
            publicSignals,
            proof
        );

        res.json({
            donors: normalizedDonors,
            total: total.toString(),
            commitments,
            publicSignals,
            publicTotal,
            publicCommitments,
            proof,
            verified,
            input,
        });
    } catch (err) {
        console.error("/api/proof error", err);
        res.status(400).json({
            error: err.message || "Unknown error",
        });
    }
});

app.use((req, res, next) => {
    if (req.method === "GET" && req.accepts("html")) {
        return res.sendFile(path.join(publicDir, "index.html"));
    }
    return next();
});

async function start() {
    try {
        ensureFileExists(wasmPath, "circuit wasm");
        ensureFileExists(zkeyPath, "final zkey");
        ensureFileExists(verificationKeyPath, "verification key");

        const verificationRaw = fs.readFileSync(verificationKeyPath, "utf-8");
        verificationKey = JSON.parse(verificationRaw);

        poseidonInstance = await circomlibjs.buildPoseidon();

        app.listen(PORT, () => {
            console.log(
                `ZK Crowdfunding demo ready on http://localhost:${PORT}`
            );
        });
    } catch (err) {
        console.error("Failed to start server", err);
        process.exit(1);
    }
}

start();
