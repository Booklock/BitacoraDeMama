// Junta todas las migraciones en un solo archivo, en orden.
// Ejecutar cinco consultas en el orden correcto es la parte más frágil de la
// instalación; con un archivo el orden deja de ser responsabilidad de nadie.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'supabase/migrations';
const SALIDA = 'supabase/instalacion-completa.sql';

const archivos = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

const partes = [
  `-- Bitácora de Mamá · Instalación completa`,
  `-- GENERADO POR scripts/build-instalador.mjs — no editar a mano.`,
  `--`,
  `-- Pega este archivo entero en el SQL Editor de Supabase y pulsa Run.`,
  `-- Contiene ${archivos.length} migraciones, ya en el orden correcto:`,
  ...archivos.map((f, i) => `--   ${i + 1}. ${f}`),
  ``,
  `begin;`,
  ``,
];

for (const archivo of archivos) {
  partes.push(
    `-- ${'='.repeat(74)}`,
    `-- ${archivo}`,
    `-- ${'='.repeat(74)}`,
    readFileSync(join(DIR, archivo), 'utf8').trim(),
    ``,
  );
}

partes.push(`commit;`, ``);

writeFileSync(SALIDA, partes.join('\n'));
console.log(`${SALIDA}: ${archivos.length} migraciones, ${partes.join('\n').split('\n').length} líneas`);
