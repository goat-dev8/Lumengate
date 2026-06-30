import assert from 'node:assert/strict';
import test from 'node:test';

test('resolveConfidentialAsset loads EURC from legacy config fields', async () => {
  const { resolveConfidentialAsset, confidentialAssetReady } = await import('../src/lib/confidentialAssetConfig.ts');
  const config = {
    eurcSacId: 'CCEO6CAXLBLBOPES32MALMYLOJPHSK477WZH6ZOOHECV4IKLUCTZKU25',
    usdcSacId: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
    confidentialTokenId: 'CD6GQ4ZMC3VOE4QZJY32IGXRNOESZGLCZDRLD2PNWZSMKLMH2XR3MLZ6',
    confidentialVerifierId: 'CDT6OHHRX2WK45A7RXAFCAA3ETOOYWD67N4XEUZN7BDRR7NOYSUNB2GO',
    confidentialAuditorId: 'CCUMCSQOSLI2VHE4FIGYATSEPBUDMPFNDLUQH753HIOFKECH435QKNEW',
    confidentialPolicyId: 'CBBGGAKMHHDQKLF2ER4HAB6ATIEGZZ75CNAADKQJRP6E34HMNQQ72274',
    confidentialUnderlyingId: 'CCEO6CAXLBLBOPES32MALMYLOJPHSK477WZH6ZOOHECV4IKLUCTZKU25',
    confidentialAuditorIdNum: 1,
  };
  const eurc = resolveConfidentialAsset(config, 'eurc');
  assert.equal(eurc.key, 'eurc');
  assert.ok(eurc.contracts?.token);
  assert.ok(confidentialAssetReady(config, 'eurc'));
});

test('USDC confidential loads from deployments.json confidential_tokens', async () => {
  const { resolveConfidentialAsset, confidentialAssetReady } = await import('../src/lib/confidentialAssetConfig.ts');
  const config = {
    usdcSacId: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
    confidentialTokens: {
      usdc: {
        token: 'CBIGJFIRVZRNUJ45TN5EMLMMIBJY4GHELFLVYCJ4HUZLWUWA2VSSWOWF',
        verifier: 'CBTQRGYH6YWWRZXUMMW4JFGLFBBY2JGG5DVZMMLADUEMCBJEVBZKURUS',
        auditor: 'CAMGRDELQPYIPJEZPW5GYBPTPEADP7RAK4KMZEXVSUN5AAVOWHYDCJYY',
        policy: 'CB22T45KWIJHMYUVIEVEXVC3RYZ2FKVKQ26EFSINB5TOLASPDOSWEDEM',
        underlying: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
        auditorIdNum: 1,
        deployedAtLedger: 3369135,
      },
    },
  };
  const usdc = resolveConfidentialAsset(config, 'usdc');
  assert.equal(usdc.key, 'usdc');
  assert.ok(usdc.contracts?.token);
  assert.ok(confidentialAssetReady(config, 'usdc'));
});
