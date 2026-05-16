import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import type * as ReactStart from '@tanstack/react-start';

import { appI18n } from '#/i18n';
import type { ServiceDto } from '#/server/services';
import type { VisitMaterialPickerDto } from '#/server/visits';
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

    fireEvent.click(screen.getByRole('button', { name: /add material/i }));

    const materialPicker = screen.getByRole('button', {
      name: /material pick a material/i,
    });
    const addMaterialButton = screen.getByRole('button', {
      name: /add material/i,
    });

    expect(
      materialPicker.compareDocumentPosition(addMaterialButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

function renderVisitFormBody() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <VisitFormHarness />
    </QueryClientProvider>,
  );
}

function VisitFormHarness() {
  const form = useForm<VisitFormFields>({
    defaultValues: {
      ...createEmptyVisitFormValues(),
      customerId: 'customer-id',
    },
  });

  return (
    <FormProvider {...form}>
      <VisitFormBody
        mode="create"
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
