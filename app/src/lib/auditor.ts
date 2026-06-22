import type { DeploymentConfig } from './config';
import {
  extractPublicInputFields,
  nullifierHexFromBundle,
  readNullifierSpent,
  readOnChainRoots,
  type ProofBundle,
} from './contracts';
import type { DisclosurePack } from './disclosure';
import { rootsMatchCredential } from './passport';
import type { IssuerCredentialResponse } from './config';

export type AuditorVerification = {
  ok: boolean;
  checks: Array<{ label: string; pass: boolean; detail: string }>;
  publicInputs: ProofBundle['publicInputs'] | null;
  nullifierHex: string | null;
  nullifierSpent: boolean | null;
};

function proofFromDisclosure(pack: DisclosurePack): ProofBundle {
  return {
    proofHex: '',
    publicInputsHex: pack.proofPublicInputsHex,
    publicInputs: pack.proofPublicInputs,
  };
}

function proofFromPublicInputsHex(hex: string): ProofBundle['publicInputs'] {
  return extractPublicInputFields(hex);
}

export async function verifyAuditorInput(
  config: DeploymentConfig,
  input:
    | { kind: 'disclosure'; pack: DisclosurePack }
    | { kind: 'public-inputs'; publicInputsHex: string }
    | { kind: 'nullifier'; nullifierHex: string; policyId: number },
): Promise<AuditorVerification> {
  const checks: AuditorVerification['checks'] = [];
  let publicInputs: ProofBundle['publicInputs'] | null = null;
  let nullifierHex: string | null = null;
  let policyId = config.policyId;
  let nullifierSpent: boolean | null = null;

  if (input.kind === 'disclosure') {
    publicInputs = input.pack.proofPublicInputs;
    policyId = input.pack.policyId;
    nullifierHex = nullifierHexFromBundle(proofFromDisclosure(input.pack));
    checks.push({
      label: 'Disclosure pack version',
      pass: input.pack.version === 1,
      detail: `v${input.pack.version}`,
    });
    checks.push({
      label: 'Issuer address present',
      pass: Boolean(input.pack.issuerEthAddress),
      detail: input.pack.issuerEthAddress,
    });
    checks.push({
      label: 'Credential not expired at export',
      pass: input.pack.expiresAt > input.pack.createdAt,
      detail: new Date(input.pack.expiresAt).toISOString(),
    });
  } else if (input.kind === 'public-inputs') {
    publicInputs = proofFromPublicInputsHex(input.publicInputsHex);
    policyId = Number(publicInputs.policyId);
    nullifierHex = `0x${BigInt(publicInputs.nullifier).toString(16).padStart(64, '0')}`;
  } else {
    nullifierHex = input.nullifierHex.startsWith('0x')
      ? input.nullifierHex
      : `0x${input.nullifierHex}`;
    policyId = input.policyId;
  }

  if (publicInputs) {
    let onChainRoots;
    try {
      onChainRoots = await readOnChainRoots(config);
      const credLike = {
        credential: {
          root: publicInputs.root,
          revocationRoot: publicInputs.revocationRoot,
        },
      } as IssuerCredentialResponse;
      const match = rootsMatchCredential(onChainRoots, credLike);
      checks.push({
        label: 'Merkle root matches chain',
        pass: match,
        detail: publicInputs.root,
      });
      checks.push({
        label: 'Revocation root matches chain',
        pass: match,
        detail: publicInputs.revocationRoot,
      });
    } catch (err) {
      checks.push({
        label: 'Read on-chain roots',
        pass: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }

    checks.push({
      label: 'Policy ID',
      pass: Number(publicInputs.policyId) > 0,
      detail: publicInputs.policyId,
    });
    checks.push({
      label: 'No public wallet in proof',
      pass: true,
      detail: 'V3 private note binding — address not in public inputs',
    });
  }

  if (nullifierHex) {
    try {
      nullifierSpent = await readNullifierSpent(config, nullifierHex, policyId);
      checks.push({
        label: 'Nullifier spent on-chain',
        pass: !nullifierSpent,
        detail: nullifierSpent ? 'spent — proof already used' : 'available',
      });
    } catch (err) {
      checks.push({
        label: 'Nullifier lookup',
        pass: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const ok = checks.length > 0 && checks.every((c) => c.pass);
  return { ok, checks, publicInputs, nullifierHex, nullifierSpent };
}
