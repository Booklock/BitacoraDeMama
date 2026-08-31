export const MONEDAS = [
  { codigo: 'USD', etiqueta: 'USD — Dólar estadounidense ($)', simbolo: '$' },
  { codigo: 'EUR', etiqueta: 'EUR — Euro (€)', simbolo: '€' },
  { codigo: 'CRC', etiqueta: 'CRC — Colón costarricense (₡)', simbolo: '₡' },
  { codigo: 'MXN', etiqueta: 'MXN — Peso mexicano ($)', simbolo: '$' },
  { codigo: 'GTQ', etiqueta: 'GTQ — Quetzal guatemalteco (Q)', simbolo: 'Q' },
  { codigo: 'COP', etiqueta: 'COP — Peso colombiano ($)', simbolo: '$' },
  { codigo: 'ARS', etiqueta: 'ARS — Peso argentino ($)', simbolo: '$' },
];

const POR_REGION: Record<string, string> = {
  CR: 'CRC', MX: 'MXN', GT: 'GTQ', CO: 'COP', AR: 'ARS',
  ES: 'EUR', FR: 'EUR', IT: 'EUR', DE: 'EUR', PT: 'EUR',
  US: 'USD', PA: 'USD', EC: 'USD', SV: 'USD',
};

/** Adivina la moneda por la región del navegador (decisión D6: la
 *  configuración llega pre-rellenada). Siempre confirmable por la usuaria. */
export function monedaDelNavegador(): string {
  if (typeof navigator === 'undefined') return 'USD';
  try {
    const region = new Intl.Locale(navigator.language).region;
    return (region && POR_REGION[region]) || 'USD';
  } catch {
    return 'USD';
  }
}
