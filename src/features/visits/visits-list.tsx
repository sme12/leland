import { useUser } from '@clerk/tanstack-react-start';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Link } from '@tanstack/react-router';
import { CalendarDays, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { VisitDto } from '#/server/visits';
import { listVisits } from '#/server/visits';
import { formatEuro } from '#/shared/purchase-format';
import { visitKeys } from './visit-queries';

type OptimisticVisit = VisitDto & { isPending?: boolean };

export function VisitsList() {
  const { t, i18n } = useTranslation();
  const { user } = useUser();
  const userKey = user?.id ?? 'pending';
  const listVisitsFn = useServerFn(listVisits);
  const query = useQuery({
    queryKey: visitKeys.list(userKey),
    queryFn: () => listVisitsFn(),
    staleTime: 30_000,
    enabled: !!user,
  });
  const groups = useMemo(
    () =>
      groupVisits((query.data ?? []) as Array<OptimisticVisit>, i18n.language),
    [i18n.language, query.data],
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal">
            {t('visit.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('visit.subtitle')}
          </p>
        </div>
        <Link
          to="/visits/new"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-3 text-sm font-semibold text-background outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus aria-hidden="true" className="size-4" />
          {t('visit.add')}
        </Link>
      </div>

      <section
        data-visits-list
        data-loaded={query.isPending ? 'false' : 'true'}
        className="mt-6 overflow-hidden rounded-md border border-border bg-surface"
      >
        {query.isError ? (
          <p className="p-4 text-sm text-danger">{t('visit.loadError')}</p>
        ) : query.isPending ? (
          <p className="p-4 text-sm text-muted-foreground">
            {t('visit.loading')}
          </p>
        ) : groups.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {t('visit.empty')}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {groups.map((group) => (
              <section key={group.key} data-visit-month={group.key}>
                <h2 className="bg-muted/40 px-4 py-3 text-sm font-semibold uppercase tracking-normal">
                  {group.label}
                </h2>
                <ul className="divide-y divide-border">
                  {group.visits.map((visit) => (
                    <li key={visit.id} data-visit-id={visit.id}>
                      {visit.isPending ? (
                        <VisitRow visit={visit} locale={i18n.language} />
                      ) : (
                        <Link
                          to="/visits/$visitId"
                          params={{ visitId: visit.id }}
                          className="block outline-none hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <VisitRow visit={visit} locale={i18n.language} />
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function VisitRow({
  visit,
  locale,
}: {
  visit: OptimisticVisit;
  locale: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-2 font-medium">
          <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">{visit.customer.name}</span>
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">
          {formatVisitDate(visit.date, locale)}
        </span>
      </span>
      <span className="grid grid-cols-2 gap-3 text-sm sm:min-w-56">
        <span>
          <span className="block text-muted-foreground">
            {t('visit.fields.priceCharged')}
          </span>
          <span className="font-semibold">
            {formatEuro(visit.priceCharged, locale)}
          </span>
        </span>
        <span>
          <span className="block text-muted-foreground">
            {t('visit.fields.cost')}
          </span>
          <span className="font-semibold">
            {visit.isPending
              ? t('visit.pendingCost')
              : formatEuro(visit.totalCost, locale)}
          </span>
        </span>
      </span>
    </div>
  );
}

function groupVisits(visits: Array<OptimisticVisit>, locale: string) {
  const groups = new Map<
    string,
    { key: string; label: string; visits: Array<OptimisticVisit> }
  >();

  for (const visit of visits) {
    const key = visit.date.slice(0, 7);
    const label = new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
      .format(new Date(`${key}-01T00:00:00.000Z`))
      .toLocaleUpperCase(locale);
    const group = groups.get(key) ?? { key, label, visits: [] };

    group.visits.push(visit);
    groups.set(key, group);
  }

  return Array.from(groups.values());
}

function formatVisitDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00.000Z`));
}
