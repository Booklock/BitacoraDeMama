'use client';

import { useState } from 'react';
import { useApp } from '@/lib/demo/EstadoApp';
import { ETIQUETAS_ETAPA } from '@/lib/engine/dashboard';
import type { Stage, Status } from '@/lib/engine/types';

const ESTADOS: { valor: Status; texto: string }[] = [
  { valor: 'purchased', texto: 'Comprado' },
  { valor: 'pending', texto: 'Pendiente' },
  { valor: 'wishlist', texto: 'Lista de deseos' },
  { valor: 'savings', texto: 'Apartado' },
];

const MONEDAS = ['USD', 'EUR', 'CRC', 'MXN', 'GTQ', 'COP', 'ARS'];

export function FormularioProducto({ onCerrar }: { onCerrar: () => void }) {
  const { catalogo, pagadores, tasas, agregarProducto } = useApp();

  const [nombre, setNombre] = useState('');
  const [qrhCode, setQrhCode] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [marca, setMarca] = useState('');
  const [precio, setPrecio] = useState('');
  const [moneda, setMoneda] = useState('USD');
  const [cantidad, setCantidad] = useState('1');
  const [estado, setEstado] = useState<Status>('pending');
  const [pagador, setPagador] = useState('');
  const [etapa, setEtapa] = useState<Stage | ''>('');

  // El select en cascada del Excel: los ítems dependen de la categoría.
  const itemsDisponibles = catalogo.find((c) => c.code === qrhCode)?.items ?? [];

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const valorPrecio = precio === '' ? null : Number(precio);
    const compraHecha = estado === 'purchased' || estado === 'savings';

    agregarProducto({
      name: nombre.trim() || 'Producto sin nombre',
      qrhCode: qrhCode || null,
      itemCode: itemCode || null,
      brand: marca.trim() || undefined,
      price: valorPrecio,
      currencyCode: moneda,
      qty: Math.max(Number(cantidad) || 1, 1),
      status: estado,
      payerId: pagador || null,
      stage: etapa || null,
      // Se congela la tasa sólo si ya es una compra (decisión D7).
      fxRateToUsd: compraHecha ? (tasas[moneda] ?? null) : null,
    });
    onCerrar();
  };

  const campo = 'w-full rounded-lg border border-crema-borde bg-white px-3 py-2 text-sm';
  const etiqueta = 'block text-xs font-medium text-tinta-suave';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/30 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-formulario"
    >
      <form
        onSubmit={enviar}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl2 bg-crema p-6 shadow-xl"
      >
        <h2 id="titulo-formulario" className="text-lg font-semibold">Agregar producto</h2>

        <div className="mt-4 space-y-3">
          <label className={etiqueta}>
            Nombre del producto
            <input
              className={`${campo} mt-1`} value={nombre} required
              onChange={(e) => setNombre(e.target.value)}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className={etiqueta}>
              Categoría QRH
              <select
                className={`${campo} mt-1`} value={qrhCode} required
                onChange={(e) => { setQrhCode(e.target.value); setItemCode(''); }}
              >
                <option value="">Elige una…</option>
                {catalogo.map((c) => (
                  <option key={c.code} value={c.code}>{c.nameEs}</option>
                ))}
              </select>
            </label>

            <label className={etiqueta}>
              Ítem del checklist
              <select
                className={`${campo} mt-1`} value={itemCode} disabled={!qrhCode}
                onChange={(e) => setItemCode(e.target.value)}
              >
                <option value="">{qrhCode ? 'Elige uno…' : 'Elige antes la categoría'}</option>
                {itemsDisponibles.map((i) => (
                  <option key={i.code} value={i.code}>{i.nameEs ?? i.nameEn}</option>
                ))}
              </select>
            </label>
          </div>

          <label className={etiqueta}>
            Marca <span className="font-normal">(opcional)</span>
            <input
              className={`${campo} mt-1`} value={marca}
              onChange={(e) => setMarca(e.target.value)}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className={etiqueta}>
              Precio
              <input
                type="number" min="0" step="0.01" inputMode="decimal"
                className={`${campo} mt-1`} value={precio}
                onChange={(e) => setPrecio(e.target.value)}
              />
            </label>
            <label className={etiqueta}>
              Moneda
              <select
                className={`${campo} mt-1`} value={moneda}
                onChange={(e) => setMoneda(e.target.value)}
              >
                {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className={etiqueta}>
              Cantidad
              <input
                type="number" min="1" step="1"
                className={`${campo} mt-1`} value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className={etiqueta}>
              Estado
              <select
                className={`${campo} mt-1`} value={estado}
                onChange={(e) => setEstado(e.target.value as Status)}
              >
                {ESTADOS.map((s) => <option key={s.valor} value={s.valor}>{s.texto}</option>)}
              </select>
            </label>
            <label className={etiqueta}>
              Pagado por
              <select
                className={`${campo} mt-1`} value={pagador}
                onChange={(e) => setPagador(e.target.value)}
              >
                <option value="">Sin asignar</option>
                {pagadores.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className={etiqueta}>
              Etapa
              <select
                className={`${campo} mt-1`} value={etapa}
                onChange={(e) => setEtapa(e.target.value as Stage | '')}
              >
                <option value="">Sin etapa</option>
                {(Object.keys(ETIQUETAS_ETAPA) as Stage[]).map((s) => (
                  <option key={s} value={s}>{ETIQUETAS_ETAPA[s]}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <p className="mt-4 text-xs text-tinta-suave">
          Si eliges «Comprado» o «Apartado», el ítem del checklist se marcará solo.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button" onClick={onCerrar}
            className="rounded-lg px-4 py-2 text-sm text-tinta-suave hover:text-tinta"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded-lg bg-verde px-4 py-2 text-sm font-medium text-white hover:bg-verde-oscuro"
          >
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}
