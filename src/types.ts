export type AuthorizationScheme = 'fractal-server-viewer-paths' | 'user-folders' | 'none';

export type Config = {
  port: number
  fractalServerUrl: string
  basePath: string
  zarrDataBasePath: string | null
  vizarrStaticFilesPath: string
  authorizationScheme: AuthorizationScheme
  cacheExpirationTime: number
}

export type User = {
  id: number
  email: string
  is_active: boolean
  is_superuser: boolean
  is_verified: boolean
  username: string | null
}

export type UserSettings = {
  slurm_user: string | null
  cache_dir: string | null
  slurm_accounts: string[]
}
