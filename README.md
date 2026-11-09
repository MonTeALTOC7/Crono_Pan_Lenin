# Crono_Pan_Lenin

Aplicación móvil Cronológico de Campo CASUR.

PWA de solo lectura para Pansaco (993) y Claudio Alberto Reyes Ruiz (25). Abre en suertes activas, conserva las demás en el catálogo y permite buscar por suerte, código o variedad. La ficha distingue el último corte registrado de la fecha de cosecha propuesta. La edad actual usa la más reciente entre último corte y siembra, con fecha base como respaldo.

Las tarjetas muestran el TCH estimado de la zafra actual (`tchEst2627`) para molienda y lo distinguen con un rango visual: bajo <45, medio 45–<70, alto ≥70. Cuando falta el valor, se muestra «—» y una tarjeta neutra. El TCH de la zafra anterior (`tch`) aparece en la ficha como TCH Z25/26. El color nunca sustituye el valor numérico.

## Fuente y corte inicial

- Maestro de Suertes de la App Negocios de Caña CASUR, datos de GitHub Pages contrastados con `main` en `1f9fe9aaef755a34e8cec2f2bbbfc487966fd1ab`.
- Versión `2026.10.25-aforo.1101`. Fecha de generación y fecha efectiva del aforo, 12 de octubre de 2026. El manifiesto oficial no consigna fecha de publicación.
- Pansaco, 42 activas de 49 en catálogo, 368.44 ha activas. Claudio Reyes, 3 activas de 3, 32.25 ha activas.
- La app usa un JSON reducido. El teléfono descarga exclusivamente esa copia y guarda la última versión válida. Cada recarga o comprobación consulta el último corte desplegado de esta PWA.

## Publicar en GitHub Pages

1. En el repositorio `MonTeALTOC7/Crono_Pan_Lenin`, subir estos archivos en una rama de trabajo y abrir un pull request.
2. En **Settings → Pages**, elegir **Deploy from a branch** y la rama autorizada con carpeta **/docs**. La app está preparada para servirse bajo la ruta del repositorio.
3. Abrir el enlace HTTPS desde Chrome o Safari y esperar **Disponible sin internet**. Usar **Instalar** en la app. En iPhone se agrega mediante **Compartir → Agregar a pantalla de inicio**.

En Android, abrir el enlace directamente en Chrome (no dentro de un visor de otra app). Cuando Chrome no ofrece su aviso nativo, el botón **Instalar** muestra de inmediato los pasos para usar **⋮ → Instalar aplicación** o **Agregar a pantalla principal**. El ZIP es código fuente, no un complemento instalable.

Verificar el alcance de visibilidad antes de activar Pages. Una página pública permite abrir el enlace sin autenticación.

## Actualizar el corte desde el Maestro

Ejecutar con Node.js 22 o superior:

```sh
node tools/sync-cronologico.mjs
```

El sincronizador verifica los hashes SHA-256 oficiales y la coincidencia de la generación, conserva solo las dos fincas por código e identidad y reemplaza la copia tras validar su alcance. Si el Maestro cambia durante la descarga o el archivo llega incompleto, el comando falla y conserva el corte local. Revisar el cambio en `docs/data/cronologico.json` y publicarlo con el flujo GitHub acordado. El teléfono obtiene el corte al reabrir o tocar actualizar con conexión.

Para una prueba local, servir `docs/` por HTTP en `localhost`. Para probar una generación ya descargada, pasar el directorio que contiene `integrity.json`, `version.json` y `cronologico.json` como argumento del sincronizador.
