import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Resolver } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { preventImplicitSubmit } from '#/components/prevent-implicit-submit';
import type {
  CustomerFormInput,
  CustomerFormValues,
} from '#/shared/schemas/customer';
import { customerFormSchema } from '#/shared/schemas/customer';
import { testIds } from '#/testing/test-ids';

type CustomerFormProps = {
  defaultValues?: CustomerFormInput;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: CustomerFormValues) => void | Promise<void>;
};

export function CustomerForm({
  defaultValues,
  submitLabel,
  isSubmitting,
  onSubmit,
}: CustomerFormProps) {
  const { t } = useTranslation();
  const form = useForm<CustomerFormInput, unknown, CustomerFormValues>({
    resolver: customerResolver,
    defaultValues: defaultValues ?? { name: '', comment: '' },
  });
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return (
    <form
      data-testid={testIds.customerForm.root}
      className="space-y-5"
      onKeyDown={preventImplicitSubmit}
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
    >
      <label className="block">
        <span className="text-sm font-medium">{t('customer.fields.name')}</span>
        <input
          {...form.register('name')}
          data-testid={testIds.customerForm.nameInput}
          autoComplete="name"
          disabled={!isHydrated || isSubmitting}
          className="mt-2 h-11 w-full rounded-md border border-border bg-surface px-3 outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        />
        {form.formState.errors.name ? (
          <span className="mt-2 block text-sm text-danger">
            {t(form.formState.errors.name.message ?? 'validation.generic')}
          </span>
        ) : null}
      </label>

      <label className="block">
        <span className="text-sm font-medium">
          {t('customer.fields.comment')}
        </span>
        <textarea
          {...form.register('comment')}
          data-testid={testIds.customerForm.commentInput}
          rows={5}
          disabled={!isHydrated || isSubmitting}
          className="mt-2 w-full resize-y rounded-md border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        />
      </label>

      <button
        type="submit"
        data-testid={testIds.customerForm.submitButton}
        disabled={!isHydrated || isSubmitting}
        className="inline-flex h-11 items-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Save aria-hidden="true" className="size-4" />
        {submitLabel}
      </button>
    </form>
  );
}

const customerResolver: Resolver<
  CustomerFormInput,
  unknown,
  CustomerFormValues
> = (values) => {
  const result = customerFormSchema.safeParse(values);

  if (result.success) {
    return {
      values: result.data,
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
