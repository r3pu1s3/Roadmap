// src/lib/__mocks__/prisma.ts
// 1
import { beforeEach } from 'vitest'
import { mockDeep, mockReset } from 'vitest-mock-extended'
import type { PrismaClient } from '../../generated/prisma/client'

// 2
beforeEach(() => {
  mockReset(prisma)
})

// 3
const prisma = mockDeep<PrismaClient>()
export default prisma