export type AuthorizationScheme = 'allowed-list' | 'user-folders' | 'none';

export type Config = {
  port: number
  fractalServerUrl: string
  basePath: string
  zarrDataBasePath: string
  vizarrStaticFilesPath: string
  authorizationScheme: AuthorizationScheme
  allowedUsers: string[]
  cacheExpirationTime: number
}

export type User = {
  id: number
  email: string
  is_active: boolean
  is_superuser: boolean
  is_verified: boolean
  slurm_user: string | null
  cache_dir: string | null
  username: string | null
  slurm_accounts: string[]
}
