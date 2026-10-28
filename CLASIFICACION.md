# Clasificación de productos

La web agrupa los productos que son lo mismo gracias a una clasificación hecha **una vez** por
Claude (Claude Code con subagentes Sonnet), sin API. Se guarda cifrada en `classification.bin` con
`HOME_DATA_KEY` y la descarga diaria solo la aplica.

Cada nombre de producto tiene:

| Campo      | Ejemplo                         | Para qué                                            |
| ---------- | ------------------------------- | --------------------------------------------------- |
| `type`     | Refresco de cola sin azúcar     | Tarjeta genérica: junta todas las marcas            |
| `brand`    | Coca-Cola                       | Búsqueda por marca                                  |
| `product`  | Coca-Cola Zero                  | Tarjeta propia cuando se busca ese producto de marca |

Los productos nuevos sin clasificar aparecen sueltos, con su nombre. La ejecución diaria cuenta
cuántos hay y, a partir de 300, avisa por ntfy: «Hay N productos nuevos sin clasificar».

## Cómo hacer una ronda (para Claude)

Cuando el usuario lo pida tras el aviso:

1. Descarga los precios de todas las cadenas desde el Mac (Eroski y Caprabo solo funcionan desde
   casa):

   ```bash
   npm run fetch
   ```

2. Prepara los nombres sin clasificar, en bloques de unas 2.000 líneas:

   ```bash
   HOME_DATA_KEY="$(cat ~/.config/superprecios/home-data-key)" node scripts/classify/prepare.mjs
   ```

3. Lanza un subagente Sonnet por bloque, en paralelo. Cada uno lee
   `scripts/classify/INSTRUCCIONES.md`, clasifica `classify-work/chunks/chunk-NN.tsv`, escribe
   `classify-work/out/chunk-NN.partN.tsv` y comprueba la cobertura hasta que diga `OK`:

   ```bash
   node scripts/classify/collect.mjs classify-work/chunks/chunk-NN.tsv classify-work/out/chunk-NN
   ```

   Si hay pocos productos (unos cientos), basta un solo subagente.

4. Comprueba que ningún subagente se ha desfasado: si se salta una línea, todo lo que sigue queda
   con la clasificación del producto de al lado y la cobertura sigue diciendo `OK`.

   ```bash
   node scripts/classify/align.mjs classify-work/chunks/chunk-NN.tsv classify-work/out/chunk-NN.json
   ```

   Los tramos cortos de productos casi idénticos son falsos positivos. Un tramo largo es un
   desfase: borra esas líneas del `.json`, ponlas en `chunks/chunk-NNb.tsv` y reclasifícalas.

5. Revisa una muestra a mano y fusiona los resultados con la clasificación existente:

   ```bash
   HOME_DATA_KEY="$(cat ~/.config/superprecios/home-data-key)" node scripts/classify/merge.mjs
   ```

   `merge.mjs` unifica los valores que solo difieren en mayúsculas, acentos o palabras de enlace
   («Leche entera con calcio» = «Leche entera calcio»).

6. Haz commit de `classification.bin` y push: la publicación aplicará la nueva clasificación.

Mantén el criterio de `INSTRUCCIONES.md`; si cambia, reclasificar todo es la única forma de que siga
siendo coherente (`rm classification.bin` y repetir la ronda).
