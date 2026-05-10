import { useClerk } from '@clerk/tanstack-react-start';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/sign-out')({
  component: SignOutPage,
});

function SignOutPage() {
  const { t } = useTranslation();
  const { signOut } = useClerk();
  const navigate = useNavigate();

  useEffect(() => {
    void signOut({ redirectUrl: '/sign-in' }).catch(() => {
      void navigate({ to: '/sign-in' });
    });
  }, [navigate, signOut]);

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-5xl items-center justify-center px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-normal text-foreground">
        {t('auth.signingOut')}
      </h1>
    </main>
  );
}
