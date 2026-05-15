import { useUser } from '@clerk/tanstack-react-start';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Link } from '@tanstack/react-router';
import Decimal from 'decimal.js';
import { Plus, ReceiptText } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { PurchaseDto } from '#/server/purchases';
import { listPurchases } from '#/server/purchases';
import { MATERIAL_CATEGORIES } from '#/shared/enums';
import { formatEuro, formatQuantity } from '#/shared/purchase-format';
import { purchaseKeys } from './purchase-queries';

export function PurchasesList() {
  const { t, i18n } = useTranslation();
  const { user } = useUser();
  const userKey = user?.id ?? 'pending';
  const listPurchasesFn = useServerFn(listPurchases);
  const query = useQuery({
    queryKey: purchaseKeys.list(userKey),
    queryFn: () => listPurchasesFn(),
    staleTime: 30_000,
    enabled: !!user,
  });
  const groups = useMemo(() => groupPurchases(query.data ?? []), [query.data]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal">
            {t('purchase.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('purchase.subtitle')}
          </p>
        </div>
        <Link
          to="/purchases/new"
          search={{ materialId: undefined }}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-3 text-sm font-semibold text-background outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus aria-hidden="true" className="size-4" />
          {t('purchase.add')}
        </Link>
      </div>

      <section
        data-purchases-list
        data-loaded={query.isPending ? 'false' : 'true'}
        className="mt-6 overflow-hidden rounded-md border border-border bg-surface"
      >
        {query.isError ? (
          <p className="p-4 text-sm text-danger">{t('purchase.loadError')}</p>
        ) : query.isPending ? (
          <p className="p-4 text-sm text-muted-foreground">
            {t('purchase.loading')}
          </p>
        ) : groups.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {t('purchase.empty')}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {groups.map((group) => (
              <section
                key={group.category}
                data-purchase-category={group.category}
              >
                <div className="flex items-center justify-between gap-3 bg-muted/40 px-4 py-3">
                  <h2 className="truncate text-sm font-semibold">
                    {t(`material.category.${group.category}`)}
                  </h2>
                  <p className="shrink-0 text-sm text-muted-foreground">
                    {t('purchase.groupSummary', {
                      count: group.purchases.length,
                      total: formatEuro(group.totalSpend, i18n.language),
                    })}
                  </p>
                </div>
                <ul className="divide-y divide-border">
                  {group.purchases.map((purchase) => (
                    <li key={purchase.id} data-purchase-id={purchase.id}>
                      <Link
                        to="/purchases/$purchaseId"
                        params={{ purchaseId: purchase.id }}
                        className="grid gap-3 p-4 outline-none hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[1fr_auto]"
                      >
                        <span className="min-w-0">
                          <span className="flex min-w-0 items-center gap-2 font-medium">
                            <ReceiptText
                              aria-hidden="true"
                              className="size-4 shrink-0"
                            />
                            <span className="truncate">
                              {purchase.material.name}
                            </span>
                          </span>
                          <span className="mt-1 block text-sm text-muted-foreground">
                            {formatDisplayDate(purchase.date, i18n.language)} ·{' '}
                            {formatQuantity(
                              purchase.totalQuantity,
                              purchase.material.unitOfMeasure,
                              i18n.language,
                              t(
                                `material.uom.${purchase.material.unitOfMeasure}`,
                              ),
                            )}
                          </span>
                        </span>
                        <span className="text-sm font-semibold sm:text-right">
                          {formatEuro(purchase.totalPrice, i18n.language)}
                        </span>
                      </Link>
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

function groupPurchases(purchases: Array<PurchaseDto>) {
  return MATERIAL_CATEGORIES.map((category) => {
    const categoryPurchases = purchases.filter(
      (purchase) => purchase.material.category === category,
    );
    const totalSpend = categoryPurchases.reduce(
      (total, purchase) => total.plus(purchase.totalPrice),
      new Decimal(0),
    );

    return { category, purchases: categoryPurchases, totalSpend };
  }).filter((group) => group.purchases.length > 0);
}

function formatDisplayDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00.000Z`));
}
