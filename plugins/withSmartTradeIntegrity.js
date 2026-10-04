/**
 * Smart Trade integrity gate.
 *
 * Injects a runtime check into MainApplication.onCreate():
 *  - APK signing certificate SHA-256 must match the pinned value
 *  - FLAG_DEBUGGABLE must be clear (release builds only)
 * Any mismatch throws → the app crashes on launch. Because a modified APK
 * must be re-signed with a different key (signature pin) or is installed as
 * debug, patched/tampered builds never reach JavaScript — ad ids, keys and
 * business logic stay unreachable.
 */
const fs = require('fs');
const path = require('path');

const MARKER = 'Smart Trade integrity gate';

const buildBlock = (sha256, ind) => `${ind}// ${MARKER} (generated — do not edit)
${ind}try {
${ind}    val pm = packageManager
${ind}    val pkg = packageName
${ind}    val bytes: ByteArray = if (android.os.Build.VERSION.SDK_INT >= 28) {
${ind}        val si = pm.getPackageInfo(pkg, android.content.pm.PackageManager.GET_SIGNING_CERTIFICATES).signingInfo
${ind}            ?: throw IllegalStateException("no-signing-info")
${ind}        if (si.hasMultipleSigners()) si.apkContentsSigners[0].toByteArray()
${ind}        else si.signingCertificateHistory[0].toByteArray()
${ind}    } else {
${ind}        @Suppress("DEPRECATION")
${ind}        pm.getPackageInfo(pkg, android.content.pm.PackageManager.GET_SIGNATURES).signatures!![0].toByteArray()
${ind}    }
${ind}    val hex = java.security.MessageDigest.getInstance("SHA-256")
${ind}        .digest(bytes).joinToString("") { "%02x".format(it) }
${ind}    if (!hex.equals("${sha256}", ignoreCase = true)) throw IllegalStateException("sig-mismatch actual=" + hex)
${ind}    if ((applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0)
${ind}        throw IllegalStateException("debug-flag")
${ind}} catch (t: Throwable) {
${ind}    throw RuntimeException("Security verification failed: " + t.message, t)
${ind}}
`;

const withSmartTradeIntegrity = (config, options = {}) =>
  require('@expo/config-plugins').withDangerousMod(config, [
    'android',
    async (cfg) => {
      const sha = options.signatureSha256;
      if (!sha || !/^[0-9a-fA-F]{64}$/.test(sha)) {
        console.warn('[integrity] signatureSha256 missing/invalid — check skipped');
        return cfg;
      }
      const file = path.join(
        cfg.modRequest.platformProjectRoot,
        'app/src/main/java/com/suiswing/swingtrader/MainApplication.kt',
      );
      let src = fs.readFileSync(file, 'utf8');
      if (!src.includes(MARKER)) {
        const m = src.match(/^([ \t]*)override fun onCreate\(\) \{[ \t]*$/m);
        if (!m) {
          throw new Error('[integrity] MainApplication.kt onCreate() not found');
        }
        src = src.replace(m[0], `${m[0]}\n${buildBlock(sha, m[1] === '\t' ? '\t' : m[1] + '  ').trimEnd()}`);
        fs.writeFileSync(file, src);
        console.log('[integrity] signature pin injected');
      }
      return cfg;
    },
  ]);

module.exports = withSmartTradeIntegrity;
