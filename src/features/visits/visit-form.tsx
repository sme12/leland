import { useUser } from '@clerk/tanstack-react-start';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import Decimal from 'decimal.js';
import { Check, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import type { Resolver } from 'react-hook-form';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { CustomerDto } from '#/server/customers';
import type { ServiceDto } from '#/server/services';
import type { VisitMaterialPickerDto } from '#/server/visits';
import { getCurrentUnitCost, parseVisitServerError } from '#/server/visits';
import { getVisitPriceSuggestion } from './price-suggestion';
import { getServicePrefillValue } from './service-prefill';
import { PickerSheet } from './picker-sheet';
import { visitKeys } from './visit-queries';
import {
  createDefaultVisitDate,
  visitCreateSchema,
  visitUpdateSchema,
} from '#/shared/schemas/visit';
import {
  visitDraftCreateSchema,
  visitDraftUpdateSchema,
} from '#/shared/schemas/visit-draft';
import { moneyStringSchema } from '#/shared/schemas/decimal';
import { isFutureHelsinkiDate, isPastHelsinkiDate } from '#/shared/date';
import { formatEuro } from '#/shared/purchase-format';
import { testIds } from '#/testing/test-ids';

export type VisitFormMode = 'create' | 'edit';
export type VisitRecordType = 'visit' | 'draft';

export type VisitLineItemFormFields = {
  id?: string;
  materialId: string;
  amount: string;
  unitCost?: string;
};

export type VisitFormFields = {
  recordType: VisitRecordType;
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
  recordType: VisitRecordType;
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
  recordType,
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
  const priceCharged = useWatch({
    control: form.control,
    name: 'priceCharged',
  });
  const items = useWatch({ control: form.control, name: 'items' });
  const priceSuggestion = useMemo(() => {
    return getVisitPriceSuggestion({
      currentPriceCharged: priceCharged,
      serviceDefaultPrice: selectedService?.defaultPrice ?? null,
      items,
    });
  }, [items, priceCharged, selectedService?.defaultPrice]);
  const priceLabel =
    recordType === 'draft'
      ? t('visit.fields.estimatedPrice')
      : t('visit.fields.priceCharged');

  return (
    <div data-testid={testIds.visitForm.root} className="space-y-6 pb-28">
      <label className="block">
        <span className="text-sm font-medium">{t('visit.fields.date')}</span>
        <input
          data-testid={testIds.visitForm.dateInput}
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
        testIds={{
          trigger: testIds.visitForm.customerTrigger,
          dialog: testIds.visitForm.customerDialog,
          searchInput: testIds.visitForm.customerSearchInput,
          option: testIds.visitForm.customerOption,
          createButton: testIds.visitForm.customerCreateButton,
        }}
        getOptionTestValue={(customer) => customer.id}
      />

      <section
        data-testid={testIds.visitForm.materialsSection}
        className={
          customerId
            ? 'space-y-3'
            : 'space-y-3 rounded-md border border-dashed border-border p-4 opacity-70'
        }
      >
        <div>
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
                recordType={recordType}
                materials={materials}
                disabled={!customerId}
                onRemove={() => remove(index)}
                onBuyFirst={onBuyFirst}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          data-testid={testIds.visitForm.addMaterialButton}
          disabled={!customerId}
          onClick={() => append({ materialId: '', amount: '', unitCost: '' })}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus aria-hidden="true" className="size-4" />
          {t('visit.addMaterial')}
        </button>
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

          form.setValue('serviceId', service.id, {
            shouldDirty: true,
            shouldValidate: true,
          });

          if (!isChargedDirty && mode === 'create') {
            const nextCharged = getServicePrefillValue({
              currentValue: form.getValues('priceCharged'),
              defaultPrice: service.defaultPrice,
              isDirty: false,
            });

            form.setValue('priceCharged', nextCharged, {
              shouldDirty: false,
              shouldValidate: true,
            });
          }
        }}
        testIds={{
          trigger: testIds.visitForm.serviceTrigger,
          dialog: testIds.visitForm.serviceDialog,
          searchInput: testIds.visitForm.serviceSearchInput,
          option: testIds.visitForm.serviceOption,
        }}
        getOptionTestValue={(service) => service.name}
      />

      <div>
        <label className="block">
          <span className="text-sm font-medium">{priceLabel}</span>
          <input
            {...form.register('priceCharged')}
            data-testid={testIds.visitForm.priceInput}
            data-record-type={recordType}
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

        {priceSuggestion ? (
          <div
            data-testid={testIds.visitForm.priceSuggestion}
            data-suggested-price={priceSuggestion}
            className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/45 px-3 py-2"
          >
            <span className="text-sm text-muted-foreground">
              {t('visit.priceSuggestion', {
                value: formatEuro(priceSuggestion, i18n.language),
              })}
            </span>
            <button
              type="button"
              data-testid={testIds.visitForm.applyPriceSuggestionButton}
              onClick={() =>
                form.setValue('priceCharged', priceSuggestion, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Check aria-hidden="true" className="size-4" />
              {t('visit.applyPriceSuggestion')}
            </button>
          </div>
        ) : null}
      </div>

      <label className="block">
        <span className="text-sm font-medium">{t('visit.fields.note')}</span>
        <textarea
          {...form.register('note')}
          data-testid={testIds.visitForm.noteInput}
          rows={4}
          className="mt-2 w-full resize-y rounded-md border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus-visible:ring-ring"
        />
      </label>
    </div>
  );
}

function VisitLineItemRow({
  index,
  recordType,
  materials,
  disabled,
  onRemove,
  onBuyFirst,
}: {
  index: number;
  recordType: VisitRecordType;
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
    <div
      data-testid={testIds.visitForm.lineItem}
      data-line-index={index}
      className="rounded-md border border-border bg-surface p-3"
    >
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
            testIds={{
              trigger: testIds.visitForm.materialTrigger,
              dialog: testIds.visitForm.materialDialog,
              searchInput: testIds.visitForm.materialSearchInput,
              option: testIds.visitForm.materialOption,
            }}
            getOptionTestValue={(material) => material.id}
            isOptionDisabled={(material) =>
              recordType === 'visit' && !material.hasPurchases
            }
            renderDisabledAction={
              recordType === 'visit'
                ? (material) => (
                    <button
                      type="button"
                      data-testid={testIds.visitForm.materialBuyFirstButton}
                      data-material-id={material.id}
                      onClick={() => onBuyFirst(material.id)}
                      className="shrink-0 rounded-md border border-border px-2 py-1 text-xs font-semibold outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {t('visit.buyFirst')}
                    </button>
                  )
                : undefined
            }
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
          data-testid={testIds.visitForm.materialRemoveButton}
          onClick={onRemove}
          aria-label={t('visit.removeLineItem')}
          className="mt-8 inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-border text-danger outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </button>
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-medium">{t('visit.fields.amount')}</span>
        <input
          {...form.register(`items.${index}.amount`)}
          data-testid={testIds.visitForm.materialAmountInput}
          inputMode="decimal"
          disabled={disabled || !materialId}
          className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        />
      </label>

      <p
        data-testid={testIds.visitForm.materialUnitCostCaption}
        className="mt-2 text-sm text-muted-foreground"
      >
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
  const recordType = values.recordType;
  const schema =
    recordType === 'draft'
      ? values.id
        ? visitDraftUpdateSchema
        : visitDraftCreateSchema
      : values.id
        ? visitUpdateSchema
        : visitCreateSchema;
  const result = schema.safeParse(toVisitValidationInput(values, recordType));

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
        issue.path
          .map((segment) =>
            segment === 'estimatedPrice' ? 'priceCharged' : segment,
          )
          .join('.'),
        { type: issue.code, message: issue.message },
      ]),
    ),
  };
};

