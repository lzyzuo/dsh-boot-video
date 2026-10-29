window.__ModuleLoader__.load({
  id: '@local/dsh-boot-animation',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'bootAnimation'
    const STATUS_SRC = '/boot-animation/status.json'
    const VIDEO_SRC = '/boot-animation/video.mp4'
    const FADE_MS = 650
    const HARD_CAP_MS = 26000
    const STATUS_GUARD_MS = 2500
    const ERROR_GRACE_MS = 900
    const HINT_DELAY_MS = 1200

    const DICTS = {
      zh: { hint: '点击任意处跳过', mute: '静音', unmute: '取消静音' },
      en: { hint: 'Click anywhere to skip', mute: 'Mute', unmute: 'Unmute' },
    }

    /** One boot animation per page load: a reload counts as a restart, a re-render does not. */
    let pageBooted = false

    const CSS = [
      '.dsha-root{position:fixed;inset:0;z-index:2147483000;background:#000;overflow:hidden;pointer-events:auto;opacity:0;transition:opacity ' + FADE_MS + 'ms cubic-bezier(.4,0,.2,1)}',
      '.dsha-root[data-phase="in"]{animation:dsha-in 460ms ease-out both}',
      '.dsha-root[data-phase="out"]{opacity:0}',
      '@keyframes dsha-in{from{opacity:0}to{opacity:1}}',
      '.dsha-video{display:block;width:100%;height:100%;object-fit:cover;background:#000}',
      '.dsha-vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(125% 95% at 50% 46%,transparent 42%,rgba(0,0,0,.5) 100%)}',
      '.dsha-bottom{position:absolute;left:0;right:0;bottom:0;height:132px;pointer-events:none;background:linear-gradient(to top,rgba(0,0,0,.55),transparent)}',
      '.dsha-bar{position:absolute;left:0;right:0;bottom:0;height:2px;background:rgba(255,255,255,.14);pointer-events:none}',
      '.dsha-bar>i{display:block;height:100%;width:0;background:linear-gradient(90deg,#7fc4ff,#e8c37a);box-shadow:0 0 10px rgba(232,195,122,.55);transition:width 180ms linear}',
      '.dsha-hint{position:absolute;right:30px;bottom:26px;font-size:12px;font-weight:500;line-height:1.4;letter-spacing:.18em;color:rgba(233,238,247,.7);opacity:0;transition:opacity 520ms ease;pointer-events:none;text-shadow:0 1px 6px rgba(0,0,0,.6)}',
      '.dsha-hint[data-on="1"]{opacity:1}',
      '.dsha-mute{position:absolute;left:26px;bottom:22px;display:flex;align-items:center;gap:7px;padding:6px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(8,12,20,.42);backdrop-filter:blur(6px);color:rgba(233,238,247,.82);font-size:12px;font-weight:500;line-height:1;letter-spacing:.08em;cursor:pointer;opacity:.55;transition:opacity 200ms ease,background 200ms ease}',
      '.dsha-mute:hover{opacity:1;background:rgba(8,12,20,.7)}',
      '.dsha-mute:focus-visible{outline:2px solid #7fc4ff;outline-offset:2px}',
    ].join('\n')

    function BootLayer(props) {
      const t = props.t
      const [mode, setMode] = React.useState(() => (pageBooted ? 'done' : 'pending'))
      const [phase, setPhase] = React.useState('in')
      const [progress, setProgress] = React.useState(0)
      const [muted, setMuted] = React.useState(false)
      const [hint, setHint] = React.useState(false)
      const videoRef = React.useRef(null)
      const finishedRef = React.useRef(false)
      const soundRef = React.useRef(true)

      const finish = React.useCallback(() => {
        if (finishedRef.current) return
        finishedRef.current = true
        const v = videoRef.current
        if (v) {
          try { v.pause() } catch {}
        }
        setPhase('out')
        window.setTimeout(() => setMode('done'), FADE_MS)
      }, [])

      // Ask the host whether the animation is enabled before showing anything.
      React.useEffect(() => {
        if (mode !== 'pending') return
        let alive = true
        const controller = new AbortController()
        const settle = (ok, sound, ready) => {
          if (!alive) return
          if (!ok || !ready) {
            pageBooted = true
            if (ok && !ready) {
              console.info('[boot-animation] 没有找到开机视频，已跳过。把 mp4 放到插件目录的 media/boot.mp4，或在配置里设置 file。')
            }
            setMode('done')
            return
          }
          soundRef.current = sound
          setMuted(!sound)
          setMode('playing')
        }
        fetch(STATUS_SRC, { cache: 'no-store', signal: controller.signal })
          .then((res) => (res.ok ? res.json() : null))
          .then((json) => settle(
            !!json && json.enabled !== false,
            !!json && json.sound !== false,
            !json || json.ready !== false,
          ))
          .catch(() => settle(false, true, false))
        const guard = window.setTimeout(() => settle(false, true, false), STATUS_GUARD_MS)
        return () => { alive = false; window.clearTimeout(guard); controller.abort() }
      }, [mode])

      // Own the playback lifetime: start, cap, skip and cleanup.
      React.useEffect(() => {
        if (mode !== 'playing') return
        pageBooted = true
        const v = videoRef.current
        if (!v) {
          finish()
          return
        }
        let disposed = false
        const start = () => {
          if (disposed) return
          const attempt = v.play()
          if (attempt && typeof attempt.catch === 'function') {
            attempt.catch(() => {
              if (disposed) return
              // Autoplay with sound refused: fall back to muted playback.
              try { v.muted = true } catch {}
              setMuted(true)
              const retry = v.play()
              if (retry && typeof retry.catch === 'function') retry.catch(() => { if (!disposed) finish() })
            })
          }
        }
        if (v.readyState >= 2) start()
        else v.addEventListener('loadeddata', start, { once: true })

        const onKey = (event) => {
          const key = event.key
          if (key === 'Escape' || key === 'Enter' || key === ' ' || key === 'Spacebar') finish()
        }
        const onPointer = () => finish()
        const capTimer = window.setTimeout(finish, HARD_CAP_MS)
        const hintTimer = window.setTimeout(() => setHint(true), HINT_DELAY_MS)

        window.addEventListener('keydown', onKey, true)
        window.addEventListener('pointerdown', onPointer, true)
        return () => {
          disposed = true
          window.clearTimeout(capTimer)
          window.clearTimeout(hintTimer)
          window.removeEventListener('keydown', onKey, true)
          window.removeEventListener('pointerdown', onPointer, true)
          v.removeEventListener('loadeddata', start)
        }
      }, [mode, finish])

      const onTimeUpdate = React.useCallback(() => {
        const v = videoRef.current
        if (!v || !v.duration || !Number.isFinite(v.duration)) return
        setProgress(Math.min(v.currentTime / v.duration, 1))
      }, [])

      const onError = React.useCallback(() => {
        window.setTimeout(finish, ERROR_GRACE_MS)
      }, [finish])

      const toggleMute = React.useCallback((event) => {
        event.stopPropagation()
        const v = videoRef.current
        if (!v) return
        const next = !v.muted
        try { v.muted = next } catch {}
        setMuted(next)
      }, [])

      if (mode === 'done') return null

      return h(
        'div',
        {
          className: 'dsha-root',
          'data-phase': phase,
          'data-dsh-boot-animation': '',
          role: 'presentation',
        },
        h('style', { key: 'css' }, CSS),
        mode === 'playing'
          ? h('video', {
              key: 'video',
              ref: videoRef,
              className: 'dsha-video',
              src: VIDEO_SRC,
              autoPlay: true,
              muted: muted,
              playsInline: true,
              preload: 'auto',
              controls: false,
              disablePictureInPicture: true,
              onEnded: finish,
              onError: onError,
              onTimeUpdate: onTimeUpdate,
            })
          : null,
        h('div', { key: 'vig', className: 'dsha-vig' }),
        h('div', { key: 'bottom', className: 'dsha-bottom' }),
        mode === 'playing'
          ? h(
              'button',
              {
                key: 'mute',
                type: 'button',
                className: 'dsha-mute',
                title: muted ? t('unmute') : t('mute'),
                'aria-label': muted ? t('unmute') : t('mute'),
                onPointerDown: (event) => event.stopPropagation(),
                onClick: toggleMute,
              },
              h(
                'svg',
                {
                  width: 14,
                  height: 14,
                  viewBox: '0 0 24 24',
                  fill: 'none',
                  stroke: 'currentColor',
                  strokeWidth: 1.8,
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                  'aria-hidden': 'true',
                },
                h('path', { key: 'body', d: 'M4 9.5h3.2L12 5.5v13L7.2 14.5H4z' }),
                muted
                  ? h('path', { key: 'off', d: 'M16.5 9.5l5 5m0-5l-5 5' })
                  : [h('path', { key: 'w1', d: 'M16 8.6a5 5 0 010 6.8' }), h('path', { key: 'w2', d: 'M18.9 6.1a9 9 0 010 11.8' })],
              ),
            )
          : null,
        mode === 'playing' ? h('div', { key: 'hint', className: 'dsha-hint', 'data-on': hint ? '1' : '0' }, t('hint')) : null,
        mode === 'playing'
          ? h('div', { key: 'bar', className: 'dsha-bar' }, h('i', { style: { width: (progress * 100).toFixed(2) + '%' } }))
          : null,
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        for (const code of Object.keys(DICTS)) {
          ctx.effect(() => ctx.locale.register(NS, code, DICTS[code]))
        }
        const t = ctx.locale.bind(NS)
        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            { name: 'shell.overlay', id: 'boot-animation', order: 90000, label: 'Boot animation' },
            (props) => h(BootLayer, Object.assign({}, props, { t: t })),
          ),
        )
      },
    }
  },
})
