export function FreighterInstallHint({
  variant = 'sidebar',
  className = '',
}: {
  variant?: 'sidebar' | 'inline' | 'navbar';
  className?: string;
}) {
  return (
    <p className={`fin-freighter-hint fin-freighter-hint-${variant} ${className}`.trim()}>
      Need a Stellar wallet?{' '}
      <a href="https://freighter.app/" target="_blank" rel="noreferrer">
        Freighter
      </a>
      ,{' '}
      <a href="https://xbull.app/" target="_blank" rel="noreferrer">
        xBull
      </a>
      , Albedo, LOBSTR, or Hana — pick any in the connect modal.
    </p>
  );
}
