# Diseño — Viajes, divisas y categorías nuevas

Fecha: 2026-11-16
Estado: aprobado en conversación (enfoques A para viajes y A para divisas)

## Para qué

App personal de gastos del Erasmus (PWA, un solo móvil, sin backend). Hoy todo se
apunta en euros y no hay forma de saber cuánto ha costado una escapada concreta,
ni de apuntar un gasto pagado en otra moneda. Faltan además dos categorías que se
usan de verdad: tabaco y alojamiento.

## Objetivos

1. Categorías nuevas `tabaco` (🚬) y `alojamiento` (🛏️) disponibles en el
   formulario, los filtros y los gráficos, como cualquier otra.
2. Apuntar un gasto en otra divisa, viendo al momento su equivalente en euros y
   guardándolo ya convertido. El euro es la única fuente de verdad para saldos,
   presupuesto, gráficos y bodega.
3. Viajes: crear viajes desde Inicio, verlos con su estado y su coste total,
   abrirlos, empezarlos y terminarlos. Mientras un viaje está en curso se le
   pueden enganchar gastos nuevos. Vuelos (`viajes`) y alojamiento pueden
   engancharse a un viaje en cualquier estado.
4. Compatibilidad total con los datos ya guardados en el móvil: nada se pierde ni
   hay que reimportar nada.

## No objetivos

- Tipos de cambio automáticos por API. El cambio se teclea a mano (decisión A).
- Presupuesto propio por viaje, avisos o gráficas de viajes.
- Empezar/terminar viajes automáticamente por fechas: lo marca la persona.
- Editar el importe o la divisa de un gasto ya guardado (se borra y se vuelve a
  apuntar, como hoy).
- Sincronización, copia en la nube o exportación distinta del CSV actual.
- Sacar los gastos de viaje del presupuesto mensual: siguen contando en su mes.

## Anti-objetivos (si pasa, está mal)

- Un gasto de viaje guardado dos veces (en `datos.gastos` y dentro del viaje).
- Cambiar la clave de `localStorage` o reescribir gastos viejos al arrancar.
- Que apuntar un gasto normal pase a requerir más de lo que requiere hoy: divisa
  EUR y "sin viaje" son el estado por defecto y no añaden campos visibles.
- Romper el funcionamiento offline o el uso desde la pantalla de inicio.

## Restricciones

- JS puro, sin build, sin dependencias, sin servidor. GitHub Pages estático.
- Persistencia en `localStorage`, clave `erasmus_gastos_v1` (no se toca).
- Barra inferior con 5 huecos ya ocupados: el detalle del viaje es una pantalla
  secundaria (`tab = "viaje"`), no una pestaña nueva.
- Móvil, ancho máximo 480 px, estilos y componentes existentes.
- Service worker cache-first: subir `CACHE` a `gastos-v7` para que la versión
  nueva llegue al móvil; los datos siguen en el mismo origen/URL.
- Misma URL en GitHub Pages ⇒ mismo `localStorage`: la actualización no borra
  nada.

## Enfoques considerados

**Viajes**
- A. El viaje es una etiqueta en el gasto (`gasto.viajeId`); el total del viaje
  es la suma de sus gastos. No duplica, no toca datos viejos, los gastos viejos
  se pueden enganchar después. **Elegido.**
- B. El viaje es un cajón con su propia lista de gastos. Total directo, pero los
  gastos de viaje dejarían de contar en el mes y los viejos no se reutilizan sin
  copiarlos. Descartado.

**Divisas**
- A. Cambio a mano al apuntar; se guarda el importe original y la tasa.
  **Elegido.**
- B. Tasa automática por API con caché de respaldo. Descartado: dependencia de
  red y más código para un uso esporádico.

## Modelo de datos

Se mantiene la clave `erasmus_gastos_v1` y la forma actual de `gastos`.

```
datos.viajes = [{
  id: "v" + Date.now() + rand,   // string
  nombre: "Interrail",           // obligatorio al crear
  desde: "YYYY-MM-DD" | "",      // opcional
  hasta: "YYYY-MM-DD" | "",      // opcional
  estado: "pendiente" | "curso" | "finalizado"
}]
```

Campos nuevos y opcionales en cada gasto (si faltan, el gasto es de siempre):

```
viajeId?: string                 // id de viaje; si no existe, se ignora
moneda?: string                  // código ISO; sin campo = EUR
cantidadOriginal?: number        // importe tecleado en esa divisa
tasa?: number                    // euros por 1 unidad de la divisa
```

