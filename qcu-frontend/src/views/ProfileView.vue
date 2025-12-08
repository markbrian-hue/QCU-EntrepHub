<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from "vue-toastification";
import api from '../axios';

const router = useRouter();
const toast = useToast();
const user = ref(null);
const orders = ref([]);
const loading = ref(false);

const formatPrice = (amount) => 
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
};

onMounted(async () => {
  const userData = localStorage.getItem('user');
  if (!userData) {
    router.push('/login');
    return;
  }
  user.value = JSON.parse(userData);

  // Fetch Order History
  loading.value = true;
  try {
    const userId = user.value.userId || user.value.UserId;
    const response = await api.get(`/orders/customer/${userId}`);
    orders.value = response.data;
  } catch (error) {
    console.error(error);
  } finally {
    loading.value = false;
  }
});

const handleLogout = () => {
  localStorage.removeItem('user');
  toast.info("Logged out successfully"); 
  router.push('/login');
};

const statusColor = (status) => {
  const map = {
    'PENDING': 'bg-yellow-400 text-black border-yellow-500',
    'PREPARING': 'bg-blue-600 text-white border-blue-700',
    'READY': 'bg-purple-600 text-white border-purple-700',
    'COMPLETED': 'bg-green-600 text-white border-green-700'
  };
  return map[status] || 'bg-gray-200 text-gray-800';
}
</script>

<template>
  <div class="max-w-6xl mx-auto font-sans">
    
    <div class="flex flex-col md:flex-row justify-between items-end border-b border-gray-200 pb-6 mb-10">
      <div>
        <h2 class="text-xs font-bold text-yellow-600 uppercase tracking-widest mb-1">Account Overview</h2>
        <h1 class="text-4xl font-black text-gray-900 uppercase tracking-tighter">My Profile</h1>
      </div>
      <button @click="handleLogout" class="mt-4 md:mt-0 text-gray-400 font-bold uppercase text-xs tracking-widest hover:text-red-600 hover:underline transition">
        Sign Out
      </button>
    </div>

    <div class="grid md:grid-cols-3 gap-12">
      
      <div class="md:col-span-1">
        <div class="bg-gray-900 text-white p-8 border-l-8 border-yellow-500 sticky top-24 shadow-xl">
          
          <div class="w-16 h-16 bg-yellow-500 flex items-center justify-center text-3xl font-black text-gray-900 mb-6 uppercase shadow-lg">
            {{ user?.fullName?.charAt(0) }}
          </div>
          
          <h2 class="text-2xl font-bold uppercase tracking-tight leading-none">{{ user?.fullName }}</h2>
          <p class="text-yellow-500 text-xs font-bold uppercase tracking-widest mt-2 mb-8 border-b border-gray-800 pb-4">
            {{ user?.role }} Account
          </p>
          
          <div class="space-y-6 text-sm">
            <div>
              <span class="block text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Student Number / ID</span>
              <span class="font-bold text-white text-lg tracking-wide">{{ user?.studentNumber }}</span>
            </div>
            
            <div v-if="user?.role === 'VENDOR'">
              <span class="block text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Shop Name</span>
              <span class="font-bold text-white text-lg tracking-wide">{{ user?.ShopName }}</span>
            </div>
          </div>

        </div>
      </div>

      <div class="md:col-span-2">
        <div class="flex items-center gap-4 mb-8">
          <h3 class="text-2xl font-black text-gray-900 uppercase tracking-tight">Order History</h3>
          <span class="bg-yellow-500 text-black text-xs font-bold px-2 py-1">{{ orders.length }}</span>
        </div>

        <div v-if="loading" class="space-y-4">
          <div v-for="n in 3" :key="n" class="h-32 bg-gray-100 animate-pulse border border-gray-200"></div>
        </div>

        <div v-else-if="orders.length === 0" class="text-center py-24 border-2 border-dashed border-gray-300 bg-gray-50">
          <p class="text-gray-400 font-bold uppercase text-sm tracking-wide">No orders found</p>
          <router-link to="/" class="text-yellow-600 text-xs font-black uppercase hover:underline mt-2 inline-block tracking-widest">
            Start Shopping
          </router-link>
        </div>

        <div v-else class="space-y-6">
          <div v-for="order in orders" :key="order.orderId" class="bg-white border border-gray-200 p-0 hover:border-black transition group shadow-sm">
            
            <div class="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
              <div class="flex gap-4 items-center">
                <span class="font-black text-gray-900 uppercase tracking-tight">Order #{{ order.orderId }}</span>
                <span class="text-xs text-gray-500 font-bold uppercase tracking-wide">{{ formatDate(order.createdAt) }}</span>
              </div>
              <span :class="statusColor(order.status)" class="px-3 py-1 text-[10px] font-black uppercase tracking-widest shadow-sm">
                {{ order.status }}
              </span>
            </div>

            <div class="p-6">
              <div class="flex justify-between items-start mb-4">
                <div>
                  <p class="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">Vendor</p>
                  <p class="font-bold text-gray-800 uppercase">{{ order.shopName }}</p>
                </div>
                <div class="text-right">
                  <p class="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">Total</p>
                  <p class="text-xl font-black text-yellow-600">{{ formatPrice(order.totalAmount) }}</p>
                </div>
              </div>

              <div class="flex items-center gap-2 text-xs font-bold text-gray-500 bg-gray-50 p-3 border border-gray-100 uppercase tracking-wide">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Drop-off: <span class="text-gray-900">{{ order.deliveryLocation }}</span></span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  </div>
</template>