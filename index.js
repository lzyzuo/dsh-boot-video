import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

export const inject = ['webServer']

const BASE = '/boot-animation'
const DEFAULT_VIDEO = fileURLToPath(new URL('./media/boot.mp4', import.meta.url))

function resolveVideo(config) {
  const raw = typeof config?.file === 'string' ? config.file.trim() : ''
  if (!raw) return DEFAULT_VIDEO
  if (isAbsolute(raw)) return raw
  try {
    return fileURLToPath(new URL(raw, import.meta.url))
  } catch {
    return DEFAULT_VIDEO
  }
}

/** A boot video is only usable when it exists and has bytes in it. */
async function fileReady(file) {
  try {
    const info = await stat(file)
    return info.isFile() && info.size > 0
  } catch {
    return false
  }
}

/** Parse a single `bytes=` range against a known file size. */
function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim())
  if (!m) return { invalid: true }
  const hasStart = m[1] !== ''
  const hasEnd = m[2] !== ''
  if (!hasStart && !hasEnd) return { invalid: true }
  if (!hasStart) {
    const suffix = Number(m[2])
    if (!Number.isFinite(suffix) || suffix <= 0) return { invalid: true }
    const start = Math.max(size - suffix, 0)
    return { start, end: size - 1 }
  }
  const start = Number(m[1])
  const end = hasEnd ? Number(m[2]) : size - 1
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return { unsatisfiable: true }
  }
  return { start, end: Math.min(end, size - 1) }
}

async function serveVideo(req, res, file) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405
    res.setHeader('Allow', 'GET, HEAD')
    res.end()
    return
  }
  let info
  try {
    info = await stat(file)
  } catch {
    res.statusCode = 404
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('boot video not found')
    return
  }
  if (!info.isFile()) {
    res.statusCode = 404
    res.end()
    return
  }
  const size = info.size
  res.setHeader('Content-Type', 'video/mp4')
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Cache-Control', 'public, max-age=600')

  const range = req.headers.range
  if (!range) {
    res.statusCode = 200
    res.setHeader('Content-Length', String(size))
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    const stream = createReadStream(file)
    stream.on('error', () => {
      try { res.destroy() } catch {}
    })
    res.on('close', () => stream.destroy())
    stream.pipe(res)
    return
  }

  const parsed = parseRange(range, size)
  if (parsed.invalid) {
    res.statusCode = 400
    res.setHeader('Content-Length', '0')
    res.end()
    return
  }
  if (parsed.unsatisfiable) {
    res.statusCode = 416
    res.setHeader('Content-Range', `bytes */${size}`)
    res.setHeader('Content-Length', '0')
    res.end()
    return
  }

  const { start, end } = parsed
  res.statusCode = 206
  res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
  res.setHeader('Content-Length', String(end - start + 1))
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  const stream = createReadStream(file, { start, end })
  stream.on('error', () => {
    try { res.destroy() } catch {}
  })
  res.on('close', () => stream.destroy())
  stream.pipe(res)
}

export function apply(ctx, config) {
  const enabled = config?.enabled !== false
  const sound = config?.sound !== false
  const file = resolveVideo(config)

  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'exact',
      path: `${BASE}/status.json`,
      handler(req, res) {
        void (async () => {
          // `ready` lets the client skip the overlay entirely (no black flash)
          // when no boot video has been installed yet.
          const ready = enabled ? await fileReady(file) : false
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.end(JSON.stringify({ enabled, sound, ready }))
        })()
      },
    }),
  )

  if (!enabled) return

  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'exact',
      path: `${BASE}/video.mp4`,
      handler(req, res) {
        void serveVideo(req, res, file)
      },
    }),
  )
}
