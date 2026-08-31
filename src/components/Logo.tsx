export function Logo({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    /* Isotipo de la marca, extraído del Excel y redibujado como SVG para que
       escale y tome el color del contexto. */
    <svg viewBox="0 0 100 100" className={className} aria-hidden role="presentation">
      <g fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round">
        <ellipse cx="50" cy="20" rx="11" ry="13" />
        <path d="M50 55c0-11 7-19 16-19s15 8 15 18-7 18-16 18-15-8-15-17z" />
        <path d="M50 55c0-11-8-19-18-19s-18 9-18 21 9 22 20 22c5 0 9-2 12-5" />
      </g>
    </svg>
  );
}
