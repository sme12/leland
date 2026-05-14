import type { CustomerDto } from '#/server/customers';

export const customerKeys = {
  all: (userId: string) => ['customers', userId] as const,
  list: (userId: string, archived: boolean) =>
    [...customerKeys.all(userId), { archived }] as const,
  detail: (userId: string, id: string) =>
    [...customerKeys.all(userId), 'detail', id] as const,
};

export type CustomerStatus = 'active' | 'archived';

export function getCustomersByStatus(
  customers: CustomerDto[] | undefined,
  status: CustomerStatus,
) {
  const isArchived = status === 'archived';
  return (
    customers?.filter((customer) => customer.isArchived === isArchived) ?? []
  );
}
