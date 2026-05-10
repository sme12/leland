import { useUser } from '@clerk/tanstack-react-start';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { requireAuthenticated } from '#/lib/auth';

export const Route = createFileRoute('/')({
  beforeLoad: async () => await requireAuthenticated(),
  component: Home,
});

function Home() {
  const { t } = useTranslation();
  const { user } = useUser();
  const firstName = user?.firstName?.trim() || t('home.fallbackName');

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-5xl items-center px-4 py-10">
      <section className="w-full">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">
          {t('app.name')}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal text-foreground sm:text-5xl">
          {t('home.hello', { name: firstName })}
        </h1>
      </section>
    </main>
  );
}
