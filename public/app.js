const donorRowsEl = document.getElementById("donorRows");
const formEl = document.getElementById("donorForm");
const fillSampleBtn = document.getElementById("fillSample");
const randomizeBtn = document.getElementById("randomizeEntropy");
const statusPanel = document.getElementById("statusPanel");
const verificationPanel = document.getElementById("verificationPanel");
const formErrorEl = document.getElementById("formError");
const verifyFormEl = document.getElementById("verifyForm");
const proofInputEl = document.getElementById("proofInput");
const signalsInputEl = document.getElementById("signalsInput");
const fillFromLastProofBtn = document.getElementById("fillFromLastProof");
const verifySubmitBtn = document.getElementById("verifySubmit");
const verifyErrorEl = document.getElementById("verifyError");

let donorCount = 4;
let sampleDonors = [];
let lastProofPayload = null;

async function init() {
    await loadConfig();
    renderRows();
    if (sampleDonors.length === donorCount) {
        applyDonorValues(sampleDonors);
    }
}

async function loadConfig() {
    try {
        const response = await fetch("/api/config");
        if (!response.ok) {
            return;
        }
        const config = await response.json();
        if (typeof config.donorCount === "number" && config.donorCount > 0) {
            donorCount = config.donorCount;
        }
        if (Array.isArray(config.sampleDonors)) {
            sampleDonors = config.sampleDonors.map((donor) => ({
                amount: `${donor.amount}`,
                randomness: `${donor.randomness}`,
            }));
        }
    } catch (err) {
        console.warn("Unable to load config", err);
    }
}

function renderRows() {
    donorRowsEl.innerHTML = "";
    for (let i = 0; i < donorCount; i += 1) {
        const row = document.createElement("div");
        row.className = "donor-row";
        row.innerHTML = `
      <label>
        Donor ${i + 1} Amount (USD)
        <input type="number" name="amount-${i}" min="0" step="1" placeholder="0" required>
      </label>
      <label>
        Randomness (optional)
        <input type="text" name="randomness-${i}" pattern="^\\d*$" inputmode="numeric" placeholder="Auto-generate if empty">
      </label>
    `;
        donorRowsEl.appendChild(row);
    }
}

function applyDonorValues(donors) {
    donors.forEach((donor, index) => {
        const amountInput = document.querySelector(`[name="amount-${index}"]`);
        const randomnessInput = document.querySelector(
            `[name="randomness-${index}"]`
        );
        if (amountInput) {
            amountInput.value = donor.amount ?? "";
        }
        if (randomnessInput) {
            randomnessInput.value = donor.randomness ?? "";
        }
    });
}

function randomEntropy() {
    const buffer = new Uint32Array(2);
    window.crypto.getRandomValues(buffer);
    return ((BigInt(buffer[0]) << 32n) | BigInt(buffer[1])).toString();
}

function collectDonors() {
    const donors = [];
    for (let i = 0; i < donorCount; i += 1) {
        const amountInput = document.querySelector(`[name="amount-${i}"]`);
        const randomnessInput = document.querySelector(
            `[name="randomness-${i}"]`
        );

        if (!amountInput) {
            continue;
        }

        const amount = amountInput.value.trim();
        const randomness = randomnessInput ? randomnessInput.value.trim() : "";

        if (amount === "") {
            showFormError(`Donor ${i + 1} amount is required`);
            amountInput.focus();
            return null;
        }

        if (!/^-?\d+$/.test(amount)) {
            showFormError(`Donor ${i + 1} amount must be an integer`);
            amountInput.focus();
            return null;
        }

        if (randomness !== "" && !/^\d+$/.test(randomness)) {
            showFormError(`Donor ${i + 1} randomness must contain digits only`);
            if (randomnessInput) {
                randomnessInput.focus();
            }
            return null;
        }

        donors.push({ amount, randomness });
    }
    hideFormError();
    return donors;
}

function showFormError(message) {
    formErrorEl.textContent = message;
    formErrorEl.classList.remove("hidden");
}

function hideFormError() {
    formErrorEl.textContent = "";
    formErrorEl.classList.add("hidden");
}

function showVerifyError(message) {
    if (!verifyErrorEl) {
        return;
    }
    verifyErrorEl.textContent = message;
    verifyErrorEl.classList.remove("hidden");
}

function hideVerifyError() {
    if (!verifyErrorEl) {
        return;
    }
    verifyErrorEl.textContent = "";
    verifyErrorEl.classList.add("hidden");
}

