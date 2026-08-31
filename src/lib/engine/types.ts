/** Tipos del dominio. Espejo del modelo de datos (docs/02-modelo-de-datos.md). */

export type Status = 'purchased' | 'pending' | 'wishlist' | 'savings';

export type Stage = 'pregnancy' | 'm0_3' | 'm3_6' | 'm6_9' | 'm9_12' | 'all';

/** Estados que completan un ítem del checklist. Del Excel: Purchased y
 *  Savings cuentan; Pending y Wishlist no (docs/01 §6.3). */
export const ESTADOS_QUE_COMPLETAN: readonly Status[] = ['purchased', 'savings'];

export interface ChecklistItem {
  code: string;
  qrhCode: string;
  order: number;
  nameEn: string;
  nameEs: string | null;
  defaultQtyNeeded: number;
  /** Ítems cuya compra completa este ítem. Se incluye a sí mismo. */
  satisfiedBy: string[];
}

export interface QrhCategory {
  code: string;
  order: number;
  nameEn: string;
  nameEs: string;
  descriptionEs: string | null;
  /** Hospital Bag y Landing se marcan a mano: no dependen de una compra. */
  isManual: boolean;
  items: ChecklistItem[];
}

export interface Product {
  id: string;
  name: string;
  qrhCode: string | null;
  itemCode: string | null;
  brand?: string;
  store?: string;
  url?: string;
  price: number | null;
  currencyCode: string | null;
  qty: number;
  status: Status;
  payerId: string | null;
  notes?: string;
  stage: Stage | null;
  /** Tasa congelada al comprar (decisión D7). Null mientras no se compra. */
  fxRateToUsd?: number | null;
}

export interface Payer {
  id: string;
  name: string;
  role: 'mother' | 'father' | 'gift' | 'shared' | 'extra';
  order: number;
}

/** Lo editable de la hoja QRH Checklists. */
export interface ChecklistState {
  notApplicable: boolean;
  qtyNeeded: number | null;
  manualCompleted: boolean;
  notes?: string;
}

export interface Settings {
  currencyCode: string;
  babyName: string;
  fatherLastname: string;
  motherLastname: string;
}

/** Tasas a USD, indexadas por código de moneda. USD es la base: vale 1. */
export type FxRates = Record<string, number>;

/** Cómo se calcula el gasto (decisión D2).
 *  - `excel`: réplica literal, precio unitario y todos los estados.
 *  - `corrected`: precio × cantidad, y sólo lo realmente comprado. */
export type ModoGasto = 'excel' | 'corrected';
