import type { WorkerEnv } from '../env'
import { clearSessionCookie, createSessionCookie, createUser, deleteUser, getSessionUser, listUsers, verifyLogin } from '../utils/auth'
import { json } from '../utils/response'

export async function handleAuthStatus(request: Request, env: WorkerEnv): Promise<Response> {
  const user = await getSessionUser(request, env)
  return json({ authenticated: Boolean(user), user })
}

export async function handleLogin(request: Request, env: WorkerEnv): Promise<Response> {
  const body = (await request.json()) as { username?: string; password?: string }
  const user = await verifyLogin(env, body.username ?? '', body.password ?? '')
  if (!user) {
    return json({ error: 'INVALID_CREDENTIALS' }, { status: 401 })
  }

  return json(
    { authenticated: true, user },
    {
      headers: {
        'set-cookie': await createSessionCookie(env, request, user.username),
      },
    },
  )
}

export function handleLogout(request: Request): Response {
  return json(
    { authenticated: false },
    {
      headers: {
        'set-cookie': clearSessionCookie(request),
      },
    },
  )
}

export async function handleListUsers(env: WorkerEnv): Promise<Response> {
  return json({ users: await listUsers(env) })
}

export async function handleCreateUser(env: WorkerEnv, request: Request): Promise<Response> {
  const body = (await request.json()) as { username?: string; password?: string }
  return json(await createUser(env, body.username ?? '', body.password ?? ''), { status: 201 })
}

export async function handleDeleteUser(env: WorkerEnv, username: string): Promise<Response> {
  return json(await deleteUser(env, username))
}
