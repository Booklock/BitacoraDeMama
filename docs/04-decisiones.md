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

## D4 · Registro individual o en pareja, sobre un proyecto compartido

**Decisión.** Una pareja son **dos usuarios dentro de un mismo proyecto**, no una
cuenta compartida. Al registrarse se elige:

- **«Empiezo yo»** → se crea el proyecto, la persona queda como `owner` y pasa al
  asistente de configuración.
- **«Tengo un código»** → se une a un proyecto existente como `member`, se salta el
  asistente (la configuración ya existe) y sólo elige con qué pagador se identifica.

El `owner` genera un código de invitación de un solo uso desde Configuración. Ambos
ven exactamente el mismo dashboard, inventario y checklists, y ambos pueden editar.

**Por qué.** Compartir una sola cuenta y contraseña es lo que la gente hace cuando no
le damos alternativa, y rompe la trazabilidad: no se sabe quién registró qué. Con dos
usuarios sobre un proyecto se conserva el dashboard único que pidieron, y además cada
producto puede guardar `created_by`.

**Consecuencias.** `project_members` y `project_invites` entran en el esquema desde la
Etapa 2. Sin permisos granulares en v1: `owner` y `member` editan lo mismo, y la única
diferencia es invitar y borrar el proyecto.

## D5 · Login simple, sin verificación de correo

**Decisión.** Correo y contraseña con Supabase Auth, con la confirmación por correo
**desactivada**: la persona se registra y entra directo.

**Por qué.** Es una app que se usa por primera vez con poco tiempo y muchas ganas de
ver el checklist; un paso de verificación en medio pierde usuarias.

**Consecuencias y riesgo asumido.** Si alguien se equivoca al escribir su correo, no
podrá recuperar la contraseña, porque el correo nunca se comprobó. Para mitigarlo sin
reintroducir fricción: se pide el correo dos veces en el registro, y se ofrece
verificarlo después desde Configuración (opcional, con un aviso discreto). La
verificación obligatoria puede activarse más adelante sin migrar datos — es un
interruptor de Supabase.

## D6 · La configuración se arma sola al crear la cuenta

**Decisión.** Terminado el registro individual, se entra a un asistente de tres pasos
—moneda → personas → bebé— con todo **pre-rellenado** en vez de vacío:

| Campo | Valor inicial |
|-------|---------------|
| Moneda | deducida del idioma y región del navegador, y confirmable |
| Tasas | ya cargadas desde `fx_rates` |
| Pagador «madre» o «padre» | el nombre con el que se registró la persona |
| «Regalo (Baby Shower)» y «Común» | los del Excel |
| Personas adicionales | vacías, opcionales |
| Nombre del bebé y apellidos | únicos campos realmente en blanco |
| Mission ID | se genera solo al escribir el nombre del bebé |

Se puede saltar el asistente y quedarse con los valores por defecto; la app funciona
igual, y Configuración queda accesible siempre.

**Por qué.** El Excel obliga a configurar antes de empezar («¡hazlo primero!») porque
no puede adivinar nada. La app sí puede, y la configuración deja de ser un trámite.

**Consecuencias.** Quien se une con un código **no** ve el asistente: hereda la
configuración del proyecto y sólo elige su pagador.

## D7 · Tipos de cambio alineados en una sola tabla, con tasa congelada al comprar

**Decisión.** Una única tabla `fx_rates` con USD como moneda base interna, refrescada
desde una API pública. Cada producto guarda la moneda en que se compró; al pasar a
`Purchased` o `Savings` se **congela** la tasa de esa moneda a USD. La conversión a la
moneda que la familia ve usa siempre la tasa **actual** de esa moneda.

**Por qué.** Es normal que en un mismo proyecto haya compras en tres monedas (la
abuela en EUR, la mamá en CRC, Amazon en USD). Y hay que distinguir dos cosas que el
Excel mezcla: lo que algo **costó** es un hecho del pasado que no debe moverse cuando
fluctúa el mercado, mientras que la moneda en que se **muestra** es una preferencia que
sí debe re-expresar todo el histórico. Las tasas del Excel, además, están fijas desde
mediados de 2026 y el propio archivo pide actualizarlas a mano.

