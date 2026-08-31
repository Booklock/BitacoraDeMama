'use client';

import type { Status } from '@/lib/engine/types';

export const ESTILO_ESTADO: Record<Status, { etiqueta: string; punto: string; fondo: string }> = {
  purchased: { etiqueta: 'Comprado',  punto: 'bg-estado-comprado',  fondo: 'bg-amarillo-oliva/40' },
  pending:   { etiqueta: 'Pendiente', punto: 'bg-estado-pendiente', fondo: 'bg-amarillo-medio/50' },
  wishlist:  { etiqueta: 'Deseo',     punto: 'bg-estado-deseo',     fondo: 'bg-azul-medio/40' },
  savings:   { etiqueta: 'Apartado',  punto: 'bg-estado-apartado',  fondo: 'bg-azul-fuerte/30' },
};

/** El color nunca va solo: siempre acompaña a la etiqueta de texto. */
export function BadgeEstado({ estado }: { estado: Status }) {
  const e = ESTILO_ESTADO[estado];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full ${e.fondo} px-2.5 py-0.5 text-xs font-medium`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${e.punto}`} aria-hidden />
      {e.etiqueta}
    </span>
  );
}

export function Tarjeta({
  titulo, children, className = '',
}: { titulo?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl2 bg-white/70 p-5 ring-1 ring-crema-borde ${className}`}>
      {titulo && <h2 className="mb-4 text-sm font-semibold text-tinta">{titulo}</h2>}
      {children}
    </section>
  );
}

/** Cifra protagonista. Cuando el dato es uno solo, no es una gráfica. */
export function Cifra({
  etiqueta, valor, apoyo,
}: { etiqueta: string; valor: string; apoyo?: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-tinta-suave">{etiqueta}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{valor}</p>
      {apoyo && <p className="mt-0.5 text-xs text-tinta-suave">{apoyo}</p>}
    </div>
  );
}

export function BarraProgreso({ ratio, className = '' }: { ratio: number; className?: string }) {
  const pct = Math.round(ratio * 100);
  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full bg-crema-arena ${className}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full bg-verde transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export interface FilaBarra {
  clave: string;
  etiqueta: string;
  valor: number;
  /** Texto ya formateado que se muestra a la derecha. */
  texto: string;
}

/**
 * Lista de barras horizontales: una sola serie, así que no lleva leyenda —
 * el título de la tarjeta la nombra. Cada fila trae su valor escrito, de modo
 * que el dato se lee aunque no se distinga el color.
 */
export function ListaBarras({
  filas, tono = 'verde',
}: { filas: FilaBarra[]; tono?: 'verde' | 'azul' }) {
  const max = Math.max(...filas.map((f) => f.valor), 0);
  const color = tono === 'verde' ? 'bg-verde' : 'bg-azul-fuerte';

  if (filas.length === 0 || max === 0) {
    return <p className="text-sm text-tinta-suave">Todavía no hay datos que mostrar.</p>;
  }

  return (
    <ul className="space-y-2.5">
      {filas.map((f) => (
        <li key={f.clave} className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3 sm:grid-cols-[minmax(0,11.5rem)_1fr_auto]">
          <span className="truncate text-sm text-tinta" title={f.etiqueta}>
            {f.etiqueta}
          </span>
          <span className="h-2.5 rounded-full bg-crema-arena/70">
            <span
              className={`block h-full rounded-full ${color}`}
              style={{ width: `${max === 0 ? 0 : (f.valor / max) * 100}%` }}
            />
          </span>
          <span className="text-right text-sm tabular-nums text-tinta-suave">{f.texto}</span>
        </li>
      ))}
    </ul>
  );
}
