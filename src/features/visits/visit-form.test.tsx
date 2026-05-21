import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as ReactStart from '@tanstack/react-start';

import { appI18n } from '#/i18n';
import type { ServiceDto } from '#/server/services';
import type { VisitMaterialPickerDto } from '#/server/visits';
import { testIds } from '#/testing/test-ids';
import {
  createEmptyVisitFormValues,
  getVisitFormMissingKeys,
  VisitFormBody,
} from './visit-form';
import type { VisitFormFields } from './visit-form';

vi.mock('@clerk/tanstack-react-start', () => ({
  useUser: () => ({ user: { id: 'user-id' } }),
}));

vi.mock('@tanstack/react-start', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactStart>();

  return {
    ...actual,
    useServerFn: () => vi.fn(),
  };
});

afterEach(() => {
  cleanup();
});

describe('getVisitFormMissingKeys', () => {
  it('flags non-money visit prices without throwing', () => {
    const values = {
      ...createEmptyVisitFormValues(),
      customerId: 'customer-id',
      serviceId: 'service-id',
      priceCharged: 'not-a-number',
    };

    expect(getVisitFormMissingKeys(values)).toContain('validation.money');
  });
});

describe('VisitFormBody', () => {
  it('renders the add material button after the appended material row', async () => {
    await appI18n.changeLanguage('en');

    renderVisitFormBody();

    fireEvent.click(screen.getByTestId(testIds.visitForm.addMaterialButton));

    const materialPicker = screen.getByTestId(
      testIds.visitForm.materialTrigger,
    );
    const addMaterialButton = screen.getByTestId(
      testIds.visitForm.addMaterialButton,
    );

    expect(
      materialPicker.compareDocumentPosition(addMaterialButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('shows price suggestions in edit mode', async () => {
    await appI18n.changeLanguage('en');

    renderVisitFormBody({
      mode: 'edit',
      defaultValues: {
        ...createEmptyVisitFormValues(),
        id: 'visit-id',
        customerId: 'customer-id',
        serviceId: 'service-id',
      },
    });

    expect(
      screen
        .getByTestId(testIds.visitForm.priceSuggestion)
        .getAttribute('data-suggested-price'),
    ).toBe('30');
  });

  it('marks the price field as draft-priced for draft forms', async () => {
    await appI18n.changeLanguage('en');

    renderVisitFormBody({
      recordType: 'draft',
      defaultValues: {
        ...createEmptyVisitFormValues('draft'),
        customerId: 'customer-id',
      },
    });

    expect(
      screen
        .getByTestId(testIds.visitForm.priceInput)
        .getAttribute('data-record-type'),
    ).toBe('draft');
  });
});

function renderVisitFormBody({
  mode = 'create',
  recordType = 'visit',
  defaultValues = {
    ...createEmptyVisitFormValues(recordType),
    customerId: 'customer-id',
  },
}: {
  mode?: 'create' | 'edit';
  recordType?: 'visit' | 'draft';
  defaultValues?: VisitFormFields;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <VisitFormHarness
        mode={mode}
        recordType={recordType}
        defaultValues={defaultValues}
      />
    </QueryClientProvider>,
  );
}

function VisitFormHarness({
  mode,
  recordType,
  defaultValues,
}: {
  mode: 'create' | 'edit';
  recordType: 'visit' | 'draft';
  defaultValues: VisitFormFields;
}) {
  const form = useForm<VisitFormFields>({
    defaultValues,
  });

  return (
    <FormProvider {...form}>
      <VisitFormBody
        mode={mode}
        recordType={recordType}
        customers={[
          {
            id: 'customer-id',
            name: 'Ada Lovelace',
            comment: null,
            isArchived: false,
          },
        ]}
        materials={materials}
        services={services}
        onCreateCustomer={() => undefined}
        onBuyFirst={() => undefined}
      />
    </FormProvider>
  );
}

const materials: Array<VisitMaterialPickerDto> = [
  {
    id: 'material-id',
    name: 'Color cream',
    category: 'color',
    unitOfMeasure: 'ml',
    isArchived: false,
    hasPurchases: true,
  },
];

const services: Array<ServiceDto> = [
  {
    id: 'service-id',
    name: 'service.color',
    defaultPrice: '30',
    displayOrder: 1,
  },
];
