'use client';

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string;
  ayuda?: string;
}

export function CampoTexto({ etiqueta, ayuda, id, ...props }: Props) {
  const idCampo = id ?? `campo-${etiqueta.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div>
      <label htmlFor={idCampo} className="block text-sm font-medium text-tinta">
        {etiqueta}
      </label>
      <input
        id={idCampo}
        {...props}
        className="mt-1 w-full rounded-lg border border-crema-borde bg-white px-3 py-2 text-sm outline-none focus:border-verde focus:ring-1 focus:ring-verde"
      />
      {ayuda && <p className="mt-1 text-xs text-tinta-suave">{ayuda}</p>}
    </div>
  );
}

export function Boton({
  children, cargando, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { cargando?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || cargando}
      className="w-full rounded-lg bg-verde px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-verde-oscuro disabled:cursor-not-allowed disabled:opacity-60"
    >
      {cargando ? 'Un momento…' : children}
    </button>
  );
}

export function Aviso({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-lg bg-alerta/40 px-3 py-2 text-sm text-tinta">
      {children}
    </p>
  );
}
