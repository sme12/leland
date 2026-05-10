import { Show, SignInButton, UserButton } from '@clerk/tanstack-react-start';
import { Link } from '@tanstack/react-router';
import { LogIn, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { LanguageSwitcher } from './language-switcher';

export function AppNav() {
  const { t } = useTranslation();

  return (
    <header className="border-b border-border bg-background/95">
      <div className="mx-auto flex min-h-16 w-full max-w-5xl items-center justify-between gap-3 px-4">
        <Link
          to="/"
          className="text-base font-semibold tracking-normal text-foreground"
        >
          {t('app.name')}
        </Link>
        <nav aria-label={t('app.name')} className="flex items-center gap-2">
          <LanguageSwitcher />
          <Show when="signed-in">
            <UserButton />
            <Link
              to="/sign-out"
              aria-label={t('nav.signOut')}
              title={t('nav.signOut')}
              className="inline-flex size-10 items-center justify-center rounded-md border border-border bg-surface text-foreground shadow-sm outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut aria-hidden="true" className="size-4" />
            </Link>
          </Show>
          <Show when="signed-out">
            <SignInButton mode="redirect">
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-3 text-sm font-medium text-background outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <LogIn aria-hidden="true" className="size-4" />
                {t('nav.signIn')}
              </button>
            </SignInButton>
          </Show>
        </nav>
      </div>
    </header>
  );
}
