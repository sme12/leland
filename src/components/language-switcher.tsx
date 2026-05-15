import { Select } from '@base-ui/react/select';
import { Check, ChevronDown, Languages } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { normalizeLanguage, supportedLanguages } from '#/i18n/resources';
import type { SupportedLanguage } from '#/i18n/resources';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [language, setLanguage] = useState<SupportedLanguage>(() =>
    normalizeLanguage(i18n.resolvedLanguage ?? i18n.language),
  );

  const items = useMemo(
    () =>
      supportedLanguages.map((value) => ({
        value,
        label: t(`language.${value}`),
      })),
    [t],
  );

  useEffect(() => {
    const activeLanguage = normalizeLanguage(
      i18n.resolvedLanguage ?? i18n.language,
    );

    setLanguage(activeLanguage);
    document.documentElement.lang = activeLanguage;
  }, [i18n.language, i18n.resolvedLanguage]);

  function handleValueChange(value: SupportedLanguage | null) {
    if (!value) {
      return;
    }

    setLanguage(value);
    void i18n.changeLanguage(value);
  }

  return (
    <Select.Root
      items={items}
      value={language}
      onValueChange={handleValueChange}
    >
      <Select.Trigger
        aria-label={t('language.label')}
        className="inline-flex h-10 min-w-30 items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground shadow-sm outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Languages aria-hidden="true" className="size-4" />
        <Select.Value className="min-w-14 text-left" />
        <Select.Icon>
          <ChevronDown aria-hidden="true" className="size-4 text-muted" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          alignItemWithTrigger={false}
          sideOffset={8}
          className="z-[60]"
        >
          <Select.Popup className="min-w-36 rounded-md border border-border bg-surface p-1 shadow-lg">
            <Select.List>
              {items.map((item) => (
                <Select.Item
                  key={item.value}
                  value={item.value}
                  className="grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-sm px-2 py-2 text-sm text-foreground outline-none data-[highlighted]:bg-muted"
                >
                  <Select.ItemIndicator>
                    <Check aria-hidden="true" className="size-4" />
                  </Select.ItemIndicator>
                  <Select.ItemText>{item.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
