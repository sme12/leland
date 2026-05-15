import { useUser } from '@clerk/tanstack-react-start';
import { Toast } from '@base-ui/react/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { ArrowLeft, PackagePlus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MaterialForm } from '#/features/materials/material-form';
import { materialKeys } from '#/features/materials/material-queries';
import { PurchaseForm } from '#/features/purchases/purchase-form';
import { PurchaseMaterialSelect } from '#/features/purchases/purchase-material-select';
import { purchaseKeys } from '#/features/purchases/purchase-queries';
import { createMaterial, listMaterials } from '#/server/materials';
import type { MaterialDto } from '#/server/materials';
import { createPurchase } from '#/server/purchases';
import type { MaterialCreateValues } from '#/shared/schemas/material';
import type { PurchaseCreateValues } from '#/shared/schemas/purchase';

export const Route = createFileRoute('/_app/purchases/new')({
  validateSearch: (search: Record<string, unknown>) => ({
    materialId:
      typeof search.materialId === 'string' ? search.materialId : undefined,
  }),
  component: NewPurchaseRoute,
});

function NewPurchaseRoute() {
  const { t } = useTranslation();
  const { materialId } = Route.useSearch();
  const { user } = useUser();
  const userKey = user?.id ?? 'pending';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = Toast.useToastManager();
  const listMaterialsFn = useServerFn(listMaterials);
  const createMaterialFn = useServerFn(createMaterial);
  const createPurchaseFn = useServerFn(createPurchase);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [createdMaterialFallback, setCreatedMaterialFallback] =
    useState<MaterialDto | null>(null);
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const hasAppliedPrefillRef = useRef(false);
  const materialsQuery = useQuery({
    queryKey: materialKeys.list(userKey, false),
    queryFn: () => listMaterialsFn({ data: { archived: false } }),
    staleTime: Infinity,
    enabled: !!user,
  });
  const selectedMaterial = useMemo(
    () =>
      (materialsQuery.data ?? []).find(
        (material) => material.id === selectedMaterialId,
      ) ??
      (createdMaterialFallback?.id === selectedMaterialId
        ? createdMaterialFallback
        : null),
    [createdMaterialFallback, materialsQuery.data, selectedMaterialId],
  );

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (hasAppliedPrefillRef.current) {
      return;
    }

    if (!materialId || !materialsQuery.data) {
      return;
    }

    if (materialsQuery.data.some((material) => material.id === materialId)) {
      hasAppliedPrefillRef.current = true;
      setSelectedMaterialId(materialId);
      setCreatedMaterialFallback(null);
    }
  }, [materialId, materialsQuery.data]);

  const createMaterialMutation = useMutation({
    mutationFn: (values: MaterialCreateValues) =>
      createMaterialFn({ data: values }),
    onSuccess: async (material) => {
      await queryClient.invalidateQueries({
        queryKey: materialKeys.root,
      });
      setCreatedMaterialFallback(material);
      setSelectedMaterialId(material.id);
      setIsAddingMaterial(false);
    },
    onError: (error) => {
      toast.add({
        title: t('material.createFailed'),
        description: error.message,
      });
    },
  });

  const createPurchaseMutation = useMutation({
    mutationFn: (values: PurchaseCreateValues) =>
      createPurchaseFn({ data: values }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: purchaseKeys.all(userKey),
      });
      await navigate({ to: '/purchases' });
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
        to="/purchases"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('common.back')}
      </Link>
      <h1 className="mt-5 text-3xl font-semibold tracking-normal">
        {t('purchase.newTitle')}
      </h1>

      <section className="mt-6 space-y-4 rounded-md border border-border bg-surface p-4 sm:p-6">
        {materialsQuery.isPending ? (
          <p className="text-sm text-muted-foreground">
            {t('material.loading')}
          </p>
        ) : materialsQuery.isError ? (
          <p className="text-sm text-danger">{t('material.loadError')}</p>
        ) : (
          <PurchaseMaterialSelect
            materials={materialsQuery.data}
            selectedId={selectedMaterialId}
            onChange={(nextMaterialId) => {
              setSelectedMaterialId(nextMaterialId);
              if (createdMaterialFallback?.id !== nextMaterialId) {
                setCreatedMaterialFallback(null);
              }
            }}
          />
        )}

        <button
          type="button"
          disabled={!isHydrated}
          aria-expanded={isAddingMaterial}
          onClick={() => setIsAddingMaterial((current) => !current)}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          <PackagePlus aria-hidden="true" className="size-4" />
          {t('purchase.newMaterialToggle')}
        </button>

        {isAddingMaterial ? (
          <div className="border-t border-border pt-4">
            <MaterialForm
              mode="create"
              submitLabel={t('material.create')}
              isSubmitting={createMaterialMutation.isPending}
              onSubmit={(values) => createMaterialMutation.mutate(values)}
            />
          </div>
        ) : null}
      </section>

      {selectedMaterial ? (
        <section className="mt-6 rounded-md border border-border bg-surface p-4 sm:p-6">
          <PurchaseForm
            key={selectedMaterial.id}
            material={selectedMaterial}
            submitLabel={t('purchase.create')}
            isSubmitting={createPurchaseMutation.isPending}
            onSave={(values) => createPurchaseMutation.mutate(values)}
            onCancel={() => navigate({ to: '/purchases' })}
          />
        </section>
      ) : null}
    </main>
  );
}
