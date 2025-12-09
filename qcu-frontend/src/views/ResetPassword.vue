<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from "vue-toastification";
import { supabase } from '../supabase';

const router = useRouter();
const toast = useToast();
const accessToken = ref(null);
const refreshToken = ref(null);
const newPassword = ref('');
const loading = ref(false);
const ready = ref(false);

const parseHash = () => {
  const hash = window.location.hash.replace('#', '');
  const params = new URLSearchParams(hash);
  accessToken.value = params.get('access_token');
  refreshToken.value = params.get('refresh_token');
};

const setSessionIfNeeded = async () => {
  if (!accessToken.value || !refreshToken.value) return;
  const { error } = await supabase.auth.setSession({
    access_token: accessToken.value,
    refresh_token: refreshToken.value,
  });
  if (error) throw error;
};

const submit = async () => {
  if (!newPassword.value) {
    toast.warning('Enter a new password.');
    return;
  }
  loading.value = true;
  try {
    await setSessionIfNeeded();
    const { error } = await supabase.auth.updateUser({ password: newPassword.value });
    if (error) throw error;
    toast.success('Password updated. Redirecting to login...');
    // Redirect after a short delay so the toast can show
    setTimeout(() => router.push('/login'), 1200);
  } catch (err) {
    console.error(err);
    toast.error(err.message || 'Failed to reset password.');
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  parseHash();
  if (!accessToken.value || !refreshToken.value) {
    toast.error('Invalid or missing reset token.');
  } else {
    try {
      await setSessionIfNeeded();
      ready.value = true;
    } catch (err) {
      console.error(err);
      toast.error('Could not validate reset token.');
    }
  }
});
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
    <div class="w-full max-w-md bg-white p-8 shadow-xl border border-gray-200 rounded">
      <h1 class="text-2xl font-black text-gray-900 mb-2">Reset Password</h1>
      <p class="text-sm text-gray-500 mb-6">Set your new password.</p>

      <div v-if="!ready" class="text-sm text-red-600">Waiting for reset token...</div>

      <form v-else @submit.prevent="submit" class="space-y-4">
        <div>
          <label class="text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1 block">New Password</label>
          <input v-model="newPassword" type="password" required class="w-full p-3 border border-gray-300 rounded focus:border-yellow-500 focus:ring-0 font-bold" placeholder="••••••••" />
        </div>
        <button :disabled="loading" class="w-full bg-black text-yellow-500 py-3 font-black uppercase tracking-widest hover:bg-gray-900 disabled:opacity-60 rounded">
          {{ loading ? 'Updating...' : 'Update Password' }}
        </button>
      </form>

      <router-link to="/login" class="block mt-4 text-xs font-bold uppercase text-yellow-600 hover:underline text-center">Back to Login</router-link>
    </div>
  </div>
</template>