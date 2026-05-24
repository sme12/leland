export const visitKeys = {
  root: ['visits'] as const,
  all: (userId: string) => [...visitKeys.root, userId] as const,
  list: (userId: string) => [...visitKeys.all(userId), 'list'] as const,
  detail: (userId: string, visitId: string) =>
    [...visitKeys.all(userId), 'detail', visitId] as const,
  draftDetail: (userId: string, draftId: string) =>
    [...visitKeys.all(userId), 'draft-detail', draftId] as const,
  materials: (userId: string) =>
    [...visitKeys.all(userId), 'material-picker'] as const,
  unitCost: (userId: string, materialId: string) =>
    [...visitKeys.all(userId), 'unit-cost', materialId] as const,
};
