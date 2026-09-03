'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/estado/ProveedorDatos';
import { BarraProgreso, Cifra, ListaBarras, Tarjeta } from '@/components/ui';
import { formatearDinero } from '@/lib/engine/money';
import {
  flightPlan, gastoPorPagador, progresoPorEtapa, resumenGeneral, resumenPorQrh, totalApartado,
} from '@/lib/engine/dashboard';

export default function DashboardPage() {
  const { productos, estados, ajustes, pagadores, tasas, catalogo } = useApp();
  const moneda = ajustes.currencyCode;

  const plan = useMemo(() => flightPlan(ajustes, pagadores), [ajustes, pagadores]);
  const general = useMemo(
    () => resumenGeneral(catalogo, productos, estados, tasas, moneda),
    [catalogo, productos, estados, tasas, moneda],
  );
  const porQrh = useMemo(
    () => resumenPorQrh(catalogo, productos, estados, tasas, moneda, 'corrected'),
    [catalogo, productos, estados, tasas, moneda],
  );
  const porPagador = useMemo(
    () => gastoPorPagador(pagadores, productos, tasas, moneda, 'corrected'),
    [pagadores, productos, tasas, moneda],
  );
  const porEtapa = useMemo(() => progresoPorEtapa(productos), [productos]);
  const apartado = useMemo(
    () => totalApartado(productos, tasas, moneda, 'corrected'),
    [productos, tasas, moneda],
  );

  if (productos.length === 0) {
    return (
      <div className="space-y-5">
        <FlightPlanCard plan={plan} />
        <Tarjeta>
          <h2 className="text-lg font-semibold">Tu bitácora está lista</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-tinta-suave">
            Todavía no hay nada registrado, así que aquí no hay números que mostrar.
            En cuanto agregues tu primer producto, los checklists empiezan a marcarse
            solos y este panel cobra vida.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/inventario"
              className="rounded-lg bg-verde px-4 py-2 text-sm font-medium text-white hover:bg-verde-oscuro"
            >
              Agregar mi primer producto
            </Link>
            <Link
              href="/checklists"
              className="rounded-lg px-4 py-2 text-sm font-medium text-verde-oscuro ring-1 ring-crema-borde hover:bg-white"
            >
              Ver los 13 checklists
            </Link>
          </div>
        </Tarjeta>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Flight Plan: el encabezado de aviación del Excel */}
      <FlightPlanCard plan={plan} />

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
            etiqueta="Ya comprado"
            valor={formatearDinero(general.gastado, moneda)}
            apoyo="Comprado y apartado, precio × cantidad"
          />
        </Tarjeta>

        <Tarjeta>
          <Cifra
            etiqueta="Falta por comprar"
            valor={formatearDinero(general.proyectado - general.gastado, moneda)}
            apoyo={`${formatearDinero(general.proyectado, moneda)} si compras todo lo de la lista`}
          />
        </Tarjeta>
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
            leyenda={['Ya comprado', 'En lista']}
            filas={porQrh.map((q) => ({
              clave: q.code,
              etiqueta: q.nombre,
              valor: q.gastoFijo + q.gastoEnLista,
              valorFijo: q.gastoFijo,
              texto: formatearDinero(q.gastoFijo + q.gastoEnLista, moneda),
            }))}
          />
          <p className="mt-3 text-xs text-tinta-suave">
            La barra completa es lo que costaría todo. La parte verde es lo que
            ya está comprado o apartado; la morada, lo que sigue siendo una intención.
          </p>
        </Tarjeta>

        <Tarjeta titulo="¿Quién paga?">
          <ListaBarras
            leyenda={['Ya comprado', 'En lista']}
            filas={porPagador.map((p) => ({
              clave: p.nombre,
              etiqueta: p.nombre,
              valor: p.fijo + p.enLista,
              valorFijo: p.fijo,
              texto: formatearDinero(p.fijo + p.enLista, moneda),
            }))}
          />
          <p className="mt-3 text-xs text-tinta-suave">
            De lo apartado para regalos hay {formatearDinero(apartado, moneda)}.
          </p>
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

function FlightPlanCard({ plan }: { plan: ReturnType<typeof flightPlan> }) {
  return (
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
  );
}
