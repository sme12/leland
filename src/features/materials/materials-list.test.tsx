import { cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { appI18n } from '#/i18n';
import type { MaterialDto } from '#/server/materials';
import { listMaterials } from '#/server/materials';
import { testIds } from '#/testing/test-ids';
import { MaterialsList } from './materials-list';

vi.mock('@clerk/tanstack-react-start', () => ({
  useUser: () => ({ user: { id: 'user-id' } }),
}));

vi.mock('@tanstack/react-start', () => ({
  useServerFn: (serverFn: unknown) => serverFn,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    ...props
  }: {
    children: ReactNode;
    [key: string]: unknown;
  }) => <a {...props}>{children}</a>,
}));

vi.mock('#/server/materials', () => ({
  listMaterials: vi.fn(),
  setMaterialArchived: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(async () => {
  await appI18n.changeLanguage('en');
});

describe('MaterialsList', () => {
  it('shows remaining stock with purchased and used quantities', async () => {
    vi.mocked(listMaterials).mockResolvedValue([
      material({
        name: 'Copper Color',
        stock: { purchased: '150', used: '55.5', remaining: '94.5' },
      }),
    ]);

    renderMaterialsList();

    const row = await screen.findByTestId(testIds.materialsList.row);
    const stock = within(row).getByTestId(testIds.materialsList.stockSummary);

    expect(stock.textContent).toContain('Remaining 94.5 ml');
    expect(stock.textContent).toContain('Purchased 150 ml · Used 55.5 ml');
    expect(stock.getAttribute('data-stock-status')).toBe('ok');
  });

  it('marks negative remaining stock without hiding the negative quantity', async () => {
    vi.mocked(listMaterials).mockResolvedValue([
      material({
        name: 'Developer',
        stock: { purchased: '10', used: '12.5', remaining: '-2.5' },
      }),
    ]);

    renderMaterialsList();

    const row = await screen.findByTestId(testIds.materialsList.row);
    const stock = within(row).getByTestId(testIds.materialsList.stockSummary);

    expect(stock.textContent).toContain('Remaining -2.5 ml');
    expect(stock.getAttribute('data-stock-status')).toBe('negative');
  });
});

function renderMaterialsList() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MaterialsList />
    </QueryClientProvider>,
  );
}

function material(overrides: Partial<MaterialDto> = {}): MaterialDto {
  return {
    id: 'material-id',
    name: 'Material',
    unitOfMeasure: 'ml',
    category: 'color',
    isArchived: false,
    stock: { purchased: '0', used: '0', remaining: '0' },
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}
