// Gives every product a `type` (what it is, without brand, size or packaging)
// so the site can group "Leche entera Hacendado", "Leche Entera Brik 1 L
// Consum" and "Leche entera Dia Láctea pack 6 x 1 L" as one product.
//
// type      grouping key: the meaningful words, accent-free, singular, sorted
// typeName  label: the most common wording of the group, e.g. "Leche entera"

// Mercadona puts its own brands in the name with no brand field.
const KNOWN_BRANDS = [
  'hacendado', 'deliplus', 'bosque verde', 'compy', 'solcare', 'babysec', 'beauty cream',
  'consum', 'dia', 'eroski', 'eroski basic', 'eroski natur', 'eroski seleqtia', 'bonarea',
]

// Uppercase words that are not brands.
const NOT_BRANDS = new Set(['uht', 'bio', 'eco', 'xl', 'xxl', 'l', 'm', 's', 'xs', 'do', 'dop', 'igp', 'pvc', 'aove', 'ii', 'iii', 'iv'])

const STOPWORDS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'con', 'en', 'y', 'e', 'a', 'al', 'para', 'por', 'o', 'un', 'una'])

const PACKAGING = new Set([
  'pack', 'paquete', 'paq', 'brik', 'bric', 'brick', 'minibrik', 'tetrabrik', 'botella', 'botellin', 'garrafa',
  'lata', 'bote', 'tarro', 'frasco', 'bolsa', 'bandeja', 'caja', 'cubeta', 'malla', 'sobre', 'tarrina',
  'barqueta', 'estuche', 'envase', 'blister', 'granel', 'pieza', 'aprox', 'unidad', 'ud', 'uds', 'unid', 'formato',
  'ahorro', 'corte', 'peso', 'compra', 'minima', 'recambio', 'pet', 'vidrio', 'carton',
  'g', 'gr', 'grs', 'gramo', 'gramos', 'kg', 'kilo', 'kilos', 'lt', 'litro', 'litros', 'ml', 'cl', 'cc',
])

// Origin and marketing words that don't change what the product is.
const NOISE = new Set([
  'vaca', 'uht', 'espana', 'espanol', 'espanola', 'nacional', 'pais', 'vasco', 'cataluna', 'catalunya',
  'galicia', 'asturias', 'navarra', 'andalucia', 'valencia', 'origen', 'clasico', 'clasica', 'tradicional',
  'calidad', 'seleccion', 'receta', 'gama', 'nuevo', 'nueva', 'oferta', 'sabor', 'xl', 'xxl',
])

// A word only counts as a one-word brand when it mostly shows up as one (in a
// brand field or in UPPERCASE): "Pascual" does, "extra" and "natural" don't.
const BRAND_SHARE = 0.3

function stripAccents(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function words(text) {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}ºª%]+/u)
    .filter(Boolean)
}

// "huevos" → "huevo", "limones" → "limon", "macarrones" → "macarron".
function singular(word) {
  if (word.length <= 3 || !word.endsWith('s')) return word
  if (/[lnrdj]es$/.test(word)) return word.slice(0, -2)
  return word.slice(0, -1)
}

function keyWord(word) {
  return singular(stripAccents(word))
}

// Checked before and after dropping the plural: "país" must not become "pai".
function isFiller(word) {
  const plain = stripAccents(word)
  return [plain, singular(plain)].some(
    (w) => w.length < 2 || /\d/.test(w) || STOPWORDS.has(w) || PACKAGING.has(w) || NOISE.has(w),
  )
}

// Runs of UPPERCASE words, the way Eroski, Caprabo and Lidl write brands.
function uppercaseBrands(name) {
  const runs = []
  let run = []
  for (const word of name.split(/\s+/)) {
    const letters = word.replace(/[^\p{L}]/gu, '')
    const isBrand = letters.length >= 2 && letters === letters.toUpperCase() && !NOT_BRANDS.has(letters.toLowerCase())
    if (isBrand) run.push(word)
    else if (run.length) {
      runs.push(run.join(' '))
      run = []
    }
  }
  if (run.length) runs.push(run.join(' '))
  return runs
}

function count(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

function buildBrandIndex(products) {
  const frequency = new Map()
  const asBrand = new Map()
  const phrases = new Set(KNOWN_BRANDS)
  for (const p of products) {
    for (const t of new Set(words(p.name).map(keyWord))) count(frequency, t)
    const brandWords = new Set()
    for (const phrase of [p.brand, ...uppercaseBrands(p.name)].filter(Boolean)) {
      phrases.add(phrase)
      for (const t of words(phrase)) brandWords.add(keyWord(t))
    }
    for (const t of brandWords) count(asBrand, t)
  }
  const known = new Set(KNOWN_BRANDS.map((b) => words(b).map(keyWord).join(' ')))

  // Indexed by first word; longest phrases first so "eroski basic" wins over "eroski".
  const index = new Map()
  for (const phrase of phrases) {
    const tokens = words(phrase).map(keyWord)
    if (tokens.length === 0) continue
    if (tokens.length === 1 && !known.has(tokens[0])) {
      const seen = frequency.get(tokens[0]) ?? 0
      if (seen >= 5 && (asBrand.get(tokens[0]) ?? 0) / seen < BRAND_SHARE) continue
    }
    if (!index.has(tokens[0])) index.set(tokens[0], [])
    index.get(tokens[0]).push(tokens)
  }
  for (const list of index.values()) list.sort((a, b) => b.length - a.length)
  return index
}

function describe(name, brands) {
  const original = words(name)
  const keys = original.map(keyWord)
  const kept = []
  for (let i = 0; i < keys.length; i++) {
    // The first word says what the product is; it is never a brand.
    const brand = i > 0 && brands.get(keys[i])?.find((tokens) => tokens.every((t, j) => keys[i + j] === t))
    if (brand) {
      i += brand.length - 1
      continue
    }
    if (isFiller(original[i])) continue
    kept.push({ key: keys[i], word: original[i] })
  }
  if (kept.length === 0) return null
  return {
    key: [...new Set(kept.map((k) => k.key))].sort().join(' '),
    label: kept.map((k) => k.word).join(' '),
  }
}

export function assignTypes(products) {
  const brands = buildBrandIndex(products)
  const labels = new Map()
  for (const p of products) {
    const type = describe(p.name, brands) ?? { key: stripAccents(p.name.toLowerCase()), label: p.name.toLowerCase() }
    p.type = type.key
    if (!labels.has(type.key)) labels.set(type.key, new Map())
    const counts = labels.get(type.key)
    counts.set(type.label, (counts.get(type.label) ?? 0) + 1)
  }
  const names = new Map()
  for (const [key, counts] of labels) {
    const label = [...counts].sort((a, b) => b[1] - a[1])[0][0]
    names.set(key, label.charAt(0).toUpperCase() + label.slice(1))
  }
  for (const p of products) p.typeName = names.get(p.type)
  return products
}
