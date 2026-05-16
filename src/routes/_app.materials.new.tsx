import { useUser } from '@clerk/tanstack-react-start';
import { Toast } from '@base-ui/react/toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { MaterialForm } from '#/features/materials/material-form';
import { materialKeys } from '#/features/materials/material-queries';
import { invalidateVisitMaterialQueries } from '#/features/visits/visit-query-invalidation';
import { createMaterial } from '#/server/materials';
import type { MaterialCreateValues } from '#/shared/schemas/material';

export const Route = createFileRoute('/_app/materials/new')({
  component: NewMaterialRoute,
});

function NewMaterialRoute() {
  const { t } = useTranslation();
  const { user } = useUser();
  const userKey = user?.id ?? 'pending';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = Toast.useToastManager();
  const createMaterialFn = useServerFn(createMaterial);
  const mutation = useMutation({
    mutationFn: (values: MaterialCreateValues) =>
      createMaterialFn({ data: values }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: materialKeys.root,
        }),
        invalidateVisitMaterialQueries({ queryClient, userId: userKey }),
      ]);
      await navigate({ to: '/materials' });
    },
    onError: (error) => {
      console.error('Failed to create material:', error);
      toast.add({
        title: t('material.createFailed'),
        description: error.message,
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
        {t('material.newTitle')}
      </h1>
      <div className="mt-6 rounded-md border border-border bg-surface p-4 sm:p-6">
        <MaterialForm
          mode="create"
          submitLabel={t('material.create')}
          isSubmitting={mutation.isPending}
          onSubmit={(values) => mutation.mutate(values)}
        />
      </div>
    </main>
  );
}
