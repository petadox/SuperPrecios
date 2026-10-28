# Clasificación de productos de supermercado

Clasificas productos de supermercados españoles (Mercadona, Dia, Consum, Eroski, Caprabo, bonÀrea,
Lidl) para un comparador de precios. El objetivo: que los productos que son **lo mismo** queden
juntos para comparar su precio por kg, litro o unidad entre supermercados.

## Entrada

Un fichero TSV, una línea por producto:

```
número <TAB> nombre <TAB> formato (puede estar vacío) <TAB> categoría del supermercado <TAB> pista de marca (puede estar vacía)
```

Las líneas están ordenadas por familia de producto, así que los productos parecidos van seguidos.

## Qué decides para cada producto

### 1. `tipo` — qué es el producto, sin marca

Nombre genérico en español, con mayúscula solo al principio (salvo nombres propios). Dos productos
del mismo tipo deben ser intercambiables al comparar precio por kg/L/ud.

**Incluye** lo que cambia el producto:
- la clase de producto: "Leche", "Refresco de cola", "Aceite de oliva virgen extra", "Detergente líquido para ropa";
- la variante: entera / semidesnatada / desnatada; sin lactosa; sin azúcar o zero; light; sin cafeína;
  descafeinado; sin gluten; integral; ecológico; sabor o variedad (fresa, natural, limón, arbequina,
  basmati); especie si no es la habitual (cabra, oveja; la vaca no se indica); pieza o corte en carne y
  pescado (pechuga, muslo, lomo, filete); presentación que cambia el producto (molido, en grano,
  soluble, en cápsulas, en polvo, rallado, en lonchas, congelado, en conserva, en aceite de oliva,
  al natural); talla y cría en huevos ("Huevos L", "Huevos camperos M"); en vinos, el color y la D.O.
  ("Vino tinto D.O. Rioja crianza").

**No incluyas**: la marca o el nombre comercial, el tamaño, el peso, el volumen, el número de
unidades, el envase (brik, lata, botella, pack, bandeja, garrafa), el origen geográfico (salvo
denominaciones que definen el producto: jamón ibérico, queso manchego, D.O. de vinos), ni ediciones
especiales o licencias (Gremlins, Navidad, Disney).

Ejemplos:
- "Leche entera Hacendado", "Leche Entera Brik 1 L Pascual", "Leche entera Dia Láctea pack 6 x 1 L" → `Leche entera`
- "Leche semidesnatada sin lactosa KAIKU, brik 1 litro" → `Leche semidesnatada sin lactosa`
- "Refresco Coca-Cola", "Coca-Cola 12 x 330 ml", "Refresco de cola Hacendado" → `Refresco de cola`
- "Coca-Cola zero azúcar 2 L", "Refresco cola Zero Hacendado" → `Refresco de cola sin azúcar`
- "Coca-Cola zero azúcar zero cafeína" → `Refresco de cola sin azúcar y sin cafeína`
- "Chocolate con leche y almendras enteras Hacendado" → `Chocolate con leche y almendras`
- "Atún claro en aceite de oliva CALVO, pack 3x80 g" → `Atún claro en aceite de oliva`

**Consistencia**: dentro de tu lote, usa exactamente el mismo texto para el mismo tipo (cópialo, no
lo reformules). Prefiere el nombre más habitual y simple.

**Conciso**: quédate con los uno o dos atributos que de verdad cambian el producto; las alegaciones
de marketing no ("+Proteínas 10 g 0% MG" → "Flan de huevo alto en proteínas", no la lista entera).
Desarrolla abreviaturas ("v. extra" → "virgen extra", "s/lactosa" → "sin lactosa").

### 2. `marca` — la marca, escrita de forma canónica

Como se escribe normalmente: "Coca-Cola", "Central Lechera Asturiana", "Pascual", "Hacendado",
"Deliplus", "Bosque Verde", "Dia", "Consum", "Eroski", "bonÀrea", "Milbona". Usa la pista de la
columna 5 si la hay (normaliza mayúsculas: "COCA-COLA" → "Coca-Cola"). En Mercadona la marca suele
ir al final del nombre. Vacía si no tiene (fruta a granel, carnicería, pescadería…).

### 3. `producto` — solo para productos de marca con nombre comercial propio

Rellénalo cuando el producto tiene un nombre comercial que lo identifica por sí solo y por el que la
gente lo busca: "Coca-Cola", "Coca-Cola Zero", "Coca-Cola Zero Zero", "Coca-Cola Light", "Pepsi",
"Pepsi Max", "Fanta Naranja", "Aquarius Limón", "Red Bull", "Nutella", "Nocilla", "Cola Cao",
"Nesquik", "Kit Kat", "Oreo", "Pringles Original", "Actimel", "Danonino", "Kinder Bueno".
Sin tamaño ni envase, y el mismo texto para todos los formatos (lata, botella, pack…).

Solo para marcas y líneas que cualquier persona reconoce por su nombre; ante la duda, vacío.

Déjalo **vacío** para marcas blancas (Hacendado, Dia, Consum, Eroski, bonÀrea, Milbona…), para
productos sin marca y cuando la marca solo acompaña a un producto genérico ("Leche entera Pascual",
"Atún claro Calvo", "Aceite de oliva Carbonell" → vacío).

## Salida

Un TSV sin cabecera, en el orden de la entrada:

```
rango <TAB> tipo <TAB> marca <TAB> producto
```

- `rango` es un número (`17`) o un rango de líneas **consecutivas** con exactamente los mismos tres
  valores (`17-23`). Usa rangos siempre que puedas: ahorra mucho.
- Cada número de la entrada debe aparecer **exactamente una vez**.
- Campos vacíos: deja el campo vacío pero conserva los tabuladores.
- Nada de comentarios ni líneas extra.

Escribe la salida con la herramienta Write, en partes de unas 400 líneas de salida:
`<nombre>.part1.tsv`, `<nombre>.part2.tsv`… Clasifica tú cada producto leyendo su nombre (no
escribas scripts que adivinen tipos con reglas). El criterio ya está decidido aquí: aplícalo con
agilidad, sin deliberar largo cada línea; reserva la reflexión para los casos de verdad dudosos.

**Cuidado con desfasarte.** Cada número de salida debe corresponder exactamente al producto de esa
línea de entrada. Si te saltas una línea, todo lo que sigue queda desplazado y el script de
cobertura no lo detecta. Después de escribir cada parte, coge 5 números al azar de esa parte y
comprueba con `grep` en la entrada que el producto de ese número es el que has clasificado.

Cada llamada a Write debe tener como máximo unas 300 líneas de salida.

Al terminar, comprueba la cobertura con el script que te indiquen y corrige lo que falte o sobre
hasta que diga `OK`.
