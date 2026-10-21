/**
 * Sound effects, synthesised with the Web Audio API: no audio files to load.
 *
 * Browsers (iOS Safari especially) only let audio start from a user gesture,
 * so the AudioContext is created and resumed on the player's first tap or key
 * press. Until then, sounds are silently skipped.
 */

import { loadJson, saveJson } from './storage'

export type SoundName = 'lock' | 'hit' | 'miss' | 'bust' | 'checkout'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noise: AudioBuffer | null = null
let muted = loadJson<boolean>('muted') === true

export function isMuted(): boolean {
  return muted
}

export function setMuted(value: boolean): void {
  muted = value
  saveJson('muted', value)
}

/** Creates/resumes audio. Call from inside a user gesture (tap, click, key press). */
export function unlockAudio(): void {
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      ctx = new Ctor()
      master = ctx.createGain()
      master.gain.value = 0.5
      master.connect(ctx.destination)
      // Half a second of white noise, reused for every dart thud.
      noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate)
      const data = noise.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    }
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    // No audio on this device: the game is fine without it.
  }
}

/**
 * Unlocks audio on the first gesture anywhere on the page, then stops
 * listening. iOS counts touchend/click as gestures but not touchstart.
 */
export function installAudioUnlock(): () => void {
  const events = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const
  const handler = () => {
    unlockAudio()
    if (ctx?.state === 'running') events.forEach((e) => window.removeEventListener(e, handler))
  }
  events.forEach((e) => window.addEventListener(e, handler, { passive: true }))
  return () => events.forEach((e) => window.removeEventListener(e, handler))
}

/** A tiny vibration on phones that support it (Android), unless sound is off. */
export function haptic(ms: number): void {
  if (muted || typeof navigator === 'undefined' || !navigator.vibrate) return
  navigator.vibrate(ms)
}

/** Plays a sound `delayMs` from now (scheduled on the audio clock, so it's sample-accurate). */
export function playSound(name: SoundName, delayMs = 0): void {
  if (muted || !ctx || !master || ctx.state !== 'running') return
  const at = ctx.currentTime + delayMs / 1000
  SOUNDS[name](ctx, master, at)
}

type Voice = (ctx: AudioContext, out: AudioNode, at: number) => void

/** A tone with a quick attack and exponential decay. */
function tone(
  ctx: AudioContext,
  out: AudioNode,
  at: number,
  {
    type,
    from,
    to,
    duration,
    volume,
  }: { type: OscillatorType; from: number; to: number; duration: number; volume: number },
) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, at)
  osc.frequency.exponentialRampToValueAtTime(to, at + duration)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration)
  osc.connect(gain).connect(out)
  osc.start(at)
  osc.stop(at + duration + 0.02)
}

/** A short filtered noise burst: the "thock" of a tip going into sisal. */
function thud(ctx: AudioContext, out: AudioNode, at: number, brightness: number, volume: number) {
  if (!noise) return
  const src = ctx.createBufferSource()
  src.buffer = noise
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = brightness
  filter.Q.value = 1.2
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume, at)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.07)
  src.connect(filter).connect(gain).connect(out)
  src.start(at)
  src.stop(at + 0.08)
}

const SOUNDS: Record<SoundName, Voice> = {
  // A short, dry click: a line locking into place.
  lock: (ctx, out, at) => {
    tone(ctx, out, at, { type: 'square', from: 1700, to: 900, duration: 0.025, volume: 0.07 })
  },
  hit: (ctx, out, at) => {
    thud(ctx, out, at, 1800, 0.9)
    tone(ctx, out, at, { type: 'sine', from: 160, to: 70, duration: 0.09, volume: 0.6 })
  },
  // Into the surround: duller and quieter.
  miss: (ctx, out, at) => {
    thud(ctx, out, at, 600, 0.6)
    tone(ctx, out, at, { type: 'sine', from: 110, to: 55, duration: 0.08, volume: 0.35 })
  },
  // A falling two-note "uh-oh".
  bust: (ctx, out, at) => {
    tone(ctx, out, at, { type: 'square', from: 330, to: 300, duration: 0.16, volume: 0.12 })
    tone(ctx, out, at + 0.17, { type: 'square', from: 220, to: 150, duration: 0.3, volume: 0.12 })
  },
  // A rising arpeggio with a little sparkle on top.
  checkout: (ctx, out, at) => {
    ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone(ctx, out, at + i * 0.075, {
        type: 'triangle',
        from: f,
        to: f,
        duration: 0.32,
        volume: 0.28,
      }),
    )
    tone(ctx, out, at + 0.3, { type: 'sine', from: 2093, to: 2093, duration: 0.45, volume: 0.08 })
  },
}
