import { useUser } from '@clerk/tanstack-react-start';
import { Toast } from '@base-ui/react/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { ArrowLeft } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { materialKeys } from '#/features/materials/material-queries';
import { PurchaseForm } from '#/features/purchases/purchase-form';
import { PurchaseMaterialSelect } from '#/features/purchases/purchase-material-select';
import type { PurchaseMaterialOption } from '#/features/purchases/purchase-material-select';
import { purchaseKeys } from '#/features/purchases/purchase-queries';
import { listMaterials } from '#/server/materials';
import { getPurchase, updatePurchase } from '#/server/purchases';
import type { PurchaseCreateValues } from '#/shared/schemas/purchase';

export const Route = createFileRoute('/_app/purchases/$purchaseId_/edit')({
  component: EditPurchaseRoute,
});

function EditPurchaseRoute() {
  const { t } = useTranslation();
  const { user } = useUser();
  const userKey = user?.id ?? 'pending';
  const { purchaseId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = Toast.useToastManager();
  const getPurchaseFn = useServerFn(getPurchase);
  const listMaterialsFn = useServerFn(listMaterials);
  const updatePurchaseFn = useServerFn(updatePurchase);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(
    null,
  );
  const purchaseQuery = useQuery({
    queryKey: purchaseKeys.detail(userKey, purchaseId),
    queryFn: () => getPurchaseFn({ data: { id: purchaseId } }),
    staleTime: 30_000,
    retry: false,
  });
  const materialsQuery = useQuery({
    queryKey: materialKeys.list(userKey, false),
    queryFn: () => listMaterialsFn({ data: { archived: false } }),
    staleTime: Infinity,
    enabled: !!user,
  });
  const materialOptions = useMemo(() => {
    if (!purchaseQuery.data) {
      return materialsQuery.data ?? [];
    }

    return mergeCurrentMaterial(
      purchaseQuery.data.material,
      materialsQuery.data ?? [],
    );
  }, [materialsQuery.data, purchaseQuery.data]);
  const effectiveMaterialId =
    selectedMaterialId ?? purchaseQuery.data?.materialId ?? '';
  const selectedMaterial =
    materialOptions.find((material) => material.id === effectiveMaterialId) ??
    purchaseQuery.data?.material ??
    null;

  const mutation = useMutation({
    mutationFn: (values: PurchaseCreateValues) =>
      updatePurchaseFn({ data: { ...values, id: purchaseId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: purchaseKeys.all(userKey),
      });
      await navigate({ to: '/purchases/$purchaseId', params: { purchaseId } });
    },
    onError: (error) => {
      toast.add({
        title: t('purchase.saveFailed'),
        description: error.message,
      });
    },
  });

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link
        to="/purchases/$purchaseId"
        params={{ purchaseId }}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('common.back')}
      </Link>
      <h1 className="mt-5 text-3xl font-semibold tracking-normal">
        {t('purchase.editTitle')}
      </h1>

      <section className="mt-6 rounded-md border border-border bg-surface p-4 sm:p-6">
        {purchaseQuery.isPending || materialsQuery.isPending ? (
          <p className="text-sm text-muted-foreground">
            {t('purchase.loading')}
          </p>
        ) : purchaseQuery.isError ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">{t('purchase.notFoundTitle')}</p>
            <p className="text-sm text-muted-foreground">
              {t('purchase.notFoundBody')}
            </p>
          </div>
        ) : selectedMaterial ? (
          <div className="space-y-5">
            <PurchaseMaterialSelect
              materials={materialOptions}
              selectedId={effectiveMaterialId}
              onChange={setSelectedMaterialId}
            />
            <PurchaseForm
              key={selectedMaterial.id}
              material={selectedMaterial}
              mode="edit"
              defaultValues={{
                totalQuantity: purchaseQuery.data.totalQuantity,
                totalPrice: purchaseQuery.data.totalPrice,
                date: purchaseQuery.data.date,
              }}
              submitLabel={t('purchase.save')}
              isSubmitting={mutation.isPending}
              onSave={(values) => mutation.mutate(values)}
              onCancel={() =>
                navigate({
                  to: '/purchases/$purchaseId',
                  params: { purchaseId },
                })
              }
            />
          </div>
        ) : null}
      </section>
    </main>
  );
}

function mergeCurrentMaterial(
  currentMaterial: PurchaseMaterialOption,
  activeMaterials: Array<PurchaseMaterialOption>,
) {
  if (activeMaterials.some((material) => material.id === currentMaterial.id)) {
    return activeMaterials;
  }

  return [currentMaterial, ...activeMaterials];
}
