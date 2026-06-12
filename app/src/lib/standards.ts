/**
 * SEP-57 / OpenZeppelin Stellar RWA identity verifier adapter surface.
 * Lumengate exposes the same verify(passport proof) contract API other RWA tokens can call.
 */

export type IdentityVerifierAdapter = {
  contractId: string;
  methods: {
    verifyPassport: 'verify_passport';
    isEligible: 'is_eligible';
  };
  standard: 'lumengate-passport-v1';
  compatibleWith: ['SEP-57-style RWA identity verifier', 'OpenZeppelin RWA hook pattern'];
};

export function loadIdentityVerifierAdapter(policyVerifierId: string): IdentityVerifierAdapter {
  return {
    contractId: policyVerifierId,
    methods: {
      verifyPassport: 'verify_passport',
      isEligible: 'is_eligible',
    },
    standard: 'lumengate-passport-v1',
    compatibleWith: ['SEP-57-style RWA identity verifier', 'OpenZeppelin RWA hook pattern'],
  };
}
