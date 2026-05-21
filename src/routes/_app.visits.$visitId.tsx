import { useUser } from '@clerk/tanstack-react-start';
import { Toast } from '@base-ui/react/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { visitKeys } from '#/features/visits/visit-queries';
import { deleteVisit, getVisit } from '#/server/visits';
import { formatEuro, formatQuantity } from '#/shared/purchase-format';
import { testIds } from '#/testing/test-ids';

export const Route = createFileRoute('/_app/visits/$visitId')({
  component: VisitDetailRoute,
});

function VisitDetailRoute() {
  const { t, i18n } = useTranslation();
  const { user } = useUser();
  const userKey = user?.id ?? 'pending';
  const { visitId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = Toast.useToastManager();
  const getVisitFn = useServerFn(getVisit);
  const deleteVisitFn = useServerFn(deleteVisit);
  const query = useQuery({
    queryKey: visitKeys.detail(userKey, visitId),
    queryFn: () => getVisitFn({ data: { id: visitId } }),
    staleTime: 30_000,
    retry: false,
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteVisitFn({ data: { id: visitId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: visitKeys.root });
      await navigate({ to: '/visits' });
    },
    onError: (error) => {
      toast.add({
        title: t('visit.deleteFailed'),
        description: error.message,
      });
    },
  });

  function confirmDelete() {
    if (query.data && window.confirm(t('visit.confirmDelete'))) {
      deleteMutation.mutate();
    }
  }

  return (
    <main
      data-testid={testIds.visitDetail.root}
      className="mx-auto w-full max-w-2xl px-4 py-8"
    >
      <Link
        to="/visits"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('common.back')}
      </Link>

      {query.isPending ? (
        <p className="mt-6 text-sm text-muted-foreground">
          {t('visit.loading')}
        </p>
      ) : query.isError ? (
        <section className="mt-6 rounded-md border border-border bg-surface p-4 sm:p-6">
          <p className="text-sm font-medium">{t('visit.notFoundTitle')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('visit.notFoundBody')}
          </p>
        </section>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1
                data-testid={testIds.visitDetail.title}
                className="text-3xl font-semibold tracking-normal"
              >
                {query.data.customer.name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatDisplayDate(query.data.date, i18n.language)} ·{' '}
                {t(query.data.service.name)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/visits/$visitId/edit"
                params={{ visitId }}
                data-testid={testIds.visitDetail.editLink}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Pencil aria-hidden="true" className="size-4" />
                {t('common.edit')}
              </Link>
              <button
                type="button"
                data-testid={testIds.visitDetail.deleteButton}
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-danger outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <Trash2 aria-hidden="true" className="size-4" />
                {t('common.delete')}
              </button>
            </div>
          </div>

          <dl
            data-testid={testIds.visitDetail.summary}
            className="mt-6 grid gap-3 rounded-md border border-border bg-surface p-4 sm:grid-cols-3 sm:p-6"
          >
            <DetailItem
              label={t('visit.fields.priceCharged')}
              value={formatEuro(query.data.priceCharged, i18n.language)}
            />
            <DetailItem
              label={t('visit.fields.cost')}
              value={formatEuro(query.data.totalCost, i18n.language)}
            />
            <DetailItem
              label={t('visit.fields.net')}
              value={formatEuro(query.data.net, i18n.language)}
            />
          </dl>

          <section
            data-testid={testIds.visitDetail.materials}
            className="mt-6 overflow-hidden rounded-md border border-border bg-surface"
          >
            <h2 className="bg-muted/40 px-4 py-3 text-sm font-semibold">
              {t('visit.materialsTitle')}
            </h2>
            {query.data.lineItems.length === 0 ? (
              <p
                data-testid={testIds.visitDetail.pureLabor}
                className="p-4 text-sm text-muted-foreground"
              >
                {t('visit.pureLabor')}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {query.data.lineItems.map((item) => (
                  <li
                    key={item.id}
                    data-testid={testIds.visitDetail.materialRow}
                    className="grid gap-2 p-4 sm:grid-cols-[1fr_auto]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {item.material.name}
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {formatQuantity(
                          item.amount,
                          item.material.unitOfMeasure,
                          i18n.language,
                          t(`material.uom.${item.material.unitOfMeasure}`),
                        )}{' '}
                        ·{' '}
                        {formatEuro(item.unitCost, i18n.language, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 4,
                        })}
                        /{t(`material.uom.${item.material.unitOfMeasure}`)}
                      </span>
                    </span>
                    <span className="font-semibold">
                      {formatEuro(item.totalCost, i18n.language)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {query.data.note ? (
            <section className="mt-6 rounded-md border border-border bg-surface p-4 sm:p-6">
              <h2 className="text-sm font-semibold">
                {t('visit.fields.note')}
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {query.data.note}
              </p>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}

function formatDisplayDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00.000Z`));
}
