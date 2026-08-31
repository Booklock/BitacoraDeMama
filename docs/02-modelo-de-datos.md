# 02 · Modelo de datos

Traducción del libro a un esquema relacional. Los nombres van en inglés (código),
las etiquetas visibles en la app son bilingües como en el Excel.

## Entidades

```
users ──N:M── projects        (vía project_members — una pareja comparte proyecto)
   │             ├──1:1── project_settings
   │             ├──1:N── project_invites   (código para que se una la pareja)
   │             ├──1:N── payers
   │             ├──1:N── products           (= hoja Inventory)
   │             └──1:N── checklist_states   (overrides: N/A, qty_needed, notas, manual)
   │
   └── un usuario puede pertenecer a varios proyectos (p. ej. un segundo bebé)

qrh_categories ──1:N── checklist_items ──N:N── checklist_items  (satisfied_by / combos)
       └── catálogo del sistema, sembrado desde qrh-catalog.json

fx_rates  ── tabla única de tipos de cambio a USD (ver §Monedas)
```

### `qrh_categories` — 13 filas, catálogo del sistema
| Campo | Tipo | Origen |
|-------|------|--------|
| `code` | `varchar` PK | `QRH-001` … `QRH-013` |
| `order` | `int` | 1–13 |
| `name_en`, `name_es` | `varchar` | `Reference!B`, `Reference!C` |
| `description_es` | `text` | encabezado de sección en `QRH Checklists` |
| `manual` | `bool` | `true` sólo para QRH-007 y QRH-012 |

### `checklist_items` — 188 filas, catálogo del sistema
| Campo | Tipo | Origen |
|-------|------|--------|
| `code` | `varchar` PK | `QRH-001-01` … |
| `qrh_code` | FK | |
| `order` | `int` | sufijo del código |
| `name_en`, `name_es` | `varchar` | `"EN \| ES"` partido |
| `default_qty_needed` | `int` | `QRH Checklists!D`, por defecto 1 |

### `item_satisfied_by` — mapa de combos
| Campo | Origen |
|-------|--------|
| `item_code` | ítem que se completa |
| `source_item_code` | ítem cuya compra lo completa (incluye a sí mismo) |

28 ítems tienen más de una fuente. Se extrae de los términos `SUMIFS` extra
de cada fórmula `C` — ya resuelto en el campo `satisfied_by` del catálogo JSON.

### `project_members` — quién ve el proyecto
| Campo | Tipo | Notas |
|-------|------|-------|
| `project_id` | FK | |
| `user_id` | FK | |
| `role` | `owner \| member` | ambos editan todo; `owner` puede invitar y borrar el proyecto |
| `payer_id` | FK nullable | con qué pagador de la lista se identifica esta persona |
| `joined_at` | `timestamptz` | |

Clave primaria `(project_id, user_id)`. Una pareja son **dos usuarios en un mismo
proyecto**: mismo inventario, mismos checklists, mismo dashboard.

### `project_invites` — unirse en pareja
| Campo | Tipo | Notas |
|-------|------|-------|
| `code` | `varchar` PK | código corto legible, p. ej. `LUNA-4K2P` |
| `project_id` | FK | |
| `created_by` | FK usuario | |
| `expires_at` | `timestamptz` | |
| `used_at`, `used_by` | nullable | de un solo uso |

### `project_settings` — hoja `Configuración`
`currency_code` (moneda de visualización del proyecto), `custom_symbol`,
`custom_rate` (para la moneda «Otra»), `baby_name`, `father_lastname`,
`mother_lastname`. `mission_id` es **derivado**, no se almacena (§6.5 del análisis).

La tasa de la moneda del proyecto **ya no vive aquí**: se lee de `fx_rates`, para que
haya una sola fuente de verdad (ver §Monedas).

### `payers` — `Configuración!C22:C28`
`id`, `project_id`, `role` (`mother|father|gift|shared|extra`), `name`, `order`, `active`.
Las 3 «persona adicional» vacías simplemente no existen como filas.

### `products` — hoja `Inventory`
`id`, `project_id`, `name`, `qrh_code`, `item_code`, `brand`, `store`, `url`,
`price` (`decimal`), `currency_code`, `qty` (`int`), `status`
(`purchased|pending|wishlist|savings`), `payer_id`, `notes`,
`stage` (`pregnancy|m0_3|m3_6|m6_9|m9_12|all`), `created_by`, `created_at`, `updated_at`.

Más dos campos de tipo de cambio (ver §Monedas):

| Campo | Tipo | Para qué |
|-------|------|----------|
| `fx_rate_to_usd` | `decimal` nullable | tasa de `currency_code` a USD **congelada** al marcarse como comprado |
| `fx_rate_locked_at` | `timestamptz` nullable | cuándo se congeló |

