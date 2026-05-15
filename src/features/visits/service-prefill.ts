export function getServicePrefillValue({
  currentValue,
  defaultPrice,
  isDirty,
}: {
  currentValue: string;
  defaultPrice: string | null;
  isDirty: boolean;
}) {
  if (isDirty) {
    return currentValue;
  }

  return defaultPrice ?? '';
}
