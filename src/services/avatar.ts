// ═══════════════════════════════════════════════════════════
// Avatar Service — pick, compress, upload, update profile
//
// Compression pipeline adapted from BZZT (uploadPhoto.ts):
//   resize 600px → JPEG 70% → base64 → validate → upload
//
// Uses expo-image-picker + expo-image-manipulator + Supabase Storage.
// Falls back gracefully on permission denied, cancel, offline.
// ═══════════════════════════════════════════════════════════

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';
import { logDebugEvent } from '@/systems/debugEvents';

const BUCKET = 'avatars';

// Compression settings (from BZZT)
const RESIZE_WIDTH = 600;
const COMPRESS_QUALITY = 0.7;
const MAX_FILE_SIZE_KB = 4500; // 4.5 MB after compression
const UPLOAD_TIMEOUT_MS = 15_000; // 15s

export type AvatarResult =
  | { status: 'success'; url: string }
  | { status: 'cancelled' }
  | { status: 'permission_denied' }
  | { status: 'error'; message: string };

/**
 * Pick an image from the device gallery.
 * Returns the local URI or null if cancelled/denied.
 */
export async function pickAvatarImage(): Promise<
  { uri: string } | { cancelled: true } | { denied: true } | { error: string }
> {
  // Request permission
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    return { denied: true };
  }

  // Launch picker
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });

  if (result.canceled || !result.assets?.[0]) {
    return { cancelled: true };
  }

  return { uri: result.assets[0].uri };
}

/**
 * Upload avatar to Supabase Storage and update profile.
 *
 * Pipeline (from BZZT):
 *   1. Resize to 600px width, compress to JPEG 70%
 *   2. Read as base64
 *   3. Validate size (max 4.5MB)
 *   4. Upload with 15s timeout
 *   5. Update profile with public URL + cache buster
 */
export async function uploadAvatar(userId: string, localUri: string): Promise<AvatarResult> {
  if (!supabase) {
    return { status: 'error', message: 'Backend not configured' };
  }

  try {
    logDebugEvent('avatar', 'upload_start', 'start', { sessionId: userId });

    // ── Step 1: Compress & resize (from BZZT uploadPhoto.ts) ──
    console.log('[AVATAR] Compressing image...');
    const compressed = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: RESIZE_WIDTH } }],
      { compress: COMPRESS_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
    );
    console.log('[AVATAR] Compressed URI:', compressed.uri);

    // ── Step 2: Read as base64 (from BZZT) ──
    const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (!base64 || base64.length === 0) {
      console.error('[AVATAR] Compressed image is empty');
      return { status: 'error', message: 'Zdjęcie jest puste po kompresji. Wybierz inne.' };
    }

    // ── Step 3: Validate size (from BZZT) ──
    const fileSizeKB = Math.round((base64.length * 3) / 4 / 1024);
    console.log('[AVATAR] File size:', fileSizeKB, 'KB');

    if (fileSizeKB > MAX_FILE_SIZE_KB) {
      return {
        status: 'error',
        message: `Zdjęcie za duże (${(fileSizeKB / 1024).toFixed(1)}MB). Wybierz mniejsze.`,
      };
    }

    // ── Step 4: Upload with timeout (from BZZT) ──
    const filePath = `${userId}/avatar.jpg`;
    console.log('[AVATAR] Uploading to bucket:', filePath);

    const uploadPromise = supabase.storage
      .from(BUCKET)
      .upload(filePath, decode(base64), {
        contentType: 'image/jpeg',
        upsert: true,
      });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), UPLOAD_TIMEOUT_MS),
    );

    let uploadError;
    try {
      const result = await Promise.race([uploadPromise, timeoutPromise]);
      uploadError = result.error;
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'timeout') {
        console.error('[AVATAR] Upload timeout');
        return { status: 'error', message: 'Wolne połączenie. Spróbuj ponownie.' };
      }
      throw err;
    }

    if (uploadError) {
      logDebugEvent('avatar', 'upload_fail', 'fail', { payload: { error: uploadError.message } });
      return { status: 'error', message: 'Nie udało się wysłać zdjęcia' };
    }

    // ── Step 5: Public URL + cache buster + profile update ──
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(filePath);

    const publicUrl = urlData?.publicUrl;
    if (!publicUrl) {
      return { status: 'error', message: 'Nie udało się uzyskać adresu zdjęcia' };
    }

    const avatarUrl = `${publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId);

    if (updateError) {
      logDebugEvent('avatar', 'profile_update_fail', 'fail', { payload: { error: updateError.message } });
      return { status: 'error', message: 'Zdjęcie wysłane, ale nie udało się zaktualizować profilu' };
    }

    logDebugEvent('avatar', 'upload_ok', 'ok', { sessionId: userId });
    return { status: 'success', url: avatarUrl };
  } catch (e) {
    logDebugEvent('avatar', 'upload_error', 'fail', { payload: { error: String(e) } });
    return { status: 'error', message: 'Coś poszło nie tak' };
  }
}

/**
 * Remove avatar — clears avatar_url in profile.
 */
export async function removeAvatar(userId: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', userId);

    if (error) {
      logDebugEvent('avatar', 'remove_fail', 'fail', { payload: { error: error.message } });
      return false;
    }

    logDebugEvent('avatar', 'remove_ok', 'ok', { sessionId: userId });
    return true;
  } catch {
    return false;
  }
}
