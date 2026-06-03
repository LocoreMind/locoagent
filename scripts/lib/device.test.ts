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

test('agentBrowserProfileArgs returns -p flags', () => {
  expect(agentBrowserProfileArgs('desktop')).toEqual([])
  expect(agentBrowserProfileArgs('ios')).toEqual(['-p', 'ios'])
  expect(agentBrowserProfileArgs('android')).toEqual(['-p', 'android'])
})
