import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'us.dnguyen.carehub.kiosk',
	appName: 'CareHub Kiosk',
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
	// No iOS configuration - Android only for kiosk
};

export default config;
