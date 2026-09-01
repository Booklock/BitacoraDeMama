'use client';

import Link from 'next/link';
import { useApp } from '@/lib/estado/ProveedorDatos';

/** Deja claro si lo que se ve son datos de ejemplo en este navegador o la
 *  bitácora real, compartida. Confundirlos sería el peor malentendido posible. */
export function AvisoModo() {
  const { modo, error } = useApp();

  return (
    <div className="mx-auto max-w-6xl space-y-2 px-5 py-3">
      {modo === 'demo' && (
        <p className="rounded-lg bg-amarillo-suave px-3 py-2 text-xs text-tinta-suave">
          Estás viendo una <strong className="font-semibold text-tinta">demostración</strong> con
          datos de ejemplo, guardados sólo en este navegador.{' '}
          <Link href="/crear-cuenta" className="font-medium text-verde-oscuro underline underline-offset-2">
            Crea tu bitácora
          </Link>{' '}
          para guardarlos de verdad y compartirlos.
        </p>
      )}

      {modo === 'nube' && (
        <p className="rounded-lg bg-azul-claro px-3 py-2 text-xs text-tinta-suave">
          Esta es tu bitácora. Todo lo que registres se guarda y lo ve también quien
          comparta el proyecto contigo.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-alerta/40 px-3 py-2 text-xs text-tinta">
          {error}
        </p>
      )}
    </div>
  );
}
