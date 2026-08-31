// Genera la migración de semilla a partir de data/seed/*.json.
// El catálogo no se escribe a mano: sale del Excel analizado en la Etapa 1.
import { readFileSync, writeFileSync } from 'node:fs';

const catalog = JSON.parse(readFileSync('data/seed/qrh-catalog.json', 'utf8'));
const config = JSON.parse(readFileSync('data/seed/config-defaults.json', 'utf8'));

const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);

const lines = [
  '-- Bitácora de Mamá · Semilla del catálogo y de los tipos de cambio',
  '-- GENERADO POR scripts/generate-seed-sql.mjs — no editar a mano.',
  '-- Fuente: data/seed/*.json, extraídos del Excel (ver docs/01-analisis-excel.md).',
  '',
  '-- Tipos de cambio iniciales (decisión D7). Se refrescan luego por API.',
  'insert into fx_rates (currency_code, symbol, label_es, rate_to_usd, source) values',
];

const fx = config.currencies
  .filter((c) => c.code !== 'OTRA')
  .map((c) => `  (${q(c.code)}, ${q(c.symbol)}, ${q(c.label)}, ${c.rate_to_usd}, 'seed')`);
lines.push(fx.join(',\n') + '\non conflict (currency_code) do nothing;', '');

lines.push('-- 13 categorías QRH');
lines.push('insert into qrh_categories (code, sort_order, name_en, name_es, description_es, is_manual) values');
lines.push(
  catalog
    .map((c) => `  (${q(c.code)}, ${c.order}, ${q(c.name_en)}, ${q(c.name_es)}, ${q(c.description_es)}, ${c.manual})`)
    .join(',\n') + '\non conflict (code) do nothing;',
);
lines.push('');

const items = catalog.flatMap((c) => c.items.map((i) => ({ ...i, qrh: c.code })));
lines.push(`-- ${items.length} ítems de checklist`);
lines.push('insert into checklist_items (code, qrh_code, sort_order, name_en, name_es, default_qty_needed) values');
lines.push(
  items
    .map((i) => `  (${q(i.id)}, ${q(i.qrh)}, ${i.order}, ${q(i.name_en)}, ${q(i.name_es)}, ${i.qty_needed ?? 1})`)
    .join(',\n') + '\non conflict (code) do nothing;',
);
lines.push('');

const links = items.flatMap((i) => i.satisfied_by.map((s) => [i.id, s]));
lines.push(`-- Mapa de combos: ${links.length} relaciones (docs/01 §6.3)`);
lines.push('insert into item_satisfied_by (item_code, source_item_code) values');
lines.push(links.map(([a, b]) => `  (${q(a)}, ${q(b)})`).join(',\n') + '\non conflict do nothing;');
lines.push('');

const out = 'supabase/migrations/20260831000400_seed_catalog.sql';
writeFileSync(out, lines.join('\n'));
console.log(`${out}: ${catalog.length} QRH, ${items.length} ítems, ${links.length} relaciones de combo, ${fx.length} monedas`);
