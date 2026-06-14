import { useEffect, useState } from 'react';

import { Link, useNavigate } from 'react-router-dom';

import { ArrowRightLeft, ExternalLink } from 'lucide-react';

import { AppShell } from '../components/layout/Shell';

import { Card, CardHeader } from '../components/ui/Card';

import { Button } from '../components/ui/Button';

import { Badge } from '../components/ui/Badge';

import { EmptyState } from '../components/ui/States';

import { useApp } from '../context/AppContext';

import { proofMatchesCredential } from '../lib/credentialProof';

import {

  buildTransferTransaction,

  buildUsdcTransferTransaction,

  buildEurcTransferTransaction,

  formatSorobanUserError,

  nullifierHexFromBundle,

  readBalance,

  readNullifierSpent,

  readUsdcSacBalance,

  readEurcSacBalance,

  validateStellarAddress,

} from '../lib/contracts';

import { checkRecipientUsdcTrustline } from '../lib/horizon';

import { explorerTxUrl, truncateMiddle } from '../lib/utils';



type AssetKind = 'rwa' | 'usdc' | 'eurc';



export function TransferPage() {

  const {

    address,

    proof,

    credential,

    config,

    signAndSubmit,

    pushActivity,

    recordTransferTx,

  } = useApp();

  const navigate = useNavigate();

  const activeProof = proofMatchesCredential(proof, credential) ? proof : null;

  const [asset, setAsset] = useState<AssetKind>('rwa');

  const [to, setTo] = useState('');

  const [amount, setAmount] = useState('');

  const [rwaBalance, setRwaBalance] = useState<string | null>(null);

  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);

  const [eurcBalance, setEurcBalance] = useState<string | null>(null);

  const [nullifierSpent, setNullifierSpent] = useState<boolean | null>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [txHash, setTxHash] = useState<string | null>(null);

  const usdcReady = Boolean(config.complianceSacAdminId);
  const eurcReady = Boolean(config.complianceSacAdminId && config.eurcSacId);



  useEffect(() => {

    if (!address) return;

    readBalance(config, address)

      .then(setRwaBalance)

      .catch(() => setRwaBalance(null));

    readUsdcSacBalance(config, address)
      .then(setUsdcBalance)
      .catch(() => setUsdcBalance(null));
    if (config.eurcSacId) {
      readEurcSacBalance(config, address)
        .then(setEurcBalance)
        .catch(() => setEurcBalance(null));
    }

  }, [address, config, txHash, asset]);



  useEffect(() => {

    if (!activeProof) {

      setNullifierSpent(null);

      return;

    }

    let cancelled = false;

    readNullifierSpent(

      config,

      nullifierHexFromBundle(activeProof),

      Number(activeProof.publicInputs.policyId),

    )

      .then((spent) => {

        if (!cancelled) setNullifierSpent(spent);

      })

      .catch(() => {

        if (!cancelled) setNullifierSpent(null);

      });

    return () => {

      cancelled = true;

    };

  }, [activeProof, config]);



  const handleTransfer = async () => {

    if (!address || !activeProof || !to || !amount) return;

    if (nullifierSpent) {

      setError(formatSorobanUserError('Error(Contract, #7)'));

      return;

    }

    const recipient = to.trim();

    if (!validateStellarAddress(recipient)) {

      setError('Enter a valid Stellar recipient address (starts with G).');

      return;

    }

    if (Number(amount) <= 0) {

      setError('Enter a positive amount.');

      return;

    }

    if (asset === 'usdc') {

      const trustlineStatus = await checkRecipientUsdcTrustline(config, recipient);

      if (trustlineStatus === 'missing') {

        setError(

          `Recipient ${truncateMiddle(recipient, 8, 6)} has no USDC trustline for official testnet USDC. ` +

            `Use treasury ${truncateMiddle(config.marketplaceSettlementAddress, 8, 6)} or Marketplace settlement.`,

        );

        return;

      }

    }

    setLoading(true);

    setError(null);

    try {

      const xdr =
        asset === 'usdc'
          ? await buildUsdcTransferTransaction(config, address, address, recipient, amount, activeProof)
          : asset === 'eurc'
            ? await buildEurcTransferTransaction(config, address, address, recipient, amount, activeProof)
            : await buildTransferTransaction(config, address, address, recipient, amount, activeProof);

      const hash = await signAndSubmit(xdr);

      setTxHash(hash);

      await recordTransferTx(hash, {

        from: address,

        to: recipient,

        amount,

        success: true,

      });

      pushActivity({

        kind: 'transfer',

        title:
          asset === 'usdc'
            ? `USDC settlement: ${amount}`
            : asset === 'eurc'
              ? `EURC settlement: ${amount}`
              : 'Transfer completed',
        detail: `${amount} ${asset === 'usdc' ? 'USDC' : asset === 'eurc' ? 'EURC' : 'units'} → ${truncateMiddle(recipient, 8, 6)}`,

        txHash: hash,

        explorerUrl: explorerTxUrl(config.explorerBaseUrl, hash),

        status: 'success',

      });

      navigate('/app/compliance');

    } catch (err) {

      const raw = err instanceof Error ? err.message : String(err);

      setError(formatSorobanUserError(raw));

      pushActivity({

        kind: 'transfer',

        title: 'Transfer failed',

        detail: raw,

        status: 'error',

      });

    } finally {

      setLoading(false);

    }

  };



  const balanceLabel =
    asset === 'usdc'
      ? usdcBalance !== null
        ? `${usdcBalance} USDC (SAC)`
        : 'USDC unavailable — add trustline to official issuer'
      : asset === 'eurc'
        ? eurcBalance !== null
          ? `${eurcBalance} EURC (SAC)`
          : 'EURC unavailable — add trustline first'
      : rwaBalance !== null
        ? `${rwaBalance} RWA units`
        : 'Loading…';



  return (

    <AppShell>

      <div className="space-y-6">

        <div>

          <Badge tone="brand">Step 3</Badge>

          <h1 className="mt-3 text-3xl font-semibold text-navy">Transfer asset</h1>

          <p className="mt-2 max-w-2xl text-slate-muted">

            Proof-gated settlement on Stellar testnet — RwaToken or USDC via ComplianceSacAdmin.

          </p>

        </div>



        {!activeProof ? (

          <EmptyState

            title="Proof required"

            description="Generate a fresh proof before transferring."

            action={

              <Link to="/app/prove">

                <Button>Generate proof</Button>

              </Link>

            }

          />

        ) : (

          <>

            <div className="flex flex-wrap gap-2">

              <Button variant={asset === 'rwa' ? 'primary' : 'secondary'} size="sm" onClick={() => setAsset('rwa')}>

                RwaToken

              </Button>

              <Button

                variant={asset === 'usdc' ? 'primary' : 'secondary'}

                size="sm"

                disabled={!usdcReady}

                onClick={() => {

                  setAsset('usdc');

                  setTo(config.marketplaceSettlementAddress);

                }}

              >

                USDC (SAC)

              </Button>

              <Button
                variant={asset === 'eurc' ? 'primary' : 'secondary'}
                size="sm"
                disabled={!eurcReady}
                onClick={() => {
                  setAsset('eurc');
                  setTo(config.marketplaceSettlementAddress);
                }}
              >
                EURC (SAC)
              </Button>

            </div>



            <Card>

              <CardHeader

                title="Replay protection"

                badge={

                  nullifierSpent === false ? (

                    <Badge tone="ok">Nullifier unspent</Badge>

                  ) : nullifierSpent ? (

                    <Badge tone="err">Nullifier spent</Badge>

                  ) : (

                    <Badge>Checking…</Badge>

                  )

                }

              />

            </Card>



            <Card>

              <CardHeader

                title={asset === 'usdc' ? 'USDC SAC transfer' : 'RWA token transfer'}

                description={

                  asset === 'usdc'

                    ? `ComplianceSacAdmin ${truncateMiddle(config.complianceSacAdminId ?? '', 6, 4)} → official USDC SAC`

                    : 'PolicyVerifier.verify inside RwaToken.transfer'

                }

                badge={<Badge tone="ok">{balanceLabel}</Badge>}

              />

              {!address ? (

                <p className="text-sm text-slate-muted">Connect wallet to transfer.</p>

              ) : (

                <div className="grid gap-4 md:grid-cols-2">

                  <label className="block">

                    <span className="text-sm text-slate-muted">Recipient (Stellar address)</span>

                    <input

                      className="mt-2 w-full rounded-xl border border-slate-line px-4 py-3 font-mono text-sm outline-none focus:border-brand"

                      value={to}

                      onChange={(e) => setTo(e.target.value)}

                      placeholder={

                        asset === 'usdc' ? config.marketplaceSettlementAddress : 'G...'

                      }

                    />

                    {asset === 'usdc' ? (

                      <p className="mt-2 text-xs text-slate-muted">

                        Treasury settlement (has USDC trustline). Recipient must trust official

                        testnet USDC or the transfer will fail.

                      </p>

                    ) : null}

                  </label>

                  <label className="block">

                    <span className="text-sm text-slate-muted">Amount</span>

                    <input

                      className="mt-2 w-full rounded-xl border border-slate-line px-4 py-3 text-sm outline-none focus:border-brand"

                      value={amount}

                      onChange={(e) => setAmount(e.target.value)}

                      type="number"

                      min="0"

                      step={asset === 'usdc' ? '0.0000001' : '1'}

                    />

                  </label>

                </div>

              )}

              <Button

                className="mt-6"

                loading={loading}

                disabled={!address || !to || !amount || nullifierSpent === true}

                onClick={handleTransfer}

              >

                <ArrowRightLeft className="h-4 w-4" />

                Transfer with proof

              </Button>

              {error ? <p className="mt-4 text-sm text-status-err">{error}</p> : null}

            </Card>



            {txHash ? (

              <Card>

                <CardHeader title="Transfer confirmed" badge={<Badge tone="ok">On-chain</Badge>} />

                <p className="font-mono text-xs break-all text-slate-ink">{txHash}</p>

                <a

                  href={explorerTxUrl(config.explorerBaseUrl, txHash)}

                  target="_blank"

                  rel="noreferrer"

                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline"

                >

                  View on Stellar Expert

                  <ExternalLink className="h-4 w-4" />

                </a>

              </Card>

            ) : null}

          </>

        )}

      </div>

    </AppShell>

  );

}


