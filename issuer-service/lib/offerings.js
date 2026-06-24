const { readFileSync, existsSync } = require('fs');
const { join } = require('path');
const { policyByKey } = require('./policies');

const OFFERINGS_PATH =
  process.env.OFFERINGS_PATH || join(__dirname, '..', 'fixtures', 'offerings.json');

function loadOfferingsFile() {
  if (!existsSync(OFFERINGS_PATH)) {
    throw new Error(`Offerings file missing: ${OFFERINGS_PATH}`);
  }
  return JSON.parse(readFileSync(OFFERINGS_PATH, 'utf8'));
}

function envTrim(v) {
  return v ? String(v).trim().replace(/\r$/, '') : '';
}

/** Enrich offerings with live deployment IDs from env; offering data must come from configured fixtures. */
function listOfferings(env = process.env) {
  const raw = loadOfferingsFile();
  const rwaTokenId = envTrim(env.RWA_TOKEN_ID || env.VITE_RWA_TOKEN_ID);
  const policyVerifierId = envTrim(env.POLICY_VERIFIER_ID || env.VITE_POLICY_VERIFIER_ID);
  const rwaAdapterId = envTrim(env.RWA_ADAPTER_ID || env.VITE_RWA_ADAPTER_ID);
  const settlementAddress = envTrim(
    env.MARKETPLACE_SETTLEMENT_ADDRESS || env.VITE_MARKETPLACE_SETTLEMENT_ADDRESS,
  );
  const usdcSacId = envTrim(
    env.VITE_USDC_SAC_ID || 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  );
  const usdcIssuer = envTrim(
    env.VITE_USDC_ISSUER || 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  );
  const compliantDexId = envTrim(env.COMPLIANT_DEX_ID || env.VITE_COMPLIANT_DEX_ID);
  const compliantPayrollId = envTrim(env.COMPLIANT_PAYROLL_ID || env.VITE_COMPLIANT_PAYROLL_ID);

  return raw.map((row) => {
    const policy = policyByKey(row.requiredPolicy);
    const route =
      row.settlementRoute ||
      (row.settlementAsset === 'usdc' ? 'sac' : 'rwa');
    const settlementPolicyByRoute = {
      rwa: 'PolicyVerifier.verify → RwaToken.transfer',
      sac: 'ComplianceSacAdmin.transfer_compliant → USDC SAC',
      dex: 'CompliantDEX.swap_compliant → USDC SAC',
      payroll: 'CompliantPayroll.pay_compliant → USDC SAC',
    };
    const verificationRouteByRoute = {
      rwa: `${policyVerifierId ? 'PolicyVerifier' : 'PolicyVerifier'} → RwaToken`,
      sac: 'RwaAdapter.verify_passport → ComplianceSacAdmin',
      dex: 'RwaAdapter.verify_passport → CompliantDEX',
      payroll: 'RwaAdapter.verify_passport → CompliantPayroll',
    };
    return {
      ...row,
      settlementRoute: route,
      minimumAmount: row.minimumAmount,
      unitLabel: row.settlementAsset === 'usdc' ? 'USDC' : 'RWA units',
      policyId: policy.policyId,
      claims: policy.claims || [],
      eligibilityPolicy: policy.title,
      settlementPolicy: settlementPolicyByRoute[route] || settlementPolicyByRoute.sac,
      verificationRoute: verificationRouteByRoute[route] || verificationRouteByRoute.sac,
      proofRequirements: [
        `Policy ${policy.policyId}: ${(policy.claims || []).join(', ') || policy.title}`,
        'Unique nullifier per settlement (on-chain)',
      ],
      settlementAddress,
      contracts: {
        rwaTokenId: rwaTokenId || null,
        policyVerifierId: policyVerifierId || null,
        rwaAdapterId: rwaAdapterId || null,
        compliantDexId: compliantDexId || null,
        compliantPayrollId: compliantPayrollId || null,
      },
      complianceTargets: {
        usdcSacId,
        usdcIssuer,
      },
      fundsThreshold: row.fundsThreshold
        ? String(row.fundsThreshold)
        : policy.fundsThreshold
          ? String(policy.fundsThreshold)
          : undefined,
      whyProofRequired:
        row.description ||
        `Settlement requires UltraHonk proof for ${policy.title} without exposing PII on-chain.`,
    };
  });
}

function offeringById(id, env = process.env) {
  return listOfferings(env).find((o) => o.id === id) || null;
}

module.exports = { listOfferings, offeringById, OFFERINGS_PATH };
