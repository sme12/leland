import { useUser } from '@clerk/tanstack-react-start';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Link } from '@tanstack/react-router';
import { CalendarDays, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { VisitOrDraftListRowDto } from '#/server/visits';
import { listVisitRows } from '#/server/visits';
import { formatEuro } from '#/shared/purchase-format';
import { testIds } from '#/testing/test-ids';
import { visitKeys } from './visit-queries';

type OptimisticVisitRow = VisitOrDraftListRowDto & { isPending?: boolean };

export function VisitsList() {
  const { t, i18n } = useTranslation();
  const { user } = useUser();
  const userKey = user?.id ?? 'pending';
  const listVisitRowsFn = useServerFn(listVisitRows);
  const query = useQuery({
    queryKey: visitKeys.list(userKey),
    queryFn: () => listVisitRowsFn(),
    staleTime: 30_000,
    enabled: !!user,
  });
  const groups = useMemo(
    () =>
      groupVisits(
        (query.data ?? []) as Array<OptimisticVisitRow>,
        i18n.language,
      ),
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
          data-testid={testIds.visitsList.addLink}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-3 text-sm font-semibold text-background outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus aria-hidden="true" className="size-4" />
          {t('visit.add')}
        </Link>
      </div>

      <section
        data-testid={testIds.visitsList.root}
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
                  {group.visits.map((row) => (
                    <li
                      key={`${row.recordType}-${row.id}`}
                      data-testid={testIds.visitsList.row}
                      data-visit-id={
                        row.recordType === 'visit' ? row.id : undefined
                      }
                      data-visit-draft-id={
                        row.recordType === 'draft' ? row.id : undefined
                      }
                    >
                      {row.isPending ? (
                        <VisitRow row={row} locale={i18n.language} />
                      ) : row.recordType === 'draft' ? (
                        <Link
                          to="/visits/drafts/$draftId/edit"
                          params={{ draftId: row.id }}
                          className="block outline-none hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <VisitRow row={row} locale={i18n.language} />
                        </Link>
                      ) : (
                        <Link
                          to="/visits/$visitId"
                          params={{ visitId: row.id }}
                          className="block outline-none hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <VisitRow row={row} locale={i18n.language} />
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
  row,
  locale,
}: {
  row: OptimisticVisitRow;
  locale: string;
}) {
  const { t } = useTranslation();
  const isDraft = row.recordType === 'draft';

  return (
    <div
      className={`grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center ${
        isDraft ? 'border-l-4 border-l-ring bg-muted/20' : ''
      }`}
    >
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-2 font-medium">
          <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">{row.customer.name}</span>
          {isDraft ? (
            <span className="shrink-0 rounded-md border border-border bg-surface px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              <span data-testid={testIds.visitsList.draftBadge}>
                {t('visit.draftBadge')}
              </span>
            </span>
          ) : null}
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">
          {formatVisitDate(row.date, locale)}
        </span>
      </span>
      <span className="grid grid-cols-2 gap-3 text-sm sm:min-w-56">
        <span>
          <span className="block text-muted-foreground">
            {isDraft
              ? t('visit.fields.estimatedPrice')
              : t('visit.fields.priceCharged')}
          </span>
          <span className="font-semibold">
            {isDraft
              ? row.estimatedPrice
                ? formatEuro(row.estimatedPrice, locale)
                : t('visit.noEstimatedPrice')
              : formatEuro(row.priceCharged, locale)}
          </span>
        </span>
        <span>
          <span className="block text-muted-foreground">
            {isDraft ? t('visit.fields.service') : t('visit.fields.cost')}
          </span>
          <span className="font-semibold">
            {isDraft
              ? t(row.service.name)
              : row.isPending
                ? t('visit.pendingCost')
                : formatEuro(row.totalCost, locale)}
          </span>
        </span>
      </span>
    </div>
  );
}

function groupVisits(visits: Array<OptimisticVisitRow>, locale: string) {
  const groups = new Map<
    string,
    { key: string; label: string; visits: Array<OptimisticVisitRow> }
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
