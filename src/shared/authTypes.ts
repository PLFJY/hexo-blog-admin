export type AuthUser = {
  username: string
  role: 'admin' | 'user'
  builtIn: boolean
  createdAt?: string
}

export type AuthStatusResponse = {
  authenticated: boolean
  user?: AuthUser
}

export type CreateUserRequest = {
  username: string
  password: string
}
