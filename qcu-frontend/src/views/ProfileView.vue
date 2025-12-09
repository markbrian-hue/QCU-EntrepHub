<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from "vue-toastification";
import { supabase } from '../supabase';

const router = useRouter();
const toast = useToast();
const user = ref(null);
const orders = ref([]);
const loading = ref(false);

const showDetailsModal = ref(false);
const selectedOrder = ref(null);
const orderItems = ref([]);
const loadingItems = ref(false);

const showConfirmModal = ref(false);
const confirmConfig = ref({
  title: '',
  message: '',
  action: null, 
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
  if (user.value?.userId || user.value?.UserId) await fetchOrders();
});

const fetchOrders = async () => {
  loading.value = true;
  try {
    const userId = user.value.userId || user.value.UserId;
    const { data, error } = await supabase
      .from('orders')
      .select(`*, vendors ( shop_name )`)
      .eq('customer_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    orders.value = data.map(o => ({
      orderId: o.order_id,
      totalAmount: o.total_amount,
      status: o.status,
      deliveryLocation: o.delivery_location,
      createdAt: o.created_at,
      shopName: o.vendors?.shop_name || 'Unknown Shop'
    }));
  } catch (error) { 
    console.error(error);
  } finally { 
    loading.value = false; 
  }
};

const handleLogout = () => {
  localStorage.removeItem('user');
  toast.info("Logged out successfully"); 
  router.push('/login');
};

const openOrderDetails = async (order) => {
  if (order.status === 'COMPLETED' || order.status === 'CANCELLED') return;
  selectedOrder.value = order;
  showDetailsModal.value = true;
  loadingItems.value = true;

  try {
    const { data, error } = await supabase
      .from('order_items')
      .select(`quantity, price_at_order, products ( name, image_url )`)
      .eq('order_id', order.orderId);

    if (error) throw error;

    orderItems.value = data.map(i => ({
      name: i.products?.name,
      imageUrl: i.products?.image_url,
      quantity: i.quantity,
      price: i.price_at_order
    }));
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

const triggerCancel = (orderId) => {
  confirmConfig.value = {
    title: 'CANCEL ORDER?',
    message: 'Are you sure? This action cannot be undone.',
    action: 'CANCEL',
    orderId: orderId,
    confirmButtonText: 'YES, CANCEL ORDER',
    confirmButtonColor: 'bg-red-600 hover:bg-red-700'
  };
  showConfirmModal.value = true;
};

const triggerReceive = (orderId) => {
  confirmConfig.value = {
    title: 'ORDER RECEIVED?',
    message: 'Please confirm you have received the items. This will update the stock.',
    action: 'RECEIVE',
    orderId: orderId,
    confirmButtonText: 'CONFIRM RECEIPT',
    confirmButtonColor: 'bg-green-600 hover:bg-green-700'
  };
  showConfirmModal.value = true;
};

const handleConfirmAction = async () => {
  const { action, orderId } = confirmConfig.value;
  showConfirmModal.value = false;

  try {
    if (action === 'CANCEL') {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'CANCELLED' })
        .eq('order_id', orderId);
      if (error) throw error;
      toast.info("Order cancelled.");
    } else if (action === 'RECEIVE') {
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('product_id, quantity')
        .eq('order_id', orderId);
      if (itemsError) throw itemsError;

      for (const item of items) {
        const { data: product } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('product_id', item.product_id)
          .single();
        if (product) {
          const newStock = Math.max(0, product.stock_quantity - item.quantity);
          await supabase
            .from('products')
            .update({ stock_quantity: newStock })
            .eq('product_id', item.product_id);
        }
      }

      const { error } = await supabase
        .from('orders')
        .update({ status: 'COMPLETED' })
        .eq('order_id', orderId);
      if (error) throw error;
      toast.success("Transaction completed, thank you for purchasing!");
      closeDetailsModal();
    }
    await fetchOrders(); 
  } catch (err) {
    console.error(err);
    toast.error("Failed to update order.");
  }
};

const statusColor = (status) => {
  const map = {
    'PENDING': 'bg-yellow-400 text-black',
    'PREPARING': 'bg-blue-600 text-white',
    'READY': 'bg-purple-600 text-white', 
    'READY_FOR_PICKUP': 'bg-purple-600 text-white', 
    'COMPLETED': 'bg-green-600 text-white',
    'CANCELLED': 'bg-red-600 text-white'
  };
  return map[status] || 'bg-gray-200 text-gray-800';
}
</script>

