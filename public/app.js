const donorRowsEl = document.getElementById("donorRows");
const formEl = document.getElementById("donorForm");
const fillSampleBtn = document.getElementById("fillSample");
const randomizeBtn = document.getElementById("randomizeEntropy");
const statusPanel = document.getElementById("statusPanel");
const formErrorEl = document.getElementById("formError");

let donorCount = 4;
let sampleDonors = [];

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

function setBusyState(isBusy) {
    const submitButton = formEl.querySelector("button.primary");
    if (isBusy) {
        statusPanel.innerHTML =
            '<p class="placeholder">Generating witness &amp; proof...</p>';
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
}

function renderSuccess(payload) {
    statusPanel.innerHTML = "";

    const pill = document.createElement("div");
    pill.className = `status-pill ${payload.verified ? "success" : "error"}`;
    pill.textContent = payload.verified
        ? "Proof verified successfully"
        : "Proof failed verification";
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

        renderSuccess(payload);
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

init();
