import { useUser } from '@clerk/tanstack-react-start';
import { Toast } from '@base-ui/react/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import Decimal from 'decimal.js';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ServiceDto } from '#/server/services';
import { listServices, updateServiceDefaultPrice } from '#/server/services';

const serviceKeys = {
  all: (userId: string) => ['services', userId] as const,
};

export function ServicePrices() {
  const { t } = useTranslation();
  const { user } = useUser();
  const userKey = user?.id ?? 'pending';
  const listServicesFn = useServerFn(listServices);
  const updatePriceFn = useServerFn(updateServiceDefaultPrice);
  const queryClient = useQueryClient();
  const toast = Toast.useToastManager();

  const query = useQuery({
    queryKey: serviceKeys.all(userKey),
    queryFn: () => listServicesFn(),
    staleTime: Infinity,
  });

  const mutation = useMutation({
    mutationFn: (input: { id: string; price: string | null }) =>
      updatePriceFn({ data: input }),
    onSuccess: async ({ service, previousPrice }) => {
      await queryClient.invalidateQueries({
        queryKey: serviceKeys.all(userKey),
      });
      toast.add({
        title: t('service.saved'),
        description: t('service.savedDescription'),
        actionProps: {
          children: t('common.undo'),
          disabled: mutation.isPending,
          onClick: () => {
            if (!mutation.isPending) {
              mutation.mutate({ id: service.id, price: previousPrice });
            }
          },
        },
      });
    },
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-normal">
          {t('servicePrices.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('servicePrices.subtitle')}
        </p>
      </div>

      <section className="mt-6 overflow-hidden rounded-md border border-border bg-surface">
        {query.isPending ? (
          <p className="p-4 text-sm text-muted-foreground">
            {t('servicePrices.loading')}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {(query.data ?? []).map((service) => (
              <ServicePriceRow
                key={service.id}
                service={service}
                onCommit={(price) => mutation.mutate({ id: service.id, price })}
                isSaving={mutation.isPending}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function isSamePrice(a: string | null, b: string | null) {
  if (a === null || b === null) {
    return a === b;
  }
  try {
    return new Decimal(a).eq(new Decimal(b));
  } catch {
    return a === b;
  }
}

function ServicePriceRow({
  service,
  onCommit,
  isSaving,
}: {
  service: ServiceDto;
  onCommit: (price: string | null) => void;
  isSaving: boolean;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(service.defaultPrice ?? '');

  useEffect(() => {
    setValue(service.defaultPrice ?? '');
  }, [service.defaultPrice]);

  function commit() {
    const normalized = value.trim();
    const nextValue = normalized.length === 0 ? null : normalized;

    if (!isSamePrice(nextValue, service.defaultPrice)) {
      onCommit(nextValue);
    }
  }

  return (
    <li className="grid gap-3 p-4 sm:grid-cols-[1fr_12rem] sm:items-center">
      <label className="font-medium" htmlFor={`service-${service.id}`}>
        {t(service.name)}
      </label>
      <input
        id={`service-${service.id}`}
        inputMode="decimal"
        value={value}
        disabled={isSaving}
        placeholder={t('servicePrices.setPrice')}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        className="h-11 w-full rounded-md border border-border bg-background px-3 text-right outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
      />
    </li>
  );
}
