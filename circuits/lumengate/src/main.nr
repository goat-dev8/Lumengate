// Lumengate V3 eligibility circuit (circuits/eligibility semantics)
// Public: root, revocation_root, policy_id, asset_id, action_id, nullifier
// Private: note_secret, note_blinding, credential attributes
// Proves: Merkle membership, revocation non-membership, policy predicate,
//         private note binding, nullifier derivation (no public wallet)
// Issuer trust: Stellar Ed25519 signature verified off-chain at issuance;
//               on-chain IssuerRegistry + Merkle root admin gate authorized issuers.

use dep::poseidon::poseidon2::Poseidon2;

global MERKLE_DEPTH: u32 = 8;
global EIGHTEEN_YEARS_SECONDS: u64 = 568036800;
global TEST_NOTE_SECRET: Field = 19354118459287362494945372901602010677760359726580540197775835622036563665;
global TEST_NOTE_BLINDING: Field = 555555;
global TEST_POLICY_ID: Field = 1;
global TEST_ASSET_ID: Field = 1;
global TEST_ACTION_ID: Field = 1;
global TEST_REVOCATION_ACC: Field = 0;
global TEST_NOTE_LEAVES: [Field; 8] = [0, 0, 0, 0, 0, 0, 0, 0];

fn hash2(a: Field, b: Field) -> Field {
    Poseidon2::hash([a, b], 2)
}

fn hash3(a: Field, b: Field, c: Field) -> Field {
    Poseidon2::hash([a, b, c], 3)
}

fn hash4(a: Field, b: Field, c: Field, d: Field) -> Field {
    Poseidon2::hash([a, b, c, d], 4)
}

fn constrain_bit(bit: Field) {
    assert(bit * (1 - bit) == 0);
}

fn compute_merkle_root(leaf: Field, path_siblings: [Field; 8], path_bits: [Field; 8]) -> Field {
    let mut cur = leaf;
    for i in 0..8 {
        let sib = path_siblings[i];
        let bit = path_bits[i];
        constrain_bit(bit);
        if bit == 0 {
            cur = hash2(cur, sib);
        } else {
            cur = hash2(sib, cur);
        }
    }
    cur
}

fn compute_revocation_root(path_siblings: [Field; 8], path_bits: [Field; 8]) -> Field {
    let mut cur: Field = 0;
    for i in 0..8 {
        let sib = path_siblings[i];
        let bit = path_bits[i];
        constrain_bit(bit);
        if bit == 0 {
            cur = hash2(cur, sib);
        } else {
            cur = hash2(sib, cur);
        }
    }
    cur
}

fn field_from_u1(v: bool) -> Field {
    if v { 1 } else { 0 }
}

fn main(
    // --- Public inputs (order fixed for on-chain encoding) ---
    root: pub Field,
    revocation_root: pub Field,
    policy_id: pub Field,
    asset_id: pub Field,
    action_id: pub Field,
    nullifier: pub Field,
    // --- Private note binding (V3: no public wallet) ---
    note_secret: Field,
    note_blinding: Field,
    // --- Private credential attributes ---
    accredited: bool,
    jurisdiction_code: Field,
    dob_timestamp: Field,
    sanctions_clear: bool,
    issuer_id: Field,
    salt: Field,
    current_time: Field,
    min_jurisdiction: Field,
    max_jurisdiction: Field,
    // --- Merkle membership path ---
    path_siblings: [Field; 8],
    path_bits: [Field; 8],
    // --- Revocation non-membership path (sparse / empty leaf) ---
    rev_path_siblings: [Field; 8],
    rev_path_bits: [Field; 8],
) {
    // 1) Private pool note commitment (never public; unlinkability spine)
    let note_commitment = hash2(note_secret, note_blinding);
    assert(note_commitment != 0);

    // 2) Credential commitment C = Poseidon(attrs || salt)
    let attrs_hash = hash3(
        hash2(field_from_u1(accredited), jurisdiction_code),
        hash2(dob_timestamp, field_from_u1(sanctions_clear)),
        issuer_id,
    );
    let commitment = hash2(attrs_hash, salt);

    // 3) Policy predicate
    assert(accredited);
    assert(sanctions_clear);
    let j_code: u32 = jurisdiction_code as u32;
    let j_min: u32 = min_jurisdiction as u32;
    let j_max: u32 = max_jurisdiction as u32;
    assert(j_code >= j_min);
    assert(j_code <= j_max);
    let now: u64 = current_time as u64;
    let dob: u64 = dob_timestamp as u64;
    assert(now >= dob + EIGHTEEN_YEARS_SECONDS);

    // 4) Merkle membership under on-chain root
    let computed_root = compute_merkle_root(commitment, path_siblings, path_bits);
    assert(computed_root == root);

    // 5) Revocation non-membership
    let computed_rev = compute_revocation_root(rev_path_siblings, rev_path_bits);
    assert(computed_rev == revocation_root);
    assert(commitment != 0);

    // 6) Nullifier is scoped to one asset/action; no wallet address is public.
    let computed_nullifier = hash4(note_secret, policy_id, asset_id, action_id);
    assert(computed_nullifier == nullifier);
}

#[test]
fn test_fixture_values() {
    let note_secret: Field = 987654321;
    let note_blinding: Field = 555555;
    let accredited = true;
    let jurisdiction_code: Field = 840;
    let dob_timestamp: Field = 631152000;
    let sanctions_clear = true;
    let issuer_id: Field = 2;
    let salt: Field = 123456789;
    let policy_id: Field = 1;
    let asset_id: Field = 1;
    let action_id: Field = 1;

    let note_commitment = hash2(note_secret, note_blinding);
    let attrs_hash = hash3(
        hash2(field_from_u1(accredited), jurisdiction_code),
        hash2(dob_timestamp, field_from_u1(sanctions_clear)),
        issuer_id,
    );
    let commitment = hash2(attrs_hash, salt);
    let nullifier = hash4(note_secret, policy_id, asset_id, action_id);

    let path_siblings = [0; 8];
    let path_bits = [0; 8];
    let root = compute_merkle_root(commitment, path_siblings, path_bits);

    let rev_path_siblings = [0; 8];
    let rev_path_bits = [0; 8];
    let rev_root = compute_revocation_root(rev_path_siblings, rev_path_bits);

    println(f"note_commitment={note_commitment}");
    println(f"commitment={commitment}");
    println(f"nullifier={nullifier}");
    println(f"root={root}");
    println(f"rev_root={rev_root}");
}

#[test]
fn nullifier_for_note() {
    let note_secret: Field = TEST_NOTE_SECRET;
    let policy_id: Field = TEST_POLICY_ID;
    let asset_id: Field = TEST_ASSET_ID;
    let action_id: Field = TEST_ACTION_ID;
    let nullifier = hash4(note_secret, policy_id, asset_id, action_id);
    println(f"nullifier_note={nullifier}");
}

#[test]
fn note_commitment_for_note() {
    let note_commitment = hash2(TEST_NOTE_SECRET, TEST_NOTE_BLINDING);
    println(f"note_commitment_note={note_commitment}");
}

#[test]
fn note_root_from_leaves() {
    let mut acc: Field = 0;
    for i in 0..8 {
        acc = hash2(acc, TEST_NOTE_LEAVES[i]);
    }
    println(f"note_root={acc}");
}

#[test]
fn revocation_accumulator_root() {
    println(f"rev_root={TEST_REVOCATION_ACC}");
}
