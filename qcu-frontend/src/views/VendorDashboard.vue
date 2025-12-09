<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from "vue-toastification";
import api from '../axios';
import { supabase } from '../supabase';

const router = useRouter();
const toast = useToast();
const user = ref(null);
const activeTab = ref('orders'); 
const orderFilter = ref('ALL'); // NEW: For filtering orders
const isSubmitting = ref(false);

// Edit/Delete State
const isEditing = ref(false);
const editingProductId = ref(null);

// Data
const orders = ref([]);
const products = ref([]);
const selectedFile = ref(null);
const imagePreview = ref(null);

const newProduct = ref({
  name: '', description: '', price: '', stockQuantity: '20', category: 'Food',
});

const formatPrice = (amount) => 
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

// --- ADVANCED ANALYTICS ---
const analytics = computed(() => {
  const validOrders = orders.value.filter(o => o.status !== 'CANCELLED');
  const totalRevenue = validOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  
  // Status Counts
  const pending = orders.value.filter(o => o.status === 'PENDING').length;
  const preparing = orders.value.filter(o => o.status === 'PREPARING').length;
  const ready = orders.value.filter(o => o.status === 'READY_FOR_PICKUP' || o.status === 'READY').length;
  const completed = orders.value.filter(o => o.status === 'COMPLETED').length;
  const cancelled = orders.value.filter(o => o.status === 'CANCELLED').length;

  // Simple "Chart" Data (Percentage of total orders)
  const total = orders.value.length || 1;
  const chartData = [
    { label: 'Pending', percent: (pending / total) * 100, color: 'bg-yellow-400' },
    { label: 'Prep', percent: (preparing / total) * 100, color: 'bg-blue-500' },
    { label: 'Ready', percent: (ready / total) * 100, color: 'bg-purple-500' },
    { label: 'Done', percent: (completed / total) * 100, color: 'bg-green-500' }
  ];

  return { revenue: totalRevenue, totalOrders: orders.value.length, pending, preparing, ready, completed, cancelled, chartData };
});

// --- FILTERED ORDERS LIST ---
const filteredOrders = computed(() => {
  if (orderFilter.value === 'ALL') return orders.value;
  // Handle inconsistent "READY" vs "READY_FOR_PICKUP" naming
  if (orderFilter.value === 'READY') {
      return orders.value.filter(o => o.status === 'READY' || o.status === 'READY_FOR_PICKUP');
  }
  return orders.value.filter(o => o.status === orderFilter.value);
});

onMounted(async () => {
  const userData = localStorage.getItem('user');
  if (!userData) { router.push('/login'); return; }
  user.value = JSON.parse(userData);

  const role = user.value.role || user.value.Role;
  if (!role || role.toUpperCase() !== 'VENDOR') {
    toast.error("Access Denied. Vendors only."); 
    router.push('/'); 
    return;
  }

  await loadOrders();
  await loadProducts();
});

const getVendorId = () => user.value?.VendorId || user.value?.vendorId;

// --- SUPABASE ACTIONS ---
const loadOrders = async () => {
  const vId = getVendorId();
  if (!vId) return;

  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`*, users ( full_name )`)
      .eq('vendor_id', vId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Fetch items for each order manually (Supabase doesn't do deep nesting easily in one go)
    const ordersWithItems = await Promise.all(data.map(async (order) => {
        const { data: items } = await supabase
            .from('order_items')
            .select(`quantity, price_at_order, products ( name )`)
            .eq('order_id', order.order_id);
            
        // Flatten item structure
        const flatItems = items.map(i => ({
            name: i.products?.name || 'Unknown Item',
            quantity: i.quantity,
            price: i.price_at_order
        }));

        return {
          orderId: order.order_id,
          totalAmount: order.total_amount,
          status: order.status,
          deliveryLocation: order.delivery_location,
          paymentMethod: order.payment_method,
          createdAt: order.created_at,
          customer: { fullName: order.users?.full_name },
          items: flatItems
        };
    }));

    orders.value = ordersWithItems;

  } catch (err) { 
    console.error("Orders Error:", err);
  }
};

