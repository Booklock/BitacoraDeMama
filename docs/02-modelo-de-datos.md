# 02 · Modelo de datos

Traducción del libro a un esquema relacional. Los nombres van en inglés (código),
las etiquetas visibles en la app son bilingües como en el Excel.

## Entidades

```
users ──1:N── projects ──1:1── project_settings
                  │
                  ├──1:N── payers
                  ├──1:N── products            (= hoja Inventory)
                  └──1:N── checklist_states    (overrides: N/A, qty_needed, notas, manual)

qrh_categories ──1:N── checklist_items ──N:N── checklist_items  (satisfied_by / combos)
       └── catálogo del sistema, sembrado desde qrh-catalog.json
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

### `project_settings` — hoja `Configuración`
`currency_code`, `currency_symbol`, `currency_rate_to_usd`, `custom_symbol`,
`custom_rate`, `baby_name`, `father_lastname`, `mother_lastname`.
`mission_id` es **derivado**, no se almacena (§6.5 del análisis).

### `payers` — `Configuración!C22:C28`
`id`, `project_id`, `role` (`mother|father|gift|shared|extra`), `name`, `order`, `active`.
Las 3 «persona adicional» vacías simplemente no existen como filas.

### `products` — hoja `Inventory`
`id`, `project_id`, `name`, `qrh_code`, `item_code`, `brand`, `store`, `url`,
`price` (`decimal`), `currency_code`, `qty` (`int`), `status`
(`purchased|pending|wishlist|savings`), `payer_id`, `notes`,
`stage` (`pregnancy|m0_3|m3_6|m6_9|m9_12|all`), `created_at`, `updated_at`.

`converted_price` **no se almacena**: es derivado de `price`, `currency_code` y la
moneda del proyecto. Guardarlo congelaría el valor si la usuaria cambia de moneda —
que es justo lo contrario a lo que hace el Excel.

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
| `product.converted_price` | §6.1 |
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
