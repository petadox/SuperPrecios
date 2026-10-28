# SuperPrecios

Compara el precio por kilo, litro o unidad de los productos de varios supermercados.

Vue 3 + Vite, publicado en GitHub Pages. Los supermercados no permiten llamar a sus APIs desde el
navegador, así que una GitHub Action descarga los catálogos cada día (05:00 UTC) y vuelve a
publicar la web.

## Contraseña y datos cifrados

GitHub Pages es público, así que los precios se publican **cifrados** (AES-GCM, clave derivada con
PBKDF2) y el navegador los descifra con la contraseña. Sin ella no se pueden leer, aunque se
descarguen los ficheros de `data/`.

La contraseña **cambia cada día** (hora de Madrid): sale de `HMAC(PASSWORD_SEED, fecha)` y son
cuatro palabras de comida y dos cifras. Cada publicación la envía al móvil con
[ntfy](https://ntfy.sh): instala la app y suscríbete al canal guardado en el secreto `NTFY_TOPIC`.
Para verla en el Mac:

```bash
PASSWORD_SEED=$(cat ~/.config/superprecios/password-seed) npm run password
```

Secretos del repo (Settings → Secrets and variables → Actions):

| Secreto         | Para qué                                                        |
| --------------- | --------------------------------------------------------------- |
| `PASSWORD_SEED` | Semilla de la contraseña diaria                                  |
| `NTFY_TOPIC`    | Canal de ntfy al que llega la contraseña                         |
| `HOME_DATA_KEY` | Clave de los datos que se suben desde casa (rama `home-data`)    |

Copia local en `~/.config/superprecios/`.

## Tipos de producto

La búsqueda agrupa los productos que son lo mismo: "Leche entera Hacendado", "Leche Entera Brik
1 L Consum" y "Leche entera Dia Láctea pack 6 x 1 L" van a la tarjeta *Leche entera*, y buscando
"coca cola" sale una tarjeta *Coca-Cola* con el precio de cada supermercado. La clasificación la
hace Claude a mano, una vez, y se guarda cifrada en `classification.bin`: ver
[CLASIFICACION.md](CLASIFICACION.md).

Las tarjetas se ordenan en `src/search.js`: la que es exactamente lo buscado, luego las que
empiezan por lo buscado, y dentro de cada nivel las que están en más supermercados.

## Desarrollo

```bash
npm install
npm run fetch                      # descarga todas las cadenas a data/ (sin cifrar, no se publica)
npm run fetch -- dia lidl          # solo esas cadenas, conserva las demás
SITE_PASSWORD=prueba npm run encrypt   # cifra data/ en public/data/
npm run dev
```

## Cadenas

| Cadena    | Fuente                                                                               | Zona                                       |
| --------- | ------------------------------------------------------------------------------------ | ------------------------------------------ |
| Mercadona | API interna de `tienda.mercadona.es`                                                 | `MERCADONA_WAREHOUSE` (por defecto `bcn1`) |
| Dia       | API interna de `www.dia.es` (menú sacado del HTML de una categoría)                  | CP por defecto de la web (28041)           |
| Consum    | API interna de `tienda.consum.es` (catálogo completo paginado)                       | Tienda online por defecto                  |
| Eroski    | HTML de `supermercado.eroski.es`, solo alimentación y bebidas. Precio por kg/L de la tarjeta cuando lo muestra; si no, deducido de la cantidad del nombre | Tienda online por defecto |
| Caprabo   | Igual que Eroski (mismo grupo y misma web): `capraboacasa.com`                       | Tienda online por defecto                  |
| bonÀrea   | `POST /es/shop/ShoppingBody` de `bonarea-online.com` (la llamada de solo lectura de su web) | Tienda online                        |
| Lidl      | Solo las **ofertas semanales** de alimentación de `lidl.es`: no vende comida online  | Ofertas de la semana                       |

**Eroski y Caprabo** bloquean los servidores de GitHub (403), así que se descargan desde casa con
`scripts/fetch-at-home.sh` y llegan a la Action cifrados con `HOME_DATA_KEY` en la rama
`home-data`.

Las peticiones se identifican como `SuperPrecios (uso personal)`; no nos hacemos pasar por un
navegador. Cadenas que no están porque su cortafuegos rechaza las peticiones identificadas:
Alcampo y Bonpreu/Esclat (Ocado tras CloudFront, aunque su robots.txt permite rastrear),
Carrefour y Alimerka (Cloudflare). Aldi no vende alimentación online en España.

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

   Si la cantidad solo viene en texto ("pack 6x1 litro"), usa `parseQuantity` de
   `scripts/chains/quantity.mjs`.

2. Añádela a `CHAINS` en `scripts/fetch-prices.mjs`.
3. Dale un color en `src/style.css` (`--chain-<id>` y `[data-chain='<id>']`).

## Despliegue

Cada push a `main`, la ejecución diaria y el botón *Run workflow* lanzan
`.github/workflows/deploy.yml`: trae `home-data`, descarga el resto, cifra con la contraseña del
día, publica en Pages y la envía por ntfy.
