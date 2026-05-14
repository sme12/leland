import { useUser } from '@clerk/tanstack-react-start';
import { Toast } from '@base-ui/react/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { CustomerForm } from '#/features/customers/customer-form';
import { customerKeys } from '#/features/customers/customer-queries';
import { getCustomer, updateCustomer } from '#/server/customers';
import type { CustomerFormValues } from '#/shared/schemas/customer';

export const Route = createFileRoute('/_app/customers/$customerId/edit')({
  component: EditCustomerRoute,
});

function EditCustomerRoute() {
  const { t } = useTranslation();
  const { user } = useUser();
  const userKey = user?.id ?? 'pending';
  const { customerId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = Toast.useToastManager();
  const getCustomerFn = useServerFn(getCustomer);
  const updateCustomerFn = useServerFn(updateCustomer);
  const query = useQuery({
    queryKey: customerKeys.detail(userKey, customerId),
    queryFn: () => getCustomerFn({ data: { id: customerId } }),
    staleTime: Infinity,
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: (values: CustomerFormValues) =>
      updateCustomerFn({ data: { ...values, id: customerId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: customerKeys.all(userKey),
      });
      await navigate({ to: '/customers' });
    },
    onError: () => {
      toast.add({
        title: t('customer.saveFailed'),
        description: t('customer.saveFailedDescription'),
      });
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
        {t('customer.editTitle')}
      </h1>
      <div className="mt-6 rounded-md border border-border bg-surface p-4 sm:p-6">
        {query.isPending ? (
          <p className="text-sm text-muted-foreground">
            {t('customer.loading')}
          </p>
        ) : query.isError ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">{t('customer.notFoundTitle')}</p>
            <p className="text-sm text-muted-foreground">
              {t('customer.notFoundBody')}
            </p>
            <Link
              to="/customers"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              {t('customer.backToList')}
            </Link>
          </div>
        ) : (
          <CustomerForm
            defaultValues={{
              name: query.data.name,
              comment: query.data.comment ?? '',
            }}
            submitLabel={t('customer.save')}
            isSubmitting={mutation.isPending}
            onSubmit={(values) => mutation.mutate(values)}
          />
        )}
      </div>
    </main>
  );
}
