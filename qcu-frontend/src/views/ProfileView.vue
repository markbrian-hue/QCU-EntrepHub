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

// Details Modal State
const showDetailsModal = ref(false);
const selectedOrder = ref(null);
const orderItems = ref([]);
const loadingItems = ref(false);

// Confirmation Modal State (New)
const showConfirmModal = ref(false);
const confirmConfig = ref({
  title: '',
  message: '',
  action: null, // 'CANCEL' or 'RECEIVE'
  orderId: null,
  confirmButtonText: '',
  confirmButtonColor: ''
});

const formatPrice = (amount) => 
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

onMounted(async () => {
  const userData = localStorage.getItem('user');
  if (!userData) { router.push('/login'); return; }
  user.value = JSON.parse(userData);
  await fetchOrders();
});

const fetchOrders = async () => {
  loading.value = true;
  try {
    const userId = user.value.userId || user.value.UserId;
    const response = await api.get(`/orders/customer/${userId}`);
    orders.value = response.data;
  } catch (error) { console.error(error); } 
  finally { loading.value = false; }
};

const handleLogout = () => {
  localStorage.removeItem('user');
  toast.info("Logged out successfully"); 
  router.push('/login');
};

// --- DETAILS MODAL ---
const openOrderDetails = async (order) => {
  // Prevent clicking if completed (Optional, per your previous request)
  if (order.status === 'COMPLETED' || order.status === 'CANCELLED') return;

  selectedOrder.value = order;
  showDetailsModal.value = true;
  loadingItems.value = true;

  try {
    const res = await api.get(`/orders/details/${order.orderId}`);
    orderItems.value = res.data;
  } catch (err) {
    toast.error("Failed to load items.");
  } finally {
    loadingItems.value = false;
  }
};

const closeDetailsModal = () => {
  showDetailsModal.value = false;
  selectedOrder.value = null;
  orderItems.value = [];
};

// --- CONFIRMATION POPUP LOGIC ---

const triggerCancel = (orderId) => {
  confirmConfig.value = {
    title: 'Cancel Order?',
    message: 'Are you sure you want to cancel this order? This action cannot be undone.',
    action: 'CANCEL',
    orderId: orderId,
    confirmButtonText: 'Yes, Cancel Order',
    confirmButtonColor: 'bg-red-600 hover:bg-red-700'
  };
  showConfirmModal.value = true;
};

const triggerReceive = (orderId) => {
  confirmConfig.value = {
    title: 'Order Received?',
    message: 'Please confirm that you have physically received your items. This will complete the transaction.',
    action: 'RECEIVE',
    orderId: orderId,
    confirmButtonText: 'Yes, I Received It',
    confirmButtonColor: 'bg-green-600 hover:bg-green-700'
  };
  showConfirmModal.value = true;
};

const handleConfirmAction = async () => {
  const { action, orderId } = confirmConfig.value;
  showConfirmModal.value = false; // Close modal immediately

  try {
    if (action === 'CANCEL') {
      await api.put(`/orders/${orderId}/status`, { status: 'CANCELLED' });
      toast.info("Order cancelled successfully.");
    } else if (action === 'RECEIVE') {
      await api.put(`/orders/${orderId}/status`, { status: 'COMPLETED' });
      toast.success("Transaction completed! Enjoy your purchase.");
      // Close details modal if it's open (since user might click receive from inside details)
      closeDetailsModal(); 
    }
    await fetchOrders(); // Refresh list
  } catch (err) {
    toast.error("Failed to update order status.");
  }
};

const statusColor = (status) => {
  const map = {
    'PENDING': 'bg-yellow-400 text-black border-yellow-500',
    'PREPARING': 'bg-blue-600 text-white border-blue-700',
    'READY': 'bg-purple-600 text-white border-purple-700', 
    'READY_FOR_PICKUP': 'bg-purple-600 text-white border-purple-700', 
    'COMPLETED': 'bg-green-600 text-white border-green-700',
    'CANCELLED': 'bg-red-100 text-red-600 border-red-200'
  };
  return map[status] || 'bg-gray-200 text-gray-800';
}
</script>

