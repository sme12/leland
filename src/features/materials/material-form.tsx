import { Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Resolver } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { MaterialCategory, UnitOfMeasure } from '#/shared/enums';
import { MATERIAL_CATEGORIES, UNIT_OF_MEASURE } from '#/shared/enums';
import type {
  MaterialCreateValues,
  MaterialEditFormValues,
} from '#/shared/schemas/material';
import {
  materialCreateSchema,
  materialEditFormSchema,
} from '#/shared/schemas/material';

type MaterialFormMode = 'create' | 'edit';

type MaterialFormInput = {
  name: string;
  category: MaterialCategory;
  unitOfMeasure?: UnitOfMeasure;
};

type MaterialFormValues = MaterialCreateValues | MaterialEditFormValues;

type MaterialFormProps = {
  mode: MaterialFormMode;
  defaultValues?: MaterialFormInput;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: MaterialFormValues) => void | Promise<void>;
};

export function MaterialForm({
  mode,
  defaultValues,
  submitLabel,
  isSubmitting,
  onSubmit,
}: MaterialFormProps) {
  const { t } = useTranslation();
  const resolver = useMemo(() => createMaterialResolver(mode), [mode]);
  const form = useForm<MaterialFormInput, unknown, MaterialFormValues>({
    resolver,
    defaultValues: defaultValues ?? {
      name: '',
      category: 'color',
      unitOfMeasure: 'ml',
    },
  });
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
    >
      <label className="block">
        <span className="text-sm font-medium">{t('material.fields.name')}</span>
        <input
          {...form.register('name')}
          autoComplete="off"
          disabled={!isHydrated || isSubmitting}
          className="mt-2 h-11 w-full rounded-md border border-border bg-surface px-3 outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        />
        {form.formState.errors.name ? (
          <span className="mt-2 block text-sm text-danger">
            {t(form.formState.errors.name.message ?? 'validation.generic')}
          </span>
        ) : null}
      </label>

      <label className="block">
        <span className="text-sm font-medium">
          {t('material.fields.category')}
        </span>
        <select
          {...form.register('category')}
          disabled={!isHydrated || isSubmitting}
          className="mt-2 h-11 w-full rounded-md border border-border bg-surface px-3 outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        >
          {MATERIAL_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {t(`material.category.${category}`)}
            </option>
          ))}
        </select>
        {form.formState.errors.category ? (
          <span className="mt-2 block text-sm text-danger">
            {t(form.formState.errors.category.message ?? 'validation.generic')}
          </span>
        ) : null}
      </label>

      {mode === 'create' ? (
        <label className="block">
          <span className="text-sm font-medium">
            {t('material.fields.unitOfMeasure')}
          </span>
          <select
            {...form.register('unitOfMeasure')}
            disabled={!isHydrated || isSubmitting}
            className="mt-2 h-11 w-full rounded-md border border-border bg-surface px-3 outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          >
            {UNIT_OF_MEASURE.map((unitOfMeasure) => (
              <option key={unitOfMeasure} value={unitOfMeasure}>
                {t(`material.uom.${unitOfMeasure}`)}
              </option>
            ))}
          </select>
          {form.formState.errors.unitOfMeasure ? (
            <span className="mt-2 block text-sm text-danger">
              {t(
                form.formState.errors.unitOfMeasure.message ??
                  'validation.generic',
              )}
            </span>
          ) : null}
        </label>
      ) : null}

      <button
        type="submit"
        disabled={!isHydrated || isSubmitting}
        className="inline-flex h-11 items-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Save aria-hidden="true" className="size-4" />
        {submitLabel}
      </button>
    </form>
  );
}

function createMaterialResolver(
  mode: MaterialFormMode,
): Resolver<MaterialFormInput, unknown, MaterialFormValues> {
  return (values) => {
    const result =
      mode === 'create'
        ? materialCreateSchema.safeParse(values)
        : materialEditFormSchema.safeParse(values);

    if (result.success) {
      return {
        values: result.data,
        errors: {},
      };
    }

    return {
      values: {},
      errors: Object.fromEntries(
        result.error.issues.map((issue) => [
          issue.path.join('.'),
          { type: issue.code, message: issue.message },
        ]),
      ),
    };
  };
}
