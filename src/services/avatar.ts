// ═══════════════════════════════════════════════════════════
// Avatar Service — pick, upload, update profile
//
// Uses expo-image-picker + Supabase Storage (avatars bucket).
// Falls back gracefully on permission denied, cancel, offline.
// ═══════════════════════════════════════════════════════════

import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { logDebugEvent } from '@/systems/debugEvents';

const BUCKET = 'avatars';
const MAX_SIZE_MB = 2;

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
 * Returns the public URL on success.
 */
export async function uploadAvatar(userId: string, localUri: string): Promise<AvatarResult> {
  if (!supabase) {
    return { status: 'error', message: 'Backend not configured' };
  }

  try {
    logDebugEvent('avatar', 'upload_start', 'start', { sessionId: userId });

    // Read file as blob
    const response = await fetch(localUri);
    const blob = await response.blob();

    // Check size
    if (blob.size > MAX_SIZE_MB * 1024 * 1024) {
      return { status: 'error', message: `Zdjęcie jest za duże (max ${MAX_SIZE_MB}MB)` };
    }

    // Determine extension from MIME
    const ext = blob.type === 'image/png' ? 'png' : 'jpg';
    const filePath = `${userId}/avatar.${ext}`;

    // Upload (upsert — replaces existing)
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, blob, {
        upsert: true,
        contentType: blob.type,
      });

    if (uploadError) {
      logDebugEvent('avatar', 'upload_fail', 'fail', { payload: { error: uploadError.message } });
      return { status: 'error', message: 'Nie udało się wysłać zdjęcia' };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(filePath);

    const publicUrl = urlData?.publicUrl;
    if (!publicUrl) {
      return { status: 'error', message: 'Nie udało się uzyskać adresu zdjęcia' };
    }

    // Add cache buster to force refresh
    const avatarUrl = `${publicUrl}?t=${Date.now()}`;

    // Update profile
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
