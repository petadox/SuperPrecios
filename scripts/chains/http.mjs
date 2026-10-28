export const USER_AGENT = 'SuperPrecios (uso personal)'

// Retries both error responses and network failures ("fetch failed"), and
// names the chain in the final error.
export async function retry(label, attempt) {
  for (let tries = 1; ; tries++) {
    try {
      return await attempt()
    } catch (e) {
      if (tries === 3) throw new Error(`${label}: ${e.message}`)
      await new Promise((resolve) => setTimeout(resolve, 2000 * tries))
    }
  }
}

export async function fetchOk(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { 'User-Agent': USER_AGENT, ...init.headers } })
  if (!res.ok) throw new Error(`${res.status} en ${url}`)
  return res
}