`cantidad` sigue siendo **siempre euros** (redondeado a 2 decimales al guardar).
`efectivo(g)`, `gastosDelMes`, `totalDeMes`, gráficas y bodega no cambian: los
totales por mes ya salen bien. Los bizums no cambian.

Config nuevo, opcional y solo comodidad: `config.cambios = { GBP: 1.17, ... }`,
último cambio usado por divisa, para rellenar el campo la próxima vez. Se puede
editar siempre; no se consulta ninguna API.

### Migración (crítica)

- `INICIALES` gana `viajes: []`.
- Al cargar: `viajes` = array válido de `raw.viajes` normalizado (estado
  desconocido → `"pendiente"`, sin nombre → `"Viaje"`, fechas ausentes → `""`);
  si no hay, `[]`.
- `gastos` se conserva **tal cual**. Sin `viajeId` = sin viaje; sin `moneda` =
  euros; sin `tasa` = no aplica.
- `viajeId` que apunte a un viaje borrado/inexistente se trata como sin viaje al
  mostrarlo (y no se reescribe el gasto por ello).
- `config.cambios` ausente → `{}`.
- No se toca ningún importe ni fecha guardado. Los totales de meses pasados
  deben quedar idénticos.

## Pantallas

### Inicio

Debajo de las tres tarjetas de Fundido/Media/Proyección y antes de "Últimos
sablazos", tarjeta nueva:

```
✈️ Viajes                         [+ Nuevo]
🟢 Interrail Italia   · en curso
   12–16 nov · 4 gastos          348,20 €
⚪ Praga              · sin empezar
   23–26 ene · 1 gasto            89,00 €
```

- Orden: en curso primero, luego sin empezar, luego terminados. Dentro de cada
  grupo: por `desde` ascendente (los sin fecha al final); los terminados por
  `hasta` descendente (sin fecha al final). Empate: por `id`, que ya lleva marca
  de tiempo. Puede haber más de un viaje en curso a la vez (una escapada dentro
  de otra estancia); el selector los lista todos.
- Cada fila abre el detalle. Sin viajes: "Aún no hay viajes. Crea uno para saber
  cuánto te cuesta cada escapada."
- "+ Nuevo" despliega un formulario dentro de la tarjeta: nombre obligatorio,
  desde y hasta opcionales, botón "Crear viaje". Nada de pantallas nuevas para
  esto.

### Detalle del viaje (`tab = "viaje"`)

```
‹ Viajes
Interrail Italia
🟢 en curso · 12–16 nov
348,20 €            [ Terminar viaje ]

[ + Apuntar gasto ]  [ Añadir gasto ya apuntado ]

(vuelos, alojamiento, comidas… lista por fecha, borrables)

[ Borrar viaje ]  (dos toques, como los gastos)
```

- Botón de estado: `pendiente` → "Empezar viaje"; `curso` → "Terminar viaje";
  `finalizado` → "Reabrir" (vuelve a `curso`). Los botones **solo** cambian el
  estado: no rellenan ni tocan `desde`/`hasta`.
- Terminado: se oculta "+ Apuntar gasto" y aparece "Viaje cerrado: solo puedes
  añadir vuelos o alojamiento desde + eligiendo esa categoría". Así el selector
  normal deja de ofrecerlo, pero la excepción de vuelos/alojamiento se cumple.
- "Añadir gasto ya apuntado" está en los tres estados, pero su lista se filtra
  por la misma regla: en un viaje en curso ofrece gastos sin viaje de cualquier
  categoría; en uno pendiente o terminado, solo de `viajes` o `alojamiento`. Así
  un viaje cerrado no engorda con comidas. Cada fila de la lista tiene "+".
  Serve también para enganchar gastos anteriores a la actualización.
- Borrar viaje: sus gastos **no** se borran, solo pierden el `viajeId`.
- Cada gasto del detalle lleva una "✕" ("Quitar del viaje"): lo desengancha sin
  borrarlo, por si se engancha uno por error.
- Si el viaje no tiene fechas, la cabecera muestra solo el estado; no se inventan
  fechas.

### Añadir gasto

Orden de campos: cantidad, divisa (junto a la cantidad), categoría, fecha, nota,
viaje, botón.

- Divisa: `<select>` con EUR por defecto y una lista corta de monedas habituales
  (USD, GBP, CHF, PLN, CZK, HUF, SEK, NOK, DKK, TRY, MAD, JPY…).