`converted_price` **no se almacena como número final**: se calcula siempre contra la
moneda actual del proyecto, para que cambiar de moneda re-exprese todo (como hace el
Excel). Lo que sí se congela es la tasa de origen de una compra ya hecha, porque
cuánto costó en su día es un hecho histórico, no algo que deba moverse cada vez que
fluctúa el mercado.

### `checklist_states` — lo editable de `QRH Checklists`
`project_id`, `item_code`, `not_applicable` (bool, col `F`),
`qty_needed` (override de `D`), `notes` (col `G`),
`manual_completed` (bool, sólo QRH-007 y QRH-012).
Fila creada sólo cuando la usuaria toca algo — el resto usa los valores por defecto.

## Enumeraciones

| Enum | Valores | Nota |
|------|---------|------|
| `status` | Purchased · Pending · Wishlist · Savings | Purchased y Savings completan checklist |
| `stage` | Pregnancy · 0-3 · 3-6 · 6-9 · 9-12 Months · All Stages | |
| `currency` | EUR · USD · CRC · MXN · GTQ · COP · ARS · Otra | tasas en el seed |
| `payer_role` | mother · father · gift · shared · extra ×3 | |

## Estado derivado (nunca se persiste)

| Derivado | Fórmula fuente |
|----------|----------------|
| `product.converted_price` | §6.1, con la tasa congelada si ya se compró |
| `item.completed` | §6.3 — incluye `not_applicable` y combos |
| `item.progress_label` | `"comprado/necesario"` o `"N/A"` |
| `qrh.progress_pct` | ítems completados / total de ítems del QRH |
| `qrh.spend` | suma de `converted_price` de sus productos |
| `project.global_progress` | completados / 188 |
| `project.total_spend` | suma de todos los `converted_price` |
| `payer.total` | suma por pagador |
| `stage.progress_pct` | comprados / total de la etapa |
| `settings.mission_id` | §6.5 |

Todo esto vive en un único módulo de cálculo puro y testeable
(`lib/engine/`), sin acceso a base de datos, para poder verificarlo contra
el Excel celda por celda.


## Monedas y tipos de cambio

El Excel guarda 7 tasas fijas en `Configuración!E8:E14` y avisa a la usuaria de que
las actualice a mano. Eso funciona en una hoja de cálculo personal; en una app usada
por familias en distintos países durante nueve meses, no.

### `fx_rates` — fuente única de verdad
| Campo | Tipo | Notas |
|-------|------|-------|
| `currency_code` | `varchar` | EUR, USD, CRC, MXN, GTQ, COP, ARS… |
| `rate_to_usd` | `decimal(18,8)` | cuánto vale 1 unidad en USD |
| `fetched_at` | `timestamptz` | |
| `source` | `varchar` | `api`, `seed` o `manual` |

USD es la **moneda base interna**, igual que en el Excel (todas sus tasas son «a USD»).
Ninguna otra tabla guarda tasas: ni `project_settings` ni el catálogo. Esa es la
«alineación» que hacía falta — en el Excel la misma tasa aparecía referenciada desde
tres sitios distintos.

### Las dos conversiones, que no son la misma

Un producto puede comprarse en una moneda distinta de la que la familia usa para ver
sus totales. Hay que separar dos cosas que el Excel mezcla:

1. **Cuánto costó** — hecho histórico. Al pasar a `Purchased` o `Savings` se congela
   `fx_rate_to_usd` en el producto. Si el peso se devalúa mañana, lo que se pagó ayer
   no cambia.
2. **En qué moneda lo veo** — preferencia de visualización. Siempre usa la tasa
   **actual** de la moneda del proyecto, para que cambiar de moneda re-exprese todo
   el histórico de forma coherente.

```
amount_usd  = price × qty × (fx_rate_to_usd congelada, o la actual si aún no se compró)
mostrado    = amount_usd ÷ fx_rate_to_usd(moneda del proyecto, hoy)
```

Los ítems en `Pending` y `Wishlist` **no** congelan tasa: son estimaciones y deben
reflejar el precio de hoy.

### Actualización de tasas

- Semilla inicial: las 7 tasas del Excel (`data/seed/config-defaults.json`), con
  `source = "seed"`.
- Refresco periódico desde una API pública de divisas, con `source = "api"`.
- Si la API falla, se sigue usando la última tasa buena; nunca se cae a `1`.
- La moneda «Otra» del Excel se conserva: símbolo y tasa manuales, `source = "manual"`.
- La UI muestra siempre **cuándo** se actualizó la tasa y permite corregirla a mano.

### Multi-moneda dentro de un mismo proyecto

Es el caso normal, no el excepcional: la abuela compra en EUR, la mamá en CRC, y algo
llega de Amazon en USD. Cada producto guarda su propia moneda; los totales del
Dashboard, del pagador y del QRH se calculan sobre `amount_usd` y se muestran en la
moneda del proyecto. La tabla de inventario muestra ambos valores: el precio original
en su moneda y el convertido.