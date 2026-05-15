import { useUser } from '@clerk/tanstack-react-start';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import Decimal from 'decimal.js';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import type { Resolver } from 'react-hook-form';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { CustomerDto } from '#/server/customers';
import type { ServiceDto } from '#/server/services';
import type { VisitMaterialPickerDto } from '#/server/visits';
import { getCurrentUnitCost, parseVisitServerError } from '#/server/visits';
import { getServicePrefillValue } from './service-prefill';
import { PickerSheet } from './picker-sheet';
import { visitKeys } from './visit-queries';
import {
  createDefaultVisitDate,
  visitCreateSchema,
  visitUpdateSchema,
} from '#/shared/schemas/visit';
import { isFutureHelsinkiDate } from '#/shared/date';
import { formatEuro } from '#/shared/purchase-format';

export type VisitFormMode = 'create' | 'edit';

export type VisitLineItemFormFields = {
  id?: string;
  materialId: string;
  amount: string;
  unitCost?: string;
};

export type VisitFormFields = {
  id?: string;
  date: string;
  customerId: string;
  serviceId: string;
  priceCharged: string;
  note: string;
  items: Array<VisitLineItemFormFields>;
};

type VisitFormBodyProps = {
  mode: VisitFormMode;
  customers: Array<CustomerOption>;
  materials: Array<VisitMaterialPickerDto>;
  services: Array<ServiceDto>;
  onCreateCustomer?: (name: string) => void;
  onBuyFirst: (materialId: string) => void;
};

type CustomerOption = Pick<
  CustomerDto,
  'id' | 'name' | 'comment' | 'isArchived'
>;

