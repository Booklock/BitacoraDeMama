import type { FxRates, Payer, Product, Settings } from '../engine/types';

/** Datos de muestra para que la app se pueda recorrer sin cuenta.
 *  Son inventados, pero realistas: precios en tres monedas distintas,
 *  estados variados y un combo, para que el motor se vea trabajando. */

export const TASAS_DEMO: FxRates = {
  EUR: 1.144, USD: 1, CRC: 0.0022, MXN: 0.0575, GTQ: 0.1311, COP: 0.000303, ARS: 0.000671,
};

export const AJUSTES_DEMO: Settings = {
  currencyCode: 'USD',
  babyName: 'Valentina',
  fatherLastname: 'Rojas',
  motherLastname: 'Montalto',
};

export const PAGADORES_DEMO: Payer[] = [
  { id: 'p1', name: 'Mamá', role: 'mother', order: 1 },
  { id: 'p2', name: 'Papá', role: 'father', order: 2 },
  { id: 'p3', name: 'Regalo (Baby Shower)', role: 'gift', order: 3 },
  { id: 'p4', name: 'Común', role: 'shared', order: 4 },
];

export const PRODUCTOS_DEMO: Product[] = [
  { id: 'd1', name: 'Cuna convertible', qrhCode: 'QRH-001', itemCode: 'QRH-001-01',
    brand: 'Micuna', store: 'Amazon', price: 420, currencyCode: 'USD', qty: 1,
    status: 'purchased', payerId: 'p4', stage: 'all', fxRateToUsd: 1 },

  { id: 'd2', name: 'Colchón de cuna', qrhCode: 'QRH-001', itemCode: 'QRH-001-03',
    brand: 'Pikolin', store: 'El Corte Inglés', price: 149, currencyCode: 'EUR', qty: 1,
    status: 'purchased', payerId: 'p1', stage: 'all', fxRateToUsd: 1.144 },

  // Combo: completa a la vez el monitor y el termómetro de ambiente.
  { id: 'd3', name: 'Monitor con termómetro', qrhCode: 'QRH-001', itemCode: 'QRH-001-07',
    brand: 'Motorola', store: 'Amazon', price: 189, currencyCode: 'USD', qty: 1,
    status: 'purchased', payerId: 'p3', stage: 'all', fxRateToUsd: 1 },

  { id: 'd4', name: 'Bodys manga larga', qrhCode: 'QRH-002', itemCode: 'QRH-002-01',
    brand: 'Petit Bateau', store: 'Zara Home', price: 45000, currencyCode: 'CRC', qty: 5,
    status: 'purchased', payerId: 'p3', stage: 'm0_3', fxRateToUsd: 0.0022 },

  { id: 'd5', name: 'Bañera plegable', qrhCode: 'QRH-003', itemCode: 'QRH-003-01',
    brand: 'Stokke', store: 'Tienda local', price: 79, currencyCode: 'EUR', qty: 1,
    status: 'purchased', payerId: 'p2', stage: 'm0_3', fxRateToUsd: 1.144 },

  { id: 'd6', name: 'Sacaleches eléctrico', qrhCode: 'QRH-004', itemCode: 'QRH-004-01',
    brand: 'Medela', store: 'Farmacia', price: 230, currencyCode: 'USD', qty: 1,
    status: 'savings', payerId: 'p1', stage: 'pregnancy' },

  { id: 'd7', name: 'Carrito 3 piezas', qrhCode: 'QRH-011', itemCode: 'QRH-011-01',
    brand: 'Nuna', store: 'Amazon', url: 'https://example.com', price: 890,
    currencyCode: 'USD', qty: 1, status: 'wishlist', payerId: null, stage: 'all' },

  { id: 'd8', name: 'Silla de auto grupo 0+', qrhCode: 'QRH-011', itemCode: 'QRH-011-02',
    brand: 'Cybex', store: 'Amazon', price: 340, currencyCode: 'USD', qty: 1,
    status: 'pending', payerId: 'p4', stage: 'all' },

  { id: 'd9', name: 'Crema para el culito', qrhCode: 'QRH-013', itemCode: 'QRH-013-02',
    brand: 'Mustela', store: 'Farmacia', price: 24, currencyCode: 'EUR', qty: 2,
    status: 'purchased', payerId: 'p1', stage: 'm0_3', fxRateToUsd: 1.144 },

  { id: 'd10', name: 'Cojín de lactancia', qrhCode: 'QRH-004', itemCode: 'QRH-004-02',
    brand: 'Boppy', store: 'Amazon', price: 55, currencyCode: 'USD', qty: 1,
    status: 'purchased', payerId: 'p3', stage: 'pregnancy', fxRateToUsd: 1 },
];
