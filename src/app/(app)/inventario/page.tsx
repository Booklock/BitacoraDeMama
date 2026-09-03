'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/lib/estado/ProveedorDatos';
import { BadgeEstado, Tarjeta } from '@/components/ui';
import { FormularioProducto } from '@/components/FormularioProducto';
import { nombreItem, nombreQrh } from '@/lib/catalogo';
import { formatearDinero, precioConvertido, simbolo } from '@/lib/engine/money';
import { ETIQUETAS_ETAPA } from '@/lib/engine/dashboard';
import type { Status } from '@/lib/engine/types';

const FILTROS_ESTADO: { valor: Status | 'todos' | 'decididos'; texto: string }[] = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'decididos', texto: 'Lo que decidimos' },
  { valor: 'suggested', texto: 'Sugeridos' },
  { valor: 'purchased', texto: 'Comprado' },
  { valor: 'pending', texto: 'Pendiente' },
  { valor: 'wishlist', texto: 'Deseo' },
  { valor: 'savings', texto: 'Apartado' },
];

export default function InventarioPage() {
  const { productos, ajustes, pagadores, tasas, catalogo, borrarProducto } = useApp();
  const [filtroEstado, setFiltroEstado] = useState<Status | 'todos' | 'decididos'>('todos');
  const [filtroQrh, setFiltroQrh] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState(false);

  const moneda = ajustes.currencyCode;
  const nombrePagador = (id: string | null) =>
    pagadores.find((p) => p.id === id)?.name ?? '—';

  const sugeridos = useMemo(
    () => productos.filter((p) => p.status === 'suggested').length,
    [productos],
  );

  const visibles = useMemo(
    () =>
      productos.filter((p) => {
        if (filtroEstado === 'decididos' && p.status === 'suggested') return false;
        if (filtroEstado !== 'todos' && filtroEstado !== 'decididos' && p.status !== filtroEstado) {
          return false;
        }
        if (filtroQrh !== 'todos' && p.qrhCode !== filtroQrh) return false;
        if (busqueda && !p.name.toLowerCase().includes(busqueda.toLowerCase())) return false;
        return true;
      }),
    [productos, filtroEstado, filtroQrh, busqueda],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Inventario</h1>
          <p className="mt-0.5 text-sm text-tinta-suave">
            La única pantalla donde escribes. Todo lo demás se calcula solo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="rounded-lg bg-verde px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-verde-oscuro"
        >
          Agregar producto
        </button>
      </div>

      {/* Filtros: en una sola fila, encima de los datos */}
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre…"
          aria-label="Buscar producto"
          className="min-w-[12rem] flex-1 rounded-lg border border-crema-borde bg-white px-3 py-1.5 text-sm"
        />
        <select
          value={filtroQrh}
          onChange={(e) => setFiltroQrh(e.target.value)}
          aria-label="Filtrar por categoría"
          className="rounded-lg border border-crema-borde bg-white px-3 py-1.5 text-sm"
        >
          <option value="todos">Todas las categorías</option>
          {catalogo.map((c) => (
            <option key={c.code} value={c.code}>{c.nameEs}</option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1 rounded-lg bg-white/70 p-1 ring-1 ring-crema-borde">
          {FILTROS_ESTADO.map((f) => (
            <button
              key={f.valor}
              type="button"
              onClick={() => setFiltroEstado(f.valor)}
              aria-pressed={filtroEstado === f.valor}
              className={`rounded-md px-2.5 py-1 text-sm transition-colors ${
                filtroEstado === f.valor
                  ? 'bg-verde text-white'
                  : 'text-tinta-suave hover:text-tinta'
              }`}
            >
              {f.texto}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-tinta-suave">
        {visibles.length} de {productos.length} productos
        {sugeridos > 0 && filtroEstado === 'todos' && (
          <>
            {' · '}
            <span>
              {sugeridos} son sugerencias de la app. Marca el estado de lo que ya
              tengas o quieras, y borra lo que no aplique.
            </span>
          </>
        )}
      </p>

      {/* Tabla en pantalla ancha */}
      <div className="hidden overflow-x-auto rounded-xl2 bg-white/70 ring-1 ring-crema-borde md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-crema-borde text-left text-xs uppercase tracking-wide text-tinta-suave">
            <tr>
              {['Producto', 'Categoría', 'Ítem', 'Precio', `Convertido (${moneda})`,
                'Cant.', 'Estado', 'Pagado por', 'Etapa', ''].map((h) => (
                <th key={h} scope="col" className="whitespace-nowrap px-3 py-2.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibles.map((p) => (
              <tr key={p.id} className="border-b border-crema-borde/60 last:border-0">
                <td className="min-w-[10rem] px-3 py-2.5">
                  <span className="font-medium text-tinta">{p.name}</span>
                  {p.brand && <span className="block text-xs text-tinta-suave">{p.brand}</span>}
                  {p.reservedByName && (
                    <span className="block text-xs text-verde-oscuro">
                      Regalo de {p.reservedByName}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-tinta-suave">
                  {nombreQrh(p.qrhCode)}
                </td>
                <td className="px-3 py-2.5 text-tinta-suave">{nombreItem(p.itemCode)}</td>
                {/* Se muestra el precio original Y el convertido: en un mismo
                    proyecto conviven compras en varias monedas. */}
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-tinta-suave">
                  {p.price == null ? '—' : `${simbolo(p.currencyCode ?? '')} ${p.price}`}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                  {formatearDinero(precioConvertido(p, tasas, moneda), moneda)}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-tinta-suave">{p.qty}</td>
                <td className="px-3 py-2.5"><BadgeEstado estado={p.status} /></td>
                <td className="whitespace-nowrap px-3 py-2.5 text-tinta-suave">
                  {nombrePagador(p.payerId)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-tinta-suave">
                  {p.stage ? ETIQUETAS_ETAPA[p.stage] : '—'}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => borrarProducto(p.id)}
                    className="text-xs text-tinta-suave underline underline-offset-2 hover:text-tinta"
                  >
                    Borrar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibles.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-tinta-suave">
            Ningún producto coincide con los filtros.
          </p>
        )}
      </div>

      {/* Tarjetas en móvil: una tabla de 10 columnas no funciona en teléfono */}
      <div className="space-y-3 md:hidden">
        {visibles.map((p) => (
          <Tarjeta key={p.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-tinta-suave">{nombreItem(p.itemCode)}</p>
              </div>
              <BadgeEstado estado={p.status} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-sm">
              <dt className="text-tinta-suave">Precio</dt>
              <dd className="text-right tabular-nums">
                {p.price == null ? '—' : `${simbolo(p.currencyCode ?? '')} ${p.price}`}
              </dd>
              <dt className="text-tinta-suave">Convertido</dt>
              <dd className="text-right tabular-nums">
                {formatearDinero(precioConvertido(p, tasas, moneda), moneda)}
              </dd>
              <dt className="text-tinta-suave">Pagado por</dt>
              <dd className="text-right">{nombrePagador(p.payerId)}</dd>
            </dl>
            <button
              type="button"
              onClick={() => borrarProducto(p.id)}
              className="mt-3 text-xs text-tinta-suave underline underline-offset-2"
            >
              Borrar
            </button>
          </Tarjeta>
        ))}
        {visibles.length === 0 && (
          <p className="py-8 text-center text-sm text-tinta-suave">
            Ningún producto coincide con los filtros.
          </p>
        )}
      </div>

      {abierto && <FormularioProducto onCerrar={() => setAbierto(false)} />}
    </div>
  );
}
