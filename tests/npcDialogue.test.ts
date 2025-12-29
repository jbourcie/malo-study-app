import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getNpcLine } from '../src/game/npc/npcDialogue'
import * as npcLines from '../src/game/npc/npcLines'

class MemoryStorage {
  private data = new Map<string, string>()
  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null
  }
  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
  clear() {
    this.data.clear()
  }
}

describe('npcDialogue', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // vitest jsdom is not enabled; provide a minimal localStorage stub
    ;(globalThis as any).localStorage = new MemoryStorage()
  })

  it('keeps daily quest flow unchanged (same NPC + lines)', () => {
    const spy = vi.spyOn(npcLines, 'pickNpcLine').mockReturnValue('daily-line')
    const line = getNpcLine('scout', 'daily_quest', { reasonCode: 'repair' })

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith({
      npcId: 'scout',
      reason: 'repair',
      dateKey: expect.any(String),
    })
    expect(line.text).toBe('daily-line')
  })

  it('stores recent dialogue indices to avoid repeating the last lines', () => {
    const line = getNpcLine('robot', 'session_start', {})
    expect(typeof line.text).toBe('string')
    const raw = localStorage.getItem('malocraft.npc.dialogue.robot.session_start')
    expect(raw).toBeTruthy()
    const parsed = raw ? JSON.parse(raw) : []
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBeGreaterThan(0)
  })

  it('adds CTA for wrong answers only when a lesson is available', () => {
    const withLesson = getNpcLine('goblin', 'wrong_answer', { lessonAvailable: true, lessonRef: 'sec-1' })
    expect(withLesson.cta).toEqual({ label: 'Voir l’astuce', action: 'open_lesson' })

    const withoutLesson = getNpcLine('goblin', 'wrong_answer', { lessonAvailable: false })
    expect(withoutLesson.cta).toBeUndefined()
  })

  it('does not crash when no lesson is attached (pack without lesson)', () => {
    const line = getNpcLine('robot', 'wrong_answer', { lessonAvailable: false })
    expect(line.text).toBeTruthy()
  })
})
