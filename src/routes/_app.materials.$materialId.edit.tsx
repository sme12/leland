import { useUser } from '@clerk/tanstack-react-start';
import { Toast } from '@base-ui/react/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { MaterialForm } from '#/features/materials/material-form';
import { materialKeys } from '#/features/materials/material-queries';
import { getMaterial, updateMaterial } from '#/server/materials';
import type { MaterialEditFormValues } from '#/shared/schemas/material';

export const Route = createFileRoute('/_app/materials/$materialId/edit')({
  component: EditMaterialRoute,
});

function EditMaterialRoute() {
  const { t } = useTranslation();
  const { user } = useUser();
  const userKey = user?.id ?? 'pending';
  const { materialId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = Toast.useToastManager();
  const getMaterialFn = useServerFn(getMaterial);
  const updateMaterialFn = useServerFn(updateMaterial);
  const query = useQuery({
    queryKey: materialKeys.detail(userKey, materialId),
    queryFn: () => getMaterialFn({ data: { id: materialId } }),
    staleTime: Infinity,
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: (values: MaterialEditFormValues) =>
      updateMaterialFn({ data: { ...values, id: materialId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: materialKeys.all(userKey),
      });
      await navigate({ to: '/materials' });
    },
    onError: () => {
      toast.add({
        title: t('material.saveFailed'),
        description: t('material.saveFailedDescription'),
      });
    },
  });

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link
        to="/materials"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('common.back')}
      </Link>
      <h1 className="mt-5 text-3xl font-semibold tracking-normal">
        {t('material.editTitle')}
      </h1>
      <div className="mt-6 rounded-md border border-border bg-surface p-4 sm:p-6">
        {query.isPending ? (
          <p className="text-sm text-muted-foreground">
            {t('material.loading')}
          </p>
        ) : query.isError ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">{t('material.notFoundTitle')}</p>
            <p className="text-sm text-muted-foreground">
              {t('material.notFoundBody')}
            </p>
            <Link
              to="/materials"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              {t('material.backToList')}
            </Link>
          </div>
        ) : (
          <MaterialForm
            mode="edit"
            defaultValues={{
              name: query.data.name,
              category: query.data.category,
            }}
            submitLabel={t('material.save')}
            isSubmitting={mutation.isPending}
            onSubmit={(values) => mutation.mutate(values)}
          />
        )}
      </div>
    </main>
  );
}