function setVerificationBusy(isBusy) {
    if (!verifySubmitBtn) {
        return;
    }
    verifySubmitBtn.disabled = isBusy;
    verifySubmitBtn.textContent = isBusy ? "Verifying..." : "Verify Proof";
}

function parseJsonInput(rawText, label) {
    if (!rawText || rawText.trim() === "") {
        throw new Error(`${label} is required`);
    }
    try {
        return JSON.parse(rawText);
    } catch (err) {
        throw new Error(`${label} must be valid JSON`);
    }
}

function normalizePublicSignalsArray(signals) {
    if (!Array.isArray(signals)) {
        throw new Error("Public signals JSON must be an array");
    }
    return signals.map((value, index) => {
        if (typeof value === "string") {
            const trimmed = value.trim();
            if (trimmed === "") {
                throw new Error(
                    `Public signals entry ${index} cannot be empty`
                );
            }
            return trimmed;
        }
        if (typeof value === "number" || typeof value === "bigint") {
            return value.toString();
        }
        throw new Error(
            `Public signals entry ${index} must be a string, number, or bigint`
        );
    });
}

function setBusyState(isBusy) {
    const submitButton = formEl.querySelector("button.primary");
    if (isBusy) {
        statusPanel.innerHTML =
            '<p class="placeholder">Generating witness &amp; proof...</p>';
        verificationPanel.innerHTML =
            '<p class="placeholder">Waiting for proof output...</p>';
        submitButton.disabled = true;
        submitButton.textContent = "Working...";
    } else {
        submitButton.disabled = false;
        submitButton.textContent = "Prove & Verify";
    }
}

function renderError(message) {
    statusPanel.innerHTML = "";
    const pill = document.createElement("div");
    pill.className = "status-pill error";
    pill.textContent = message;
    statusPanel.appendChild(pill);

    verificationPanel.innerHTML = "";
    const verifyPill = document.createElement("div");
    verifyPill.className = "status-pill error";
    verifyPill.textContent = "Verification unavailable";
    verificationPanel.appendChild(verifyPill);

    const verifyNote = document.createElement("p");
    verifyNote.className = "hint";
    verifyNote.textContent =
        "Proof generation failed, so verification did not run.";
    verificationPanel.appendChild(verifyNote);
}

function renderProofResult(payload) {
    lastProofPayload = payload;
    hideVerifyError();

    if (proofInputEl && payload.proof) {
        proofInputEl.value = JSON.stringify(payload.proof, null, 2);
    }

    if (signalsInputEl && payload.publicSignals) {
        signalsInputEl.value = JSON.stringify(payload.publicSignals, null, 2);
    }

    statusPanel.innerHTML = "";

    const pill = document.createElement("div");
    pill.className = "status-pill success";
    pill.textContent = "Proof generated";
    statusPanel.appendChild(pill);

    const summary = document.createElement("p");
    summary.innerHTML = `<strong>Total Raised:</strong> ${payload.total}`;
    statusPanel.appendChild(summary);

    const inputsDetail = document.createElement("div");
    inputsDetail.className = "status-detail";
    inputsDetail.innerHTML = `<h3>Inputs Used</h3><pre>${payload.donors
        .map(
            (donor, index) =>
                `Donor ${index + 1}: amount=${donor.amount} randomness=${
                    donor.randomness
                }`
        )
        .join("\n")}</pre>`;
    statusPanel.appendChild(inputsDetail);

    const commitmentsDetail = document.createElement("div");
    commitmentsDetail.className = "status-detail";
    commitmentsDetail.innerHTML = `<h3>Commitments</h3><pre>${payload.commitments
        .map((value, index) => `C${index + 1} = ${value}`)
        .join("\n")}</pre>`;
    statusPanel.appendChild(commitmentsDetail);

    const proofDetail = document.createElement("div");
    proofDetail.className = "status-detail";
    proofDetail.innerHTML = `<h3>Proof</h3><pre>${JSON.stringify(
        payload.proof,
        null,
        2
    )}</pre>`;
    statusPanel.appendChild(proofDetail);

    const publicSignalsDetail = document.createElement("div");
    publicSignalsDetail.className = "status-detail";
    publicSignalsDetail.innerHTML = `<h3>Public Signals</h3><pre>${JSON.stringify(
        payload.publicSignals,
        null,
        2
    )}</pre>`;
    statusPanel.appendChild(publicSignalsDetail);
}