**Consecuencias.** `fx_rates` y los campos `fx_rate_to_usd` / `fx_rate_locked_at` del
producto entran en la Etapa 2. `Pending` y `Wishlist` no congelan tasa. Si la API
falla se conserva la última tasa buena, nunca se cae a `1` como hace el Excel ante una
moneda desconocida. La UI muestra la fecha de la última actualización y permite
corregir a mano, conservando la moneda «Otra» del Excel. El detalle está en la sección
«Monedas y tipos de cambio» de `02-modelo-de-datos.md`.


## D8 · Dos formas de compartir, con acceso muy distinto

**Decisión.** La bitácora se comparte de dos maneras que no se parecen en nada:

| | **Pareja** | **Familia** |
|---|---|---|
| Qué ve | todo: inventario, precios, dashboard, configuración | sólo lo que falta por comprar |
| Qué puede hacer | editarlo todo | apuntarse a regalar y marcar comprado |
| Cómo entra | crea su cuenta con un código de 8 caracteres | abre un enlace, sin cuenta |
| Duración | un solo uso, 30 días | reutilizable hasta que se revoque |

**Por qué la familia no necesita cuenta.** Los abuelos no se van a registrar. Si
regalar exige crear una cuenta, no regalan por la app y la función no existe. El
enlace público es la única forma de que esto se use de verdad.

**Qué obliga eso.** Como cualquiera con el enlace entra, el token es de 24
caracteres (≈121 bits, no se adivina) y —más importante— **el enlace no da
acceso a ninguna tabla**. Todo pasa por funciones que comprueban el token y
devuelven sólo lo que la familia debe ver. El rol `anon` no puede leer
`products` ni aunque tenga el enlace; eso está probado en
`supabase/pruebas/02-lista-regalos.sql`.

**Qué NO ve la familia**, deliberadamente: lo ya comprado, los totales, el
presupuesto, quién paga qué, ni las notas de los padres. La lista de regalos no
es una ventana a la economía de la casa.

**Consecuencias.** Un regalo marcado como comprado desde el enlace completa el
checklist de los padres, se atribuye al pagador «Regalo (Baby Shower)» y congela
el tipo de cambio del día, igual que una compra propia. En el inventario aparece
«Regalo de <nombre>».

**Riesgo aceptado.** Cualquiera con el enlace puede liberar un regalo apartado
por otra persona. Es un enlace familiar y el coste de equivocarse es bajo;
resolverlo bien exigiría identificar a cada persona, que es justo lo que
queríamos evitar. Generar un enlace nuevo invalida el anterior.


## D10 · Todo nace «Pendiente», y la lista de regalos exige precio

**Decisión.** La lista precargada entra entera como **Pendiente**. Se retira el
estado «Sugerido» que introdujo D9.

**Por qué.** Quien abre su bitácora por primera vez espera ver todo pendiente
por comprar, no un estado intermedio que hay que aprender. La distinción entre
«lo propuso la app» y «lo decidimos nosotros» era correcta en el modelo y
confusa en la pantalla.

**El problema que resolvía sigue existiendo.** Si todo nace pendiente y la lista
de regalos muestra lo pendiente, la abuela abre el enlace y ve 165 filas en
blanco. Se resuelve con una regla mejor: **la lista de regalos sólo muestra
productos con precio.**

Es más honesta que el estado aparte. Un producto sin precio tampoco es un
regalo que alguien pueda evaluar —no sabe cuánto cuesta ni dónde encontrarlo—,
y poner el precio es exactamente la señal de que la familia ya lo investigó y
de verdad lo quiere. El inventario tiene un filtro «Sin precio» para ver de un
vistazo qué falta por completar.

**Consecuencias.** La migración pasa a pendiente lo ya precargado como
«sugerido». El dashboard detecta la bitácora sin estrenar por otro criterio:
ningún producto con precio y ninguno comprado. Y se añade `reiniciar_inventario()`,
que borra todo y vuelve a dejar la lista limpia — necesario en la beta, cuando
una bitácora se llena de pruebas.
