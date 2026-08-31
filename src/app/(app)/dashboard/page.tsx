'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/lib/demo/EstadoApp';
import { BarraProgreso, Cifra, ListaBarras, Tarjeta } from '@/components/ui';
import { formatearDinero } from '@/lib/engine/money';
import {
  flightPlan, gastoPorPagador, progresoPorEtapa, resumenGeneral, resumenPorQrh, totalApartado,
} from '@/lib/engine/dashboard';
import type { ModoGasto } from '@/lib/engine/types';

export default function DashboardPage() {
  const { productos, estados, ajustes, pagadores, tasas, catalogo } = useApp();
  const [modo, setModo] = useState<ModoGasto>('corrected');
  const moneda = ajustes.currencyCode;

  const plan = useMemo(() => flightPlan(ajustes, pagadores), [ajustes, pagadores]);
  const general = useMemo(
    () => resumenGeneral(catalogo, productos, estados, tasas, moneda),
    [catalogo, productos, estados, tasas, moneda],
  );
  const porQrh = useMemo(
    () => resumenPorQrh(catalogo, productos, estados, tasas, moneda, modo),
    [catalogo, productos, estados, tasas, moneda, modo],
  );
  const porPagador = useMemo(
    () => gastoPorPagador(pagadores, productos, tasas, moneda, modo),
    [pagadores, productos, tasas, moneda, modo],
  );
  const porEtapa = useMemo(() => progresoPorEtapa(productos), [productos]);
  const apartado = useMemo(
    () => totalApartado(productos, tasas, moneda, modo),
    [productos, tasas, moneda, modo],
  );

  return (
    <div className="space-y-5">
      {/* Flight Plan: el encabezado de aviación del Excel */}
      <section className="rounded-xl2 bg-verde-oscuro px-6 py-5 text-white">
        <p className="text-xs uppercase tracking-[0.2em] text-white/70">
          Mission {plan.mission}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Flight Plan</h1>
        <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Aircraft', plan.aircraft],
            ['Captain', plan.captain],
            ['First officer', plan.firstOfficer],
            ['Passenger', plan.passenger],
            ['Mission', `Safe delivery ${plan.passenger}`],
            ['Flight duration', plan.duration],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs uppercase tracking-wide text-white/60">{k}</dt>
              <dd className="mt-0.5 font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Cifras principales */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Tarjeta>
          <Cifra
            etiqueta="Avance de checklists"
            valor={`${Math.round(general.progreso.ratio * 100)}%`}
            apoyo={`${general.progreso.completos} de ${general.progreso.total} ítems`}
          />
          <BarraProgreso ratio={general.progreso.ratio} className="mt-3" />
        </Tarjeta>

        <Tarjeta>
          <Cifra
            etiqueta="Gastado"
            valor={formatearDinero(general.gastado, moneda)}
            apoyo="Comprado y apartado, precio × cantidad"
          />
        </Tarjeta>

        <Tarjeta>
          <Cifra
            etiqueta="Proyectado"
            valor={formatearDinero(general.proyectado, moneda)}
            apoyo="Incluye pendientes y lista de deseos"
          />
        </Tarjeta>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-tinta-suave">Cómo se calcula el gasto:</span>
        <div className="flex gap-1 rounded-lg bg-white/70 p-1 ring-1 ring-crema-borde">
          {([
            ['corrected', 'Corregido'],
            ['excel', 'Como el Excel'],
          ] as const).map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setModo(valor)}
              aria-pressed={modo === valor}
              className={`rounded-md px-3 py-1 transition-colors ${
                modo === valor ? 'bg-verde text-white' : 'text-tinta-suave hover:text-tinta'
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
        <span className="text-xs text-tinta-suave">
          {modo === 'corrected'
            ? 'Sólo lo comprado o apartado, multiplicado por la cantidad.'
            : 'Réplica del Excel: suma todo, incluida la lista de deseos, sin multiplicar por cantidad.'}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Avance por checklist">
          <ListaBarras
            filas={porQrh.map((q) => ({
              clave: q.code,
              etiqueta: q.nombre,
              valor: q.ratio,
              texto: `${q.completos}/${q.total}`,
            }))}
          />
        </Tarjeta>

        <Tarjeta titulo={`Gasto por checklist (${moneda})`}>
          <ListaBarras
            tono="azul"
            filas={porQrh.map((q) => ({
              clave: q.code,
              etiqueta: q.nombre,
              valor: q.gasto,
              texto: formatearDinero(q.gasto, moneda),
            }))}
          />
        </Tarjeta>

        <Tarjeta titulo="¿Quién paga?">
          <ListaBarras
            tono="azul"
            filas={[
              ...porPagador.map((p) => ({
                clave: p.nombre,
                etiqueta: p.nombre,
                valor: p.total,
                texto: formatearDinero(p.total, moneda),
              })),
              {
                clave: '__apartado',
                etiqueta: 'Apartado',
                valor: apartado,
                texto: formatearDinero(apartado, moneda),
              },
            ]}
          />
        </Tarjeta>

        <Tarjeta titulo="Comprado por etapa">
          <ListaBarras
            filas={porEtapa.map((e) => ({
              clave: e.etapa,
              etiqueta: e.nombre,
              valor: e.ratio,
              texto: e.total === 0 ? '—' : `${Math.round(e.ratio * 100)}%`,
            }))}
          />
        </Tarjeta>
      </div>
    </div>
  );
}
