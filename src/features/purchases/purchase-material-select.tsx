import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { MaterialDto } from '#/server/materials';

export type PurchaseMaterialOption = Pick<
  MaterialDto,
  'id' | 'name' | 'category' | 'unitOfMeasure' | 'isArchived'
>;

type PurchaseMaterialSelectProps = {
  materials: Array<PurchaseMaterialOption>;
  selectedId: string;
  disabled?: boolean;
  onChange: (materialId: string) => void;
};

export function PurchaseMaterialSelect({
  materials,
  selectedId,
  disabled = false,
  onChange,
}: PurchaseMaterialSelectProps) {
  const { t } = useTranslation();

  return (
    <label className="block">
      <span className="text-sm font-medium">
        {t('purchase.fields.material')}
      </span>
      <span className="relative mt-2 block">
        <select
          value={selectedId}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full appearance-none rounded-md border border-border bg-surface px-3 pr-10 outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        >
          <option value="">{t('purchase.selectMaterial')}</option>
          {materials.map((material) => (
            <option key={material.id} value={material.id}>
              {material.name} · {t(`material.category.${material.category}`)} ·{' '}
              {t(`material.uom.${material.unitOfMeasure}`)}
              {material.isArchived ? ` · ${t('purchase.archived')}` : ''}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2"
        />
      </span>
    </label>
  );
}
