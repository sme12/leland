import { useUser } from '@clerk/tanstack-react-start';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Link } from '@tanstack/react-router';
import {
  Archive,
  ChevronDown,
  ChevronRight,
  PackagePlus,
  Pencil,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { MaterialDto } from '#/server/materials';
import type { MaterialCategory } from '#/shared/enums';
import type { MaterialStatus } from './material-queries';
import { invalidateVisitMaterialQueries } from '#/features/visits/visit-query-invalidation';
import { listMaterials, setMaterialArchived } from '#/server/materials';
import { MATERIAL_CATEGORIES } from '#/shared/enums';
import { materialKeys } from './material-queries';

export function MaterialsList() {
  const { t, i18n } = useTranslation();
  const { user } = useUser();
  const userKey = user?.id ?? 'pending';
  const [status, setStatus] = useState<MaterialStatus>('active');
  const [openCategories, setOpenCategories] = useState(
    () => new Set<MaterialCategory>(MATERIAL_CATEGORIES),
  );
  const queryClient = useQueryClient();
  const listMaterialsFn = useServerFn(listMaterials);
  const setArchivedFn = useServerFn(setMaterialArchived);
  const archived = status === 'archived';

  const query = useQuery({
    queryKey: materialKeys.list(userKey, archived),
    queryFn: () => listMaterialsFn({ data: { archived } }),
    staleTime: Infinity,
    enabled: !!user,
  });

  useEffect(() => {
    if (query.isError) {
      console.error('Failed to load materials:', query.error);
    }
  }, [query.error, query.isError]);

  const groupedMaterials = useMemo(() => {
    const collator = new Intl.Collator(i18n.language, { sensitivity: 'base' });

    return MATERIAL_CATEGORIES.map((category) => ({
      category,
      materials: [...(query.data ?? [])]
        .filter((material) => material.category === category)
        .sort((a, b) => collator.compare(a.name, b.name)),
    })).filter((group) => group.materials.length > 0);
  }, [i18n.language, query.data]);

  const archiveMutation = useMutation({
    mutationFn: (input: { id: string; isArchived: boolean }) =>
      setArchivedFn({ data: input }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: materialKeys.root,
        }),
        invalidateVisitMaterialQueries({ queryClient, userId: userKey }),
      ]);
    },
  });

  function confirmArchive(material: MaterialDto, nextArchived: boolean) {
    const key = nextArchived
      ? 'material.confirmArchive'
      : 'material.confirmRestore';

    if (window.confirm(t(key, { name: material.name }))) {
      archiveMutation.mutate({ id: material.id, isArchived: nextArchived });
    }
  }

  function toggleCategory(category: MaterialCategory) {
    setOpenCategories((current) => {
      const next = new Set(current);

      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }

      return next;
    });
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal">
            {t('material.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('material.subtitle')}
          </p>
        </div>
        <Link
          to="/materials/new"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-3 text-sm font-semibold text-background outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus aria-hidden="true" className="size-4" />
          {t('material.add')}
        </Link>
      </div>

      <div
        className="mt-6 inline-grid grid-cols-2 rounded-md border border-border bg-surface p-1"
        role="group"
        aria-label={t('material.statusLabel')}
      >
        {(['active', 'archived'] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={status === item}
            onClick={() => setStatus(item)}
            className="h-9 rounded px-4 text-sm font-medium transition aria-pressed:bg-foreground aria-pressed:text-background"
          >
            {t(`material.status.${item}`)}
          </button>
        ))}
      </div>

      <section
        data-materials-list
        data-loaded={query.isPending ? 'false' : 'true'}
        className="mt-5 overflow-hidden rounded-md border border-border bg-surface"
      >
        {query.isError ? (
          <p className="p-4 text-sm text-red-600">{t('material.loadError')}</p>
        ) : query.isPending ? (
          <p className="p-4 text-sm text-muted-foreground">
            {t('material.loading')}
          </p>
        ) : groupedMaterials.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {t(archived ? 'material.emptyArchived' : 'material.emptyActive')}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {groupedMaterials.map((group) => {
              const isOpen = openCategories.has(group.category);

              return (
                <section
                  key={group.category}
                  data-material-category={group.category}
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => toggleCategory(group.category)}
                    className="flex w-full items-center justify-between gap-3 bg-muted/40 px-4 py-3 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      {isOpen ? (
                        <ChevronDown aria-hidden="true" className="size-4" />
                      ) : (
                        <ChevronRight aria-hidden="true" className="size-4" />
                      )}
                      <span className="truncate text-sm font-semibold">
                        {t(`material.category.${group.category}`)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {t('material.groupCount', {
                        count: group.materials.length,
                      })}
                    </span>
                  </button>

                  {isOpen ? (
                    <ul className="divide-y divide-border">
                      {group.materials.map((material) => (
                        <li
                          key={material.id}
                          data-material-id={material.id}
                          className="flex items-start justify-between gap-3 p-4"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {material.name}
                            </p>
                            <p className="mt-1 inline-flex items-center gap-2 text-sm text-muted-foreground">
                              <PackagePlus
                                aria-hidden="true"
                                className="size-4"
                              />
                              {t(`material.uom.${material.unitOfMeasure}`)}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {!archived ? (
                              <Link
                                to="/materials/$materialId/edit"
                                params={{ materialId: material.id }}
                                aria-label={t('material.editNamed', {
                                  name: material.name,
                                })}
                                className="inline-flex size-10 items-center justify-center rounded-md border border-border hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <Pencil aria-hidden="true" className="size-4" />
                              </Link>
                            ) : null}
                            <button
                              type="button"
                              aria-label={t(
                                archived
                                  ? 'material.restoreNamed'
                                  : 'material.archiveNamed',
                                { name: material.name },
                              )}
                              className="inline-flex size-10 items-center justify-center rounded-md border border-border hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={() =>
                                confirmArchive(material, !archived)
                              }
                            >
                              {archived ? (
                                <RotateCcw
                                  aria-hidden="true"
                                  className="size-4"
                                />
                              ) : (
                                <Archive
                                  aria-hidden="true"
                                  className="size-4"
                                />
                              )}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
