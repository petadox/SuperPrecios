# SuperPrecios

Compara el precio por kilo, litro o unidad de los productos de varios supermercados.

Vue 3 + Vite, publicado en GitHub Pages. Los supermercados no permiten llamar a sus APIs desde el
navegador, así que una GitHub Action descarga los catálogos cada día (05:00 UTC), los guarda como
JSON en `public/data/` y vuelve a publicar la web.

## Desarrollo

```bash
npm install
npm run fetch   # descarga los precios a public/data/
npm run dev
```

## Cadenas

| Cadena    | Fuente                                   | Zona                                        |
| --------- | ---------------------------------------- | ------------------------------------------- |
| Mercadona | API interna de `tienda.mercadona.es`     | `MERCADONA_WAREHOUSE` (por defecto `bcn1`)  |
| Dia       | API interna de `www.dia.es` (menú sacado del HTML de una categoría) | CP por defecto de la web (28041) |
| Consum    | API interna de `tienda.consum.es` (catálogo completo paginado)       | Tienda online por defecto        |

Las peticiones se identifican como `SuperPrecios (uso personal)`. Si una cadena bloquea ese tipo
de peticiones (antibot), no se añade: no nos hacemos pasar por un navegador.

### Añadir una cadena

1. Crea `scripts/chains/<cadena>.mjs` que exporte `{ id, name, fetchProducts() }`.
   `fetchProducts()` devuelve `{ products, location }`, con cada producto en este formato:

   ```js
   {
     id: 'mercadona:4241',
     chain: 'mercadona',
     name: 'Aceite de oliva 0,4º Hacendado',
     format: 'Garrafa · 5 l',
     price: 17.25,       // precio del producto
     unitPrice: 3.45,    // precio por kg, L o ud
     unit: 'L',          // 'kg' | 'L' | 'ud' (u otra unidad si no se puede convertir)
     category: 'Aceite, especias y salsas',
     subcategory: 'Aceite, vinagre y sal',
     image: 'https://…',
     url: 'https://…',
   }
   ```

2. Añádela a `CHAINS` en `scripts/fetch-prices.mjs`.
3. Dale un color en `src/style.css` (`--chain-<id>` y `[data-chain='<id>']`).

## Despliegue

Cada push a `main`, la ejecución diaria y el botón *Run workflow* lanzan
`.github/workflows/deploy.yml`. Configuración inicial del repo: **Settings → Pages → Source:
GitHub Actions**.
