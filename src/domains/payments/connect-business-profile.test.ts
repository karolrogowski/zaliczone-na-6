import { describe, it, expect } from 'vitest'
import { buildConnectBusinessProfile } from './connect-business-profile'

describe('buildConnectBusinessProfile', () => {
  it('ustawia product_description, gdy korepetytor nie ma własnej strony', () => {
    const profile = buildConnectBusinessProfile(undefined)

    expect(profile.product_description).toBeTruthy()
    expect(profile.url).toBeUndefined()
  })

  it('dodaje url platformy, gdy NEXT_PUBLIC_SITE_URL jest skonfigurowany', () => {
    const profile = buildConnectBusinessProfile('https://zaliczone-na-6.vercel.app')

    expect(profile.url).toBe('https://zaliczone-na-6.vercel.app')
    expect(profile.product_description).toBeTruthy()
  })
})
