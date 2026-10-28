// Expands a subagent's range output and checks it covers every input line.
// Usage: node collect.mjs <input.tsv> <output prefix>   → prints problems and writes <prefix>.json
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

const [input, prefix] = process.argv.slice(2)
const inputLines = (await readFile(input, 'utf8')).trimEnd().split('\n')
const expected = inputLines.map((l) => Number(l.split('\t')[0]))

const dir = dirname(prefix)
const base = basename(prefix)
const parts = (await readdir(dir))
  .filter((f) => f.startsWith(`${base}.part`) && f.endsWith('.tsv'))
  .sort((a, b) => Number(a.match(/part(\d+)/)[1]) - Number(b.match(/part(\d+)/)[1]))

const result = new Map()
const problems = []
for (const part of parts) {
  for (const [i, line] of (await readFile(join(dir, part), 'utf8')).split('\n').entries()) {
    if (!line.trim()) continue
    const [range, type = '', brand = '', product = ''] = line.split('\t')
    const m = range.trim().match(/^(\d+)(?:-(\d+))?$/)
    if (!m || !type.trim()) {
      problems.push(`${part}:${i + 1} línea inválida: ${line.slice(0, 80)}`)
      continue
    }
    const from = Number(m[1])
    const to = Number(m[2] ?? m[1])
    for (let n = from; n <= to; n++) {
      if (result.has(n)) problems.push(`${n} repetido`)
      result.set(n, { type: type.trim(), brand: brand.trim(), product: product.trim() })
    }
  }
}
const missing = expected.filter((n) => !result.has(n))
const extra = [...result.keys()].filter((n) => !expected.includes(n))
if (missing.length) problems.push(`faltan ${missing.length}: ${missing.slice(0, 20).join(',')}`)
if (extra.length) problems.push(`sobran ${extra.length}: ${extra.slice(0, 20).join(',')}`)
await writeFile(`${prefix}.json`, JSON.stringify(Object.fromEntries(result)))
console.log(`${base}: ${parts.length} partes, ${result.size}/${expected.length} líneas`)
console.log(problems.length ? problems.slice(0, 30).join('\n') : 'OK')
