# Bitácora de Mamá

Aplicación web que replica la plantilla Excel *Bitácora de Mamá — Inventory
Management System*: un sistema para que mamás y papás organicen las compras y
gastos del bebé, con checklists que se marcan solos a partir de lo que registran.

> *Diario de vuelo — la maternidad organizada como un viaje seguro.*

## Cómo funciona

Se registra cada producto una sola vez en el **Inventario**, eligiendo su categoría
(QRH) y el ítem de checklist al que corresponde. A partir de ahí, todo lo demás se
calcula solo: los **13 checklists QRH** se marcan cuando algo se compra, y el
**Dashboard** muestra gasto y avance en tiempo real, en la moneda que la familia elija.

## Estado

Etapa 1 de 10 completada — análisis del Excel y catálogo semilla. Stack definido:
Next.js + TypeScript + Supabase. Ver
[`docs/03-modulos-y-etapas.md`](docs/03-modulos-y-etapas.md) para el plan completo.

## Documentación

| Documento | Contenido |
|-----------|-----------|
| [`docs/01-analisis-excel.md`](docs/01-analisis-excel.md) | Ingeniería inversa del libro: hojas, fórmulas, validaciones, marca |
| [`docs/02-modelo-de-datos.md`](docs/02-modelo-de-datos.md) | Esquema relacional y estado derivado |
| [`docs/03-modulos-y-etapas.md`](docs/03-modulos-y-etapas.md) | Módulos y las 10 etapas de desarrollo |
| [`docs/04-decisiones.md`](docs/04-decisiones.md) | Decisiones de producto y arquitectura, con su porqué |

Una pareja comparte un mismo proyecto: dos cuentas, un solo dashboard.
Las compras pueden registrarse en distintas monedas y se convierten contra una
tabla única de tipos de cambio.

## Datos semilla

| Archivo | Contenido |
|---------|-----------|
| [`data/seed/qrh-catalog.json`](data/seed/qrh-catalog.json) | 13 categorías QRH y 188 ítems, con el mapa de combos |
| [`data/seed/config-defaults.json`](data/seed/config-defaults.json) | 8 monedas con tasas, roles de pagador, enums y colores |

Ambos fueron extraídos y validados contra las dos fuentes independientes del Excel
(la hoja `Reference` y la hoja `QRH Checklists`): 188 ítems, sin huérfanos ni duplicados.
