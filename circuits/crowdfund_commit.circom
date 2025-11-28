pragma circom 2.0.0;

// Adjust include path depending on where circomlib is installed.
// If you use npm and put circomlib in node_modules, this is common:
include "../node_modules/circomlib/circuits/poseidon.circom";

// Circuit: ZK crowdfunding with commitments
// Proves:
// - For each i, commitments[i] = Poseidon(amounts[i], randomness[i])
// - Sum_i amounts[i] = total
template CrowdfundWithCommitments(n) {

    // PUBLIC INPUTS
    signal input total;
    signal input commitments[n];

    // PUBLIC OUTPUTS
    signal output total_out;
    signal output commitments_out[n];

    // PRIVATE INPUTS
    signal input amounts[n];
    signal input randomness[n];

    // Internal sum
    signal sum;

    // Initialize sum to zero
    var varSum = 0;

    // Poseidon hashers
    component hashers[n];

    for (var i = 0; i < n; i++) {
        // Poseidon with 2 inputs: amount and randomness
        hashers[i] = Poseidon(2);

        // Connect inputs
        hashers[i].inputs[0] <== amounts[i];
        hashers[i].inputs[1] <== randomness[i];

        // Enforce computed hash equals public commitment
        hashers[i].out === commitments[i];

        // Expose commitment publicly
        commitments_out[i] <== commitments[i];

        // Accumulate sum of donations
        varSum += amounts[i];
    }
    
    sum <== varSum;

    // Enforce sum of all amounts equals public total
    sum === total;

    // Expose total publicly
    total_out <== total;
}

// Instantiate main circuit with 4 donors
component main = CrowdfundWithCommitments(4);
