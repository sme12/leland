import { Save, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Resolver, UseFormRegisterReturn } from 'react-hook-form';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { preventImplicitSubmit } from '#/components/prevent-implicit-submit';
import type { UnitOfMeasure } from '#/shared/enums';
import {
  computeContainerTotalQuantity,
  computePurchaseUnitCost,
  formatUnitCost,
} from '#/shared/purchase-format';
import type { PurchaseCreateValues } from '#/shared/schemas/purchase';
import {
  purchaseContainerFormSchema,
  purchaseCreateSchema,
  purchaseEditFormSchema,
  purchaseEditPieceFormSchema,
  purchasePieceFormSchema,
} from '#/shared/schemas/purchase';
import { testIds } from '#/testing/test-ids';

export type PurchaseFormMaterial = {
  id: string;
  name: string;
  unitOfMeasure: UnitOfMeasure;
};

export type PurchaseFormMode = 'create' | 'edit';

export type PurchaseFormDefaults = {
  totalQuantity: string;
  totalPrice: string;
  date: string;
};

type PurchaseFormFields = {
  count?: string;
  sizeEach?: string;
  quantity?: string;
  totalQuantity?: string;
  totalPrice: string;
  date: string;
};

type PurchaseFormProps = {
  material: PurchaseFormMaterial;
  mode?: PurchaseFormMode;
  defaultDate?: Date;
  defaultValues?: PurchaseFormDefaults;
  submitLabel: string;
  isSubmitting: boolean;
  showUnitCostPreview?: boolean;
  onSave: (purchase: PurchaseCreateValues) => void | Promise<void>;
  onCancel: () => void;
};

