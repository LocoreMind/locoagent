import { test, expect } from 'bun:test'
import { resolveDevice, agentBrowserProfileArgs, DEVICE_REGISTRY } from './device'

test('DEVICE_REGISTRY maps every target', () => {
  expect(DEVICE_REGISTRY.desktop.abProfile).toBeNull()
  expect(DEVICE_REGISTRY.ios.abProfile).toBe('ios')
  expect(DEVICE_REGISTRY.android.abProfile).toBe('android')
})

test('resolveDevice defaults to desktop', () => {
  expect(resolveDevice({})).toBe('desktop')
})

test('resolveDevice reads DEVICE_PROFILE (case-insensitive)', () => {
  expect(resolveDevice({ DEVICE_PROFILE: 'iOS' })).toBe('ios')
})

test('resolveDevice rejects unknown values', () => {
  expect(() => resolveDevice({ DEVICE_PROFILE: 'tablet' })).toThrow()
})

// A blank `DEVICE_PROFILE=` placeholder from .env must mean "use the default",
// not crash with "Invalid DEVICE_PROFILE \"\"".
test('resolveDevice treats a blank DEVICE_PROFILE as desktop', () => {
  expect(resolveDevice({ DEVICE_PROFILE: '' })).toBe('desktop')
  expect(resolveDevice({ DEVICE_PROFILE: '   ' })).toBe('desktop')
})

test('agentBrowserProfileArgs returns -p flags', () => {
  expect(agentBrowserProfileArgs('desktop')).toEqual([])
  expect(agentBrowserProfileArgs('ios')).toEqual(['-p', 'ios'])
  expect(agentBrowserProfileArgs('android')).toEqual(['-p', 'android'])
})
