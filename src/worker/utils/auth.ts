import type { AuthUser } from '../../shared/authTypes'
import type { WorkerEnv } from '../env'

const cookieName = 'hba_session'
const sessionMaxAgeSeconds = 60 * 60 * 24 * 7
const userPrefix = 'auth:user:'

type StoredUser = {
  username: string
  salt: string
  passwordHash: string
  role: 'admin' | 'user'
  createdAt: string
}

const encodeBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

const timingSafeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false
  let result = 0
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return result === 0
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value)
  return encodeBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
}

async function hashPassword(password: string, salt: string) {
  return digest(`${salt}:${password}`)
}

async function sign(env: WorkerEnv, username: string, expiresAt: number) {
  return digest(`${username}.${expiresAt}.${env.ADMIN_PASSWORD ?? ''}`)
}

function userKey(username: string) {
  return `${userPrefix}${username.toLowerCase()}`
}

function publicUser(user: StoredUser, builtIn = false): AuthUser {
  return {
    username: user.username,
    role: user.role,
    builtIn,
    createdAt: user.createdAt,
  }
}

export async function createSessionCookie(env: WorkerEnv, request: Request, username: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + sessionMaxAgeSeconds
  const signature = await sign(env, username, expiresAt)
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  const value = `${encodeURIComponent(username)}.${expiresAt}.${signature}`
  return `${cookieName}=${value}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${sessionMaxAgeSeconds}`
}

export function clearSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return `${cookieName}=; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=0`
}

export async function getSessionUser(request: Request, env: WorkerEnv): Promise<AuthUser | null> {
  const cookie = request.headers.get('cookie') ?? ''
  const token = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1)

  if (!token || !env.ADMIN_PASSWORD) return null
  const [usernameRaw, expiresAtRaw, signature] = token.split('.')
  const username = decodeURIComponent(usernameRaw ?? '')
  const expiresAt = Number(expiresAtRaw)
  if (!username || !Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000) || !signature) return null
  if (!timingSafeEqual(signature, await sign(env, username, expiresAt))) return null

  if (username === env.ADMIN_USERNAME) {
    return { username, role: 'admin', builtIn: true }
  }

  const stored = await env.BLOG_ADMIN_KV?.get<StoredUser>(userKey(username), 'json')
  return stored ? publicUser(stored) : null
}

export async function isAuthenticated(request: Request, env: WorkerEnv) {
  return Boolean(await getSessionUser(request, env))
}

export async function verifyLogin(env: WorkerEnv, username: string, password: string): Promise<AuthUser | null> {
  if (username === env.ADMIN_USERNAME && timingSafeEqual(password, env.ADMIN_PASSWORD ?? '')) {
    return { username, role: 'admin', builtIn: true }
  }

  const stored = await env.BLOG_ADMIN_KV?.get<StoredUser>(userKey(username), 'json')
  if (!stored) return null
  return timingSafeEqual(await hashPassword(password, stored.salt), stored.passwordHash) ? publicUser(stored) : null
}

export async function listUsers(env: WorkerEnv): Promise<AuthUser[]> {
  const list = await env.BLOG_ADMIN_KV?.list({ prefix: userPrefix })
  const storedUsers = list
    ? await Promise.all(list.keys.map((key) => env.BLOG_ADMIN_KV?.get<StoredUser>(key.name, 'json')))
    : []
  const users = storedUsers.filter((user): user is StoredUser => Boolean(user)).map((user) => publicUser(user))
  return env.ADMIN_USERNAME ? [{ username: env.ADMIN_USERNAME, role: 'admin', builtIn: true }, ...users] : users
}

export async function createUser(env: WorkerEnv, username: string, password: string): Promise<AuthUser> {
  const normalized = username.trim()
  if (!normalized || !password) throw new Error('Username and password are required')
  if (normalized === env.ADMIN_USERNAME) throw new Error('Cannot overwrite built-in admin')

  const salt = crypto.randomUUID()
  const stored: StoredUser = {
    username: normalized,
    salt,
    passwordHash: await hashPassword(password, salt),
    role: 'user',
    createdAt: new Date().toISOString(),
  }
  await env.BLOG_ADMIN_KV?.put(userKey(normalized), JSON.stringify(stored))
  return publicUser(stored)
}

export async function deleteUser(env: WorkerEnv, username: string): Promise<{ deleted: boolean }> {
  if (username === env.ADMIN_USERNAME) throw new Error('Cannot delete built-in admin')
  await env.BLOG_ADMIN_KV?.delete(userKey(username))
  return { deleted: true }
}
