import type { FxRates, ModoGasto, Product } from './types';
import { ESTADOS_QUE_COMPLETAN } from './types';

/** Tasa a usar para un producto. Si ya se compró, la que quedó congelada;
 *  si no, la de hoy (decisión D7). Moneda desconocida → null, nunca 1:
 *  inventar una tasa 1 es lo que hace el Excel y falsea los totales. */
export function tasaDelProducto(product: Product, rates: FxRates): number | null {
  if (product.fxRateToUsd != null) return product.fxRateToUsd;
  if (!product.currencyCode) return null;
  return rates[product.currencyCode] ?? null;
}

/** Valor del producto en USD, la moneda base interna. */
export function importeEnUsd(
  product: Product,
  rates: FxRates,
  { multiplicarPorCantidad }: { multiplicarPorCantidad: boolean },
): number | null {
  if (product.price == null) return null;
  const tasa = tasaDelProducto(product, rates);
  if (tasa == null) return null;
  const unidades = multiplicarPorCantidad ? Math.max(product.qty, 1) : 1;
  return product.price * tasa * unidades;
}

/** Convierte de USD a la moneda que la familia ve, con la tasa actual. */
export function desdeUsd(amountUsd: number, currencyCode: string, rates: FxRates): number | null {
  const tasa = rates[currencyCode];
  if (!tasa) return null;
  return redondear(amountUsd / tasa);
}

/** Precio convertido de un producto a la moneda del proyecto.
 *  Equivale a la columna I de la hoja Inventory (docs/01 §6.1). */
export function precioConvertido(
  product: Product,
  rates: FxRates,
  currencyCode: string,
  modo: ModoGasto = 'excel',
): number | null {
  const usd = importeEnUsd(product, rates, { multiplicarPorCantidad: modo === 'corrected' });
  if (usd == null) return null;
  return desdeUsd(usd, currencyCode, rates);
}

/** ¿Este producto suma al gasto, según el modo?
 *  El Excel suma todo, incluida la lista de deseos (docs/01 §9.1). */
export function cuentaComoGasto(product: Product, modo: ModoGasto): boolean {
  if (modo === 'excel') return true;
  return ESTADOS_QUE_COMPLETAN.includes(product.status);
}

/** Total de una lista de productos, en la moneda del proyecto. */
export function sumar(
  products: Product[],
  rates: FxRates,
  currencyCode: string,
  modo: ModoGasto,
): number {
  const usd = products
    .filter((p) => cuentaComoGasto(p, modo))
    .reduce((acc, p) => {
      const v = importeEnUsd(p, rates, { multiplicarPorCantidad: modo === 'corrected' });
      return acc + (v ?? 0);
    }, 0);
  return desdeUsd(usd, currencyCode, rates) ?? 0;
}

function redondear(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const SIMBOLOS: Record<string, string> = {
  EUR: '€', USD: '$', CRC: '₡', MXN: '$', GTQ: 'Q', COP: '$', ARS: '$',
};

export function simbolo(currencyCode: string): string {
  return SIMBOLOS[currencyCode] ?? currencyCode;
}

export function formatearDinero(valor: number | null, currencyCode: string): string {
  if (valor == null) return '—';
  const n = valor.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${simbolo(currencyCode)} ${n}`;
}