const loadProducts = async () => {
  const vId = getVendorId();
  if (!vId) return;

  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('vendor_id', vId)
      .order('product_id', { ascending: false });

    if (error) throw error;

    products.value = data.map(p => ({
      productId: p.product_id,
      name: p.name,
      price: p.price,
      stockQuantity: p.stock_quantity,
      description: p.description,
      imageUrl: p.image_url,
      category: p.category
    }));

  } catch (err) { console.error("Products Error:", err); }
};

const handleFileUpload = (event) => {
  const file = event.target.files[0];
  selectedFile.value = file;
  imagePreview.value = file ? URL.createObjectURL(file) : null;
};

// --- CRUD OPERATIONS ---
const handleSubmit = async () => {
  const vId = getVendorId();
  if (!vId) { toast.error("Session invalid. Re-login required."); return; }
  if (!newProduct.value.price) { toast.warning("Please enter a price."); return; }

  try {
    isSubmitting.value = true;
    let imageUrl = isEditing.value ? products.value.find(p => p.productId === editingProductId.value).imageUrl : null;

    if (selectedFile.value) {
      const fileName = `${Date.now()}_${selectedFile.value.name}`;
      const { error: uploadError } = await supabase.storage.from('images').upload(fileName, selectedFile.value);
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from('images').getPublicUrl(fileName);
      imageUrl = publicUrl.publicUrl;
    }

    const productData = {
      vendor_id: vId,
      name: newProduct.value.name,
      description: newProduct.value.description,
      price: newProduct.value.price,
      stock_quantity: newProduct.value.stockQuantity,
      category: newProduct.value.category,
      image_url: imageUrl
    };

    if (isEditing.value) {
      const { error } = await supabase.from('products').update(productData).eq('product_id', editingProductId.value);
      if (error) throw error;
      toast.success("Product updated!");
    } else {
      const { error } = await supabase.from('products').insert(productData);
      if (error) throw error;
      toast.success("Product added!");
    }
    
    resetForm();
    await loadProducts();
  } catch (err) {
    toast.error(`Operation failed: ${err.message}`);
  } finally { isSubmitting.value = false; }
};

