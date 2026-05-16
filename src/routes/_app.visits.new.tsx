import { useUser } from '@clerk/tanstack-react-start';
import { Toast } from '@base-ui/react/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Outlet,
  createFileRoute,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import Decimal from 'decimal.js';
import { ArrowLeft, Save } from 'lucide-react';
import { useMemo } from 'react';
import {
  FormProvider,
  useForm,
  useFormContext,
  useWatch,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { preventImplicitSubmit } from '#/components/prevent-implicit-submit';
import { customerKeys } from '#/features/customers/customer-queries';
import {
  applyVisitServerError,
  computeVisitPreviewCost,
  createEmptyVisitFormValues,
  getVisitFormMissingKeys,
  toVisitDraftMutationInput,
  toVisitMutationInput,
  visitFormResolver,
  VisitFormBody,
} from '#/features/visits/visit-form';
import type { VisitFormFields as VisitFormValues } from '#/features/visits/visit-form';
import { visitKeys } from '#/features/visits/visit-queries';
import { listCustomers } from '#/server/customers';
import { listServices } from '#/server/services';
import {
  createVisit,
  createVisitDraft,
  listMaterialsForPicker,
} from '#/server/visits';
import type { VisitOrDraftListRowDto } from '#/server/visits';
import { formatEuro, tryFormatEuro } from '#/shared/purchase-format';

export const Route = createFileRoute('/_app/visits/new')({
  component: NewVisitRoute,
});

function NewVisitRoute() {
  const form = useForm<VisitFormValues>({
    resolver: visitFormResolver,
    defaultValues: createEmptyVisitFormValues(),
  });
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isChildRoute = pathname !== '/visits/new';

  return (
    <FormProvider {...form}>
      {isChildRoute ? <Outlet /> : <NewVisitFormScreen />}
    </FormProvider>
  );
}

function NewVisitFormScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useUser();
  const userKey = user?.id ?? 'pending';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = Toast.useToastManager();
  const form = useFormContext<VisitFormValues>();
  const listCustomersFn = useServerFn(listCustomers);
  const listServicesFn = useServerFn(listServices);
  const listMaterialsForPickerFn = useServerFn(listMaterialsForPicker);
  const createVisitFn = useServerFn(createVisit);
  const createVisitDraftFn = useServerFn(createVisitDraft);
  const values = useWatch({ control: form.control }) as VisitFormValues;
  const previewCost = useMemo(() => computeVisitPreviewCost(values), [values]);
  const visitMissingKeys = useMemo(
    () => getVisitFormMissingKeys({ ...values, recordType: 'visit' }),
    [values],
  );
  const draftMissingKeys = useMemo(
    () => getVisitFormMissingKeys({ ...values, recordType: 'draft' }),
    [values],
  );
  const customersQuery = useQuery({
    queryKey: customerKeys.list(userKey, false),
    queryFn: () => listCustomersFn({ data: { archived: false } }),
    staleTime: Infinity,
    enabled: !!user,
  });
  const servicesQuery = useQuery({
    queryKey: ['services', userKey],
    queryFn: () => listServicesFn(),
    staleTime: Infinity,
    enabled: !!user,
  });
  const materialsQuery = useQuery({
    queryKey: visitKeys.materials(userKey),
    queryFn: () => listMaterialsForPickerFn(),
    staleTime: Infinity,
    enabled: !!user,
  });
  const mutation = useMutation({
    mutationFn: (formValues: VisitFormValues) =>
      createVisitFn({ data: toVisitMutationInput(formValues) }),
    onMutate: async (formValues) => {
      await queryClient.cancelQueries({ queryKey: visitKeys.list(userKey) });
      const previous = queryClient.getQueryData<Array<VisitOrDraftListRowDto>>(
        visitKeys.list(userKey),
      );
      const customer = customersQuery.data?.find(
        (item) => item.id === formValues.customerId,
      );
      const service = servicesQuery.data?.find(
        (item) => item.id === formValues.serviceId,
      );
      const optimisticId = `pending-${Date.now()}`;

      if (customer && service) {
        const optimistic: VisitOrDraftListRowDto & { isPending: boolean } = {
          recordType: 'visit',
          id: optimisticId,
          customerId: customer.id,
          serviceId: service.id,
          date: formValues.date,
          priceCharged: formValues.priceCharged,
          note: formValues.note || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          customer,
          service: {
            ...service,
            isArchived: false,
          },
          lineItems: [],
          totalCost: '0',
          net: new Decimal(formValues.priceCharged).toString(),
          isPending: true,
        };

        queryClient.setQueryData<Array<VisitOrDraftListRowDto>>(
          visitKeys.list(userKey),
          [optimistic, ...(previous ?? [])],
        );
      }

      await navigate({ to: '/visits' });

      return { previous, optimisticId };
    },
    onSuccess: async (visit, _variables, context) => {
      queryClient.setQueryData<Array<VisitOrDraftListRowDto>>(
        visitKeys.list(userKey),
        (current) =>
          (current ?? []).map((item) =>
            item.id === context.optimisticId
              ? { ...visit, recordType: 'visit' }
              : item,
          ),
      );
      await queryClient.invalidateQueries({ queryKey: visitKeys.root });
    },
    onError: (error, variables, context) => {
      queryClient.setQueryData(visitKeys.list(userKey), context?.previous);
      const mapped = applyVisitServerError({
        error,
        values: variables,
        setError: form.setError,
      });

      if (!mapped) {
        toast.add({
          title: t('visit.saveFailed'),
          description: error.message,
        });
      }
    },
  });
  const draftMutation = useMutation({
    mutationFn: (formValues: VisitFormValues) =>
      createVisitDraftFn({ data: toVisitDraftMutationInput(formValues) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: visitKeys.root });
      await navigate({ to: '/visits' });
    },
    onError: (error) => {
      toast.add({
        title: t('visit.saveDraftFailed'),
        description: error.message,
      });
    },
  });
  const isLoading =
    customersQuery.isPending ||
    servicesQuery.isPending ||
    materialsQuery.isPending;
  const isReady =
    !isLoading &&
    !customersQuery.isError &&
    !servicesQuery.isError &&
    !materialsQuery.isError &&
    Boolean(customersQuery.data) &&
    Boolean(servicesQuery.data) &&
    Boolean(materialsQuery.data);
  const isSubmitDisabled =
    !isReady || mutation.isPending || visitMissingKeys.length > 0;
  const isDraftSubmitDisabled =
    !isReady || draftMutation.isPending || draftMissingKeys.length > 0;
  const hintKey =
    visitMissingKeys.length === 0 || draftMissingKeys.length === 0
      ? undefined
      : visitMissingKeys[0];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <button
        type="button"
        onClick={() => navigate({ to: '/visits' })}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('common.back')}
      </button>
      <h1 className="mt-5 text-3xl font-semibold tracking-normal">
        {t('visit.newTitle')}
      </h1>

      <form
        id="new-visit-form"
        className="mt-6"
        onKeyDown={preventImplicitSubmit}
        onSubmit={form.handleSubmit((formValues) =>
          mutation.mutate({ ...formValues, recordType: 'visit' }),
        )}
      >
        {isLoading ? (
          <p className="rounded-md border border-border bg-surface p-4 text-sm text-muted-foreground">
            {t('visit.loadingForm')}
          </p>
        ) : !isReady ? (
          <p className="rounded-md border border-border bg-surface p-4 text-sm text-danger">
            {t('visit.loadError')}
          </p>
        ) : (
          <VisitFormBody
            mode="create"
            recordType="visit"
            customers={customersQuery.data}
            materials={materialsQuery.data}
            services={servicesQuery.data}
            onCreateCustomer={(name) =>
              navigate({
                to: '/visits/new/customer/new',
                search: { name },
              })
            }
            onBuyFirst={(materialId) =>
              navigate({ to: '/purchases/new', search: { materialId } })
            }
          />
        )}
      </form>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 py-3 shadow-lg backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span>
                <span className="text-muted-foreground">
                  {t('visit.fields.priceCharged')}
                </span>{' '}
                <strong>
                  {values.priceCharged
                    ? (tryFormatEuro(values.priceCharged, i18n.language) ??
                      values.priceCharged)
                    : '—'}
                </strong>
              </span>
              <span>
                <span className="text-muted-foreground">
                  {t('visit.fields.cost')}
                </span>{' '}
                <strong>{formatEuro(previewCost, i18n.language)}</strong>
              </span>
            </div>
            {hintKey ? (
              <p className="mt-1 text-xs text-muted-foreground">{t(hintKey)}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={isDraftSubmitDisabled}
              onClick={() => {
                form.setValue('recordType', 'draft', { shouldDirty: false });
                void form.handleSubmit((formValues) =>
                  draftMutation.mutate({
                    ...formValues,
                    recordType: 'draft',
                  }),
                )();
              }}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save aria-hidden="true" className="size-4" />
              {t('visit.saveDraft')}
            </button>
            <button
              type="submit"
              form="new-visit-form"
              disabled={isSubmitDisabled}
              onClick={() =>
                form.setValue('recordType', 'visit', { shouldDirty: false })
              }
              className="inline-flex h-11 items-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save aria-hidden="true" className="size-4" />
              {t('visit.save')}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
