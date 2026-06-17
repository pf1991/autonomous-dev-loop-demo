/**
 * audio.js — Synthesized sound effects via the Web Audio API.
 *
 * Lives in src/ (not src/game/) because it uses the Web Audio API,
 * which is a browser side effect and therefore not allowed in pure-function
 * game modules.
 *
 * Usage:
 *   import { playSound, isMuted, setMuted } from './audio'
 *   playSound('tower-basic')
 *
 * Mute state is persisted in localStorage under the key 'sfx-muted'.
 */

const STORAGE_KEY = 'sfx-muted'

/** Returns true if the player has muted sound effects. */
export function isMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/** Set mute state and persist it. */
export function setMuted(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false')
  } catch {
    // ignore
  }
}

/** Toggle mute and return the new value. */
export function toggleMute() {
  const next = !isMuted()
  setMuted(next)
  return next
}

// Lazy AudioContext — created on first playSound() call to comply with browser
// autoplay policies (must be triggered by a user gesture or deferred until one).
let _ctx = null

function getContext() {
  if (!_ctx) {
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)()
    } catch {
      return null
    }
  }
  // Resume if suspended (e.g. after browser autoplay block)
  if (_ctx.state === 'suspended') {
    _ctx.resume().catch(() => {})
  }
  return _ctx
}

/**
 * Schedule a gain envelope: linear ramp up then down.
 * @param {GainNode} gainNode
 * @param {AudioContext} ctx
 * @param {number} peak        - peak gain value
 * @param {number} attackTime  - seconds from now to reach peak
 * @param {number} decayTime   - seconds after peak to reach 0
 */
function envelope(gainNode, ctx, peak, attackTime, decayTime) {
  const now = ctx.currentTime
  gainNode.gain.setValueAtTime(0.001, now)
  gainNode.gain.linearRampToValueAtTime(peak, now + attackTime)
  gainNode.gain.linearRampToValueAtTime(0.001, now + attackTime + decayTime)
}

/**
 * Play a simple oscillator burst.
 * @param {AudioContext} ctx
 * @param {string} type     - OscillatorNode type
 * @param {number} freq     - base frequency in Hz
 * @param {number} peak     - peak gain (0..1)
 * @param {number} attack   - seconds
 * @param {number} decay    - seconds
 * @param {number} [freqEnd]  - optional frequency sweep target
 */
function oscBurst(ctx, type, freq, peak, attack, decay, freqEnd) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = type
  osc.frequency.setValueAtTime(freq, ctx.currentTime)
  if (freqEnd !== undefined) {
    osc.frequency.linearRampToValueAtTime(freqEnd, ctx.currentTime + attack + decay)
  }
  envelope(gain, ctx, peak, attack, decay)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + attack + decay + 0.01)
}

/** Synthesize a noise buffer of the given duration (seconds). */
function noiseBuffer(ctx, duration) {
  const sampleRate = ctx.sampleRate
  const samples = Math.ceil(sampleRate * duration)
  const buffer = ctx.createBuffer(1, samples, sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < samples; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

/**
 * Play filtered noise burst (used for explosion / impact sounds).
 * @param {AudioContext} ctx
 * @param {number} freq       - filter cutoff
 * @param {number} peak
 * @param {number} attack
 * @param {number} decay
 */
function noiseBurst(ctx, freq, peak, attack, decay) {
  const duration = attack + decay + 0.05
  const source = ctx.createBufferSource()
  source.buffer = noiseBuffer(ctx, duration)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = freq
  filter.Q.value = 1.5
  const gain = ctx.createGain()
  source.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  envelope(gain, ctx, peak, attack, decay)
  source.start(ctx.currentTime)
  source.stop(ctx.currentTime + duration)
}

/**
 * Play a sequence of notes as oscillator bursts (fanfare / chime).
 * @param {AudioContext} ctx
 * @param {number[]} freqs   - array of frequencies
 * @param {number} spacing   - seconds between note onsets
 * @param {string} type      - oscillator type
 * @param {number} peak
 * @param {number} noteDuration
 */
function playArpeggio(ctx, freqs, spacing, type, peak, noteDuration) {
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = type
    osc.frequency.value = freq
    const start = ctx.currentTime + i * spacing
    gain.gain.setValueAtTime(0.001, start)
    gain.gain.linearRampToValueAtTime(peak, start + 0.01)
    gain.gain.linearRampToValueAtTime(0.001, start + noteDuration)
    osc.start(start)
    osc.stop(start + noteDuration + 0.01)
  })
}

