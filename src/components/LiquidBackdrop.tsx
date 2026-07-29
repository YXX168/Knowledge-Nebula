import { useEffect, useRef } from 'react'

interface Blob {
  x: number
  y: number
  width: number
  height: number
  speed: number
  phase: number
  opacity: number
  color: string
}

const blobs: Blob[] = [
  { x: -.06, y: 1.03, width: .62, height: .36, speed: .00024, phase: .1, opacity: .88, color: '244, 205, 68' },
  { x: .29, y: .98, width: .70, height: .42, speed: -.00018, phase: 2.6, opacity: .82, color: '234, 239, 238' },
  { x: .23, y: .79, width: .74, height: .37, speed: .00023, phase: 4.2, opacity: .75, color: '234, 85, 177' },
  { x: .52, y: .88, width: .68, height: .42, speed: -.0002, phase: 1.3, opacity: .63, color: '180, 91, 203' },
  { x: .76, y: .78, width: .76, height: .55, speed: .00016, phase: 5.4, opacity: .7, color: '214, 69, 100' },
]

export function LiquidBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let animation = 0

    const render = (time: number) => {
      const scale = Math.min(window.devicePixelRatio || 1, 2)
      const width = window.innerWidth
      const height = window.innerHeight
      if (canvas.width !== Math.round(width * scale) || canvas.height !== Math.round(height * scale)) {
        canvas.width = Math.round(width * scale)
        canvas.height = Math.round(height * scale)
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
      }
      context.setTransform(scale, 0, 0, scale, 0, 0)
      context.clearRect(0, 0, width, height)
      context.fillStyle = '#0f0f0f'
      context.fillRect(0, 0, width, height)

      const timeOffset = reduceMotion ? 0 : time
      context.save()
      context.globalCompositeOperation = 'screen'
      context.filter = 'blur(48px)'
      for (const blob of blobs) {
        const angle = timeOffset * blob.speed + blob.phase
        const x = width * (blob.x + Math.sin(angle) * .13 + Math.cos(angle * .47) * .05)
        const y = height * (blob.y + Math.cos(angle * .82) * .065)
        const blobWidth = width * blob.width * (1 + Math.sin(angle * 1.31) * .09)
        const blobHeight = height * blob.height * (1 + Math.cos(angle * 1.17) * .12)
        context.fillStyle = `rgba(${blob.color}, ${blob.opacity})`
        context.beginPath()
        context.ellipse(x, y, blobWidth, blobHeight, Math.sin(angle * .62) * .16, 0, Math.PI * 2)
        context.fill()
      }
      context.restore()

      const glow = context.createLinearGradient(0, height, width, 0)
      glow.addColorStop(0, 'rgba(255,255,255,.015)')
      glow.addColorStop(.5, 'rgba(255,255,255,0)')
      glow.addColorStop(1, 'rgba(255,255,255,.025)')
      context.fillStyle = glow
      context.fillRect(0, 0, width, height)
      frame += 1
      if (!reduceMotion || frame < 2) animation = window.requestAnimationFrame(render)
    }
    animation = window.requestAnimationFrame(render)
    return () => window.cancelAnimationFrame(animation)
  }, [])

  return <canvas ref={canvasRef} className="liquid-backdrop" aria-hidden="true" />
}
