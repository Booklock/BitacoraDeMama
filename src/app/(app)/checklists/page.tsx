'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/lib/demo/EstadoApp';
import { BarraProgreso, Tarjeta } from '@/components/ui';
import {
  estaCompleto, estadoDe, etiquetaCantidad, productosQueCompletan, progresoDeQrh,
} from '@/lib/engine/checklist';

export default function ChecklistsPage() {
  const { productos, estados, catalogo, actualizarEstado } = useApp();
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(catalogo[0]?.code ?? null);

  const resumen = useMemo(
    () => catalogo.map((q) => ({ qrh: q, progreso: progresoDeQrh(q, estados, productos) })),
    [catalogo, estados, productos],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Checklists QRH</h1>
          <p className="mt-0.5 text-sm text-tinta-suave">
            Se marcan solos con lo que registras en el inventario.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-tinta-suave">
          <input
            type="checkbox"
            checked={soloPendientes}
            onChange={(e) => setSoloPendientes(e.target.checked)}
            className="h-4 w-4 rounded border-crema-borde accent-[#33A372]"
          />
          Ver sólo lo pendiente
        </label>
      </div>

      <div className="space-y-3">
        {resumen.map(({ qrh, progreso }) => {
          const desplegado = abierto === qrh.code;
          const items = soloPendientes
            ? qrh.items.filter((i) => !estaCompleto(i, qrh, estados, productos))
            : qrh.items;

          return (
            <Tarjeta key={qrh.code} className="!p-0">
              <button
                type="button"
                onClick={() => setAbierto(desplegado ? null : qrh.code)}
                aria-expanded={desplegado}
                className="flex w-full items-center gap-4 px-5 py-4 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold">{qrh.nameEs}</span>
                    <span className="text-xs text-tinta-suave">{qrh.nameEn}</span>
                    {qrh.isManual && (
                      <span className="rounded-full bg-crema-arena px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-tinta-suave">
                        Manual
                      </span>
                    )}
                  </div>
                  <BarraProgreso ratio={progreso.ratio} className="mt-2 max-w-md" />
                </div>
                <span className="shrink-0 text-sm tabular-nums text-tinta-suave">
                  {progreso.completos}/{progreso.total}
                </span>
                <span className="shrink-0 text-tinta-suave" aria-hidden>
                  {desplegado ? '−' : '+'}
                </span>
              </button>

              {desplegado && (
                <div className="border-t border-crema-borde px-5 py-3">
                  {qrh.descriptionEs && (
                    <p className="mb-3 text-sm text-tinta-suave">{qrh.descriptionEs}</p>
                  )}
                  {items.length === 0 ? (
                    <p className="py-3 text-sm text-tinta-suave">
                      Todo completo en esta categoría.
                    </p>
                  ) : (
                    <ul className="divide-y divide-crema-borde/60">
                      {items.map((item) => {
                        const completo = estaCompleto(item, qrh, estados, productos);
                        const estado = estadoDe(item.code, estados);
                        const origen = productosQueCompletan(item, productos);

                        return (
                          <li key={item.code} className="flex flex-wrap items-center gap-3 py-2.5">
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs text-white ${
                                completo ? 'bg-verde' : 'bg-crema-arena'
                              }`}
                              aria-hidden
                            >
                              {completo ? '✓' : ''}
                            </span>

                            <span className="min-w-0 flex-1">
                              <span
                                className={`block text-sm ${
                                  completo ? 'text-tinta-suave line-through' : 'text-tinta'
                                }`}
                              >
                                {item.nameEs ?? item.nameEn}
                              </span>
                              {/* Lo que el Excel no puede mostrar: qué compra
                                  concreta completó este ítem. */}
                              {origen.length > 0 && (
                                <span className="block text-xs text-tinta-suave">
                                  Completado por {origen.map((p) => p.name).join(', ')}
                                </span>
                              )}
                            </span>

                            <span className="shrink-0 text-xs tabular-nums text-tinta-suave">
                              {etiquetaCantidad(item, qrh, estados, productos)}
                            </span>

                            {qrh.isManual ? (
                              <label className="flex shrink-0 items-center gap-1.5 text-xs text-tinta-suave">
                                <input
                                  type="checkbox"
                                  checked={estado.manualCompleted}
                                  onChange={(e) =>
                                    actualizarEstado(item.code, { manualCompleted: e.target.checked })
                                  }
                                  className="h-4 w-4 rounded border-crema-borde accent-[#33A372]"
                                />
                                Listo
                              </label>
                            ) : (
                              <label className="flex shrink-0 items-center gap-1.5 text-xs text-tinta-suave">
                                <input
                                  type="checkbox"
                                  checked={estado.notApplicable}
                                  onChange={(e) =>
                                    actualizarEstado(item.code, { notApplicable: e.target.checked })
                                  }
                                  className="h-4 w-4 rounded border-crema-borde accent-[#33A372]"
                                />
                                No aplica
                              </label>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </Tarjeta>
          );
        })}
      </div>
    </div>
  );
}
