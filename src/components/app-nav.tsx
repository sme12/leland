import { Show, SignInButton, UserButton } from '@clerk/tanstack-react-start';
import { Drawer } from '@base-ui/react/drawer';
import { Link } from '@tanstack/react-router';
import {
  CalendarDays,
  LogIn,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  Scissors,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LanguageSwitcher } from './language-switcher';

const iconButtonClass =
  'inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-foreground shadow-sm outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring';

const drawerLinkClass =
  'flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-foreground outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring';

const drawerActiveClass = 'bg-muted';

export function AppNav() {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="border-b border-border bg-background/95">
      <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center justify-between gap-2 px-3 sm:px-4">
        <Link
          to="/"
          className="text-base font-semibold tracking-normal text-foreground"
        >
          {t('app.name')}
        </Link>
        <nav aria-label={t('app.name')} className="flex items-center gap-1.5">
          <Show when="signed-in">
            <Link
              to="/visits"
              aria-label={t('nav.visits')}
              title={t('nav.visits')}
              activeProps={{ className: 'bg-muted' }}
              className={iconButtonClass}
            >
              <CalendarDays aria-hidden="true" className="size-4" />
            </Link>
            <Link
              to="/purchases"
              aria-label={t('nav.purchases')}
              title={t('nav.purchases')}
              activeProps={{ className: 'bg-muted' }}
              className={iconButtonClass}
            >
              <ReceiptText aria-hidden="true" className="size-4" />
            </Link>
          </Show>
          <Drawer.Root
            open={menuOpen}
            onOpenChange={setMenuOpen}
            swipeDirection="right"
          >
            <Drawer.Trigger
              aria-label={t('nav.menu')}
              title={t('nav.menu')}
              className={iconButtonClass}
            >
              <Menu aria-hidden="true" className="size-4" />
            </Drawer.Trigger>
            <Drawer.Portal>
              <Drawer.Backdrop className="fixed inset-0 z-40 bg-foreground/30 opacity-100 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
              <Drawer.Viewport className="fixed inset-0 z-50 flex justify-end overflow-hidden pointer-events-none">
                <Drawer.Popup className="pointer-events-auto flex h-dvh w-[min(20rem,calc(100vw-1.5rem))] max-w-full translate-x-0 flex-col border-l border-border bg-background shadow-2xl transition-transform duration-200 ease-out data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full data-[swiping]:transition-none">
                  <nav
                    aria-label={t('nav.menu')}
                    className="flex min-h-0 flex-1 flex-col"
                  >
                    <div className="flex min-h-14 items-center justify-between border-b border-border px-4">
                      <Drawer.Title className="text-sm font-semibold text-foreground">
                        {t('nav.menu')}
                      </Drawer.Title>
                      <Drawer.Close
                        aria-label={t('nav.closeMenu')}
                        className="inline-flex size-9 items-center justify-center rounded-md text-foreground outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <X aria-hidden="true" className="size-4" />
                      </Drawer.Close>
                    </div>
                    <Drawer.Content className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
                      <Show when="signed-in">
                        <div className="grid gap-1">
                          <Link
                            to="/customers"
                            onClick={closeMenu}
                            activeProps={{ className: drawerActiveClass }}
                            className={drawerLinkClass}
                          >
                            <Users aria-hidden="true" className="size-4" />
                            {t('nav.customers')}
                          </Link>
                          <Link
                            to="/materials"
                            onClick={closeMenu}
                            activeProps={{ className: drawerActiveClass }}
                            className={drawerLinkClass}
                          >
                            <Package aria-hidden="true" className="size-4" />
                            {t('nav.materials')}
                          </Link>
                          <Link
                            to="/catalog/services"
                            onClick={closeMenu}
                            activeProps={{ className: drawerActiveClass }}
                            className={drawerLinkClass}
                          >
                            <Scissors aria-hidden="true" className="size-4" />
                            {t('nav.servicePrices')}
                          </Link>
                        </div>
                      </Show>
                      <div className="grid gap-3 border-t border-border pt-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 px-3">
                          <span className="text-sm font-medium text-muted-foreground">
                            {t('language.label')}
                          </span>
                          <LanguageSwitcher />
                        </div>
                        <Show when="signed-in">
                          <div className="flex items-center justify-between gap-3 rounded-md px-3 py-2">
                            <span className="text-sm font-medium text-muted-foreground">
                              {t('nav.account')}
                            </span>
                            <UserButton />
                          </div>
                          <Link
                            to="/sign-out"
                            onClick={closeMenu}
                            className={drawerLinkClass}
                          >
                            <LogOut aria-hidden="true" className="size-4" />
                            {t('nav.signOut')}
                          </Link>
                        </Show>
                        <Show when="signed-out">
                          <SignInButton mode="redirect">
                            <button
                              type="button"
                              className="flex w-full items-center gap-3 rounded-md bg-foreground px-3 py-3 text-sm font-medium text-background outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={closeMenu}
                            >
                              <LogIn aria-hidden="true" className="size-4" />
                              {t('nav.signIn')}
                            </button>
                          </SignInButton>
                        </Show>
                      </div>
                    </Drawer.Content>
                  </nav>
                </Drawer.Popup>
              </Drawer.Viewport>
            </Drawer.Portal>
          </Drawer.Root>
        </nav>
      </div>
    </header>
  );
}
