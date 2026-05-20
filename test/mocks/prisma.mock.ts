import { DeepMockProxy, mockDeep } from 'jest-mock-extended';

import { PrismaClient } from '@/generated/prisma/client';

export const createPrismaMock = () => mockDeep<PrismaClient>();
export type PrismaMock = DeepMockProxy<PrismaClient>;