function renderVerificationResult(payload) {
    hideVerifyError();
    verificationPanel.innerHTML = "";

    const pill = document.createElement("div");
    pill.className = `status-pill ${payload.verified ? "success" : "error"}`;
    pill.textContent = payload.verified
        ? "Proof verified successfully"
        : "Proof failed verification";
    verificationPanel.appendChild(pill);

    const publicTotal =
        payload.publicTotal ??
        (Array.isArray(payload.publicSignals)
            ? payload.publicSignals[0]
            : undefined) ??
        "Unavailable";

    const totalDetail = document.createElement("p");
    totalDetail.innerHTML = `<strong>Public total:</strong> ${publicTotal}`;
    verificationPanel.appendChild(totalDetail);

    let commitments = [];
    if (Array.isArray(payload.publicCommitments)) {
        commitments = payload.publicCommitments;
    } else if (Array.isArray(payload.publicSignals)) {
        commitments = payload.publicSignals.slice(1);
    }

    const commitmentsDetail = document.createElement("div");
    commitmentsDetail.className = "status-detail";
    if (commitments.length > 0) {
        commitmentsDetail.innerHTML = `<h3>Public Commitments</h3><pre>${commitments
            .map((value, index) => `C${index + 1} = ${value}`)
            .join("\n")}</pre>`;
    } else {
        commitmentsDetail.innerHTML =
            "<h3>Public Commitments</h3><pre>No commitments returned.</pre>";
    }
    verificationPanel.appendChild(commitmentsDetail);
}

formEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    const donors = collectDonors();
    if (!donors) {
        return;
    }

    setBusyState(true);

    try {
        const response = await fetch("/api/proof", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ donors }),
        });

        const payload = await response.json();

        if (!response.ok) {
            throw new Error(payload.error || "Proof generation failed");
        }

        renderProofResult(payload);
        renderVerificationResult(payload);
    } catch (err) {
        renderError(err.message);
    } finally {
        setBusyState(false);
    }
});

fillSampleBtn.addEventListener("click", () => {
    if (sampleDonors.length === donorCount) {
        applyDonorValues(sampleDonors);
    }
});

randomizeBtn.addEventListener("click", () => {
    for (let i = 0; i < donorCount; i += 1) {
        const randomnessInput = document.querySelector(
            `[name="randomness-${i}"]`
        );
        if (randomnessInput) {
            randomnessInput.value = randomEntropy();
        }
    }
});

if (fillFromLastProofBtn) {
    fillFromLastProofBtn.addEventListener("click", () => {
        if (!lastProofPayload) {
            showVerifyError(
                "Generate or load a proof first to populate these fields."
            );
            return;
        }
        hideVerifyError();
        if (lastProofPayload.proof && proofInputEl) {
            proofInputEl.value = JSON.stringify(
                lastProofPayload.proof,
                null,
                2
            );
        }
        if (lastProofPayload.publicSignals && signalsInputEl) {
            signalsInputEl.value = JSON.stringify(
                lastProofPayload.publicSignals,
                null,
                2
            );
        }
    });
}

if (verifyFormEl) {
    verifyFormEl.addEventListener("submit", async (event) => {
        event.preventDefault();
        hideVerifyError();

        if (!proofInputEl || !signalsInputEl) {
            showVerifyError("Verification form is not available in this view.");
            return;
        }

        let proofData;
        let publicSignals;

        try {
            proofData = parseJsonInput(proofInputEl.value, "Proof");
            if (typeof proofData !== "object" || proofData === null) {
                throw new Error("Proof JSON must describe an object");
            }
            publicSignals = normalizePublicSignalsArray(
                parseJsonInput(signalsInputEl.value, "Public signals")
            );
            proofInputEl.value = JSON.stringify(proofData, null, 2);
            signalsInputEl.value = JSON.stringify(publicSignals, null, 2);
        } catch (err) {
            showVerifyError(err.message);
            return;
        }

        try {
            setVerificationBusy(true);
            verificationPanel.innerHTML =
                '<p class="placeholder">Running verifier...</p>';

            const response = await fetch("/api/verify", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ proof: proofData, publicSignals }),
            });

            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.error || "Verification failed");
            }

            const enrichedPayload = {
                ...payload,
                proof: proofData,
                publicSignals,
            };

            lastProofPayload = {
                ...(lastProofPayload || {}),
                proof: proofData,
                publicSignals,
                publicTotal: payload.publicTotal,
                publicCommitments: payload.publicCommitments,
                verified: payload.verified,
            };

            renderVerificationResult(enrichedPayload);
        } catch (err) {
            showVerifyError(err.message);
            verificationPanel.innerHTML = "";
            const pill = document.createElement("div");
            pill.className = "status-pill error";
            pill.textContent = "Verification failed";
            verificationPanel.appendChild(pill);
        } finally {
            setVerificationBusy(false);
        }
    });
}

init();
