# Cuentas Erasmus 

App de control de gastos personal (PWA), pensada para móvil, con funcionamiento 100% offline. Nacida para llevar las cuentas durante una estancia Erasmus, pero sirve para cualquier presupuesto mensual.

El código está dividido en módulos ligeros (ver `Estructura`), más un service worker (`sw.js`) para que funcione sin conexión. Sin servidor, sin backend, sin dependencias: los datos viven en `localStorage` del navegador.

## Qué hace

- **Registro de gastos**: fijos (alquiler, suscripciones…) y variables por categorías con emojis, fecha y nota.
- **Bizum rápido**: entrada exprés para pagos tipo Bizum, sin campos intermedios.
- **Presupuesto mensual**: define un tope y la app te muestra cuánto llevas gastado y lo que queda.
- **Gráficas en SVG** (sin librerías): la caja del mes, gasto variable por día y comparativa de los últimos 6 meses.
- **Ajustes**: presupuesto, gastos fijos, foto de fondo personalizada.
- **Exportar a CSV**: descarga todos los datos en un clic.
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
├── sw.js        # service worker (caché offline)
├── icon.png     # icono de la PWA
└── fondo.jpg    # imagen de fondo por defecto (opcional)
```

## Estado del proyecto

**Terminado.** App estable en uso personal. Es una herramienta personal deliberadamente minimalista: no hay tests ni CI porque el alcance es un solo archivo sin backend. Mejoras posibles si algún día hiciera falta: sincronización multi-dispositivo, backup en la nube o autenticación — pero hoy no las necesita.

**Posibles mejoras** Conectar directamnete el bizum mediante api del banco, en caso de ofrecerse, añadir una capa de personalizacion y aimaciones.
