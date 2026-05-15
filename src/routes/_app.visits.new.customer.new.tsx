import { useUser } from '@clerk/tanstack-react-start';
import { Toast } from '@base-ui/react/toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { ArrowLeft } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { CustomerForm } from '#/features/customers/customer-form';
import { customerKeys } from '#/features/customers/customer-queries';
import type { VisitFormFields } from '#/features/visits/visit-form';
import { createCustomer } from '#/server/customers';
import type { CustomerFormValues } from '#/shared/schemas/customer';

export const Route = createFileRoute('/_app/visits/new/customer/new')({
  validateSearch: (search: Record<string, unknown>) => ({
    name: typeof search.name === 'string' ? search.name : '',
  }),
  component: NewVisitCustomerRoute,
});

function NewVisitCustomerRoute() {
  const { t } = useTranslation();
  const { user } = useUser();
  const userKey = user?.id ?? 'pending';
  const { name } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = Toast.useToastManager();
  const form = useFormContext<VisitFormFields>();
  const createCustomerFn = useServerFn(createCustomer);
  const mutation = useMutation({
    mutationFn: (values: CustomerFormValues) =>
      createCustomerFn({ data: values }),
    onSuccess: async (customer) => {
      await queryClient.invalidateQueries({
        queryKey: customerKeys.all(userKey),
      });
      form.setValue('customerId', customer.id, {
        shouldDirty: true,
        shouldValidate: true,
      });
      await navigate({ to: '/visits/new' });
    },
    onError: (error) => {
      toast.add({
        title: t('customer.saveFailed'),
        description: error.message,
      });
    },
  });

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <button
        type="button"
        onClick={() => navigate({ to: '/visits/new' })}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('common.back')}
      </button>
      <h1 className="mt-5 text-3xl font-semibold tracking-normal">
        {t('customer.newTitle')}
      </h1>
      <div className="mt-6 rounded-md border border-border bg-surface p-4 sm:p-6">
        <CustomerForm
          defaultValues={{ name, comment: '' }}
          submitLabel={t('customer.create')}
          isSubmitting={mutation.isPending}
          onSubmit={(values) => mutation.mutate(values)}
        />
      </div>
    </main>
  );
}
