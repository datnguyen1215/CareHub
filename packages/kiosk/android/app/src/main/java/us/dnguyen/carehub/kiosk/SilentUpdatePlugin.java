package us.dnguyen.carehub.kiosk;

import android.content.Context;
import android.content.Intent;
import android.content.IntentSender;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.cert.Certificate;
import java.security.cert.CertificateException;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;

/**
 * SilentUpdatePlugin is a Capacitor plugin that enables silent APK downloads and installations
 * for kiosk devices operating in Device Owner mode.
 *
 * <p>This plugin exposes two methods to the JavaScript layer:
 * <ul>
 *   <li>{@link #downloadAndInstall} — downloads an APK, verifies its SHA-256 checksum and
 *       APK signing certificate, then silently installs it via {@link PackageInstaller}.</li>
 *   <li>{@link #getCurrentVersion} — returns the running app's version name and version code.</li>
 * </ul>
 *
 * <p><b>Security model:</b> Before any install is committed, the plugin performs two
 * independent verifications:
 * <ol>
 *   <li>SHA-256 checksum — ensures the download was not corrupted or tampered in transit.</li>
 *   <li>APK signing certificate fingerprint — ensures the APK was signed with the same
 *       keystore as the currently running app. This prevents a compromised backend from
 *       pushing a malicious APK signed with a different key.</li>
 * </ol>
 * If either check fails the downloaded file is deleted and the JS promise is rejected.
 *
 * <p>Requires the app to be set as Device Owner via {@code dpm set-device-owner} before
 * silent installation will succeed. See {@code SETUP.md} for provisioning instructions.
 */
@CapacitorPlugin(name = "SilentUpdate")
public class SilentUpdatePlugin extends Plugin {

    private static final String TAG = "SilentUpdatePlugin";

    /** Buffer size used for streaming reads during download and checksum calculation. */
    private static final int BUFFER_SIZE = 8192;

    /** HTTPS connection timeout in milliseconds. */
    private static final int CONNECT_TIMEOUT_MS = 15_000;

    /** HTTPS read timeout in milliseconds (large APKs may take time). */
    private static final int READ_TIMEOUT_MS = 120_000;

    // -------------------------------------------------------------------------
    // Plugin methods exposed to JavaScript
    // -------------------------------------------------------------------------

    /**
     * Downloads an APK from the given URL, verifies its integrity and signature,
     * and silently installs it using the {@link PackageInstaller} API.
     *
     * <p>Expected JS call:
     * <pre>
     *   SilentUpdate.downloadAndInstall({ url: 'https://…/update.apk', checksum: 'sha256hex' })
     * </pre>
     *
     * <p>The method emits {@code downloadProgress} events during the download phase:
     * <pre>
     *   { bytesDownloaded: number, totalBytes: number, percent: number }
     * </pre>
     * {@code totalBytes} is -1 and {@code percent} is -1 when the server does not provide
     * a Content-Length header.
     *
     * <p>The JS promise resolves with {@code { success: true }} on a successful install
     * trigger, or rejects with a descriptive error message on any failure.
     *
     * @param call the Capacitor plugin call carrying {@code url} and {@code checksum} params
     */
    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        String checksum = call.getString("checksum");

        if (url == null || url.isEmpty()) {
            call.reject("Missing required parameter: url");
            return;
        }
        if (checksum == null || checksum.isEmpty()) {
            call.reject("Missing required parameter: checksum");
            return;
        }

