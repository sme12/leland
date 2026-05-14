import { useUser } from '@clerk/tanstack-react-start';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { CustomerForm } from '#/features/customers/customer-form';
import { customerKeys } from '#/features/customers/customer-queries';
import { createCustomer } from '#/server/customers';
import type { CustomerFormValues } from '#/shared/schemas/customer';

export const Route = createFileRoute('/_app/customers/new')({
  component: NewCustomerRoute,
});

function NewCustomerRoute() {
  const { t } = useTranslation();
  const { user } = useUser();
  const userKey = user?.id ?? 'pending';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createCustomerFn = useServerFn(createCustomer);
  const mutation = useMutation({
    mutationFn: (values: CustomerFormValues) =>
      createCustomerFn({ data: values }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: customerKeys.all(userKey),
      });
      await navigate({ to: '/customers' });
    },
    onError: (error) => {
      console.error('Failed to create customer:', error);
    },
  });

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link
        to="/customers"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('common.back')}
      </Link>
      <h1 className="mt-5 text-3xl font-semibold tracking-normal">
        {t('customer.newTitle')}
      </h1>
      <div className="mt-6 rounded-md border border-border bg-surface p-4 sm:p-6">
        <CustomerForm
          submitLabel={t('customer.create')}
          isSubmitting={mutation.isPending}
          onSubmit={(values) => mutation.mutate(values)}
        />
      </div>
    </main>
  );
}
