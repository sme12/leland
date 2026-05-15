import { Dialog } from '@base-ui/react/dialog';
import { Search, X } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type PickerSheetOption = {
  id: string;
};

type PickerSheetProps<TOption extends PickerSheetOption> = {
  label: string;
  valueLabel: string;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  options: Array<TOption>;
  selectedId: string;
  getOptionLabel: (option: TOption) => string;
  renderOption?: (option: TOption) => React.ReactNode;
  isOptionDisabled?: (option: TOption) => boolean;
  onSelect: (option: TOption) => void;
  onCreate?: (query: string) => void;
  createLabel?: (query: string) => string;
  renderDisabledAction?: (option: TOption) => React.ReactNode;
  disabled?: boolean;
};

export function PickerSheet<TOption extends PickerSheetOption>({
  label,
  valueLabel,
  placeholder,
  searchPlaceholder,
  emptyText,
  options,
  selectedId,
  getOptionLabel,
  renderOption,
  isOptionDisabled,
  onSelect,
  onCreate,
  createLabel,
  renderDisabledAction,
  disabled = false,
}: PickerSheetProps<TOption>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const labelId = useId();
  const valueId = useId();
  const selectedOption = options.find((option) => option.id === selectedId);
  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();

    if (!normalized) {
      return options;
    }

    return options.filter((option) =>
      getOptionLabel(option).toLocaleLowerCase().includes(normalized),
    );
  }, [getOptionLabel, options, query]);
  const canCreate =
    Boolean(onCreate && createLabel && query.trim().length > 0) &&
    !options.some(
      (option) =>
        getOptionLabel(option).toLocaleLowerCase() ===
        query.trim().toLocaleLowerCase(),
    );

  return (
    <div>
      <span id={labelId} className="text-sm font-medium">
        {label}
      </span>
      <Dialog.Root
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setQuery('');
          }
        }}
      >
        <Dialog.Trigger
          type="button"
          disabled={disabled}
          aria-labelledby={`${labelId} ${valueId}`}
          className="mt-2 flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 text-left outline-none transition hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span
            id={valueId}
            className={
              selectedOption ? 'truncate' : 'truncate text-muted-foreground'
            }
          >
            {selectedOption ? valueLabel : placeholder}
          </span>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-foreground/30" />
          <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] rounded-t-md border border-border bg-surface shadow-xl outline-none sm:inset-x-1/2 sm:bottom-auto sm:top-20 sm:w-[min(28rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:rounded-md">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <Dialog.Title className="text-base font-semibold">
                {label}
              </Dialog.Title>
              <Dialog.Close
                type="button"
                aria-label={t('common.close')}
                className="inline-flex size-9 items-center justify-center rounded-md border border-border hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X aria-hidden="true" className="size-4" />
              </Dialog.Close>
            </div>
            <div className="border-b border-border p-4">
              <label className="relative block">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-11 w-full rounded-md border border-border bg-background pl-9 pr-3 outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            </div>
            <div className="max-h-[54dvh] overflow-y-auto p-2">
              {filteredOptions.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">
                  {emptyText}
                </p>
              ) : (
                <ul className="space-y-1">
                  {filteredOptions.map((option) => {
                    const optionDisabled = isOptionDisabled?.(option) ?? false;

                    return (
                      <li key={option.id}>
                        <div
                          className={`flex items-center justify-between gap-3 rounded-md px-3 py-2 ${
                            optionDisabled ? 'opacity-55' : 'hover:bg-muted'
                          }`}
                        >
                          <button
                            type="button"
                            disabled={optionDisabled}
                            onClick={() => {
                              onSelect(option);
                              setOpen(false);
                              setQuery('');
                            }}
                            className="min-w-0 flex-1 text-left outline-none disabled:cursor-not-allowed"
                          >
                            {renderOption ? (
                              renderOption(option)
                            ) : (
                              <span className="block truncate font-medium">
                                {getOptionLabel(option)}
                              </span>
                            )}
                          </button>
                          {optionDisabled
                            ? renderDisabledAction?.(option)
                            : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {canCreate ? (
                <button
                  type="button"
                  onClick={() => {
                    onCreate?.(query.trim());
                    setOpen(false);
                    setQuery('');
                  }}
                  className="mt-2 w-full rounded-md border border-dashed border-border px-3 py-3 text-left text-sm font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {createLabel?.(query.trim())}
                </button>
              ) : null}
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
