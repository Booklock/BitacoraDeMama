import { describe, expect, it } from 'vitest';
import { precioConvertido, sumar, tasaDelProducto } from './money';
import {
  cantidadConseguida, estaCompleto, etiquetaCantidad, progresoDeQrh,
} from './checklist';
import { missionId, progresoPorEtapa, resumenGeneral } from './dashboard';
import type { ChecklistItem, FxRates, Product, QrhCategory } from './types';

// Tasas reales del Excel (Configuración!E8:E14).
const TASAS: FxRates = {
  EUR: 1.144, USD: 1, CRC: 0.0022, MXN: 0.0575, GTQ: 0.1311, COP: 0.000303, ARS: 0.000671,
};

const producto = (p: Partial<Product> = {}): Product => ({
  id: 'x', name: 'Producto', qrhCode: 'QRH-001', itemCode: 'QRH-001-01',
  price: 100, currencyCode: 'USD', qty: 1, status: 'purchased',
  payerId: null, stage: null, ...p,
});

const item = (p: Partial<ChecklistItem> = {}): ChecklistItem => ({
  code: 'QRH-001-01', qrhCode: 'QRH-001', order: 1, nameEn: 'Crib', nameEs: 'Cuna',
  defaultQtyNeeded: 1, satisfiedBy: ['QRH-001-01'], ...p,
});

const qrh = (p: Partial<QrhCategory> = {}): QrhCategory => ({
  code: 'QRH-001', order: 1, nameEn: 'Nursery', nameEs: 'Cuarto del bebé',
  descriptionEs: null, isManual: false, items: [item()], ...p,
});

describe('conversión de moneda (docs/01 §6.1)', () => {
  it('replica el ejemplo del Excel: 450 USD con moneda principal EUR', () => {
    // 450 × 1 / 1.144 = 393.36
    const p = producto({ price: 450, currencyCode: 'USD' });
    expect(precioConvertido(p, TASAS, 'EUR')).toBe(393.36);
  });

  it('no convierte cuando la moneda de compra es la del proyecto', () => {
    expect(precioConvertido(producto({ price: 250 }), TASAS, 'USD')).toBe(250);
  });

  it('convierte entre dos monedas que no son USD', () => {
    // 100000 CRC = 220 USD → 220 / 0.1311 = 1678.11 GTQ
    const p = producto({ price: 100000, currencyCode: 'CRC' });
    expect(precioConvertido(p, TASAS, 'GTQ')).toBe(1678.11);
  });

  it('devuelve null si falta el precio', () => {
    expect(precioConvertido(producto({ price: null }), TASAS, 'EUR')).toBeNull();
  });

  it('devuelve null ante una moneda desconocida en vez de inventar tasa 1', () => {
    const p = producto({ currencyCode: 'XYZ' });
    expect(precioConvertido(p, TASAS, 'USD')).toBeNull();
  });

  it('usa la tasa congelada cuando existe, no la del día (D7)', () => {
    const p = producto({ currencyCode: 'ARS', fxRateToUsd: 0.005 });
    expect(tasaDelProducto(p, TASAS)).toBe(0.005);
    // 100 × 0.005 = 0.5 USD, no 100 × 0.000671
    expect(precioConvertido(p, TASAS, 'USD')).toBe(0.5);
  });
});

describe('modos de gasto (decisión D2)', () => {
  const productos = [
    producto({ id: '1', price: 100, qty: 3, status: 'purchased' }),
    producto({ id: '2', price: 50, qty: 1, status: 'wishlist' }),
  ];

  it('modo excel: suma todo y no multiplica por cantidad', () => {
    expect(sumar(productos, TASAS, 'USD', 'excel')).toBe(150);
  });

  it('modo corregido: sólo lo comprado, multiplicado por cantidad', () => {
    expect(sumar(productos, TASAS, 'USD', 'corrected')).toBe(300);
  });
});

