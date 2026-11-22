import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

/**
 * Password hashing with scrypt (OWASP minimum: N=2^17, r=8, p=1).
 * Format: scrypt$N$r$p$salt$hash (base64url). The parameters live in the hash, so they can
 * be raised later: needsRehash() tells the login flow to re-hash with the current cost.
 */
export interface HashOptions {
  cost?: number
}

const DEFAULT_COST = 2 ** 17
const BLOCK_SIZE = 8
const PARALLELISM = 1
const KEY_LENGTH = 32
const SALT_LENGTH = 16
const MAX_COST = 2 ** 20

function derive(password: string, salt: Buffer, cost: number, blockSize: number, parallelism: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, {
      N: cost, r: blockSize, p: parallelism, maxmem: 256 * cost * blockSize,
    }, (error, key) => (error ? reject(error) : resolve(key)))
  })
}

export async function hashPassword(password: string, { cost = DEFAULT_COST }: HashOptions = {}) {
  const salt = randomBytes(SALT_LENGTH)
  const key = await derive(password, salt, cost, BLOCK_SIZE, PARALLELISM)
  return ['scrypt', cost, BLOCK_SIZE, PARALLELISM, salt.toString('base64url'), key.toString('base64url')].join('$')
}

function parse(stored: string) {
  const [scheme, cost, blockSize, parallelism, salt, key] = stored.split('$')
  const numbers = [cost, blockSize, parallelism].map(Number)
  if (scheme !== 'scrypt' || !salt || !key || numbers.some((value) => !Number.isInteger(value) || value < 1)) return null
  const [n, r, p] = numbers as [number, number, number]
  if (n > MAX_COST || (n & (n - 1)) !== 0 || r > 32 || p > 16) return null
  return { cost: n, blockSize: r, parallelism: p, salt: Buffer.from(salt, 'base64url'), key: Buffer.from(key, 'base64url') }
}

export async function verifyPassword(password: string, stored: string) {
  const parsed = parse(stored)
  if (!parsed || parsed.key.length !== KEY_LENGTH) return false
  try {
    const key = await derive(password, parsed.salt, parsed.cost, parsed.blockSize, parsed.parallelism)
    return timingSafeEqual(key, parsed.key)
  } catch {
    return false
  }
}

export function needsRehash(stored: string, { cost = DEFAULT_COST }: HashOptions = {}) {
  const parsed = parse(stored)
  return !parsed || parsed.cost < cost || parsed.blockSize < BLOCK_SIZE
}
