<script setup>
import { RouterView, useRouter, useRoute } from 'vue-router';
import { ref, watch, onMounted } from 'vue';
import { useCartStore } from './stores/cart';
import { useToast } from "vue-toastification";

const router = useRouter();
const route = useRoute();
const cartStore = useCartStore();
const toast = useToast();

const isLoggedIn = ref(false);
const isVendor = ref(false);

const checkUserStatus = () => {
  const userData = localStorage.getItem('user');
  if (userData) {
    isLoggedIn.value = true;
    const user = JSON.parse(userData);
    const role = user.role || user.Role;
    isVendor.value = (role === 'VENDOR' || role === 'Vendor');
  } else {
    isLoggedIn.value = false;
    isVendor.value = false;
  }
};

onMounted(() => checkUserStatus());
watch(() => route.path, () => checkUserStatus());

const handleLogout = () => {
  localStorage.removeItem('user');
  cartStore.clearCart();
  isLoggedIn.value = false;
  isVendor.value = false;
  toast.info("Logged out successfully"); 
  router.push('/login');
};
</script>

<template>
  <div class="min-h-screen bg-white font-sans text-gray-900">
    <nav class="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div class="container mx-auto px-6 py-4 flex justify-between items-center">
        
        <div class="flex items-center gap-3 group cursor-pointer" @click="router.push('/')">
          <div class="bg-yellow-500 text-black font-black px-3 py-1 text-lg group-hover:bg-yellow-400 transition-colors shadow-sm">
            QCU
          </div>
          <h1 class="text-xl font-bold tracking-tight text-gray-900 uppercase">
            Entrep Hub
          </h1>
        </div>
        
        <div class="flex items-center gap-8 text-sm font-bold uppercase tracking-wide text-gray-500">
          <router-link to="/" active-class="text-yellow-600 border-b-2 border-yellow-500" class="hover:text-yellow-600 py-1 transition-all">Shop</router-link>
          
          <router-link to="/cart" active-class="text-yellow-600 border-b-2 border-yellow-500" class="hover:text-yellow-600 py-1 transition-all flex items-center gap-2">
            Cart
            <span v-if="cartStore.totalItems > 0" class="bg-black text-yellow-500 text-[10px] px-1.5 py-0.5 font-bold shadow-sm">
              {{ cartStore.totalItems }}
            </span>
          </router-link>

          <router-link 
            v-if="isVendor" 
            to="/vendor" 
            active-class="text-yellow-600 border-b-2 border-yellow-500"
            class="hover:text-yellow-600 py-1 transition-all"
          >
            Dashboard
          </router-link>

          <div v-if="isLoggedIn" class="flex items-center gap-6 pl-6 border-l border-gray-300">
  <router-link to="/profile" active-class="text-yellow-600" class="hover:text-yellow-600 transition font-bold uppercase text-xs tracking-wide">
    My Profile
  </router-link>
  <button @click="handleLogout" class="hover:text-black transition font-bold uppercase text-xs tracking-wide">
    Logout
  </button>
</div>
        </div>

      </div>
    </nav>

    <main class="container mx-auto px-6 py-8">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<style>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>