describe('ítem completado (docs/01 §6.3)', () => {
  it('se completa al comprarlo', () => {
    expect(estaCompleto(item(), qrh(), {}, [producto()])).toBe(true);
  });

  it('pendiente y lista de deseos no completan', () => {
    expect(estaCompleto(item(), qrh(), {}, [producto({ status: 'pending' })])).toBe(false);
    expect(estaCompleto(item(), qrh(), {}, [producto({ status: 'wishlist' })])).toBe(false);
  });

  it('apartado (savings) sí completa, igual que comprado', () => {
    expect(estaCompleto(item(), qrh(), {}, [producto({ status: 'savings' })])).toBe(true);
  });

  it('suma cantidades, no filas: una fila con qty 3 cubre una necesidad de 3', () => {
    const it3 = item({ defaultQtyNeeded: 3 });
    expect(estaCompleto(it3, qrh(), {}, [producto({ qty: 3 })])).toBe(true);
    expect(estaCompleto(it3, qrh(), {}, [producto({ qty: 2 })])).toBe(false);
  });

  it('un ítem combo completa a sus componentes', () => {
    // QRH-001-06 (Monitor) lo completa QRH-001-07 (Monitor + Termómetro).
    const monitor = item({ code: 'QRH-001-06', satisfiedBy: ['QRH-001-06', 'QRH-001-07'] });
    const compraCombo = producto({ itemCode: 'QRH-001-07' });
    expect(cantidadConseguida(monitor, [compraCombo])).toBe(1);
    expect(estaCompleto(monitor, qrh(), {}, [compraCombo])).toBe(true);
  });

  it('un combo de otra categoría también cuenta', () => {
    // QRH-001-14 (Cambiador) lo completa QRH-003-03 (Set de Baño).
    const cambiador = item({ code: 'QRH-001-14', satisfiedBy: ['QRH-001-14', 'QRH-003-03'] });
    const set = producto({ qrhCode: 'QRH-003', itemCode: 'QRH-003-03' });
    expect(estaCompleto(cambiador, qrh(), {}, [set])).toBe(true);
  });

  it('marcar N/A completa el ítem sin comprar nada', () => {
    const estados = { 'QRH-001-01': { notApplicable: true, qtyNeeded: null, manualCompleted: false } };
    expect(estaCompleto(item(), qrh(), estados, [])).toBe(true);
    expect(etiquetaCantidad(item(), qrh(), estados, [])).toBe('N/A');
  });

  it('en los checklists manuales las compras no cuentan', () => {
    const manual = qrh({ isManual: true });
    expect(estaCompleto(item(), manual, {}, [producto()])).toBe(false);
    const marcado = { 'QRH-001-01': { notApplicable: false, qtyNeeded: null, manualCompleted: true } };
    expect(estaCompleto(item(), manual, marcado, [])).toBe(true);
  });

  it('la etiqueta muestra conseguido sobre necesario', () => {
    const it2 = item({ defaultQtyNeeded: 2 });
    expect(etiquetaCantidad(it2, qrh(), {}, [producto()])).toBe('1/2');
  });
});

describe('progreso', () => {
  const categoria = qrh({
    items: [item({ code: 'QRH-001-01' }), item({ code: 'QRH-001-02', satisfiedBy: ['QRH-001-02'] })],
  });

  it('cuenta completos sobre el total de la categoría', () => {
    const r = progresoDeQrh(categoria, {}, [producto({ itemCode: 'QRH-001-01' })]);
    expect(r).toEqual({ completos: 1, total: 2, ratio: 0.5 });
  });

  it('el resumen general separa gastado de proyectado', () => {
    const productos = [
      producto({ id: '1', price: 100, status: 'purchased' }),
      producto({ id: '2', price: 40, status: 'wishlist' }),
    ];
    const r = resumenGeneral([categoria], productos, {}, TASAS, 'USD');
    expect(r.gastado).toBe(100);
    expect(r.proyectado).toBe(140);
  });

  it('el progreso por etapa ignora las etapas sin productos', () => {
    const r = progresoPorEtapa([producto({ stage: 'pregnancy' })]);
    expect(r.find((x) => x.etapa === 'pregnancy')?.ratio).toBe(1);
    expect(r.find((x) => x.etapa === 'm0_3')?.ratio).toBe(0);
  });
});

describe('Mission ID (docs/01 §6.5)', () => {
  it('toma cuatro letras en mayúscula', () => {
    expect(missionId('Valentina')).toBe('VALE001-QRH');
  });

  it('quita los acentos, como el SUBSTITUTE del Excel', () => {
    expect(missionId('Ángela')).toBe('ANGE001-QRH');
  });

  it('aguanta un nombre más corto que cuatro letras', () => {
    expect(missionId('Ana')).toBe('ANA001-QRH');
  });
});

describe('desglose de gasto fijo y en lista', () => {
  it('separa lo comprometido de lo que sigue siendo intención', async () => {
    const { resumenPorQrh } = await import('./dashboard');
    const categoria = qrh({ items: [item()] });
    const productos = [
      producto({ id: '1', price: 100, qty: 2, status: 'purchased' }),
      producto({ id: '2', price: 30, status: 'savings' }),
      producto({ id: '3', price: 500, status: 'wishlist' }),
      producto({ id: '4', price: 40, status: 'pending' }),
    ];
    const [fila] = resumenPorQrh([categoria], productos, {}, TASAS, 'USD', 'corrected');

    // Fijo cuenta cantidad: 100×2 + 30 = 230
    expect(fila.gastoFijo).toBe(230);
    // En lista suma deseos y pendientes: 500 + 40 = 540
    expect(fila.gastoEnLista).toBe(540);
  });
});
