// Build-time env vars from .env (gitignored), inlined by Vite via envPrefix.
interface ImportMetaEnv {
  readonly WN_TELEMETRY_ENDPOINT?: string;
  readonly WN_TELEMETRY_TOKEN?: string;
}
