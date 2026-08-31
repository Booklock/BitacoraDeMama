import type { ChecklistItem, ChecklistState, Product, QrhCategory } from './types';
import { ESTADOS_QUE_COMPLETAN } from './types';

export const ESTADO_POR_DEFECTO: ChecklistState = {
  notApplicable: false,
  qtyNeeded: null,
  manualCompleted: false,
};

export function estadoDe(
  itemCode: string,
  estados: Record<string, ChecklistState>,
): ChecklistState {
  return estados[itemCode] ?? ESTADO_POR_DEFECTO;
}

export function cantidadNecesaria(item: ChecklistItem, estado: ChecklistState): number {
  return Math.max(estado.qtyNeeded ?? item.defaultQtyNeeded, 1);
}

/**
 * Cantidad conseguida de un ítem. Suma las CANTIDADES de los productos
 * comprados o apartados, no el número de filas — y acepta también los ítems
 * combo que lo satisfacen: comprar el Set de Baño completa el cambiador
 * (docs/01 §6.3).
 */
export function cantidadConseguida(item: ChecklistItem, products: Product[]): number {
  const fuentes = new Set(item.satisfiedBy);
  return products
    .filter((p) => p.itemCode && fuentes.has(p.itemCode))
    .filter((p) => ESTADOS_QUE_COMPLETAN.includes(p.status))
    .reduce((acc, p) => acc + Math.max(p.qty, 1), 0);
}

export function estaCompleto(
  item: ChecklistItem,
  qrh: QrhCategory,
  estados: Record<string, ChecklistState>,
  products: Product[],
): boolean {
  const estado = estadoDe(item.code, estados);
  if (estado.notApplicable) return true;
  if (qrh.isManual) return estado.manualCompleted;
  return cantidadConseguida(item, products) >= cantidadNecesaria(item, estado);
}

/** Texto "conseguido/necesario" de la columna Cantidad, o N/A. */
export function etiquetaCantidad(
  item: ChecklistItem,
  qrh: QrhCategory,
  estados: Record<string, ChecklistState>,
  products: Product[],
): string {
  const estado = estadoDe(item.code, estados);
  if (estado.notApplicable) return 'N/A';
  if (qrh.isManual) return estado.manualCompleted ? 'Listo' : 'Pendiente';
  return `${cantidadConseguida(item, products)}/${cantidadNecesaria(item, estado)}`;
}

/** Qué productos completaron un ítem. El Excel no puede mostrarlo. */
export function productosQueCompletan(item: ChecklistItem, products: Product[]): Product[] {
  const fuentes = new Set(item.satisfiedBy);
  return products.filter(
    (p) => p.itemCode && fuentes.has(p.itemCode) && ESTADOS_QUE_COMPLETAN.includes(p.status),
  );
}

export function progresoDeQrh(
  qrh: QrhCategory,
  estados: Record<string, ChecklistState>,
  products: Product[],
): { completos: number; total: number; ratio: number } {
  const total = qrh.items.length;
  const completos = qrh.items.filter((i) => estaCompleto(i, qrh, estados, products)).length;
  return { completos, total, ratio: total === 0 ? 0 : completos / total };
}

export function progresoGlobal(
  catalogo: QrhCategory[],
  estados: Record<string, ChecklistState>,
  products: Product[],
): { completos: number; total: number; ratio: number } {
  let completos = 0;
  let total = 0;
  for (const qrh of catalogo) {
    const p = progresoDeQrh(qrh, estados, products);
    completos += p.completos;
    total += p.total;
  }
  return { completos, total, ratio: total === 0 ? 0 : completos / total };
}
