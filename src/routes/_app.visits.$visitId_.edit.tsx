import { useUser } from '@clerk/tanstack-react-start';
import { Toast } from '@base-ui/react/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { ArrowLeft, Save } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { preventImplicitSubmit } from '#/components/prevent-implicit-submit';
import { customerKeys } from '#/features/customers/customer-queries';
import { invalidateMaterialQueries } from '#/features/materials/material-queries';
import {
  applyVisitServerError,
  createEmptyVisitFormValues,
  getVisitFormMissingKeys,
  toVisitMutationInput,
  visitFormResolver,
  VisitFormBody,
} from '#/features/visits/visit-form';
import type { VisitFormFields } from '#/features/visits/visit-form';
import { visitKeys } from '#/features/visits/visit-queries';
import { listCustomers } from '#/server/customers';
import type { ServiceDto } from '#/server/services';
import { listServices } from '#/server/services';
import { getVisit, listMaterialsForPicker, updateVisit } from '#/server/visits';
import type { VisitDto, VisitMaterialPickerDto } from '#/server/visits';
import { testIds } from '#/testing/test-ids';

export const Route = createFileRoute('/_app/visits/$visitId_/edit')({
  component: EditVisitRoute,
});

function EditVisitRoute() {
  const { t } = useTranslation();
  const { user } = useUser();
  const userKey = user?.id ?? 'pending';
  const { visitId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = Toast.useToastManager();
  const getVisitFn = useServerFn(getVisit);
  const listCustomersFn = useServerFn(listCustomers);
  const listServicesFn = useServerFn(listServices);
  const listMaterialsForPickerFn = useServerFn(listMaterialsForPicker);
  const updateVisitFn = useServerFn(updateVisit);
  const form = useForm<VisitFormFields>({
    resolver: visitFormResolver,
    defaultValues: createEmptyVisitFormValues(),
  });
  const visitQuery = useQuery({
    queryKey: visitKeys.detail(userKey, visitId),
    queryFn: () => getVisitFn({ data: { id: visitId } }),
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
      visitQuery.data
        ? mergeCustomer(visitQuery.data, customersQuery.data ?? [])
        : (customersQuery.data ?? []),
    [customersQuery.data, visitQuery.data],
  );
  const services = useMemo(
    () =>
      visitQuery.data
        ? mergeService(visitQuery.data, servicesQuery.data ?? [])
        : (servicesQuery.data ?? []),
    [servicesQuery.data, visitQuery.data],
  );
  const materials = useMemo(
    () =>
      visitQuery.data
        ? mergeMaterials(visitQuery.data, materialsQuery.data ?? [])
        : (materialsQuery.data ?? []),
    [materialsQuery.data, visitQuery.data],
  );
  const mutation = useMutation({
    mutationFn: (values: VisitFormFields) => {
      if (!visitQuery.data) {
        throw new Error('visit.notFound');
      }

      return updateVisitFn({
        data: {
          ...toVisitMutationInput(values),
          id: visitQuery.data.id,
          expectedUpdatedAt: visitQuery.data.updatedAt,
        },
      });
    },
    onSuccess: async (visit) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: visitKeys.root }),
        invalidateMaterialQueries(queryClient),
      ]);
      queryClient.setQueryData(visitKeys.detail(userKey, visit.id), visit);
      await navigate({ to: '/visits/$visitId', params: { visitId } });
    },
    onError: (error, variables) => {
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

  useEffect(() => {
    if (visitQuery.data && !form.formState.isDirty) {
      form.reset(toVisitFormValues(visitQuery.data));
    }
  }, [form, visitQuery.data]);

  const watchedValues = form.watch();
  const missingKeys = useMemo(
    () => getVisitFormMissingKeys(watchedValues),
    [watchedValues],
  );
  const isLoading =
    visitQuery.isPending ||
    customersQuery.isPending ||
    servicesQuery.isPending ||
    materialsQuery.isPending;
  const hasFormData = Boolean(visitQuery.data);
  const isReady =
    !isLoading &&
    !visitQuery.isError &&
    !customersQuery.isError &&
    !servicesQuery.isError &&
    !materialsQuery.isError &&
    hasFormData;

  return (
    <main
      data-testid={testIds.visitEdit.root}
      className="mx-auto w-full max-w-2xl px-4 py-8"
    >
      <Link
        to="/visits/$visitId"
        params={{ visitId }}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('common.back')}
      </Link>
      <h1 className="mt-5 text-3xl font-semibold tracking-normal">
        {t('visit.editTitle')}
      </h1>

      <section className="mt-6 rounded-md border border-border bg-surface p-4 sm:p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('visit.loading')}</p>
        ) : visitQuery.isError ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">{t('visit.notFoundTitle')}</p>
            <p className="text-sm text-muted-foreground">
              {t('visit.notFoundBody')}
            </p>
          </div>
        ) : !isReady ? (
          <p className="text-sm text-danger">{t('visit.loadError')}</p>
        ) : (
          <FormProvider {...form}>
            <form
              data-testid={testIds.visitEdit.form}
              onKeyDown={preventImplicitSubmit}
              onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            >
              <VisitFormBody
                mode="edit"
                recordType="visit"
                customers={customers}
                materials={materials}
                services={services}
                onBuyFirst={(materialId) =>
                  navigate({ to: '/purchases/new', search: { materialId } })
                }
              />
              {missingKeys[0] ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  {t(missingKeys[0])}
                </p>
              ) : null}
              <button
                type="submit"
                data-testid={testIds.visitEdit.saveButton}
                disabled={mutation.isPending || missingKeys.length > 0}
                className="mt-4 inline-flex h-11 items-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save aria-hidden="true" className="size-4" />
                {t('visit.save')}
              </button>
            </form>
          </FormProvider>
        )}
      </section>
    </main>
  );
}

function toVisitFormValues(visit: VisitDto): VisitFormFields {
  return {
    recordType: 'visit',
    id: visit.id,
    date: visit.date,
    customerId: visit.customerId,
    serviceId: visit.serviceId,
    priceCharged: visit.priceCharged,
    note: visit.note ?? '',
    items: visit.lineItems.map((item) => ({
      id: item.id,
      materialId: item.materialId,
      amount: item.amount,
      unitCost: item.unitCost,
    })),
  };
}

function mergeCustomer(
  visit: VisitDto,
  customers: Array<VisitDto['customer']>,
) {
  if (customers.some((customer) => customer.id === visit.customer.id)) {
    return customers;
  }

  return [visit.customer, ...customers];
}

function mergeService(visit: VisitDto, services: Array<ServiceDto>) {
  if (services.some((service) => service.id === visit.service.id)) {
    return services;
  }

  return [visit.service, ...services];
}

function mergeMaterials(
  visit: VisitDto,
  materials: Array<VisitMaterialPickerDto>,
) {
  const merged = [...materials];

  for (const item of visit.lineItems) {
    if (!merged.some((material) => material.id === item.material.id)) {
      merged.unshift({ ...item.material, hasPurchases: true });
    }
  }

  return merged;
}
