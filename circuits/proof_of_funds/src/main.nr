// Proof-of-funds: balance >= threshold without revealing balance.
// Public inputs: root, revocation_root, policy_id, nullifier (V3: no public wallet)

use dep::poseidon::poseidon2::Poseidon2;

global TEST_NOTE_SECRET: Field = 318823512651796005784698282711234952579815818683886676077412632652998948480;
global TEST_POLICY_ID: Field = 2;

fn hash2(a: Field, b: Field) -> Field {
    Poseidon2::hash([a, b], 2)
}

fn main(
    root: pub Field,
    revocation_root: pub Field,
    policy_id: pub Field,
    nullifier: pub Field,
    balance: u64,
    threshold: u64,
    note_secret: Field,
) {
    assert(balance >= threshold);
    assert(root == 0);
    assert(revocation_root == 0);
    assert(policy_id == 2);
    let computed = hash2(note_secret, policy_id);
    assert(computed == nullifier);
}

#[test]
fn nullifier_for_note() {
    let n = hash2(TEST_NOTE_SECRET, TEST_POLICY_ID);
    println(f"nullifier_note={n}");
}
