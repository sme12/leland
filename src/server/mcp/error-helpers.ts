const VALIDATION_KEY_TO_HUMAN: Record<string, string> = {
  'validation.idRequired': 'id is required',
  'validation.integerPositive': 'must be a positive integer string',
  'validation.quantity': 'must be a decimal string with up to 2 decimal places',
  'validation.quantityPositive': 'must be a positive decimal string',
  'validation.money':
    'must be a money decimal string with up to 2 decimal places',
  'validation.date': 'must be a valid YYYY-MM-DD date',
};

export function humanizeIssueMessage(message: string) {
  return VALIDATION_KEY_TO_HUMAN[message] ?? message;
}

export function extractClientRequestId(input: unknown) {
  if (
    input &&
    typeof input === 'object' &&
    'clientRequestId' in input &&
    typeof input.clientRequestId === 'string'
  ) {
    return input.clientRequestId;
  }

  return undefined;
}

export function withClientRequestId<T extends { clientRequestId?: string }>(
  error: Omit<T, 'clientRequestId'>,
  clientRequestId: string | undefined,
): T {
  return (clientRequestId ? { ...error, clientRequestId } : error) as T;
}