export function VisitFormBody({
  mode,
  customers,
  materials,
  services,
  onCreateCustomer,
  onBuyFirst,
}: VisitFormBodyProps) {
  const { t, i18n } = useTranslation();
  const form = useFormContext<VisitFormFields>();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });
  const customerId = useWatch({ control: form.control, name: 'customerId' });
  const selectedCustomer = customers.find(
    (customer) => customer.id === customerId,
  );
  const serviceId = useWatch({ control: form.control, name: 'serviceId' });
  const selectedService = services.find((service) => service.id === serviceId);

  return (
    <div className="space-y-6 pb-28">
      <label className="block">
        <span className="text-sm font-medium">{t('visit.fields.date')}</span>
        <input
          type="date"
          {...form.register('date')}
          className="mt-2 h-11 w-full rounded-md border border-border bg-surface px-3 outline-none focus:ring-2 focus:ring-ring"
        />
        {form.formState.errors.date ? (
          <span className="mt-2 block text-sm text-danger">
            {t(form.formState.errors.date.message ?? 'validation.generic')}
          </span>
        ) : null}
      </label>

      <PickerSheet
        label={t('visit.fields.customer')}
        valueLabel={selectedCustomer?.name ?? ''}
        placeholder={t('visit.customerPlaceholder')}
        searchPlaceholder={t('visit.searchCustomers')}
        emptyText={t('visit.noCustomers')}
        options={customers}
        selectedId={customerId}
        getOptionLabel={(customer) => customer.name}
        renderOption={(customer) => (
          <span className="block min-w-0">
            <span className="block truncate font-medium">{customer.name}</span>
            {customer.comment ? (
              <span className="mt-1 block truncate text-sm text-muted-foreground">
                {customer.comment}
              </span>
            ) : null}
          </span>
        )}
        onSelect={(customer) =>
          form.setValue('customerId', customer.id, {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
        onCreate={mode === 'create' ? onCreateCustomer : undefined}
        createLabel={(query) => t('visit.createCustomerCta', { name: query })}
      />

      <section
        className={
          customerId
            ? 'space-y-3'
            : 'space-y-3 rounded-md border border-dashed border-border p-4 opacity-70'
        }
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">
              {t('visit.materialsTitle')}
            </h2>
            {!customerId ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {t('visit.materialsNeedCustomer')}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={!customerId}
            onClick={() => append({ materialId: '', amount: '', unitCost: '' })}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus aria-hidden="true" className="size-4" />
            {t('visit.addMaterial')}
          </button>
        </div>

        {fields.length === 0 ? (
          <p className="rounded-md bg-muted/45 px-3 py-3 text-sm text-muted-foreground">
            {t('visit.noLineItems')}
          </p>
        ) : (
          <div className="space-y-3">
            {fields.map((field, index) => (
              <VisitLineItemRow
                key={field.id}
                index={index}
                materials={materials}
                disabled={!customerId}
                onRemove={() => remove(index)}
                onBuyFirst={onBuyFirst}
              />
            ))}
          </div>
        )}
      </section>

      <PickerSheet
        label={t('visit.fields.service')}
        valueLabel={selectedService ? t(selectedService.name) : ''}
        placeholder={t('visit.servicePlaceholder')}
        searchPlaceholder={t('visit.searchServices')}
        emptyText={t('visit.noServices')}
        options={services}
        selectedId={serviceId}
        getOptionLabel={(service) => t(service.name)}
        renderOption={(service) => (
          <span className="flex min-w-0 items-center justify-between gap-3">
            <span className="truncate font-medium">{t(service.name)}</span>
            <span className="shrink-0 text-sm text-muted-foreground">
              {service.defaultPrice
                ? formatEuro(service.defaultPrice, i18n.language)
                : t('servicePrices.setPrice')}
            </span>
          </span>
        )}
        onSelect={(service) => {
          const isChargedDirty = Boolean(
            form.formState.dirtyFields.priceCharged,
          );
          const nextCharged = getServicePrefillValue({
            currentValue: form.getValues('priceCharged'),
            defaultPrice: service.defaultPrice,
            isDirty: isChargedDirty || mode === 'edit',
          });

          form.setValue('serviceId', service.id, {
            shouldDirty: true,
            shouldValidate: true,
          });

          if (!isChargedDirty && mode === 'create') {
            form.setValue('priceCharged', nextCharged, {
              shouldDirty: false,
              shouldValidate: true,
            });
          }
        }}
      />

      <label className="block">
        <span className="text-sm font-medium">
          {t('visit.fields.priceCharged')}
        </span>
        <input
          {...form.register('priceCharged')}
          inputMode="decimal"
          className="mt-2 h-11 w-full rounded-md border border-border bg-surface px-3 outline-none focus:ring-2 focus:ring-ring"
        />
        {form.formState.errors.priceCharged ? (
          <span className="mt-2 block text-sm text-danger">
            {t(
              form.formState.errors.priceCharged.message ??
                'validation.generic',
            )}
          </span>
        ) : null}
      </label>

      <label className="block">
        <span className="text-sm font-medium">{t('visit.fields.note')}</span>
        <textarea
          {...form.register('note')}
          rows={4}
          className="mt-2 w-full resize-y rounded-md border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus-visible:ring-ring"
        />
      </label>
    </div>
  );
}

function VisitLineItemRow({
  index,
  materials,
  disabled,
  onRemove,
  onBuyFirst,
}: {
  index: number;
  materials: Array<VisitMaterialPickerDto>;
  disabled: boolean;
  onRemove: () => void;
  onBuyFirst: (materialId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { user } = useUser();
  const userKey = user?.id ?? 'pending';
  const form = useFormContext<VisitFormFields>();
  const materialId = useWatch({
    control: form.control,
    name: `items.${index}.materialId`,
  });
  const amount = useWatch({
    control: form.control,
    name: `items.${index}.amount`,
  });
  const unitCost = useWatch({
    control: form.control,
    name: `items.${index}.unitCost`,
  });
  const selectedMaterial = materials.find(
    (material) => material.id === materialId,
  );
  const getCurrentUnitCostFn = useServerFn(getCurrentUnitCost);
  const unitCostQuery = useQuery({
    queryKey: visitKeys.unitCost(userKey, materialId || 'none'),
    queryFn: () => getCurrentUnitCostFn({ data: { id: materialId } }),
    staleTime: Infinity,
    enabled: Boolean(
      user &&
      materialId &&
      selectedMaterial?.hasPurchases &&
      !selectedMaterial.isArchived,
    ),
  });
  const lineCost = useMemo(() => {
    try {
      if (!amount || !unitCost) {
        return null;
      }

      return new Decimal(amount).mul(unitCost);
    } catch {
      return null;
    }
  }, [amount, unitCost]);
  const materialIdError = form.formState.errors.items?.[index]?.materialId;

  useEffect(() => {
    if (unitCostQuery.data) {
      form.setValue(`items.${index}.unitCost`, unitCostQuery.data, {
        shouldDirty: false,
      });
    }
  }, [form, index, unitCostQuery.data]);

  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <PickerSheet
            label={t('visit.fields.material')}
            valueLabel={selectedMaterial?.name ?? ''}
            placeholder={t('visit.materialPlaceholder')}
            searchPlaceholder={t('visit.searchMaterials')}
            emptyText={t('visit.noMaterials')}
            options={materials}
            selectedId={materialId}
            disabled={disabled}
            getOptionLabel={(material) => material.name}
            isOptionDisabled={(material) => !material.hasPurchases}
            renderDisabledAction={(material) => (
              <button
                type="button"
                onClick={() => onBuyFirst(material.id)}
                className="shrink-0 rounded-md border border-border px-2 py-1 text-xs font-semibold outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t('visit.buyFirst')}
              </button>
            )}
            renderOption={(material) => (
              <span className="block min-w-0">
                <span className="block truncate font-medium">
                  {material.name}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {t(`material.category.${material.category}`)} ·{' '}
                  {t(`material.uom.${material.unitOfMeasure}`)}
                </span>
              </span>
            )}
            onSelect={(material) => {
              form.setValue(`items.${index}.materialId`, material.id, {
                shouldDirty: true,
                shouldValidate: true,
              });
              form.setValue(`items.${index}.unitCost`, '', {
                shouldDirty: false,
              });
            }}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('visit.removeLineItem')}
          className="mt-7 inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-border text-danger outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </button>
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-medium">{t('visit.fields.amount')}</span>
        <input
          {...form.register(`items.${index}.amount`)}
          inputMode="decimal"
          disabled={disabled || !materialId}
          className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        />
      </label>

      <p className="mt-2 text-sm text-muted-foreground">
        {selectedMaterial && unitCost ? (
          <>
            {t('visit.unitCostCaption', {
              value: formatEuro(unitCost, i18n.language, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              }),
              unit: t(`material.uom.${selectedMaterial.unitOfMeasure}`),
            })}
            {lineCost ? ` · ${formatEuro(lineCost, i18n.language)}` : ''}
          </>
        ) : selectedMaterial && unitCostQuery.isPending ? (
          t('visit.unitCostLoading')
        ) : (
          t('visit.unitCostEmpty')
        )}
      </p>

      {materialIdError ? (
        <p className="mt-2 text-sm text-danger">
          {t(materialIdError.message ?? 'validation.generic')}
        </p>
      ) : null}
    </div>
  );
}

export const visitFormResolver: Resolver<VisitFormFields> = (values) => {
  const schema = values.id ? visitUpdateSchema : visitCreateSchema;
  const result = schema.safeParse(toVisitValidationInput(values));

  if (result.success) {
    return {
      values,
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

function toVisitValidationInput(values: VisitFormFields) {
  return {
    ...(values.id ? { id: values.id } : {}),
    customerId: values.customerId,
    serviceId: values.serviceId,
    date: values.date,
    priceCharged: values.priceCharged,
    note: values.note,
    items: values.items.map((item) => ({
      ...(item.id ? { id: item.id } : {}),
      materialId: item.materialId,
      amount: item.amount,
    })),
  };
}

export function createEmptyVisitFormValues(): VisitFormFields {
  return {
    date: createDefaultVisitDate(),
    customerId: '',
    serviceId: '',
    priceCharged: '',
    note: '',
    items: [],
  };
}

export function toVisitMutationInput(values: VisitFormFields) {
  const items = values.items
    .filter((item) => item.materialId && item.amount)
    .map((item) => ({
      ...(item.id ? { id: item.id } : {}),
      materialId: item.materialId,
      amount: item.amount,
    }));

  return {
    ...(values.id ? { id: values.id } : {}),
    customerId: values.customerId,
    serviceId: values.serviceId,
    date: values.date,
    priceCharged: values.priceCharged,
    note: values.note,
    items,
  };
}

export function computeVisitPreviewCost(values: VisitFormFields) {
  return values.items.reduce((total, item) => {
    try {
      if (!item.amount || !item.unitCost) {
        return total;
      }

      return total.add(new Decimal(item.amount).mul(item.unitCost));
    } catch {
      return total;
    }
  }, new Decimal(0));
}

export function getVisitFormMissingKeys(values: VisitFormFields) {
  const missing: Array<string> = [];

  if (!values.customerId) missing.push('visit.missing.customer');
  if (!values.serviceId) missing.push('visit.missing.service');
  if (!values.priceCharged) missing.push('visit.missing.priceCharged');
  if (values.date && isFutureHelsinkiDate(values.date)) {
    missing.push('visit.missing.dateFuture');
  }

  for (const item of values.items) {
    if (!item.materialId) missing.push('visit.missing.material');
    if (!isPositiveDecimal(item.amount)) {
      missing.push('visit.missing.amount');
    }
  }

  return [...new Set(missing)];
}

type SetFormError = (
  name: `items.${number}.materialId`,
  error: { type: string; message: string },
) => void;

export function applyVisitServerError({
  error,
  values,
  setError,
}: {
  error: { message?: string };
  values: VisitFormFields;
  setError: SetFormError;
}): boolean {
  if (!error.message) {
    return false;
  }

  const parsed = parseVisitServerError(error.message);

  if (!parsed) {
    return false;
  }

  const index = values.items.findIndex(
    (item) => item.materialId === parsed.materialId,
  );

  if (index < 0) {
    return false;
  }

  setError(`items.${index}.materialId`, {
    type: parsed.code,
    message: 'visit.errors.materialNeedsPurchase',
  });

  return true;
}

function isPositiveDecimal(value: string) {
  try {
    return Boolean(value) && new Decimal(value).gt(0);
  } catch {
    return false;
  }
}
