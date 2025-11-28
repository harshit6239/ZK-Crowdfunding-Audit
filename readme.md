1. compiling the circuit -> circom ./circuits/crowdfund_commit.circom --r1cs --wasm --sym -o build

2. generating witness ->

cd build/crowdfund_commit_js
node generate_witness.js crowdfund_commit.wasm ../../inputs/input.json ../../witness/witness.wtns
cd ../../

3. Trusted setup ->

snarkjs powersoftau new bn128 12 ./powersoftau/phase1_pot12_00.ptau -v
snarkjs powersoftau contribute ./powersoftau/phase1_pot12_00.ptau ./powersoftau/phase1_pot12_01.ptau --name="first contribution" -v -e="zkp_assignment"
snarkjs powersoftau prepare phase2 ./powersoftau/phase1_pot12_01.ptau ./powersoftau/phase1_pot12_final.ptau -v

snarkjs powersoftau verify ./powersoftau/phase1_pot12_final.ptau

snarkjs groth16 setup build/crowdfund_commit.r1cs ./powersoftau/phase1_pot12_final.ptau ./keys/crowdfund_commit_0000.zkey
snarkjs zkey contribute ./keys/crowdfund_commit_0000.zkey ./keys/crowdfund_commit_final.zkey --name="key1" -v -e="zkp_assignment"
snarkjs zkey export verificationkey ./keys/crowdfund_commit_final.zkey keys/verification_key.json

4. snarkjs groth16 prove ./keys/crowdfund_commit_final.zkey ./witness/witness.wtns ./output/proof.json ./output/public.json

5. snarkjs groth16 verify ./keys/verification_key.json ./output/public.json ./output/proof.json
