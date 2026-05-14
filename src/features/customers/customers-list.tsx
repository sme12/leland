import { useUser } from '@clerk/tanstack-react-start';
import { useServerFn } from '@tanstack/react-start';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Archive, Pencil, Plus, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { CustomerDto } from '#/server/customers';
import type { CustomerStatus } from './customer-queries';
import { listCustomers, setCustomerArchived } from '#/server/customers';
import { customerKeys } from './customer-queries';

export function CustomersList() {
  const { t, i18n } = useTranslation();
  const { user } = useUser();
  const userKey = user?.id ?? 'pending';
  const [status, setStatus] = useState<CustomerStatus>('active');
  const queryClient = useQueryClient();
  const listCustomersFn = useServerFn(listCustomers);
  const setArchivedFn = useServerFn(setCustomerArchived);
  const archived = status === 'archived';

  const query = useQuery({
    queryKey: customerKeys.list(userKey, archived),
    queryFn: () => listCustomersFn({ data: { archived } }),
    staleTime: Infinity,
    enabled: !!user,
  });

  const sortedCustomers = useMemo(() => {
    const collator = new Intl.Collator(i18n.language, { sensitivity: 'base' });
    return [...(query.data ?? [])].sort((a, b) =>
      collator.compare(a.name, b.name),
    );
  }, [i18n.language, query.data]);

  const archiveMutation = useMutation({
    mutationFn: (input: { id: string; isArchived: boolean }) =>
      setArchivedFn({ data: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: customerKeys.all(userKey),
      });
    },
  });

  function confirmArchive(customer: CustomerDto, nextArchived: boolean) {
    const key = nextArchived
      ? 'customer.confirmArchive'
      : 'customer.confirmRestore';

    if (window.confirm(t(key, { name: customer.name }))) {
      archiveMutation.mutate({ id: customer.id, isArchived: nextArchived });
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal">
            {t('customer.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('customer.subtitle')}
          </p>
        </div>
        <Link
          to="/customers/new"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-3 text-sm font-semibold text-background outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus aria-hidden="true" className="size-4" />
          {t('customer.add')}
        </Link>
      </div>

      <div
        className="mt-6 inline-grid grid-cols-2 rounded-md border border-border bg-surface p-1"
        role="tablist"
        aria-label={t('customer.statusLabel')}
      >
        {(['active', 'archived'] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={status === item}
            onClick={() => setStatus(item)}
            className="h-9 rounded px-4 text-sm font-medium transition aria-selected:bg-foreground aria-selected:text-background"
          >
            {t(`customer.status.${item}`)}
          </button>
        ))}
      </div>

      <section
        data-customers-list
        data-loaded={query.isPending ? 'false' : 'true'}
        className="mt-5 overflow-hidden rounded-md border border-border bg-surface"
      >
        {query.isError ? (
          <p className="p-4 text-sm text-red-600">
            {t('customer.error', { message: query.error.message })}
          </p>
        ) : query.isPending ? (
          <p className="p-4 text-sm text-muted-foreground">
            {t('customer.loading')}
          </p>
        ) : sortedCustomers.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {t(archived ? 'customer.emptyArchived' : 'customer.emptyActive')}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {sortedCustomers.map((customer) => (
              <li
                key={customer.id}
                data-customer-id={customer.id}
                className="flex items-start justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{customer.name}</p>
                  {customer.comment ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {customer.comment}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!archived ? (
                    <Link
                      to="/customers/$customerId/edit"
                      params={{ customerId: customer.id }}
                      aria-label={t('customer.editNamed', {
                        name: customer.name,
                      })}
                      className="inline-flex size-10 items-center justify-center rounded-md border border-border hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Pencil aria-hidden="true" className="size-4" />
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    aria-label={t(
                      archived
                        ? 'customer.restoreNamed'
                        : 'customer.archiveNamed',
                      { name: customer.name },
                    )}
                    className="inline-flex size-10 items-center justify-center rounded-md border border-border hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => confirmArchive(customer, !archived)}
                  >
                    {archived ? (
                      <RotateCcw aria-hidden="true" className="size-4" />
                    ) : (
                      <Archive aria-hidden="true" className="size-4" />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
