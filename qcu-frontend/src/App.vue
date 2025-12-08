<script setup>
import { RouterView, useRouter, useRoute } from 'vue-router';
import { ref, watch, onMounted } from 'vue';
import { useCartStore } from './stores/cart';
import { useToast } from "vue-toastification";
import api from './axios'; // Import API

const router = useRouter();
const route = useRoute();
const cartStore = useCartStore();
const toast = useToast();

const isLoggedIn = ref(false);
const isVendor = ref(false);
const isAdmin = ref(false);

// Notification State
const showNotifications = ref(false);
const announcements = ref([]);
const hasNew = ref(false);

const checkUserStatus = () => {
  const userData = localStorage.getItem('user');
  if (userData) {
    isLoggedIn.value = true;
    const user = JSON.parse(userData);
    const role = user.role || user.Role;
    isVendor.value = (role === 'VENDOR' || role === 'Vendor');
    isAdmin.value = (role === 'ADMIN');
    fetchAnnouncements(); // Fetch on load
  } else {
    isLoggedIn.value = false;
    isVendor.value = false;
    isAdmin.value = false;
  }
};

const fetchAnnouncements = async () => {
  try {
    const res = await api.get('/announcements');
    announcements.value = res.data;
    // Simple check: If list > 0, show red dot (Enhancement: store 'last read' in localstorage)
    hasNew.value = announcements.value.length > 0;
  } catch (err) { console.error(err); }
};

const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value;
  if (showNotifications.value) hasNew.value = false; // Clear red dot when opened
};

onMounted(() => checkUserStatus());
watch(() => route.path, () => checkUserStatus());

const handleLogout = () => {
  localStorage.removeItem('user');
  cartStore.clearCart();
  isLoggedIn.value = false;
  isVendor.value = false;
  isAdmin.value = false;
  toast.info("Logged out successfully"); 
  router.push('/login');
};

const handleLogoClick = () => {
  if (isAdmin.value) router.push('/admin'); else router.push('/');
};
</script>

<template>
  <div class="min-h-screen bg-white font-sans text-gray-900">
    <nav class="bg-white border-b-4 border-yellow-500 sticky top-0 z-50 shadow-md">
      <div class="container mx-auto px-6 py-4 flex justify-between items-center">
        
        <div class="flex items-center gap-3 group cursor-pointer" @click="handleLogoClick">
          <div class="bg-yellow-500 text-black font-black px-3 py-1 text-lg uppercase tracking-wider hover:bg-black hover:text-yellow-500 transition-colors duration-300">QCU</div>
          <div class="flex flex-col">
            <h1 class="text-xl font-black tracking-tighter text-gray-900 uppercase leading-none">Entrep Hub</h1>
            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Official Marketplace</span>
          </div>
        </div>
        
        <div class="flex items-center gap-6 text-xs font-bold uppercase tracking-widest text-gray-500">
          
          <router-link v-if="!isAdmin" to="/" active-class="text-black" class="hover:text-yellow-600 transition-colors py-2 border-b-2 border-transparent hover:border-yellow-500">Shop</router-link>
          
          <router-link v-if="!isAdmin" to="/cart" active-class="text-black" class="hover:text-yellow-600 transition-colors py-2 flex items-center gap-2 group">
            Cart
            <span v-if="cartStore.totalItems > 0" class="bg-black text-yellow-500 text-[10px] px-1.5 py-0.5 font-black group-hover:bg-yellow-500 group-hover:text-black transition-colors">{{ cartStore.totalItems }}</span>
          </router-link>

          <router-link v-if="isVendor" to="/vendor" active-class="text-black" class="hover:text-yellow-600 transition-colors py-2 border-b-2 border-transparent hover:border-yellow-500">Dashboard</router-link>
          <router-link v-if="isAdmin" to="/admin" active-class="text-black" class="text-red-700 hover:text-red-900 transition-colors py-2 border-b-2 border-transparent hover:border-red-700">Admin Console</router-link>

          <div v-if="isLoggedIn" class="relative">
            <button @click="toggleNotifications" class="p-2 hover:text-yellow-600 transition relative">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg>
              <span v-if="hasNew" class="absolute top-1 right-1 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white"></span>
            </button>

            <div v-if="showNotifications" class="absolute right-0 mt-2 w-80 bg-white border border-gray-200 shadow-xl z-50 animate-fade-in-up">
              <div class="p-4 border-b border-gray-100 bg-gray-50">
                <h4 class="text-xs font-black text-gray-900 uppercase">Announcements</h4>
              </div>
              <div class="max-h-64 overflow-y-auto">
                <div v-if="announcements.length === 0" class="p-6 text-center text-gray-400 italic">No updates yet.</div>
                <div v-for="item in announcements" :key="item.id" class="p-4 border-b border-gray-100 hover:bg-yellow-50 transition">
                  <h5 class="font-bold text-gray-900 text-xs uppercase mb-1">{{ item.title }}</h5>
                  <p class="text-gray-600 text-[10px] normal-case leading-relaxed">{{ item.message }}</p>
                  <span class="text-[9px] text-gray-400 mt-2 block">{{ new Date(item.created_at).toLocaleDateString() }}</span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="isLoggedIn" class="flex items-center gap-6 pl-6 border-l-2 border-gray-100">
            <router-link to="/profile" active-class="text-black" class="hover:text-yellow-600 transition-colors">Profile</router-link>
            <button @click="handleLogout" class="text-red-600 hover:text-red-800 transition-colors">Logout</button>
          </div>

          <div v-else class="pl-6 border-l-2 border-gray-100">
            <router-link to="/login" class="px-6 py-3 bg-black text-white font-black hover:bg-yellow-500 hover:text-black transition-all duration-300 shadow-sm">Login</router-link>
          </div>
        </div>
      </div>
    </nav>
    <main class="container mx-auto px-6 py-8"><router-view v-slot="{ Component }"><transition name="fade" mode="out-in"><component :is="Component" /></transition></router-view></main>
  </div>
</template>

<style>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.animate-fade-in-up { animation: fadeInUp 0.2s ease-out; }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
</style>