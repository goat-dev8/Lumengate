/** Official Freighter wallet mark — https://freighter.app */
export const FREIGHTER_URL = 'https://freighter.app/';

export function FreighterIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <img
      src="/freighter-icon.png"
      alt=""
      className={className}
      decoding="async"
    />
  );
}
