export type MaterialStatus = 'active' | 'archived';

export const materialKeys = {
  root: ['materials'] as const,
  all: (userId: string) => ['materials', userId] as const,
  list: (userId: string, archived: boolean) =>
    [...materialKeys.all(userId), 'list', { archived }] as const,
  detail: (userId: string, materialId: string) =>
    [...materialKeys.all(userId), 'detail', materialId] as const,
};
