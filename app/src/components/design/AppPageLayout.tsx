import type { ReactNode } from 'react';
import { TopBar, type PasskeyTopBarStatus } from './TopBar';
import { useApp } from '../../context/AppContext';

type AppPageLayoutProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Default max-w-7xl; use max-w-5xl or max-w-6xl for narrower pages */
  width?: '5xl' | '6xl' | '7xl';
  passkeyStatus?: PasskeyTopBarStatus;
};

const widthClass = {
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
} as const;

function derivePasskeyStatus(
  smartAccount: unknown,
  passportActivated: boolean,
  credential: unknown,
): PasskeyTopBarStatus {
  if (smartAccount && passportActivated) return 'ready';
  if (smartAccount) return 'setup';
  if (credential) return 'setup';
  return 'needed';
}

export function AppPageLayout({
  title,
  subtitle,
  actions,
  children,
  width = '7xl',
  passkeyStatus: passkeyOverride,
}: AppPageLayoutProps) {
  const { smartAccount, passportActivated, credential } = useApp();
  const passkeyStatus =
    passkeyOverride ?? derivePasskeyStatus(smartAccount, passportActivated, credential);

  return (
    <>
      <TopBar title={title} subtitle={subtitle} actions={actions} passkeyStatus={passkeyStatus} />
      <main className={`mx-auto w-full ${widthClass[width]} px-6 pb-20 pt-8`}>{children}</main>
    </>
  );
}
