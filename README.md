# Cuentas Erasmus 

App de control de gastos personal (PWA), pensada para móvil, con funcionamiento 100% offline. Nacida para llevar las cuentas durante una estancia Erasmus, pero sirve para cualquier presupuesto mensual.

El código está dividido en módulos ligeros (ver `Estructura`), más un service worker (`sw.js`) para que funcione sin conexión. Sin servidor, sin backend, sin dependencias: los datos viven en `localStorage` del navegador.

## Qué hace

- **Registro de gastos**: fijos (alquiler, suscripciones…) y variables por categorías con emojis, fecha y nota. Incluye tabaco y alojamiento.
- **Gastos en otra divisa**: se apunta el importe en la moneda que sea y su equivalente en euros con el cambio a mano; lo guardado siempre suma en euros.
- **Viajes**: se crean desde Inicio, se pueden empezar y terminar, y tienen su propio total. Un gasto se puede enganchar a un viaje en curso, y los de vuelos y alojamiento a cualquiera. Los gastos anteriores también se pueden enganchar después.
- **Bizum rápido**: entrada exprés para pagos tipo Bizum, sin campos intermedios.
- **Presupuesto mensual**: define un tope y la app te muestra cuánto llevas gastado y lo que queda.
- **Gráficas en SVG** (sin librerías): la caja del mes, gasto variable por día y comparativa de los últimos 6 meses.
- **Ajustes**: presupuesto, gastos fijos, foto de fondo personalizada.
- **Exportar a CSV**: descarga los gastos (con viaje y divisa) en un clic.
- **Importar CSV**: recupera los gastos de un CSV exportado por esta versión o por la antigua. Acepta `;` o `,` y enseña cuántos va a importar antes de sustituir los actuales. No toca presupuesto, gastos fijos ni fondo.
- **PWA offline**: se instala en la pantalla de inicio del móvil y funciona sin conexión (cache-first).

## Cómo usarla

No requiere build ni instalación de dependencias. Dos opciones:

**Opción A — abrir directo (desarrollo):**

```bash
python3 -m http.server 8000
# abre http://localhost:8000 en el navegador
```

**Opción B — desplegar (recomendado para el móvil):**

Sube la carpeta a cualquier hosting estático (GitHub Pages, Netlify, Vercel…) y abre la URL desde el móvil. La PWA se podrá instalar en la pantalla de inicio.

- Por defecto ya esta en: "https://marcos-truchado.github.io/cartera_gastos/"

## Estructura

```
cartera_gastos/
├── index.html       # estructura de la app (solo HTML)
├── css/estilos.css  # estilos
├── js/
│   ├── util.js      # utilidades (formato, fechas, avisos)
│   ├── datos.js     # constantes, estado y persistencia
│   ├── graficas.js  # gráficas SVG
│   ├── vistas.js    # pantallas (inicio, añadir, bodega, números, ajustes)
│   └── app.js       # lógica: navegación, acciones, render
├── tests/
│   └── app.test.js  # pruebas de la lógica (node:test, sin dependencias)
├── sw.js        # service worker (caché offline)
├── icon.png     # icono de la PWA
└── fondo.jpg    # imagen de fondo por defecto (opcional)
```

## Tests

```bash
node --test tests/app.test.js
```

Sin instalar nada: usa `node:test` y carga `js/util.js`, `js/datos.js` y `js/vistas.js` en un contexto aislado con un `localStorage` simulado. Cubre la compatibilidad con datos antiguos, la conversión de divisas, las reglas de viajes, el CSV y la importación.

## Estado del proyecto

**Terminado.** App estable en uso personal. Es una herramienta personal deliberadamente minimalista: sin backend y sin dependencias. La lógica pura tiene tests (`node --test`); las vistas se comprueban a mano en el navegador. Mejoras posibles si algún día hiciera falta: sincronización multi-dispositivo, backup en la nube o autenticación — pero hoy no las necesita.

**Posibles mejoras** Conectar directamnete el bizum mediante api del banco, en caso de ofrecerse, añadir una capa de personalizacion y aimaciones.
