import { describe, expect, it } from 'vitest'
import { isGeneratedName, usernameErrorMessage, usernameProblem } from './username'

describe('usernameProblem', () => {
  it.each(['abc', 'Alice_99', 'x'.repeat(20), '  padded  ', 'PlayerOne'])('accepts %j', (name) => {
    expect(usernameProblem(name)).toBeNull()
  })

  it.each([
    ['', /At least 3/],
    ['ab', /At least 3/],
    ['   ab   ', /At least 3/],
    ['x'.repeat(21), /At most 20/],
    ['two words', /no spaces/],
    ['bob-smith', /Only letters/],
    ['Álvaro', /Only letters/],
    ['😀😀😀', /Only letters/],
  ])('rejects %j', (name, message) => {
    expect(usernameProblem(name)).toMatch(message)
  })
})

describe('isGeneratedName', () => {
  it('spots the names new players get', () => {
    expect(isGeneratedName('Player 3F9A1C')).toBe(true)
    expect(isGeneratedName('Player_3F9A1C')).toBe(false)
    expect(isGeneratedName('PlayerOne')).toBe(false)
  })
})

describe('usernameErrorMessage', () => {
  it('explains each server error', () => {
    expect(usernameErrorMessage('username_taken')).toMatch(/taken/)
    expect(usernameErrorMessage('username_reserved')).toMatch(/isn't allowed/)
    expect(usernameErrorMessage('username_invalid')).toMatch(/3-20/)
    expect(usernameErrorMessage('not_signed_in')).toMatch(/ranked round/)
    expect(usernameErrorMessage('Failed to fetch')).toMatch(/Couldn't save.*Failed to fetch/)
  })
})
