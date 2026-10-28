// Today's site password: HMAC(PASSWORD_SEED, date in Madrid) mapped to four
// food words and two digits. Every deploy on the same day gets the same one.
const WORDS = [
  'aceite', 'aceituna', 'acelga', 'ajo', 'albahaca', 'alcachofa', 'almendra', 'alubia',
  'anchoa', 'anis', 'apio', 'arroz', 'atun', 'avellana', 'avena', 'azafran',
  'azucar', 'bacalao', 'berenjena', 'bizcocho', 'boniato', 'brocoli', 'cacao', 'cafe',
  'calabaza', 'calamar', 'canela', 'caqui', 'cebada', 'cebolla', 'cereza', 'chirimoya',
  'chocolate', 'chorizo', 'ciruela', 'coco', 'coliflor', 'comino', 'cordero', 'croqueta',
  'dorada', 'empanada', 'endibia', 'eneldo', 'espinaca', 'fideo', 'flan', 'frambuesa',
  'fresa', 'galleta', 'garbanzo', 'gamba', 'granada', 'guisante', 'haba', 'harina',
  'helado', 'higo', 'hinojo', 'huevo', 'jamon', 'judia', 'kiwi', 'laurel',
  'leche', 'lechuga', 'lenteja', 'lima', 'limon', 'lomo', 'lubina', 'maiz',
  'mango', 'manzana', 'mejillon', 'melocoton', 'melon', 'membrillo', 'menta', 'merluza',
  'miel', 'mora', 'mostaza', 'nabo', 'naranja', 'nata', 'nuez', 'oregano',
  'ostra', 'paella', 'pan', 'papaya', 'pasa', 'pasta', 'patata', 'pavo',
  'pepino', 'pera', 'perejil', 'pimienta', 'pimiento', 'pistacho', 'platano', 'pollo',
  'pomelo', 'puerro', 'queso', 'rabano', 'salmon', 'sandia', 'sardina', 'seta',
  'sesamo', 'sopa', 'tomate', 'tomillo', 'torrija', 'trigo', 'trucha', 'turron',
  'uva', 'vainilla', 'yogur', 'zanahoria', 'zumo', 'quinoa', 'tofu', 'brioche',
]

if (WORDS.length !== 128) throw new Error(`La lista de palabras debe tener 128, tiene ${WORDS.length}`)

export async function dailyPassword(seed, date = new Date()) {
  const day = date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(seed), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(day)))
  const words = [0, 1, 2, 3].map((i) => WORDS[bytes[i] % WORDS.length])
  return `${words.join('-')}-${String(bytes[4] % 100).padStart(2, '0')}`
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const seed = process.env.PASSWORD_SEED
  if (!seed) throw new Error('Falta PASSWORD_SEED')
  console.log(await dailyPassword(seed))
}
