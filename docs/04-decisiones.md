# 04 · Decisiones de producto y arquitectura

Registro de las decisiones tomadas al cerrar la Etapa 1. Cada una responde a un
hallazgo del análisis; si alguna cambia, se actualiza aquí antes de tocar código.

## D1 · Stack: Next.js + Supabase

**Decisión.** React/Next.js con TypeScript en el front, Supabase (Postgres + auth)
como backend.

**Por qué.** El producto se vende a familias que lo van a usar desde el teléfono,
durante meses, y en pareja. Eso exige cuentas y datos en servidor. `localStorage`
habría sido más rápido de construir, pero perder la bitácora al limpiar el navegador
no es aceptable en un producto de pago.

**Consecuencias.** La Etapa 9 (persistencia y cuentas) deja de ser una etapa
separada al final: el esquema y la autenticación entran desde la Etapa 2, y lo que
queda para la 9 es compartir proyecto, export e importación.

## D2 · Corregir los bugs del Excel, mostrando ambos números

**Decisión.** En el Dashboard se separa **Gastado** (`Purchased` + `Savings`) de
**Proyectado** (todos los estados, incluidos `Pending` y `Wishlist`), y el precio de
cada línea se multiplica por su cantidad. El total con la lógica original del Excel
sigue estando visible.

**Por qué.** El KPI del Excel suma la lista de deseos como si fuera gasto (§9.1 del
análisis) y nunca multiplica por `Qty` (§9.2). Corregirlo sin más rompería la
correspondencia con la plantilla que las clientas ya tienen; mostrar ambos permite
que los números cuadren durante la migración.

**Consecuencias.** El motor de cálculo (Etapa 3) expone las dos variantes:
`spend({ mode: 'excel' })` y `spend({ mode: 'corrected' })`, ambas cubiertas por tests.

## D3 · Catálogo fijo de 188 ítems, con «Otro» por categoría

**Decisión.** Las 13 categorías y los 188 ítems son catálogo del sistema, no
editables. Cada QRH conserva su ítem genérico `Other | Otro` para lo que no encaje.

**Por qué.** Es el comportamiento del Excel (la hoja `Reference` está oculta y el
libro protegido, §9.6) y mantiene comparables el avance y las estadísticas entre
usuarias. Abrir el catálogo complicaría el motor de combos (§6.3) y el cálculo de
porcentajes sin un beneficio claro en esta fase.

**Consecuencias.** El esquema deja preparada la puerta: `checklist_items` lleva
`project_id` nulo para los ítems del sistema, de modo que permitir ítems propios más
adelante no exige migrar datos. Se reevalúa en la Etapa 9.
