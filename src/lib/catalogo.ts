import catalogoJson from '../../data/seed/qrh-catalog.json';
import type { QrhCategory } from './engine/types';

type CatalogoCrudo = {
  id: string; order: number; name_en: string; name_es: string;
  description_es: string | null; manual: boolean;
  items: {
    id: string; order: number; name_en: string; name_es: string | null;
    qty_needed: number; auto: boolean; satisfied_by: string[];
  }[];
}[];

/** El catálogo del Excel, tipado. Fuente única: data/seed/qrh-catalog.json,
 *  el mismo archivo que siembra la base (docs/01 §2). */
export const CATALOGO: QrhCategory[] = (catalogoJson as CatalogoCrudo).map((c) => ({
  code: c.id,
  order: c.order,
  nameEn: c.name_en,
  nameEs: c.name_es,
  descriptionEs: c.description_es,
  isManual: c.manual,
  items: c.items.map((i) => ({
    code: i.id,
    qrhCode: c.id,
    order: i.order,
    nameEn: i.name_en,
    nameEs: i.name_es,
    defaultQtyNeeded: i.qty_needed ?? 1,
    satisfiedBy: i.satisfied_by,
  })),
}));

export const ITEMS_POR_CODIGO = new Map(
  CATALOGO.flatMap((c) => c.items).map((i) => [i.code, i]),
);

export const QRH_POR_CODIGO = new Map(CATALOGO.map((c) => [c.code, c]));

export function nombreItem(code: string | null): string {
  if (!code) return '—';
  const item = ITEMS_POR_CODIGO.get(code);
  return item ? (item.nameEs ?? item.nameEn) : code;
}

export function nombreQrh(code: string | null): string {
  if (!code) return '—';
  return QRH_POR_CODIGO.get(code)?.nameEs ?? code;
}
