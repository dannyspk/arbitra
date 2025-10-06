import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const backend = (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')) || 'http://127.0.0.1:8000'
  const url = `${backend}/api/hotcoins`
  try {
    const r = await fetch(url, { method: req.method, headers: { 'Accept': 'application/json' } })
    const data = await r.text()
    // forward status and body
    res.status(r.status).setHeader('content-type', r.headers.get('content-type') || 'application/json')
    res.send(data)
  } catch (err: any) {
    res.status(502).json({ error: 'bad-gateway', detail: String(err) })
  }
}
