import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'us.dnguyen.carehub.portal',
  appName: 'CareHub Caretaker',
  webDir: 'build',
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystorePassword: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
      releaseType: 'APK'
    }
  }
  // No iOS configuration - Android only for portal
}

export default config
