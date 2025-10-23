/**
 * Unit tests for src/index.ts
 */

import { describe, it, expect } from '@jest/globals'

describe('index', () => {
  it('should import and execute the entry point', async () => {
    // The index.ts file just calls run(), which we've already tested
    // This test ensures the file can be loaded without errors
    await expect(import('../src/index.js')).resolves.toBeDefined()
  })
})
