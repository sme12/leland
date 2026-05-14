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
      <select
        value={selectedId}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-border bg-surface px-3 outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
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
    </label>
  );
}
