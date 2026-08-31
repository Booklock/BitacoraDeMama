# 03 · Módulos y etapas de desarrollo

Cada etapa es un push cerrado y funcionando. El orden respeta la dependencia real
del Excel: nada puede calcularse antes de que exista el catálogo, y el Dashboard
no puede existir antes que el Inventory.

## Mapa de módulos

| Módulo | Hoja de origen | Naturaleza |
|--------|----------------|------------|
| **M0 · Catálogo** | `Reference` (oculta) | datos semilla del sistema |
| **M1 · Motor de cálculo** | fórmulas de todas las hojas | lógica pura, sin UI |
| **M2 · Configuración** | `Configuración` | formulario |
| **M3 · Inventario** | `Inventory` | CRUD, el corazón de la app |
| **M4 · Checklists QRH** | `QRH Checklists` | vista derivada + overrides |
| **M5 · Dashboard** | `Dashboard` | KPIs + 4 gráficos |
| **M6 · Bienvenida** | `Bienvenida` | onboarding |

---

## Etapa 1 — Análisis y catálogo *(este push)*

**Entrega:** documentación técnica completa, catálogo de 13 QRH × 188 ítems
normalizado a JSON con el mapa de combos, valores por defecto de configuración,
y assets de marca extraídos del libro.

- `docs/01-analisis-excel.md` · `docs/02-modelo-de-datos.md` · este archivo
- `data/seed/qrh-catalog.json` — 188 ítems, validados contra las dos fuentes del Excel
- `data/seed/config-defaults.json` — monedas, tasas, roles, enums, colores de estado
- `assets/brand/` — isotipo e ilustración

## Etapa 2 — Fundaciones y sistema de diseño

Andamiaje del proyecto y traducción de la identidad del Excel a tokens.

- Stack, estructura de carpetas, linting, tests, CI
- Tokens de color y tipografía (Poppins) desde §8 del análisis
- Componentes base: botón, input, select, tabla, badge de estado, tarjeta, barra de progreso
- Layout con la navegación de 5 secciones = las 5 hojas visibles
- Etiquetas bilingües `EN | ES` como convención transversal

## Etapa 3 — Motor de cálculo (M1)

El módulo más importante y el que más se beneficia de ir antes que la UI.
Funciones puras, sin base de datos, cubiertas por tests que replican casos del Excel.

- `convertPrice()` — §6.1, incluida la moneda «Otra»
- `resolveItemCode()` — §6.2
- `isItemCompleted()` — §6.3: suma de `Qty`, `Purchased`+`Savings`, `N/A`, y **combos**
- `qrhProgress()`, `globalProgress()`, `spendByQrh()`, `spendByPayer()`, `stageProgress()`
- `missionId()` — §6.5, con normalización de acentos
- **Criterio de aceptación:** cargar el escenario del Excel y obtener los mismos números

## Etapa 4 — Módulo Configuración (M2)

- Selector de moneda con las 7 monedas + «Otra» (símbolo y tasa manuales)
- Gestión de pagadores: 4 roles por defecto renombrables + hasta 3 adicionales
- Datos del bebé y apellidos → Flight Plan
- `Mission ID` calculado en vivo
- Al cambiar la moneda, **todos** los precios convertidos se recalculan (como el Excel)

## Etapa 5 — Módulo Inventario (M3)

La única pantalla de captura, y por lo tanto la que más cuidado de UX merece.

- Tabla con alta, edición y borrado en línea
- **Select en cascada**: al elegir QRH Category se filtran los Checklist Item de esa
  categoría (el `INDIRECT` del Excel)
- Precio + moneda de compra → precio convertido en vivo, en columna de sólo lectura
- Estado con los 4 colores del Excel; alerta naranja de la regla `Savings` + pagador ≠ Regalo
- Filtros y orden por categoría, estado, etapa y pagador (el `autoFilter` del Excel)
- Sin límite de 207 filas
- Vista de tarjetas en móvil — una tabla de 14 columnas no funciona en teléfono

## Etapa 6 — Módulo Checklists QRH (M4)

- 13 secciones con encabezado bilingüe, descripción y barra de progreso
- Estado `Completed` calculado por el motor de la Etapa 3
- Contador `comprado/necesario` y `Qty Needed` editable
- Marca `N/A` para excluir un ítem
- **QRH-007 y QRH-012 con casilla manual** (Yes/No), como en el Excel
- Al completarse un ítem, indicar **qué producto** lo completó — algo que el Excel
  no puede mostrar y que aquí es natural
- Notas por ítem

## Etapa 7 — Módulo Dashboard (M5)

- Flight Plan con `MISSION <id>`, aircraft, captain, first officer, passenger
- KPIs: % global de QRH y presupuesto total
- Tabla y gráfico de progreso y gasto por cada uno de los 13 QRH
- Gráfico ¿Quién paga? (7 pagadores + Savings)
- Gráfico de completado por etapa (6 etapas)
- Separación de *Gastado* vs *Proyectado* (hallazgo §9.1) — sujeto a su decisión

## Etapa 8 — Bienvenida y onboarding (M6)

- Contenido de la hoja `Bienvenida` como pantalla de inicio
- Asistente de primer uso: moneda → pagadores → datos del bebé, en ese orden
- Explicación de la nomenclatura de aviación

## Etapa 9 — Persistencia, cuentas y export

Se decide en la Etapa 2 si esto va desde el principio o al final.

- Cuentas y proyectos (una bitácora por bebé; varias familias)
- Compartir el proyecto entre mamá y papá
- Export a Excel/CSV — importante: es el formato que ya conocen sus clientas
- Importar un Excel existente para migrar a las usuarias que ya compraron la plantilla

## Etapa 10 — Pulido

Responsive completo, estados vacíos, accesibilidad, rendimiento, y despliegue.

---

## Dependencias

```
E1 Catálogo
   └─► E2 Fundaciones
          └─► E3 Motor ──┬─► E5 Inventario ──┬─► E6 Checklists ─┐
                         │                    │                  ├─► E7 Dashboard
              E4 Config ─┘                    └──────────────────┘
                                                   E8 Bienvenida
                                                   E9 Persistencia · E10 Pulido
```

E3 y E4 pueden avanzar en paralelo. E6 y E7 dependen de que E5 tenga datos reales.