const startEdit = (prod) => {
  isEditing.value = true;
  editingProductId.value = prod.productId;
  newProduct.value = {
    name: prod.name, description: prod.description, price: prod.price,
    stockQuantity: prod.stockQuantity, category: prod.category || 'Food'
  };
  imagePreview.value = prod.imageUrl;
  selectedFile.value = null;
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const deleteProduct = async (id) => {
  if (!confirm("Are you sure? This cannot be undone.")) return;
  try { 
    // Force delete items first to avoid constraint errors
    await supabase.from('order_items').delete().eq('product_id', id);
    const { error } = await supabase.from('products').delete().eq('product_id', id);
    if (error) throw error;
    toast.info("Product deleted."); 
    await loadProducts(); 
  } 
  catch (err) { toast.error("Failed to delete."); }
};

const resetForm = () => {
  isEditing.value = false;
  editingProductId.value = null;
  newProduct.value = { name: '', description: '', price: '', stockQuantity: '20', category: 'Food' };
  selectedFile.value = null;
  imagePreview.value = null;
  const input = document.getElementById('fileInput');
  if (input) input.value = "";
};

const updateStatus = async (orderId, status) => {
  try {
    const { error } = await supabase.from('orders').update({ status: status }).eq('order_id', orderId);
    if (error) throw error;
    await loadOrders();
    toast.info(`Order moved to ${status}`);
  } catch (err) { toast.error("Failed to update status"); }
};

const statusColor = (status) => {
  const map = { 
    'PENDING': 'bg-yellow-400 text-black border-yellow-500', 
    'PREPARING': 'bg-blue-600 text-white border-blue-700', 
    'READY_FOR_PICKUP': 'bg-purple-600 text-white border-purple-700', 
    'COMPLETED': 'bg-green-600 text-white border-green-700',
    'CANCELLED': 'bg-red-600 text-white border-red-700'
  };
  return map[status] || 'bg-gray-100';
}
</script>

<template>
  <div class="max-w-7xl mx-auto p-4 font-sans">
    
    <div class="bg-gray-900 p-8 mb-8 text-white shadow-lg border-l-8 border-yellow-500 flex justify-between items-center">
      <div>
        <h1 class="text-3xl font-black tracking-tight uppercase">Vendor Dashboard</h1>
        <p class="text-yellow-500 mt-1 uppercase tracking-widest text-xs font-bold">Welcome, {{ user?.ShopName }}</p>
      </div>
      <div class="text-right hidden sm:block">
         <p class="text-3xl font-black text-white">{{ formatPrice(analytics.revenue) }}</p>
         <p class="text-xs text-gray-400 uppercase font-bold tracking-wide">Total Revenue</p>
      </div>
    </div>

    <div class="flex gap-0 mb-8 border-b-2 border-gray-200 overflow-x-auto">
      <button @click="activeTab = 'orders'" :class="activeTab === 'orders' ? 'bg-yellow-500 text-black' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'" class="px-8 py-3 font-bold uppercase text-sm transition-colors flex gap-2">
        Orders 
        <span v-if="analytics.pending > 0" class="bg-red-600 text-white px-2 rounded-full text-[10px]">{{ analytics.pending }}</span>
      </button>
      <button @click="activeTab = 'products'" :class="activeTab === 'products' ? 'bg-yellow-500 text-black' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'" class="px-8 py-3 font-bold uppercase text-sm transition-colors">Products</button>
      <button @click="activeTab = 'analytics'" :class="activeTab === 'analytics' ? 'bg-yellow-500 text-black' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'" class="px-8 py-3 font-bold uppercase text-sm transition-colors">Analytics</button>
    </div>

    <div v-if="activeTab === 'orders'">
      
      <div class="flex flex-wrap gap-3 mb-6">
        <button @click="orderFilter = 'ALL'" :class="orderFilter === 'ALL' ? 'bg-black text-white' : 'bg-white text-gray-600 border border-gray-300'" class="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition">All</button>
        <button @click="orderFilter = 'PENDING'" :class="orderFilter === 'PENDING' ? 'bg-yellow-400 text-black' : 'bg-white text-gray-600 border border-gray-300'" class="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition">Pending ({{ analytics.pending }})</button>
        <button @click="orderFilter = 'PREPARING'" :class="orderFilter === 'PREPARING' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300'" class="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition">Preparing ({{ analytics.preparing }})</button>
        <button @click="orderFilter = 'READY'" :class="orderFilter === 'READY' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 border border-gray-300'" class="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition">Ready ({{ analytics.ready }})</button>
        <button @click="orderFilter = 'COMPLETED'" :class="orderFilter === 'COMPLETED' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 border border-gray-300'" class="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition">Completed</button>
      </div>

      <div v-if="filteredOrders.length === 0" class="text-center py-20 bg-gray-50 border-2 border-dashed border-gray-300">
        <p class="text-gray-400 font-bold uppercase text-sm tracking-widest">No {{ orderFilter === 'ALL' ? '' : orderFilter.toLowerCase() }} orders found.</p>
      </div>

      <div v-else class="grid gap-6">
        <div v-for="order in filteredOrders" :key="order.orderId" class="bg-white border border-gray-200 shadow-sm hover:shadow-md transition group">
           <div class="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
             <div class="flex items-center gap-3">
                <span class="font-black text-gray-900 text-lg">#{{ order.orderId }}</span>
                <span class="text-xs text-gray-500 font-bold">{{ new Date(order.createdAt).toLocaleDateString() }}</span>
             </div>
             <span :class="statusColor(order.status)" class="px-3 py-1 text-[10px] font-black uppercase tracking-widest border shadow-sm">{{ order.status === 'READY_FOR_PICKUP' ? 'READY' : order.status }}</span>
           </div>
           
           <div class="p-6">
               <div class="flex flex-col md:flex-row justify-between mb-6">
                 <div>
                   <p class="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">Customer</p>
                   <p class="font-bold text-gray-800 uppercase">{{ order.customer?.fullName }}</p>
                   <p class="text-xs text-gray-500 mt-1 font-bold uppercase flex items-center gap-1">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
                      {{ order.deliveryLocation }}
                   </p>
                   
                   <div class="mt-3">
                      <span class="inline-block bg-gray-100 text-gray-600 text-[10px] font-black px-2 py-1 uppercase tracking-wider border border-gray-300">
                        {{ order.paymentMethod?.replace('_', ' ') || 'CASH' }}
                      </span>
                   </div>
                 </div>

                 <div class="text-right mt-4 md:mt-0">
                   <p class="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">Total</p>
                   <p class="text-2xl font-black text-yellow-600">{{ formatPrice(order.totalAmount) }}</p>
                 </div>
               </div>

               <div class="bg-gray-50 p-4 border-l-4 border-gray-300 mb-6">
                  <p class="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-widest">Order Items</p>
                  <ul class="space-y-1">
                    <li v-for="(item, i) in order.items" :key="i" class="flex justify-between text-sm font-bold text-gray-800">
                      <span>{{ item.quantity }}x {{ item.name }}</span>
                    </li>
                  </ul>
               </div>

               <div class="flex gap-2 pt-2 border-t border-gray-100" v-if="order.status !== 'COMPLETED' && order.status !== 'CANCELLED'">
                  <button v-if="order.status === 'PENDING'" @click="updateStatus(order.orderId, 'PREPARING')" class="flex-1 py-3 bg-blue-600 text-white text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition">Accept & Prepare</button>
                  <button v-if="order.status === 'PREPARING'" @click="updateStatus(order.orderId, 'READY_FOR_PICKUP')" class="flex-1 py-3 bg-purple-600 text-white text-xs font-black uppercase tracking-widest hover:bg-purple-700 transition">Mark Ready</button>
                  <div v-if="order.status === 'READY_FOR_PICKUP'" class="w-full text-center py-3 bg-gray-100 text-gray-400 text-xs font-bold uppercase border-2 border-dashed border-gray-200">Waiting for Pickup...</div>
               </div>
           </div>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'products'" class="grid lg:grid-cols-3 gap-8">
      <div class="lg:col-span-1">
        <div class="bg-white p-6 border border-gray-300 shadow-sm sticky top-24">
          <div class="flex justify-between items-center mb-6">
            <h3 class="font-bold text-lg text-gray-900 uppercase">{{ isEditing ? 'Edit Product' : 'Add New' }}</h3>
            <button v-if="isEditing" @click="resetForm" class="text-xs text-red-600 underline font-bold">Cancel</button>
          </div>
          <form @submit.prevent="handleSubmit" class="space-y-4">
            <div><label class="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Name</label><input v-model="newProduct.name" class="w-full p-3 border-2 border-gray-200 focus:border-black focus:bg-white outline-none transition font-bold" required /></div>
            <div class="grid grid-cols-2 gap-4">
              <div><label class="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Price</label><input v-model="newProduct.price" type="number" class="w-full p-3 border-2 border-gray-200 focus:border-black outline-none font-bold" required /></div>
              <div><label class="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Stock</label><input v-model="newProduct.stockQuantity" type="number" class="w-full p-3 border-2 border-gray-200 focus:border-black outline-none font-bold" required /></div>
            </div>
            <div>
              <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Category</label>
              <select v-model="newProduct.category" class="w-full p-3 border-2 border-gray-200 focus:border-black outline-none font-bold text-sm bg-white"><option>Food</option><option>Beverage</option><option>Merch</option><option>Services</option></select>
            </div>
            <div>
              <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Image</label>
              <input id="fileInput" type="file" @change="handleFileUpload" accept="image/*" class="w-full p-2 border-2 border-gray-200 text-xs font-bold cursor-pointer hover:bg-gray-50" />
              <div v-if="imagePreview" class="mt-2"><img :src="imagePreview" class="h-24 w-full object-cover border border-gray-300" /></div>
            </div>
            <div><label class="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Description</label><textarea v-model="newProduct.description" class="w-full p-3 border-2 border-gray-200 focus:border-black outline-none font-medium text-sm h-24 resize-none"></textarea></div>
            <button type="submit" :disabled="isSubmitting" class="w-full bg-black text-yellow-500 py-4 font-black uppercase tracking-widest hover:bg-yellow-500 hover:text-black transition shadow-lg">{{ isSubmitting ? 'Saving...' : (isEditing ? 'Update' : 'Save Product') }}</button>
          </form>
        </div>
      </div>
      <div class="lg:col-span-2 grid sm:grid-cols-2 gap-6 content-start">
        <div v-for="prod in products" :key="prod.productId" class="bg-white border border-gray-200 p-0 flex flex-col hover:border-black transition group relative shadow-sm hover:shadow-lg">
          <div class="h-48 w-full bg-gray-100 overflow-hidden relative">
             <img :src="prod.imageUrl || 'https://via.placeholder.com/150'" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
             <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition duration-300 bg-white p-1 shadow-md border border-gray-100">
                 <button @click="startEdit(prod)" class="p-2 hover:bg-gray-100 text-blue-600"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                 <button @click="deleteProduct(prod.productId)" class="p-2 hover:bg-gray-100 text-red-600"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
             </div>
          </div>
          <div class="p-4 flex-1 flex flex-col">
             <div class="flex justify-between items-start mb-2">
                <h4 class="font-bold text-gray-900 text-lg leading-tight uppercase">{{ prod.name }}</h4>
                <p class="text-yellow-600 font-black text-lg">{{ formatPrice(prod.price) }}</p>
             </div>
             <p class="text-xs text-gray-500 line-clamp-2 mb-4 flex-grow">{{ prod.description }}</p>
             <div class="border-t border-gray-100 pt-3 flex justify-between items-center">
                <span class="text-[10px] font-bold uppercase tracking-widest text-gray-400">Stock</span>
                <span class="text-sm font-bold text-black">{{ prod.stockQuantity }}</span>
             </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'analytics'">
      <div class="grid md:grid-cols-4 gap-6 mb-8">
        <div class="bg-black p-6 text-white shadow-lg"><p class="text-[10px] font-bold text-yellow-500 uppercase tracking-widest">Total Revenue</p><h2 class="text-4xl font-black mt-2">{{ formatPrice(analytics.revenue) }}</h2></div>
        <div class="bg-white p-6 border border-gray-200"><p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pending Orders</p><h2 class="text-4xl font-black text-yellow-600 mt-2">{{ analytics.pending }}</h2></div>
        <div class="bg-white p-6 border border-gray-200"><p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Completed</p><h2 class="text-4xl font-black text-green-600 mt-2">{{ analytics.completed }}</h2></div>
        <div class="bg-white p-6 border border-gray-200"><p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Orders</p><h2 class="text-4xl font-black text-gray-900 mt-2">{{ analytics.totalOrders }}</h2></div>
      </div>

      <div class="bg-white p-8 border border-gray-200">
        <h3 class="font-bold text-lg text-gray-900 uppercase mb-6">Order Status Distribution</h3>
        <div class="flex h-4 items-center rounded-full overflow-hidden bg-gray-100 w-full">
            <div v-for="seg in analytics.chartData" :key="seg.label" :class="seg.color" :style="{ width: seg.percent + '%' }" class="h-full transition-all duration-500"></div>
        </div>
        <div class="flex gap-6 mt-4 justify-center">
            <div v-for="seg in analytics.chartData" :key="seg.label" class="flex items-center gap-2">
                <div :class="seg.color" class="w-3 h-3 rounded-sm"></div>
                <span class="text-xs font-bold text-gray-500 uppercase">{{ seg.label }} ({{ Math.round(seg.percent) }}%)</span>
            </div>
        </div>
      </div>
    </div>

  </div>
</template>