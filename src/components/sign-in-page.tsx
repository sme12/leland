import { SignIn } from '@clerk/tanstack-react-start';
import { useTranslation } from 'react-i18next';

export function SignInPage() {
  const { t } = useTranslation();

  return (
    <main className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-5xl place-items-center px-4 py-8">
      <section className="grid w-full max-w-md gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">
            {t('auth.signInTitle')}
          </h1>
          <p className="mt-2 text-sm text-muted">{t('auth.signInIntro')}</p>
        </div>
        <div className="flex justify-center">
          <SignIn path="/sign-in" routing="path" />
        </div>
      </section>
    </main>
  );
}
