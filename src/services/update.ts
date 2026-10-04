import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

const REPO = 'FoysalAhammad/smarttrade';
const APK_CACHE_NAME = 'smart-trade-update.apk';
const FLAG_GRANT_READ = 0x00000001;

export interface UpdateInfo {
  version: string;
  title: string;
  notes: string;
  apkUrl: string;
}

const parse = (v: string): number[] =>
  v
    .replace(/^v/i, '')
    .split('.')
    .slice(0, 3)
    .map((p) => Number.parseInt(p, 10) || 0);

/** Semver-ish: remote > local ? */
export const isNewerVersion = (remote: string, local: string): boolean => {
  const r = parse(remote);
  const l = parse(local);
  for (let i = 0; i < 3; i += 1) {
    const a = r[i] ?? 0;
    const b = l[i] ?? 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false; // equal or older
};

/** Check if two version strings are equal */
export const isSameVersion = (remote: string, local: string): boolean => {
  const r = parse(remote);
  const l = parse(local);
  return r[0] === l[0] && r[1] === l[1] && r[2] === l[2];
};

/** Latest GitHub release, only when it is newer than the installed version. */
export const checkForUpdate = async (): Promise<UpdateInfo | null> => {
  try {
    console.log('[Update] Checking for updates...');
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    console.log('[Update] Response status:', res.status);
    if (!res.ok) {
      console.log('[Update] Response not ok');
      return null;
    }
    const rel = (await res.json()) as {
      tag_name?: string;
      name?: string;
      body?: string;
      assets?: { name?: string; browser_download_url?: string }[];
    };
    const tag = rel.tag_name ?? '';
    const local = Constants.expoConfig?.version ?? '1.0.0';
    console.log('[Update] Remote tag:', tag, 'Local version:', local);
    console.log('[Update] isNewerVersion:', isNewerVersion(tag, local));
    console.log('[Update] isSameVersion:', isSameVersion(tag, local));
    if (!tag) return null;
    // Don't show update if already on same or newer version
    if (isSameVersion(tag, local) || !isNewerVersion(tag, local)) {
      console.log('[Update] Already on latest version, skipping popup');
      return null;
    }
    const apk = (rel.assets ?? []).find((a) => (a.name ?? '').toLowerCase().endsWith('.apk'));
    console.log('[Update] APK asset:', apk?.name, apk?.browser_download_url);
    if (!apk?.browser_download_url) return null;
    return {
      version: tag.replace(/^v/i, ''),
      title: rel.name || tag,
      notes: (rel.body ?? '').slice(0, 600),
      apkUrl: apk.browser_download_url,
    };
  } catch (e) {
    console.log('[Update] Error:', e);
    return null;
  }
};

/**
 * Download the APK into the app cache (progress → 0-100) and hand it to the
 * system installer through the Expo FileProvider. One system confirmation tap
 * is required by Android; the app itself never needs storage permissions.
 */
export const downloadAndInstall = async (
  apkUrl: string,
  onProgress: (percent: number) => void,
): Promise<void> => {
  const target = `${FileSystem.cacheDirectory}${APK_CACHE_NAME}`;
  const task = FileSystem.createDownloadResumable(apkUrl, target, {}, (p) => {
    if (p.totalBytesExpectedToWrite > 0) {
      onProgress(
        Math.min(100, Math.round((p.totalBytesWritten / p.totalBytesExpectedToWrite) * 100)),
      );
    }
  });
  const res = await task.downloadAsync();
  if (!res || res.status !== 200) {
    throw new Error(`Download failed${res ? ` (HTTP ${res.status})` : ''}`);
  }
  const authority = `${Constants.applicationId}.FileSystemFileProvider`;
  const contentUri = `content://${authority}/cached_expo_files/${APK_CACHE_NAME}`;
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: 'application/vnd.android.package-archive',
    flags: FLAG_GRANT_READ,
  });
};
