import { sumar } from './money';
import { progresoDeQrh, progresoGlobal } from './checklist';
import type {
  ChecklistState, FxRates, ModoGasto, Payer, Product, QrhCategory, Settings, Stage,
} from './types';
import { ESTADOS_QUE_COMPLETAN } from './types';

export interface FilaQrh {
  code: string;
  nombre: string;
  gasto: number;
  /** Comprado o apartado: dinero ya comprometido. */
  gastoFijo: number;
  /** Pendiente o en lista de deseos: todavía es una intención. */
  gastoEnLista: number;
  completos: number;
  total: number;
  ratio: number;
}

export function resumenPorQrh(
  catalogo: QrhCategory[],
  products: Product[],
  estados: Record<string, ChecklistState>,
  rates: FxRates,
  currencyCode: string,
  modo: ModoGasto,
): FilaQrh[] {
  return catalogo.map((qrh) => {
    const suyos = products.filter((p) => p.qrhCode === qrh.code);
    const progreso = progresoDeQrh(qrh, estados, products);
    // El desglose no depende del modo: separa lo comprometido de lo que
    // todavía es una intención, que es la pregunta que se hace quien mira.
    const fijos = suyos.filter((p) => ESTADOS_QUE_COMPLETAN.includes(p.status));
    const enLista = suyos.filter((p) => !ESTADOS_QUE_COMPLETAN.includes(p.status));
    return {
      code: qrh.code,
      nombre: qrh.nameEs,
      gasto: sumar(suyos, rates, currencyCode, modo),
      gastoFijo: sumar(fijos, rates, currencyCode, 'corrected'),
      gastoEnLista: sumar(enLista, rates, currencyCode, 'excel'),
      ...progreso,
    };
  });
}

export function gastoPorPagador(
  payers: Payer[],
  products: Product[],
  rates: FxRates,
  currencyCode: string,
  modo: ModoGasto,
): { nombre: string; total: number }[] {
  return payers.map((payer) => ({
    nombre: payer.name,
    total: sumar(
      products.filter((p) => p.payerId === payer.id),
      rates, currencyCode, modo,
    ),
  }));
}

export function totalApartado(
  products: Product[], rates: FxRates, currencyCode: string, modo: ModoGasto,
): number {
  return sumar(products.filter((p) => p.status === 'savings'), rates, currencyCode, modo);
}

export const ETIQUETAS_ETAPA: Record<Stage, string> = {
  pregnancy: 'Embarazo',
  m0_3: '0-3 meses',
  m3_6: '3-6 meses',
  m6_9: '6-9 meses',
  m9_12: '9-12 meses',
  all: 'Todas las etapas',
};

/** % comprado por etapa. Sobre PRODUCTOS, no sobre ítems del checklist —
 *  así lo hace el Excel (docs/01 §6.4). */
export function progresoPorEtapa(
  products: Product[],
): { etapa: Stage; nombre: string; ratio: number; total: number }[] {
  return (Object.keys(ETIQUETAS_ETAPA) as Stage[]).map((etapa) => {
    const deLaEtapa = products.filter((p) => p.stage === etapa);
    const compradas = deLaEtapa.filter((p) => ESTADOS_QUE_COMPLETAN.includes(p.status));
    return {
      etapa,
      nombre: ETIQUETAS_ETAPA[etapa],
      total: deLaEtapa.length,
      ratio: deLaEtapa.length === 0 ? 0 : compradas.length / deLaEtapa.length,
    };
  });
}

export interface ResumenGeneral {
  gastado: number;
  proyectado: number;
  progreso: { completos: number; total: number; ratio: number };
}

/** Los dos totales que el Excel mezcla en uno (decisión D2). */
export function resumenGeneral(
  catalogo: QrhCategory[],
  products: Product[],
  estados: Record<string, ChecklistState>,
  rates: FxRates,
  currencyCode: string,
): ResumenGeneral {
  return {
    gastado: sumar(products, rates, currencyCode, 'corrected'),
    proyectado: sumar(products, rates, currencyCode, 'excel'),
    progreso: progresoGlobal(catalogo, estados, products),
  };
}

/** Mission ID: 4 primeras letras del nombre del bebé sin acentos (docs/01 §6.5). */
export function missionId(babyName: string): string {
  const limpio = babyName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z]/g, '');
  return `${limpio.slice(0, 4).toUpperCase()}001-QRH`;
}

export function flightPlan(settings: Settings, payers: Payer[]) {
  const nombreDe = (rol: Payer['role']) => payers.find((p) => p.role === rol)?.name ?? '—';
  return {
    mission: missionId(settings.babyName),
    aircraft: `${settings.fatherLastname}-${settings.motherLastname} Family`,
    captain: nombreDe('mother'),
    firstOfficer: nombreDe('father'),
    passenger: settings.babyName || '—',
    duration: '9 months',
  };
}
