# Importar CSV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recuperar en la versión nueva los gastos de un CSV exportado por la versión vieja (o por la nueva), guardándolos automáticamente tras confirmar.

**Architecture:** Un parser CSV puro y la reconstrucción de gastos/viajes viven en `js/datos.js` y se prueban con `node:test`. La UI de Ajustes elige el archivo, enseña cuántos gastos ha leído y solo sustituye los gastos y viajes cuando el usuario confirma. Presupuesto, fijos, fondo y cambios de divisa no se tocan.

**Tech Stack:** JS puro, `FileReader`, `localStorage`, `node:test` + `node:vm`, Chrome headless para el flujo real.

**Spec:** No hay spec nueva; decisiones acordadas en conversación: aceptar CSV viejo (5 columnas) y nuevo (9), `;` o `,`, sustituir gastos, avisar antes, conservar el resto de ajustes.

## Global Constraints

- No añadir dependencias ni backend.
- No cambiar `CLAVE` (`erasmus_gastos_v1`).
- El CSV viejo solo trae fecha, categoría, cantidad, nota y estado de bizum.
- Tras importar se guarda sola; no hay paso intermedio manual.
- Si no hay ni un gasto válido, no se borra nada.
- Textos en español, tono actual.
- `sw.js` pasa a `CACHE = "gastos-v8"` al publicar.

## Review Focus

- CSV viejo con BOM, `;`, comas decimales, acentos y notas con `;` o comillas.
- CSV nuevo con `viaje`, `moneda`, `cantidad_original` y `cambio`: la divisa vuelve con su importe original.
- Bizum: `yo lo debo`, `me lo deben (pendiente)` y `me lo pagaron` se reconstruyen igual.
- Filas rotas o fechas inválidas: se saltan y se avisa; si no queda ninguna, no se sustituye nada.
- Confirmación: cancelar no toca los datos y confirmar guarda en `localStorage`.

---

### Task 1: Parser CSV y reconstrucción de gastos

**Files:**
- Modify: `js/datos.js`
- Test: `tests/app.test.js`

**Interfaces:**
- Produces: `parsearCSV(texto) → string[][]`; `gastosDesdeCSV(texto) → { gastos, viajes, saltadas } | { error }`.

- [ ] **Step 1: Write the failing test**

Añadir tests con un CSV viejo (BOM, `;`, nota con `;`, bizum pendiente), uno nuevo (`,`/divisa/viaje), fechas `DD/MM/AAAA`, categoría desconocida, filas inválidas y CSV vacío.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/app.test.js`
Expected: FAIL — `parsearCSV is not defined`.

- [ ] **Step 3: Implementar parser y reconstrucción**

`parsearCSV`: quitar BOM, normalizar saltos, detectar `;`/`,` fuera de comillas, respetar comillas dobles escapadas y saltos dentro de campos, descartar filas vacías.

`gastosDesdeCSV`: localizar columnas por cabecera normalizada (sin acentos), aceptar posición antigua si no hay cabecera, validar fecha y cantidad, categoría desconocida → `otros`, reconstruir bizum, divisa (solo con tasa válida) y viajes por nombre. Devolver `error` si no hay gastos.

- [ ] **Step 4: Run tests**

Run: `node --test tests/app.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/datos.js tests/app.test.js
git commit -m "feat: parser CSV y reconstrucción de gastos importados"
```

---

### Task 2: Importar desde Ajustes con confirmación

**Files:**
- Modify: `js/datos.js` (estado), `js/vistas.js` (`vistaAjustes`), `js/app.js` (acciones)
- Test: Chrome headless (flujo real de archivo)

**Interfaces:**
- Consumes: `gastosDesdeCSV`.
- Produces: `importPendiente`; `elegirCSV()`, `procesarCSV(input)`, `confirmarImportacion()`, `cancelarImportacion()`; `#input-csv`.

- [ ] **Step 1: Estado y acciones**

`importPendiente = null`. `procesarCSV` lee el archivo con `FileReader`, guarda el resultado en `importPendiente` y renderiza; si hay error, avisa. `confirmarImportacion` sustituye `datos.gastos` y `datos.viajes`, llama a `guardar()`, limpia el estado y avisa. `cancelarImportacion` solo limpia. `navegar` limpia `importPendiente`.

- [ ] **Step 2: UI en Ajustes**

Input oculto `#input-csv` y botón “⬆️ Importar CSV”. Si `importPendiente`, tarjeta de confirmación con nº de gastos/viajes, filas saltadas, aviso de que se sustituyen los gastos actuales y de que presupuesto/fijos/fondo no se tocan, botón de importar y botón de cancelar.

- [ ] **Step 3: Verificar en Chrome headless**

Simular un archivo real con `File` + `DataTransfer`, comprobar la tarjeta, cancelar (datos intactos), volver a importar, confirmar, recargar y comprobar que sigue guardado y que presupuesto/fijos/fondo no cambiaron.

- [ ] **Step 4: Commit**

```bash
git add js/datos.js js/vistas.js js/app.js
git commit -m "feat: importar CSV desde Ajustes con confirmación"
```

---

### Task 3: Caché, README y publicación

**Files:**
- Modify: `sw.js`, `README.md`, `js/vistas.js` (versión del pie)

- [ ] **Step 1: Caché `gastos-v8` y README**

Documentar el importador, su alcance (gastos y viajes; no presupuesto/fijos/fondo) y el formato aceptado.

- [ ] **Step 2: Revisión final independiente del diff**

Un revisor fresh-context revisa parser, compatibilidad y flujo de confirmación; corregir lo crítico/importante con tests.

- [ ] **Step 3: Verificar y publicar**

`node --test tests/app.test.js` en verde, comprobar en Chrome, fusionar y subir solo con el OK del usuario.