        // Run on a background thread — network I/O must never block the main thread.
        final String finalUrl = url;
        final String finalChecksum = checksum.toLowerCase();
        new Thread(() -> {
            File apkFile = null;
            try {
                apkFile = downloadApk(finalUrl, call);
                verifyChecksum(apkFile, finalChecksum);
                verifySignature(apkFile);
                silentInstall(apkFile, call);
                // Note: resolve() is called from the PackageInstaller status receiver
                // after the install session commits successfully (see silentInstall).
                // We do NOT delete the file here; Android reads it during installation.
            } catch (SecurityException e) {
                Log.e(TAG, "Security check failed", e);
                deleteQuietly(apkFile);
                call.reject("Security check failed: " + e.getMessage());
            } catch (IOException e) {
                Log.e(TAG, "Download or I/O error", e);
                deleteQuietly(apkFile);
                call.reject("Download error: " + e.getMessage());
            } catch (Exception e) {
                Log.e(TAG, "Unexpected error during update", e);
                deleteQuietly(apkFile);
                call.reject("Update failed: " + e.getMessage());
            }
        }).start();
    }

    /**
     * Returns the current application version from {@link BuildConfig}.
     *
     * <p>Expected JS call:
     * <pre>
     *   const { version, versionCode } = await SilentUpdate.getCurrentVersion();
     * </pre>
     *
     * @param call the Capacitor plugin call (no parameters required)
     */
    @PluginMethod
    public void getCurrentVersion(PluginCall call) {
        JSObject result = new JSObject();
        result.put("version", BuildConfig.VERSION_NAME);
        result.put("versionCode", BuildConfig.VERSION_CODE);
        call.resolve(result);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Downloads the APK from {@code urlString} to a temporary file in the app's
     * internal storage directory, firing {@code downloadProgress} events as data arrives.
     *
     * @param urlString the HTTPS URL of the APK to download
     * @param call      the plugin call used to emit progress events
     * @return the downloaded {@link File}
     * @throws IOException if the connection fails or the server returns a non-200 status
     */
    private File downloadApk(String urlString, PluginCall call) throws IOException {
        URL url = new URL(urlString);
        if (!url.getProtocol().equalsIgnoreCase("https")) {
            throw new SecurityException("APK download URL must use HTTPS");
        }

        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
        connection.setReadTimeout(READ_TIMEOUT_MS);
        connection.connect();

        int responseCode = connection.getResponseCode();
        if (responseCode != HttpURLConnection.HTTP_OK) {
            connection.disconnect();
            throw new IOException("Server returned HTTP " + responseCode);
        }

        long totalBytes = connection.getContentLengthLong(); // -1 if unknown
        File apkFile = new File(getContext().getFilesDir(), "pending_update.apk");

        try (InputStream in = connection.getInputStream();
             FileOutputStream out = new FileOutputStream(apkFile)) {

            byte[] buffer = new byte[BUFFER_SIZE];
            long downloaded = 0;
            int bytesRead;

            while ((bytesRead = in.read(buffer)) != -1) {
                out.write(buffer, 0, bytesRead);
                downloaded += bytesRead;

                JSObject progress = new JSObject();
                progress.put("bytesDownloaded", downloaded);
                progress.put("totalBytes", totalBytes);
                progress.put("percent", totalBytes > 0 ? (int) (downloaded * 100 / totalBytes) : -1);
                notifyListeners("downloadProgress", progress);
            }
        } finally {
            connection.disconnect();
        }

        Log.i(TAG, "APK downloaded to " + apkFile.getAbsolutePath());
        return apkFile;
    }

    /**
     * Verifies the SHA-256 checksum of a file against the expected hex string.
     *
     * <p>This ensures the downloaded APK was not corrupted in transit or swapped by
     * a man-in-the-middle attacker (even over HTTPS, belt-and-suspenders).
     *
     * @param file             the file to checksum
     * @param expectedChecksum lowercase hex SHA-256 digest expected
     * @throws IOException        if the file cannot be read
     * @throws SecurityException  if the computed checksum does not match
     */
    private void verifyChecksum(File file, String expectedChecksum)
            throws IOException, SecurityException {
        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }

        try (FileInputStream fis = new FileInputStream(file)) {
            byte[] buffer = new byte[BUFFER_SIZE];
            int bytesRead;
            while ((bytesRead = fis.read(buffer)) != -1) {
                digest.update(buffer, 0, bytesRead);
            }
        }

        String actualChecksum = bytesToHex(digest.digest());
        if (!actualChecksum.equals(expectedChecksum)) {
            throw new SecurityException(
                    "Checksum mismatch — expected " + expectedChecksum + ", got " + actualChecksum);
        }
        Log.i(TAG, "Checksum verified: " + actualChecksum);
    }

    /**
     * Verifies that the APK at {@code apkFile} was signed with the same certificate
     * as the currently running application.
     *
     * <p><b>Why this matters:</b> Even if the download channel is secure and the
     * checksum matches, a compromised backend could serve a validly-checksummed APK
     * that was re-signed with an attacker-controlled key. Comparing signing certificate
     * fingerprints ensures only APKs built from our own keystore are ever installed.
     *
     * <p>The comparison is performed by:
     * <ol>
     *   <li>Reading the current app's signing certificate from {@link PackageManager}.</li>
     *   <li>Extracting the signing certificate from the downloaded APK via {@link JarFile}
     *       (Android APKs are signed JAR archives; the certificate is embedded in the
     *       {@code META-INF/} entries).</li>
     *   <li>Computing SHA-256 fingerprints of both certificates and comparing them.</li>
     * </ol>
     *
     * @param apkFile the APK whose signature to verify
     * @throws SecurityException if the signatures do not match or extraction fails
     * @throws IOException       if the APK file cannot be read
     */
    private void verifySignature(File apkFile) throws SecurityException, IOException {
        // Step 1: Get the SHA-256 fingerprint of the currently installed app's signing cert.
        byte[] currentCertBytes = getCurrentAppCertBytes();
        String currentFingerprint = certFingerprint(currentCertBytes);

        // Step 2: Extract the signing certificate from the downloaded APK.
        //
        // Android APKs are signed ZIP/JAR files. The signer's certificate is embedded in
        // the META-INF/ entries. To read it we must verify the JAR entry (which triggers
        // Java's built-in JAR signature verification) and then retrieve the certificate
        // from the entry's code signers.
        String apkFingerprint = extractApkCertFingerprint(apkFile);

        // Step 3: Compare fingerprints.
        if (!currentFingerprint.equals(apkFingerprint)) {
            throw new SecurityException(
                    "APK signature mismatch — the APK was not signed with this app's keystore. "
                            + "Current: " + currentFingerprint + ", APK: " + apkFingerprint);
        }
        Log.i(TAG, "APK signature verified — fingerprint: " + apkFingerprint);
    }

    /**
     * Retrieves the raw DER-encoded bytes of the first signing certificate for the
     * currently running application.
     *
     * @return DER certificate bytes
     * @throws SecurityException if the package info cannot be retrieved
     */
    private byte[] getCurrentAppCertBytes() throws SecurityException {
        try {
            Context context = getContext();
            PackageManager pm = context.getPackageManager();
            PackageInfo info = pm.getPackageInfo(
                    context.getPackageName(),
                    PackageManager.GET_SIGNING_CERTIFICATES);

            SigningInfo signingInfo = info.signingInfo;
            if (signingInfo == null) {
                throw new SecurityException("No signing info found for current package");
            }

            Signature[] signatures = signingInfo.hasMultipleSigners()
                    ? signingInfo.getApkContentsSigners()
                    : signingInfo.getSigningCertificateHistory();

            if (signatures == null || signatures.length == 0) {
                throw new SecurityException("No signatures found for current package");
            }

            return signatures[0].toByteArray();
        } catch (PackageManager.NameNotFoundException e) {
            throw new SecurityException("Cannot find current package", e);
        }
    }

    /**
     * Extracts the SHA-256 fingerprint of the signing certificate from a downloaded APK.
     *
     * <p>The method reads META-INF entries from the APK (which is a signed JAR) and
     * retrieves the {@link Certificate} objects attached to a verified entry. This relies
     * on Java's built-in JAR verification, which validates the signature chain before
     * returning certificates.
     *
     * @param apkFile the APK file to inspect
     * @return lowercase hex SHA-256 fingerprint of the signer certificate
     * @throws SecurityException if no signing certificate can be extracted
     * @throws IOException       if the APK cannot be opened or read
     */
    private String extractApkCertFingerprint(File apkFile) throws SecurityException, IOException {
        try (JarFile jar = new JarFile(apkFile, /* verify= */ true)) {
            // We need to read a signed entry to trigger certificate population.
            // AndroidManifest.xml is always present and signed.
            JarEntry manifestEntry = jar.getJarEntry("AndroidManifest.xml");
            if (manifestEntry == null) {
                throw new SecurityException("APK does not contain AndroidManifest.xml");
            }

            // Reading the entry causes Java to verify its signature and populate
            // getCodeSigners() / getCertificates().
            byte[] buffer = new byte[BUFFER_SIZE];
            try (InputStream is = jar.getInputStream(manifestEntry)) {
                //noinspection StatementWithEmptyBody
                while (is.read(buffer) != -1) {
                    // Consume stream to trigger verification
                }
            }

            Certificate[] certs = manifestEntry.getCertificates();
            if (certs == null || certs.length == 0) {
                throw new SecurityException(
                        "No certificates found in APK — the APK may not be signed");
            }

            // Use the first (leaf) certificate in the chain.
            return certFingerprint(certs[0].getEncoded());

        } catch (CertificateException e) {
            throw new SecurityException("Failed to encode APK certificate", e);
        }
    }

    /**
     * Computes the SHA-256 fingerprint of DER-encoded certificate bytes.
     *
     * @param certBytes DER-encoded certificate bytes
     * @return lowercase hex SHA-256 digest
     */
    private String certFingerprint(byte[] certBytes) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return bytesToHex(md.digest(certBytes));
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    /**
     * Initiates a silent APK installation using {@link PackageInstaller}.
     *
     * <p>This requires the app to be set as Device Owner. The installation is performed
     * in three steps:
     * <ol>
     *   <li>Create a {@link PackageInstaller.Session} with silent-install parameters.</li>
     *   <li>Stream the APK bytes into the session.</li>
     *   <li>Commit the session with a broadcast {@link IntentSender} that the OS uses
     *       to report the install result.</li>
     * </ol>
     *
     * <p>The JS promise is resolved or rejected from the broadcast receiver callback
     * after the OS reports the final install status.
     *
     * @param apkFile the verified APK to install
     * @param call    the plugin call to resolve/reject
     * @throws IOException if the session cannot be created or the APK cannot be streamed
     */
    private void silentInstall(File apkFile, PluginCall call) throws IOException {
        Context context = getContext();
        PackageInstaller installer = context.getPackageManager().getPackageInstaller();

        PackageInstaller.SessionParams params =
                new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(context.getPackageName());

        int sessionId = installer.createSession(params);
        PackageInstaller.Session session = installer.openSession(sessionId);

        try (FileInputStream in = new FileInputStream(apkFile);
             OutputStream out = session.openWrite("package", 0, apkFile.length())) {

            byte[] buffer = new byte[BUFFER_SIZE];
            int bytesRead;
            while ((bytesRead = in.read(buffer)) != -1) {
                out.write(buffer, 0, bytesRead);
            }
            session.fsync(out);
        }

        // Build a broadcast intent that PackageInstaller will send when the install completes.
        Intent resultIntent = new Intent(context, InstallStatusReceiver.class);
        resultIntent.putExtra(InstallStatusReceiver.EXTRA_CALL_CALLBACK_ID, call.getCallbackId());

        IntentSender statusReceiver = android.app.PendingIntent.getBroadcast(
                context,
                sessionId,
                resultIntent,
                android.app.PendingIntent.FLAG_UPDATE_CURRENT
                        | android.app.PendingIntent.FLAG_MUTABLE
        ).getIntentSender();

        // Store the call so the receiver can resolve/reject it.
        InstallStatusReceiver.registerCall(call.getCallbackId(), call);

        session.commit(statusReceiver);
        session.close();

        Log.i(TAG, "Install session committed, sessionId=" + sessionId);
    }

    // -------------------------------------------------------------------------
    // Utility helpers
    // -------------------------------------------------------------------------

    /**
     * Converts a byte array to a lowercase hexadecimal string.
     *
     * @param bytes the bytes to convert
     * @return hex string
     */
    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    /**
     * Deletes a file silently, logging any failure without throwing.
     *
     * @param file the file to delete, or {@code null} (no-op)
     */
    private static void deleteQuietly(File file) {
        if (file != null && file.exists()) {
            boolean deleted = file.delete();
            if (!deleted) {
                Log.w(TAG, "Failed to delete file: " + file.getAbsolutePath());
            }
        }
    }
}
