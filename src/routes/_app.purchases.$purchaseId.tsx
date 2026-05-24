import { useUser } from '@clerk/tanstack-react-start';
import { Toast } from '@base-ui/react/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { purchaseKeys } from '#/features/purchases/purchase-queries';
import { invalidateMaterialQueries } from '#/features/materials/material-queries';
import { invalidateVisitMaterialQueries } from '#/features/visits/visit-query-invalidation';
import { deletePurchase, getPurchase } from '#/server/purchases';
import {
  computePurchaseUnitCost,
  formatEuro,
  formatQuantity,
  formatUnitCost,
} from '#/shared/purchase-format';
import { testIds } from '#/testing/test-ids';

export const Route = createFileRoute('/_app/purchases/$purchaseId')({
  component: PurchaseDetailRoute,
});

function PurchaseDetailRoute() {
  const { t, i18n } = useTranslation();
  const { user } = useUser();
  const userKey = user?.id ?? 'pending';
  const { purchaseId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = Toast.useToastManager();
  const getPurchaseFn = useServerFn(getPurchase);
  const deletePurchaseFn = useServerFn(deletePurchase);
  const query = useQuery({
    queryKey: purchaseKeys.detail(userKey, purchaseId),
    queryFn: () => getPurchaseFn({ data: { id: purchaseId } }),
    staleTime: 30_000,
    retry: false,
  });
  const deleteMutation = useMutation({
    mutationFn: () => deletePurchaseFn({ data: { id: purchaseId } }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: purchaseKeys.all(userKey),
        }),
        invalidateMaterialQueries(queryClient),
        invalidateVisitMaterialQueries({
          queryClient,
          userId: userKey,
          materialIds: [query.data?.materialId],
        }),
      ]);
      await navigate({ to: '/purchases' });
    },
    onError: (error) => {
      toast.add({
        title: t('purchase.deleteFailed'),
        description: error.message,
      });
    },
  });

  function confirmDelete() {
    if (query.data && window.confirm(t('purchase.confirmDelete'))) {
      deleteMutation.mutate();
    }
  }

  return (
    <main
      data-testid={testIds.purchaseDetail.root}
      className="mx-auto w-full max-w-2xl px-4 py-8"
    >
      <Link
        to="/purchases"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('common.back')}
      </Link>

      {query.isPending ? (
        <p className="mt-6 text-sm text-muted-foreground">
          {t('purchase.loading')}
        </p>
      ) : query.isError ? (
        <section className="mt-6 rounded-md border border-border bg-surface p-4 sm:p-6">
          <p className="text-sm font-medium">
            {isPurchaseNotFoundError(query.error)
              ? t('purchase.notFoundTitle')
              : t('purchase.loadFailedTitle')}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isPurchaseNotFoundError(query.error)
              ? t('purchase.notFoundBody')
              : t('purchase.loadFailedBody')}
          </p>
        </section>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1
                data-testid={testIds.purchaseDetail.title}
                className="text-3xl font-semibold tracking-normal"
              >
                {query.data.material.name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(`material.category.${query.data.material.category}`)}
                {query.data.material.isArchived
                  ? ` · ${t('purchase.archived')}`
                  : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/purchases/$purchaseId/edit"
                params={{ purchaseId }}
                data-testid={testIds.purchaseDetail.editLink}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Pencil aria-hidden="true" className="size-4" />
                {t('common.edit')}
              </Link>
              <button
                type="button"
                data-testid={testIds.purchaseDetail.deleteButton}
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
            data-testid={testIds.purchaseDetail.summary}
            className="mt-6 grid gap-3 rounded-md border border-border bg-surface p-4 sm:grid-cols-2 sm:p-6"
          >
            <DetailItem
              label={t('purchase.fields.date')}
              value={formatDisplayDate(query.data.date, i18n.language)}
            />
            <DetailItem
              label={t('purchase.fields.totalQuantity')}
              value={formatQuantity(
                query.data.totalQuantity,
                query.data.material.unitOfMeasure,
                i18n.language,
                t(`material.uom.${query.data.material.unitOfMeasure}`),
              )}
            />
            <DetailItem
              label={t('purchase.fields.totalPrice')}
              value={formatEuro(query.data.totalPrice, i18n.language)}
            />
            <DetailItem
              label={t('purchase.fields.unitCost')}
              value={`${formatUnitCost(
                computePurchaseUnitCost(
                  query.data.totalPrice,
                  query.data.totalQuantity,
                ),
                i18n.language,
              )}/${t(`material.uom.${query.data.material.unitOfMeasure}`)}`}
            />
          </dl>
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

function isPurchaseNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message === 'purchase.notFound';
}

function formatDisplayDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00.000Z`));
}
