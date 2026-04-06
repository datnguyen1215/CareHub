/**
 * JavaScript/TypeScript bridge for the `SilentUpdate` Capacitor plugin.
 *
 * This module registers the native Android plugin with the Capacitor runtime and
 * exports a typed interface so the rest of the Svelte/JS layer can call into the
 * native side with full type safety.
 *
 * On non-native platforms (browser dev mode) all methods log a warning and return
 * reasonable stub values instead of throwing, so the app can run in the browser
 * without crashing during development.
 *
 * @example
 * ```ts
 * import { SilentUpdate } from '$lib/plugins/silent-update';
 *
 * // Listen for progress events
 * const listener = await SilentUpdate.addListener('downloadProgress', (event) => {
 *   console.log(`Download: ${event.percent}%`);
 * });
 *
 * // Trigger an update
 * await SilentUpdate.downloadAndInstall({ url, checksum });
 *
 * // Clean up listener when done
 * listener.remove();
 * ```
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parameters accepted by {@link SilentUpdatePlugin.downloadAndInstall}. */
export interface DownloadAndInstallOptions {
	/** Full HTTPS URL of the APK to download. Must use HTTPS. */
	url: string;
	/** Lowercase hexadecimal SHA-256 checksum of the APK file. */
	checksum: string;
}

/** Resolved value of {@link SilentUpdatePlugin.downloadAndInstall}. */
export interface DownloadAndInstallResult {
	/** {@code true} when the install session was committed successfully. */
	success: boolean;
}

/** Resolved value of {@link SilentUpdatePlugin.getCurrentVersion}. */
export interface VersionInfo {
	/** Human-readable version string from {@code BuildConfig.VERSION_NAME}. */
	version: string;
	/** Integer version code from {@code BuildConfig.VERSION_CODE}. */
	versionCode: number;
}

/**
 * Progress event emitted during APK download.
 * Listen via {@link SilentUpdatePlugin.addListener} with event name {@code 'downloadProgress'}.
 */
export interface DownloadProgressEvent {
	/** Number of bytes downloaded so far. */
	bytesDownloaded: number;
	/**
	 * Total file size in bytes, or {@code -1} when the server does not supply
	 * a {@code Content-Length} header.
	 */
	totalBytes: number;
	/**
	 * Download completion percentage (0–100), or {@code -1} when total size is unknown.
	 */
	percent: number;
}

/** The set of events emitted by the SilentUpdate plugin. */
export interface SilentUpdatePluginEvents {
	downloadProgress: DownloadProgressEvent;
}

/**
 * TypeScript interface for the `SilentUpdate` Capacitor plugin.
 *
 * Implemented natively in `SilentUpdatePlugin.java` for Android.
 * A browser fallback implementation is provided by {@link browserFallback}.
 */
export interface SilentUpdatePlugin {
	/**
	 * Downloads an APK from the given URL, verifies its SHA-256 checksum and
	 * signing certificate, then silently installs it using Device Owner privileges.
	 *
	 * Fires {@code downloadProgress} events during the download phase.
	 *
	 * @param options - URL and checksum of the APK to install.
	 * @returns Resolves with `{ success: true }` when the install session commits.
	 * @throws When the download fails, the checksum mismatches, the APK is signed
	 *         with a different key, or the install session fails.
	 */
	downloadAndInstall(options: DownloadAndInstallOptions): Promise<DownloadAndInstallResult>;

	/**
	 * Returns the current application version read from {@code BuildConfig}.
	 *
	 * @returns An object containing {@code version} (string) and {@code versionCode} (number).
	 */
	getCurrentVersion(): Promise<VersionInfo>;

	/**
	 * Registers a listener for a plugin event.
	 *
	 * @param eventName - The event to listen to (e.g. {@code 'downloadProgress'}).
	 * @param listenerFunc - Callback invoked with the event payload.
	 * @returns A handle whose {@code remove()} method unregisters the listener.
	 */
	addListener<K extends keyof SilentUpdatePluginEvents>(
		eventName: K,
		listenerFunc: (event: SilentUpdatePluginEvents[K]) => void
	): Promise<PluginListenerHandle>;
}

// ---------------------------------------------------------------------------
// Browser fallback
// ---------------------------------------------------------------------------

/**
 * Browser stub that logs warnings instead of crashing when the plugin is called
 * outside of a native Android environment (e.g. during Vite dev server sessions).
 */
const browserFallback: SilentUpdatePlugin = {
	async downloadAndInstall(options) {
		console.warn(
			'[SilentUpdate] downloadAndInstall() called in browser — native plugin not available.',
			options
		);
		return { success: false };
	},

	async getCurrentVersion() {
		console.warn('[SilentUpdate] getCurrentVersion() called in browser — returning stub version.');
		return { version: '0.0.0-dev', versionCode: 0 };
	},

	async addListener(eventName, listenerFunc) {
		console.warn(
			`[SilentUpdate] addListener('${eventName}') called in browser — no events will fire.`,
			listenerFunc
		);
		return { remove: async () => {} };
	}
};

// ---------------------------------------------------------------------------
// Plugin registration
// ---------------------------------------------------------------------------

/**
 * The registered `SilentUpdate` Capacitor plugin.
 *
 * On Android this delegates to {@code SilentUpdatePlugin.java}. In the browser
 * it falls back to {@link browserFallback} which logs warnings and returns stubs.
 */
export const SilentUpdate: SilentUpdatePlugin = Capacitor.isNativePlatform()
	? registerPlugin<SilentUpdatePlugin>('SilentUpdate')
	: browserFallback;