<template>
  <div class="max-w-6xl mx-auto font-sans p-4 sm:p-6 space-y-6">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-end border-b-4 border-yellow-500 pb-4 md:pb-6 gap-3">
      <div>
        <h2 class="text-[11px] sm:text-xs font-bold text-yellow-600 uppercase tracking-widest mb-1">Account Overview</h2>
        <h1 class="text-3xl sm:text-4xl font-black text-gray-900 uppercase tracking-tighter">My Profile</h1>
      </div>
      <button @click="handleLogout" class="text-gray-400 font-bold uppercase text-[11px] sm:text-xs tracking-widest hover:text-red-600 hover:underline transition">
        Sign Out
      </button>
    </div>

    <div class="grid md:grid-cols-3 gap-6 md:gap-12">
      <div class="md:col-span-1">
        <div class="bg-gray-900 text-white p-6 sm:p-8 border-l-8 border-yellow-500 sticky top-24 shadow-xl rounded">
          <div class="w-14 h-14 sm:w-16 sm:h-16 bg-yellow-500 flex items-center justify-center text-2xl sm:text-3xl font-black text-gray-900 mb-4 sm:mb-6 uppercase shadow-lg rounded">
            {{ user?.fullName?.charAt(0) }}
          </div>
          <h2 class="text-xl sm:text-2xl font-bold uppercase tracking-tight leading-none">{{ user?.fullName }}</h2>
          <p class="text-yellow-500 text-[11px] sm:text-xs font-bold uppercase tracking-widest mt-2 mb-6 sm:mb-8 border-b border-gray-800 pb-3">
            {{ user?.role }} Account
          </p>
          <div class="space-y-5 text-sm">
            <div>
              <span class="block text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">Email / ID</span>
              <span class="font-bold text-white text-lg tracking-wide break-all">{{ user?.studentNumber }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="md:col-span-2 space-y-4">
        <div class="flex items-center gap-3">
          <h3 class="text-xl sm:text-2xl font-black text-gray-900 uppercase tracking-tight">Order History</h3>
          <span class="bg-yellow-500 text-black text-[11px] sm:text-xs font-bold px-2 py-1 rounded">{{ orders.length }}</span>
        </div>

        <div v-if="loading" class="space-y-4">
          <div v-for="n in 3" :key="n" class="h-28 sm:h-32 bg-gray-100 animate-pulse border border-gray-200 rounded"></div>
        </div>

        <div v-else-if="orders.length === 0" class="text-center py-16 sm:py-20 border-2 border-dashed border-gray-300 bg-gray-50 rounded">
          <p class="text-gray-400 font-bold uppercase text-sm tracking-wide">No orders found</p>
          <router-link to="/" class="text-yellow-600 text-[11px] sm:text-xs font-black uppercase hover:underline mt-2 inline-block tracking-widest">
            Start Shopping
          </router-link>
        </div>

        <div v-else class="space-y-5">
          <div 
            v-for="order in orders" 
            :key="order.orderId" 
            @click="openOrderDetails(order)"
            class="bg-white border border-gray-200 p-0 transition group shadow-sm relative hover:border-black hover:shadow-md rounded"
            :class="(order.status === 'COMPLETED' || order.status === 'CANCELLED') ? 'opacity-80 bg-gray-50' : 'cursor-pointer'"
          >
            <div class="bg-gray-50 p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <span class="font-black text-gray-900 uppercase tracking-tight text-base sm:text-lg">Order #{{ order.orderId }}</span>
                <span class="text-[11px] sm:text-xs text-gray-500 font-bold uppercase tracking-wide">{{ formatDate(order.createdAt) }}</span>
              </div>
              <span :class="statusColor(order.status)" class="self-start sm:self-auto px-3 py-1 text-[10px] font-black uppercase tracking-widest shadow-sm rounded">
                {{ order.status === 'READY_FOR_PICKUP' ? 'READY' : order.status }}
              </span>
            </div>

            <div class="p-4 sm:p-6 space-y-3">
              <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <p class="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">Vendor</p>
                  <p class="font-bold text-gray-800 uppercase">{{ order.shopName }}</p>
                </div>
                <div class="text-left sm:text-right">
                  <p class="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">Total</p>
                  <p class="text-xl font-black text-yellow-600">{{ formatPrice(order.totalAmount) }}</p>
                </div>
              </div>
              
              <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-[11px] sm:text-xs font-bold text-gray-500 bg-gray-50 p-3 border border-gray-100 uppercase tracking-wide rounded">
                <span>Drop-off: <span class="text-gray-900">{{ order.deliveryLocation }}</span></span>
                <span v-if="order.status !== 'COMPLETED' && order.status !== 'CANCELLED'" class="text-yellow-600 font-bold uppercase tracking-widest sm:ml-auto">
                  Tap to view items
                </span>
              </div>

              <div class="flex items-center justify-between border-t border-gray-100 pt-3 sm:pt-4" @click.stop>
                <button v-if="order.status === 'PENDING'" @click="triggerCancel(order.orderId)" class="text-[11px] sm:text-xs font-bold text-red-500 hover:text-red-700 hover:underline uppercase tracking-wide">
                  Cancel Order
                </button>
                <span v-else-if="order.status === 'CANCELLED'" class="text-[11px] sm:text-xs font-bold text-gray-400 uppercase italic">Order Cancelled</span>
                <span v-else class="text-[11px] sm:text-xs font-bold text-gray-400 uppercase italic">Processing Started</span>

                <span v-if="order.status !== 'COMPLETED' && order.status !== 'CANCELLED'" class="text-[10px] font-bold text-yellow-600 uppercase tracking-widest cursor-pointer hidden sm:inline" @click="openOrderDetails(order)">
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
      <div class="bg-white w-full max-w-lg relative z-10 shadow-2xl border-t-8 border-yellow-500 animate-fade-in-up p-6 sm:p-8 rounded">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 border-b border-gray-200 pb-3 sm:pb-4 gap-2">
          <div>
            <h2 class="text-xl sm:text-2xl font-black text-gray-900 uppercase tracking-tight">Order Details</h2>
            <p class="text-[11px] sm:text-xs font-bold text-gray-500 uppercase tracking-wide">Transaction #{{ selectedOrder?.orderId }}</p>
          </div>
          <button @click="closeDetailsModal" class="text-gray-400 hover:text-black font-bold text-lg">×</button>
        </div>

        <div v-if="loadingItems" class="space-y-2">
          <div class="h-10 bg-gray-100 animate-pulse rounded"></div>
          <div class="h-10 bg-gray-100 animate-pulse rounded"></div>
        </div>
        
        <div v-else class="space-y-3 max-h-60 overflow-y-auto pr-1">
            <div v-for="item in orderItems" :key="item.name" class="flex gap-3 items-center bg-gray-50 p-3 border border-gray-200 rounded">
                <img :src="item.imageUrl || 'https://via.placeholder.com/50'" class="w-12 h-12 object-cover border border-gray-300 rounded" />
                <div class="flex-1">
                    <p class="font-bold text-sm text-gray-800 uppercase leading-none">{{ item.name }}</p>
                    <p class="text-[11px] text-gray-500 font-medium">{{ item.quantity }} x {{ formatPrice(item.price) }}</p>
                </div>
                <p class="font-black text-sm text-gray-900">{{ formatPrice(item.quantity * item.price) }}</p>
            </div>
        </div>

        <div class="flex justify-between items-center border-t-2 border-black pt-4 mt-5">
            <span class="font-bold text-gray-900 uppercase">Total Amount</span>
            <span class="text-xl sm:text-2xl font-black text-yellow-600">{{ formatPrice(selectedOrder?.totalAmount) }}</span>
        </div>

        <div v-if="selectedOrder?.status === 'READY' || selectedOrder?.status === 'READY_FOR_PICKUP'" class="mt-6">
            <button @click="triggerReceive(selectedOrder.orderId)" class="w-full bg-black text-white py-4 font-bold uppercase tracking-widest hover:bg-green-600 transition shadow-lg rounded">
                Confirm Receipt
            </button>
        </div>
      </div>
    </div>

    <div v-if="showConfirmModal" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showConfirmModal = false"></div>
      <div class="bg-white w-full max-w-sm relative z-10 p-6 shadow-2xl border-l-8 animate-fade-in-up rounded" 
           :class="confirmConfig.action === 'CANCEL' ? 'border-red-600' : 'border-green-600'">
          <h3 class="text-lg sm:text-xl font-black text-gray-900 uppercase mb-2">{{ confirmConfig.title }}</h3>
          <p class="text-sm text-gray-600 mb-6 font-medium">{{ confirmConfig.message }}</p>
          <div class="flex flex-col sm:flex-row gap-3">
            <button @click="showConfirmModal = false" class="flex-1 py-3 bg-gray-100 text-gray-600 font-bold uppercase text-[11px] sm:text-xs hover:bg-gray-200 rounded">No, Go Back</button>
            <button @click="handleConfirmAction" class="flex-1 py-3 text-white font-bold uppercase text-[11px] sm:text-xs shadow-md rounded" :class="confirmConfig.confirmButtonColor">{{ confirmConfig.confirmButtonText }}</button>
          </div>
      </div>
    </div>
  </div>
</template>