// ─── Sound definitions ────────────────────────────────────────────────────────

const SOUNDS = {
  // Tower shots — short oscillator burst, pitch varies by type
  'tower-basic': (ctx) => oscBurst(ctx, 'square', 440, 0.15, 0.01, 0.08),
  'tower-sniper': (ctx) => oscBurst(ctx, 'sawtooth', 880, 0.12, 0.005, 0.12, 220),
  'tower-cannon': (ctx) => noiseBurst(ctx, 120, 0.3, 0.005, 0.18),
  'tower-rapid': (ctx) => oscBurst(ctx, 'square', 660, 0.1, 0.005, 0.05),
  'tower-slow': (ctx) => oscBurst(ctx, 'sine', 280, 0.12, 0.02, 0.14, 200),
  'tower-mortar': (ctx) => noiseBurst(ctx, 80, 0.35, 0.008, 0.22),
  'tower-poison': (ctx) => oscBurst(ctx, 'sine', 320, 0.1, 0.01, 0.18, 160),

  // Enemy deaths
  'enemy-death': (ctx) => oscBurst(ctx, 'sine', 400, 0.12, 0.005, 0.12, 100),
  'enemy-death-boss': (ctx) => {
    noiseBurst(ctx, 80, 0.5, 0.01, 0.5)
    // Low rumble reverb tail
    oscBurst(ctx, 'sine', 55, 0.2, 0.05, 0.6, 30)
  },

  // Wave start — ascending 3-note fanfare
  'wave-start': (ctx) => playArpeggio(ctx, [440, 554, 659], 0.1, 'triangle', 0.2, 0.2),

  // Boss spawn warning — low pulsing klaxon (2 beats)
  'boss-warning': (ctx) => {
    const beats = [0, 0.28]
    beats.forEach(offset => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(110, ctx.currentTime + offset)
      osc.frequency.linearRampToValueAtTime(90, ctx.currentTime + offset + 0.22)
      const s = ctx.currentTime + offset
      gain.gain.setValueAtTime(0.001, s)
      gain.gain.linearRampToValueAtTime(0.25, s + 0.02)
      gain.gain.linearRampToValueAtTime(0.001, s + 0.22)
      osc.start(s)
      osc.stop(s + 0.25)
    })
  },

  // Achievement unlock — ascending chime arpeggio
  'achievement': (ctx) => playArpeggio(ctx, [523, 659, 784, 1047], 0.08, 'sine', 0.18, 0.25),

  // Power crate pickup — bright reward jingle
  'power-crate': (ctx) => playArpeggio(ctx, [659, 784, 988, 1319], 0.07, 'triangle', 0.22, 0.2),

  // Interest tick — soft coin clink
  'interest': (ctx) => {
    oscBurst(ctx, 'sine', 1200, 0.1, 0.005, 0.08, 900)
  },
}

/**
 * Play a named sound effect. Does nothing when muted.
 * Audio is always played at normal rate regardless of game speed.
 *
 * @param {string} name - one of the keys in SOUNDS
 */
export function playSound(name) {
  if (isMuted()) return
  const fn = SOUNDS[name]
  if (!fn) return
  const ctx = getContext()
  if (!ctx) return
  try {
    fn(ctx)
  } catch {
    // Silently swallow any Web Audio errors (e.g. unsupported in test env)
  }
}