function toVisitValidationInput(
  values: VisitFormFields,
  recordType: VisitRecordType,
) {
  if (recordType === 'draft') {
    return {
      ...(values.id ? { id: values.id } : {}),
      customerId: values.customerId,
      serviceId: values.serviceId,
      date: values.date,
      estimatedPrice: values.priceCharged,
      note: values.note,
      items: toDraftItems(values),
    };
  }

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

export function createEmptyVisitFormValues(
  recordType: VisitRecordType = 'visit',
): VisitFormFields {
  return {
    recordType,
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

export function toVisitDraftMutationInput(values: VisitFormFields) {
  return {
    ...(values.id ? { id: values.id } : {}),
    customerId: values.customerId,
    serviceId: values.serviceId,
    date: values.date,
    estimatedPrice: values.priceCharged,
    note: values.note,
    items: toDraftItems(values),
  };
}

function toDraftItems(values: VisitFormFields) {
  return values.items
    .filter((item) => item.materialId && isPositiveDecimal(item.amount))
    .map((item) => ({
      ...(item.id ? { id: item.id } : {}),
      materialId: item.materialId,
      amount: item.amount,
    }));
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
  const priceCharged = values.priceCharged.trim();
  const recordType = values.recordType;

  if (!values.customerId) missing.push('visit.missing.customer');
  if (!values.serviceId) missing.push('visit.missing.service');
  if (!values.date) missing.push('visit.missing.date');

  if (recordType === 'draft') {
    if (priceCharged && !moneyStringSchema.safeParse(priceCharged).success) {
      missing.push('validation.money');
    }
    if (values.date && isPastHelsinkiDate(values.date)) {
      missing.push('visit.missing.datePast');
    }

    return [...new Set(missing)];
  }

  if (!priceCharged) {
    missing.push('visit.missing.priceCharged');
  } else if (!moneyStringSchema.safeParse(priceCharged).success) {
    missing.push('validation.money');
  }
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

export function getVisitDraftPublishMissingKeys(values: VisitFormFields) {
  const missing: Array<string> = [];
  const estimatedPrice = values.priceCharged.trim();

  if (!estimatedPrice) {
    missing.push('visit.missing.estimatedPriceRequired');
  } else if (!moneyStringSchema.safeParse(estimatedPrice).success) {
    missing.push('validation.money');
  }
  if (values.date && isFutureHelsinkiDate(values.date)) {
    missing.push('visit.missing.publishDateFuture');
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