<template>
  <div class="max-w-6xl mx-auto font-sans p-6">
    
    <div class="flex flex-col md:flex-row justify-between items-end border-b-4 border-yellow-500 pb-6 mb-10">
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
              <span class="block text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Student Number</span>
              <span class="font-bold text-white text-lg tracking-wide">{{ user?.studentNumber }}</span>
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
          <div 
            v-for="order in orders" 
            :key="order.orderId" 
            @click="openOrderDetails(order)"
            class="bg-white border border-gray-200 p-0 transition group shadow-sm relative"
            :class="(order.status === 'COMPLETED' || order.status === 'CANCELLED') ? 'opacity-75 bg-gray-50' : 'cursor-pointer hover:border-black hover:shadow-md'"
          >
            
            <div class="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
              <div class="flex gap-4 items-center">
                <span class="font-black text-gray-900 uppercase tracking-tight">Order #{{ order.orderId }}</span>
                <span class="text-xs text-gray-500 font-bold uppercase tracking-wide">{{ formatDate(order.createdAt) }}</span>
              </div>
              <span :class="statusColor(order.status)" class="px-3 py-1 text-[10px] font-black uppercase tracking-widest shadow-sm">
                {{ order.status === 'READY_FOR_PICKUP' ? 'READY' : order.status }}
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
              
              <div class="flex items-center gap-2 text-xs font-bold text-gray-500 bg-gray-50 p-3 border border-gray-100 uppercase tracking-wide mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Drop-off: <span class="text-gray-900">{{ order.deliveryLocation }}</span></span>
              </div>

              <div class="flex justify-between items-center border-t border-gray-100 pt-4" @click.stop>
                
                <button 
                  v-if="order.status === 'PENDING'" 
                  @click="triggerCancel(order.orderId)"
                  class="text-xs font-bold text-red-500 hover:text-red-700 hover:underline uppercase tracking-wide"
                >
                  Cancel Order
                </button>
                <span v-else-if="order.status === 'CANCELLED'" class="text-xs font-bold text-gray-400 uppercase italic">
                  Order Cancelled
                </span>
                <span v-else class="text-xs font-bold text-gray-400 uppercase italic">
                  Processing Started (Cannot Cancel)
                </span>

                <span v-if="order.status !== 'COMPLETED' && order.status !== 'CANCELLED'" class="text-[10px] font-bold text-yellow-600 uppercase tracking-widest group-hover:underline cursor-pointer" @click="openOrderDetails(order)">
                  View Items
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showDetailsModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="closeDetailsModal"></div>
      
      <div class="bg-white w-full max-w-lg relative z-10 shadow-2xl border-t-8 border-yellow-500 animate-fade-in-up p-8">
        
        <div class="flex justify-between items-start mb-6 border-b border-gray-200 pb-4">
          <div>
            <h2 class="text-2xl font-black text-gray-900 uppercase tracking-tight">Order Details</h2>
            <p class="text-xs font-bold text-gray-500 uppercase tracking-wide">Transaction #{{ selectedOrder?.orderId }}</p>
          </div>
          <button @click="closeDetailsModal" class="text-gray-400 hover:text-black font-bold">X</button>
        </div>

        <div v-if="loadingItems" class="space-y-2"><div class="h-10 bg-gray-100 animate-pulse"></div></div>
        <div v-else class="space-y-4 max-h-60 overflow-y-auto pr-2">
            <div v-for="item in orderItems" :key="item.order_item_id" class="flex gap-4 items-center bg-gray-50 p-3 border border-gray-200">
                <img :src="item.image_url || 'https://via.placeholder.com/50'" class="w-12 h-12 object-cover border border-gray-300" />
                <div class="flex-1">
                    <p class="font-bold text-sm text-gray-800 uppercase leading-none">{{ item.name }}</p>
                    <p class="text-xs text-gray-500 font-medium">{{ item.quantity }} x {{ formatPrice(item.price) }}</p>
                </div>
                <p class="font-black text-sm text-gray-900">{{ formatPrice(item.quantity * item.price_at_order) }}</p>
            </div>
        </div>

        <div class="flex justify-between items-center border-t-2 border-black pt-4 mt-6">
            <span class="font-bold text-gray-900 uppercase">Total Amount</span>
            <span class="text-2xl font-black text-yellow-600">{{ formatPrice(selectedOrder?.totalAmount) }}</span>
        </div>

        <div v-if="selectedOrder?.status === 'READY' || selectedOrder?.status === 'READY_FOR_PICKUP'" class="mt-8">
            <button 
                @click="triggerReceive(selectedOrder.orderId)" 
                class="w-full bg-black text-white py-4 font-bold uppercase tracking-widest hover:bg-green-600 transition shadow-lg"
            >
                Received
            </button>
        </div>
      </div>
    </div>

    <div v-if="showConfirmModal" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showConfirmModal = false"></div>
      <div class="bg-white w-full max-w-sm relative z-10 p-6 shadow-2xl border-l-8 animate-fade-in-up" 
           :class="confirmConfig.action === 'CANCEL' ? 'border-red-600' : 'border-green-600'">
          
          <h3 class="text-xl font-black text-gray-900 uppercase mb-2">{{ confirmConfig.title }}</h3>
          <p class="text-sm text-gray-600 mb-6">{{ confirmConfig.message }}</p>

          <div class="flex gap-3">
            <button @click="showConfirmModal = false" class="flex-1 py-3 bg-gray-100 text-gray-600 font-bold uppercase text-xs hover:bg-gray-200">
              No, Go Back
            </button>
            <button @click="handleConfirmAction" class="flex-1 py-3 text-white font-bold uppercase text-xs shadow-md" 
                    :class="confirmConfig.confirmButtonColor">
              {{ confirmConfig.confirmButtonText }}
            </button>
          </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.animate-fade-in-up { animation: fadeInUp 0.3s ease-out; }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>