- Si la divisa no es EUR aparecen: `1 GBP = [__] €` (prellenado con
  `config.cambios` si existe) y una línea "≈ 23,40 €" que se actualiza al
  teclear. Guardar exige tasa > 0. Al guardar se recuerda la tasa en
  `config.cambios` y el aviso dice "Apuntado 23,40 € (20,00 GBP)".
- Viaje: `<select>` con "Sin viaje" por defecto. Opciones: los viajes en curso;
  además, si la categoría es `viajes` o `alojamiento`, todos los viajes
  (pendientes y terminados). Si el select deja de ser válido al cambiar de
  categoría, vuelve a "Sin viaje".
- Si se abre desde el detalle de un viaje en curso, el viaje viene
  preseleccionado; la fecha, la categoría y el resto igual que siempre.
- Euro y "sin viaje" no añaden ningún campo visible: el flujo de siempre queda
  igual de corto.

## Lógica

- `viajesOrdenados()`, `viajePorId(id)`, `gastosDeViaje(id)` (usa `efectivo`),
  `totalViaje(id)`.
- Fila de gasto: si `moneda` distinta de EUR, el subtítulo añade
  `· 20,00 GBP (1 GBP = 1,17 €)`; el importe grande sigue en euros.
- `filaGasto` se reutiliza en el detalle del viaje (con borrado).
- CSV: se añaden al final las columnas `viaje`, `moneda`, `cantidad_original`,
  `cambio`. Las columnas actuales y su orden no cambian.
- Ajustes: contador final de gastos sin cambios; no hace falta sección nueva.
- `Borrar todos los datos` reinicia también viajes y `cambios`.

## PWA y despliegue

- `sw.js`: `CACHE = "gastos-v7"` (los archivos cacheados son los mismos).
- `index.html` no necesita cambios: el detalle de viaje es una vista más.
- Publicación: commit en `main`, push a GitHub, Pages sirve la versión nueva. En
  el móvil puede hacer falta cerrar y reabrir la app una o dos veces para que el
  service worker coja v7. Los datos siguen ahí porque la URL y la clave no
  cambian.
- Vuelta atrás: revertir el commit y subir `CACHE` otra vez; los datos siguen
  siendo válidos porque los campos nuevos son opcionales.

## Verificación manual

1. Con datos reales ya guardados: abrir, comprobar que los totales de meses
   pasados son exactamente los de antes y que la app no pide nada.
2. Gasto en EUR sin viaje: mismo comportamiento que antes.
3. Gasto en GBP con tasa: se guarda en euros, el aviso muestra ambos importes, el
   gasto muestra el original, y el total del mes sube lo convertido.
4. Tasa vacía o 0 con divisa no EUR: no deja guardar y avisa.
5. Crear viaje sin fechas y con fechas; verlo en Inicio; abrirlo.
6. Viaje pendiente: no aparece en el selector de un gasto de comida; sí en uno de
   `viajes`/`alojamiento`.
7. Empezar viaje: aparece en el selector de cualquier categoría; apuntar un gasto
   desde el detalle viene con el viaje puesto; el total suma.
8. Terminar viaje: deja de aparecer para comida; sigue apareciendo para
   `viajes`/`alojamiento`; "Reabrir" funciona.
9. "Añadir gasto ya apuntado": enganchar un gasto viejo (creado antes del cambio)
   a un viaje en curso y ver que el total del viaje lo incluye sin duplicarlo en
   el mes. En un viaje terminado, un gasto de comida no aparece en la lista y uno
   de vuelo sí. La "✕" lo devuelve a normal.
10. Borrar viaje con gastos: los gastos siguen en su mes.
11. CSV: abre bien y trae las columnas nuevas.
12. Offline: recargar sin red y comprobar que abre y guarda.
13. Instalada en pantalla de inicio: misma comprobación con la versión nueva.

## Lo que queda a criterio de quien construye

- Emoji/colores exactos de `tabaco` y `alojamiento`, y su posición en la rejilla.
- Lista exacta de divisas ofrecidas y su orden.
- Textos y microcopy (siempre en español, tono informal actual).
- Si el detalle del viaje agrupa gastos por fecha o va en lista corrida.
- Cómo se ve el selector de "gastos ya apuntados" (scroll, buscador o lista
  corta) mientras quepa en móvil.
- Detalles de estilo dentro del sistema visual existente.
