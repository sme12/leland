import { Toast } from '@base-ui/react/toast';
import { useUser } from '@clerk/tanstack-react-start';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { ArrowLeft, Save, Send, Trash2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { preventImplicitSubmit } from '#/components/prevent-implicit-submit';
import { customerKeys } from '#/features/customers/customer-queries';
import {
  applyVisitServerError,
  createEmptyVisitFormValues,
  getVisitDraftPublishMissingKeys,
  getVisitFormMissingKeys,
  toVisitDraftMutationInput,
  visitFormResolver,
  VisitFormBody,
} from '#/features/visits/visit-form';
import type { VisitFormFields } from '#/features/visits/visit-form';
import { visitKeys } from '#/features/visits/visit-queries';
import { listCustomers } from '#/server/customers';
import type { ServiceDto } from '#/server/services';
import { listServices } from '#/server/services';
import {
  discardVisitDraft,
  getVisitDraft,
  listMaterialsForPicker,
  publishVisitDraft,
  updateVisitDraft,
} from '#/server/visits';
import type { VisitDraftDto, VisitMaterialPickerDto } from '#/server/visits';

export const Route = createFileRoute('/_app/visits/drafts/$draftId_/edit')({
  component: EditVisitDraftRoute,
});

function EditVisitDraftRoute() {
  const { t } = useTranslation();
  const { user } = useUser();
  const userKey = user?.id ?? 'pending';
  const { draftId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = Toast.useToastManager();
  const getVisitDraftFn = useServerFn(getVisitDraft);
  const listCustomersFn = useServerFn(listCustomers);
  const listServicesFn = useServerFn(listServices);
  const listMaterialsForPickerFn = useServerFn(listMaterialsForPicker);
  const updateVisitDraftFn = useServerFn(updateVisitDraft);
  const publishVisitDraftFn = useServerFn(publishVisitDraft);
  const discardVisitDraftFn = useServerFn(discardVisitDraft);
  const form = useForm<VisitFormFields>({
    resolver: visitFormResolver,
    defaultValues: createEmptyVisitFormValues('draft'),
  });
  const draftQuery = useQuery({
    queryKey: visitKeys.draftDetail(userKey, draftId),
    queryFn: () => getVisitDraftFn({ data: { id: draftId } }),
    staleTime: 30_000,
    retry: false,
  });
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
  const customers = useMemo(
    () =>
      draftQuery.data
        ? mergeCustomer(draftQuery.data, customersQuery.data ?? [])
        : (customersQuery.data ?? []),
    [customersQuery.data, draftQuery.data],
  );
  const services = useMemo(
    () =>
      draftQuery.data
        ? mergeService(draftQuery.data, servicesQuery.data ?? [])
        : (servicesQuery.data ?? []),
    [draftQuery.data, servicesQuery.data],
  );
  const materials = useMemo(
    () =>
      draftQuery.data
        ? mergeMaterials(draftQuery.data, materialsQuery.data ?? [])
        : (materialsQuery.data ?? []),
    [draftQuery.data, materialsQuery.data],
  );
  const saveMutation = useMutation({
    mutationFn: (values: VisitFormFields) => {
      if (!draftQuery.data) {
        throw new Error('visitDraft.notFound');
      }

      return updateVisitDraftFn({
        data: {
          ...toVisitDraftMutationInput(values),
          id: draftQuery.data.id,
          expectedUpdatedAt: draftQuery.data.updatedAt,
        },
      });
    },
    onSuccess: async (draft) => {
      await queryClient.invalidateQueries({ queryKey: visitKeys.root });
      queryClient.setQueryData(visitKeys.draftDetail(userKey, draft.id), draft);
      await navigate({ to: '/visits' });
    },
    onError: (error) => {
      toast.add({
        title: t('visit.saveDraftFailed'),
        description: describeDraftError(error, t),
      });
    },
  });
  const publishMutation = useMutation({
    mutationFn: () => {
      if (!draftQuery.data) {
        throw new Error('visitDraft.notFound');
      }

      return publishVisitDraftFn({
        data: {
          id: draftId,
          expectedUpdatedAt: draftQuery.data.updatedAt,
        },
      });
    },
    onSuccess: async (visit) => {
      await queryClient.invalidateQueries({ queryKey: visitKeys.root });
      queryClient.removeQueries({
        queryKey: visitKeys.draftDetail(userKey, draftId),
      });
      queryClient.setQueryData(visitKeys.detail(userKey, visit.id), visit);
      await navigate({ to: '/visits/$visitId', params: { visitId: visit.id } });
    },
    onError: (error) => {
      const mapped = applyVisitServerError({
        error,
        values: form.getValues(),
        setError: form.setError,
      });

      if (!mapped) {
        toast.add({
          title: t('visit.publishDraftFailed'),
          description: describeDraftError(error, t),
        });
      }
    },
  });
  const discardMutation = useMutation({
    mutationFn: () => {
      if (!draftQuery.data) {
        throw new Error('visitDraft.notFound');
      }

      return discardVisitDraftFn({
        data: {
          id: draftId,
          expectedUpdatedAt: draftQuery.data.updatedAt,
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: visitKeys.root });
      queryClient.removeQueries({
        queryKey: visitKeys.draftDetail(userKey, draftId),
      });
      await navigate({ to: '/visits' });
    },
    onError: (error) => {
      toast.add({
        title: t('visit.discardDraftFailed'),
        description: error.message,
      });
    },
  });

  useEffect(() => {
    if (draftQuery.data && !form.formState.isDirty) {
      form.reset(toDraftFormValues(draftQuery.data));
    }
  }, [draftQuery.data, form]);

  const watchedValues = form.watch();
  const saveMissingKeys = useMemo(
    () => getVisitFormMissingKeys({ ...watchedValues, recordType: 'draft' }),
    [watchedValues],
  );
  const publishMissingKeys = useMemo(() => {
    const keys = getVisitDraftPublishMissingKeys(watchedValues);

    if (form.formState.isDirty) {
      keys.push('visit.missing.unsavedDraftChanges');
    }

    return keys;
  }, [form.formState.isDirty, watchedValues]);
  const isLoading =
    draftQuery.isPending ||
    customersQuery.isPending ||
    servicesQuery.isPending ||
    materialsQuery.isPending;
  const hasFormData = Boolean(draftQuery.data);
  const isReady =
    !isLoading &&
    !draftQuery.isError &&
    !customersQuery.isError &&
    !servicesQuery.isError &&
    !materialsQuery.isError &&
    hasFormData;
  const anyMutationPending =
    saveMutation.isPending ||
    publishMutation.isPending ||
    discardMutation.isPending;
  const isSaveDisabled =
    anyMutationPending || saveMissingKeys.length > 0 || !isReady;
  const isPublishDisabled =
    anyMutationPending || publishMissingKeys.length > 0 || !isReady;
  const formMessageKey =
    publishMissingKeys[0] ??
    (isPublishDisabled ? saveMissingKeys[0] : undefined);

  function confirmDiscard() {
    if (
      !anyMutationPending &&
      draftQuery.data &&
      window.confirm(t('visit.confirmDiscardDraft'))
    ) {
      discardMutation.mutate();
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link
        to="/visits"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('common.back')}
      </Link>
      <h1 className="mt-5 text-3xl font-semibold tracking-normal">
        {t('visit.draftEditTitle')}
      </h1>

      <section className="mt-6 rounded-md border border-border bg-surface p-4 sm:p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('visit.loading')}</p>
        ) : draftQuery.isError ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              {t('visit.draftNotFoundTitle')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('visit.draftNotFoundBody')}
            </p>
          </div>
        ) : !isReady ? (
          <p className="text-sm text-danger">{t('visit.loadError')}</p>
        ) : (
          <FormProvider {...form}>
            <form
              onKeyDown={preventImplicitSubmit}
              onSubmit={form.handleSubmit((values) =>
                saveMutation.mutate({ ...values, recordType: 'draft' }),
              )}
            >
              <VisitFormBody
                mode="edit"
                recordType="draft"
                customers={customers}
                materials={materials}
                services={services}
                onBuyFirst={(materialId) =>
                  navigate({ to: '/purchases/new', search: { materialId } })
                }
              />
              {formMessageKey ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  {t(formMessageKey)}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={confirmDiscard}
                  disabled={anyMutationPending || !isReady}
                  className="inline-flex h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold text-danger outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  {t('visit.discardDraft')}
                </button>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="submit"
                    disabled={isSaveDisabled}
                    className="inline-flex h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save aria-hidden="true" className="size-4" />
                    {t('visit.saveDraft')}
                  </button>
                  <button
                    type="button"
                    onClick={() => publishMutation.mutate()}
                    disabled={isPublishDisabled}
                    className="inline-flex h-11 items-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Send aria-hidden="true" className="size-4" />
                    {t('visit.publishVisit')}
                  </button>
                </div>
              </div>
            </form>
          </FormProvider>
        )}
      </section>
    </main>
  );
}

function toDraftFormValues(draft: VisitDraftDto): VisitFormFields {
  return {
    recordType: 'draft',
    id: draft.id,
    date: draft.date,
    customerId: draft.customerId,
    serviceId: draft.serviceId,
    priceCharged: draft.estimatedPrice ?? '',
    note: draft.note ?? '',
    items: draft.materialEstimates.map((item) => ({
      id: item.id,
      materialId: item.materialId,
      amount: item.amount,
      unitCost: '',
    })),
  };
}

function mergeCustomer(
  draft: VisitDraftDto,
  customers: Array<VisitDraftDto['customer']>,
) {
  if (customers.some((customer) => customer.id === draft.customer.id)) {
    return customers;
  }

  return [draft.customer, ...customers];
}

function mergeService(draft: VisitDraftDto, services: Array<ServiceDto>) {
  if (services.some((service) => service.id === draft.service.id)) {
    return services;
  }

  return [draft.service, ...services];
}

function mergeMaterials(
  draft: VisitDraftDto,
  materials: Array<VisitMaterialPickerDto>,
) {
  const merged = [...materials];

  for (const item of draft.materialEstimates) {
    if (!merged.some((material) => material.id === item.material.id)) {
      merged.unshift(item.material);
    }
  }

  return merged;
}

function describeDraftError(
  error: { message?: string },
  t: (key: string) => string,
): string | undefined {
  if (error.message === 'visitDraft.concurrentModification') {
    return t('visit.errors.draftConcurrentModification');
  }

  return error.message;
}
