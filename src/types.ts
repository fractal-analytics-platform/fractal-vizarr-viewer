export type AuthorizationScheme =
  | "fractal-server"
  | "testing-basic-auth"
  | "none";

export type Config = {
  port: number;
  fractalServerUrl: string;
  basePath: string;
  vizarrStaticFilesPath: string;
  authorizationScheme: AuthorizationScheme;
  cacheExpirationTime: number;
  testingUsername: string | null;
  testingPassword: string | null;
};

export type User = {
  id: number;
  email: string;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
  username: string | null;
};
