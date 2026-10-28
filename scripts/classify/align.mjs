// Flags stretches where a subagent drifted: each line's classification fits
// the neighbouring product better than its own (it skipped or repeated a line,
// which the coverage check can't see).
// Usage: node scripts/classify/align.mjs <input.tsv> <collect output .json>
import { readFile } from 'node:fs/promises'

const [input, output] = process.argv.slice(2)
const lines = (await readFile(input, 'utf8')).trimEnd().split('\n').map((l) => l.split('\t'))
const result = JSON.parse(await readFile(output, 'utf8'))

const words = (text) =>
  new Set(
    String(text ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3),
  )
const fit = (row, r) => {
  if (!row || !r) return 0
  const have = words(`${row[1]} ${row[4] ?? ''}`)
  return [...words(`${r.type} ${r.brand} ${r.product}`)].filter((w) => have.has(w)).length
}

const flagged = []
for (let i = 0; i < lines.length; i++) {
  const r = result[lines[i][0]]
  const own = fit(lines[i], r)
  const neighbour = Math.max(fit(lines[i + 1], r), fit(lines[i - 1], r))
  if (neighbour > own) flagged.push(i)
}

// A drift shows as a run of flagged lines; isolated ones are look-alike neighbours.
const runs = []
let start = null
for (let k = 0; k < flagged.length; k++) {
  if (start === null) start = k
  const next = flagged[k + 1]
  if (next === undefined || next - flagged[k] > 2) {
    if (k - start >= 3) runs.push([flagged[start], flagged[k]])
    start = null
  }
}
for (const [a, b] of runs) {
  console.log(`posible desfase líneas ${lines[a][0]}–${lines[b][0]}`)
  for (const i of [a, a + 1, b]) console.log(`   ${lines[i][0]} ${lines[i][1].slice(0, 45)} → ${result[lines[i][0]].type}`)
}
console.log(runs.length ? `${runs.length} tramo(s) sospechoso(s)` : 'alineado')