export function PurchaseForm({
  material,
  mode = 'create',
  defaultDate,
  defaultValues,
  submitLabel,
  isSubmitting,
  showUnitCostPreview = false,
  onSave,
  onCancel,
}: PurchaseFormProps) {
  const { t, i18n } = useTranslation();
  const resolver = useMemo(
    () => createPurchaseResolver(mode, material.unitOfMeasure),
    [material.unitOfMeasure, mode],
  );
  const form = useForm<PurchaseFormFields>({
    resolver,
    defaultValues:
      defaultValues && mode === 'edit'
        ? defaultValues
        : createDefaultValues(defaultDate),
  });
  const [isHydrated, setIsHydrated] = useState(false);
  const watchedValues = useWatch({ control: form.control });
  const preview = useMemo(
    () =>
      showUnitCostPreview
        ? createPreview(watchedValues, material.unitOfMeasure, i18n.language)
        : null,
    [i18n.language, material.unitOfMeasure, showUnitCostPreview, watchedValues],
  );
  const isPiece = material.unitOfMeasure === 'piece';
  const isDisabled = !isHydrated || isSubmitting;

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  async function submit(values: PurchaseFormFields) {
    const totalQuantity =
      mode === 'edit'
        ? values.totalQuantity
        : isPiece
          ? values.quantity
          : computeContainerTotalQuantity(
              values.count ?? '',
              values.sizeEach ?? '',
            );

    const purchase = purchaseCreateSchema.parse({
      materialId: material.id,
      totalQuantity,
      totalPrice: values.totalPrice,
      date: values.date,
    });

    await onSave(purchase);
  }

  return (
    <form
      data-testid={testIds.purchaseForm.root}
      className="space-y-5"
      onKeyDown={preventImplicitSubmit}
      onSubmit={form.handleSubmit(submit)}
    >
      <div
        data-testid={testIds.purchaseForm.materialSummary}
        className="rounded-md border border-border bg-muted/35 px-3 py-2"
      >
        <p className="text-sm font-semibold">{material.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(`material.uom.${material.unitOfMeasure}`)}
        </p>
      </div>

      {mode === 'edit' ? (
        <TextInput
          label={t('purchase.fields.totalQuantity')}
          registration={form.register('totalQuantity')}
          error={form.formState.errors.totalQuantity?.message}
          inputMode={isPiece ? 'numeric' : 'decimal'}
          testId={testIds.purchaseForm.totalQuantityInput}
          disabled={isDisabled}
        />
      ) : isPiece ? (
        <TextInput
          label={t('purchase.fields.quantity')}
          registration={form.register('quantity')}
          error={form.formState.errors.quantity?.message}
          inputMode="numeric"
          testId={testIds.purchaseForm.quantityInput}
          disabled={isDisabled}
        />
      ) : (
        <>
          <TextInput
            label={t('purchase.fields.count')}
            registration={form.register('count')}
            error={form.formState.errors.count?.message}
            inputMode="numeric"
            testId={testIds.purchaseForm.countInput}
            disabled={isDisabled}
          />
          <TextInput
            label={t('purchase.fields.sizeEach')}
            registration={form.register('sizeEach')}
            error={form.formState.errors.sizeEach?.message}
            inputMode="decimal"
            testId={testIds.purchaseForm.sizeEachInput}
            disabled={isDisabled}
          />
          <p className="text-sm text-muted-foreground">
            {t('purchase.openingStockHelp')}
          </p>
        </>
      )}

      <TextInput
        label={t('purchase.fields.totalPrice')}
        registration={form.register('totalPrice')}
        error={form.formState.errors.totalPrice?.message}
        inputMode="decimal"
        testId={testIds.purchaseForm.totalPriceInput}
        disabled={isDisabled}
      />

      <TextInput
        label={t('purchase.fields.date')}
        registration={form.register('date')}
        error={form.formState.errors.date?.message}
        type="date"
        testId={testIds.purchaseForm.dateInput}
        disabled={isDisabled}
      />

      {preview ? (
        <p
          data-testid={testIds.purchaseForm.unitCostPreview}
          className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
        >
          {t('purchase.unitCostPreview', {
            value: preview,
            unit: t(`material.uom.${material.unitOfMeasure}`),
          })}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          data-testid={testIds.purchaseForm.submitButton}
          disabled={isDisabled}
          className="inline-flex h-11 items-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save aria-hidden="true" className="size-4" />
          {submitLabel}
        </button>
        <button
          type="button"
          data-testid={testIds.purchaseForm.cancelButton}
          disabled={isDisabled}
          onClick={onCancel}
          className="inline-flex h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          <X aria-hidden="true" className="size-4" />
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}

type TextInputProps = {
  label: string;
  registration: UseFormRegisterReturn;
  error?: string;
  inputMode?: 'decimal' | 'numeric';
  type?: 'text' | 'date';
  testId: string;
  disabled: boolean;
};

function TextInput({
  label,
  registration,
  error,
  inputMode,
  type = 'text',
  testId,
  disabled,
}: TextInputProps) {
  const { t } = useTranslation();

  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        {...registration}
        data-testid={testId}
        type={type}
        inputMode={inputMode}
        disabled={disabled}
        className="mt-2 h-11 w-full rounded-md border border-border bg-surface px-3 outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
      />
      {error ? (
        <span className="mt-2 block text-sm text-danger">{t(error)}</span>
      ) : null}
    </label>
  );
}

function createPurchaseResolver(
  mode: PurchaseFormMode,
  unitOfMeasure: UnitOfMeasure,
): Resolver<PurchaseFormFields> {
  return (values) => {
    const schema =
      mode === 'edit'
        ? unitOfMeasure === 'piece'
          ? purchaseEditPieceFormSchema
          : purchaseEditFormSchema
        : unitOfMeasure === 'piece'
          ? purchasePieceFormSchema
          : purchaseContainerFormSchema;
    const result = schema.safeParse(
      pickSchemaValues(values, mode, unitOfMeasure),
    );

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

function pickSchemaValues(
  values: PurchaseFormFields,
  mode: PurchaseFormMode,
  unitOfMeasure: UnitOfMeasure,
) {
  if (mode === 'edit') {
    return {
      totalQuantity: values.totalQuantity,
      totalPrice: values.totalPrice,
      date: values.date,
    };
  }

  if (unitOfMeasure === 'piece') {
    return {
      quantity: values.quantity,
      totalPrice: values.totalPrice,
      date: values.date,
    };
  }

  return {
    count: values.count,
    sizeEach: values.sizeEach,
    totalPrice: values.totalPrice,
    date: values.date,
  };
}

function createDefaultValues(defaultDate?: Date): PurchaseFormFields {
  return {
    count: '',
    sizeEach: '',
    quantity: '',
    totalPrice: '',
    date: formatLocalDate(defaultDate ?? new Date()),
  };
}

function formatLocalDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function createPreview(
  values: Partial<PurchaseFormFields>,
  unitOfMeasure: UnitOfMeasure,
  locale: string,
) {
  try {
    const totalQuantity =
      values.totalQuantity ??
      (unitOfMeasure === 'piece'
        ? values.quantity
        : values.count && values.sizeEach
          ? computeContainerTotalQuantity(values.count, values.sizeEach)
          : null);

    if (!values.totalPrice || !totalQuantity) {
      return null;
    }

    const unitCost = computePurchaseUnitCost(values.totalPrice, totalQuantity);

    return formatUnitCost(unitCost, locale);
  } catch {
    return null;
  }
}
