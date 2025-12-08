<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from "vue-toastification";
import api from '../axios';

const router = useRouter();
const toast = useToast();
const user = ref(null);
const vendorStatus = ref('PENDING'); // Default to locked
const activeTab = ref('products'); 
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

const analytics = computed(() => {
  const totalRevenue = orders.value
    .filter(o => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);
  const pendingCount = orders.value.filter(o => o.status === 'PENDING').length;
  const completedCount = orders.value.filter(o => o.status === 'COMPLETED').length;
  return { revenue: totalRevenue, totalOrders: orders.value.length, pending: pendingCount, completed: completedCount };
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

  // --- SECURITY CHECK ---
  // If the status is missing, default to PENDING to be safe
  vendorStatus.value = user.value.VendorStatus || 'PENDING';

  // Only load data if approved
  if (vendorStatus.value === 'APPROVED') {
    await loadOrders();
    await loadProducts();
  }
});

const getVendorId = () => user.value?.VendorId || user.value?.vendorId;

const loadOrders = async () => {
  const vId = getVendorId();
  if (!vId) return;
  try { const res = await api.get(`/orders/vendor/${vId}`); orders.value = res.data; } 
  catch (err) { console.error(err); }
};

const loadProducts = async () => {
  const vId = getVendorId();
  if (!vId) return;
  try { const res = await api.get(`/products/vendor/${vId}`); products.value = res.data; } 
  catch (err) { console.error(err); }
};

const handleFileUpload = (event) => {
  const file = event.target.files[0];
  selectedFile.value = file;
  imagePreview.value = file ? URL.createObjectURL(file) : null;
};

const handleSubmit = async () => {
  const vId = getVendorId();
  if (!vId) { toast.error("Session invalid."); return; }
  if (!newProduct.value.price) { toast.warning("Please enter a price."); return; }

  try {
    isSubmitting.value = true;
    const formData = new FormData();
    formData.append('VendorId', vId);
    formData.append('Name', newProduct.value.name);
    formData.append('Description', newProduct.value.description || '');
    formData.append('Price', newProduct.value.price);
    formData.append('StockQuantity', newProduct.value.stockQuantity);
    formData.append('Category', newProduct.value.category);
    if (selectedFile.value) formData.append('ImageFile', selectedFile.value);

    if (isEditing.value) {
      await api.put(`/products/${editingProductId.value}`, formData);
      toast.success("Product updated!");
    } else {
      await api.post('/products', formData);
      toast.success("Product added!");
    }
    resetForm();
    await loadProducts();
  } catch (err) {
    const msg = err.response?.data?.error || "Unknown error";
    toast.error(`Error: ${msg}`);
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
  if (!confirm("Are you sure?")) return;
  try { await api.delete(`/products/${id}`); toast.info("Deleted."); await loadProducts(); } 
  catch (err) { toast.error("Failed to delete."); }
};

const resetForm = () => {
  isEditing.value = false;
  editingProductId.value = null;
  newProduct.value = { name: '', description: '', price: '', stockQuantity: '20', category: 'Food' };
  selectedFile.value = null;
  imagePreview.value = null;
  document.getElementById('fileInput').value = "";
};

const updateStatus = async (orderId, status) => {
  try {
    await api.put(`/orders/${orderId}/status`, { status: status });
    await loadOrders();
    toast.info(`Order updated: ${status}`);
  } catch (err) { 
    toast.error("Failed to update status"); 
  }
};

const statusColor = (status) => {
  const map = { 'PENDING': 'bg-yellow-100 text-yellow-800', 'PREPARING': 'bg-blue-100 text-blue-800', 'READY': 'bg-purple-100 text-purple-800', 'COMPLETED': 'bg-green-100 text-green-800' };
  return map[status] || 'bg-gray-100';
}
</script>

<template>
  <div class="max-w-7xl mx-auto p-4 font-sans">
    
    <div v-if="vendorStatus === 'PENDING'" class="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 bg-gray-50 border border-gray-200">
      <div class="w-24 h-24 bg-yellow-100 flex items-center justify-center rounded-full mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 class="text-4xl font-black text-gray-900 uppercase tracking-tighter mb-4">Application Pending</h1>
      <p class="text-gray-500 max-w-lg mb-8 text-lg">
        Thank you for registering as a vendor. Your application is currently being reviewed by the QCU Entrep Department.
      </p>
      <div class="bg-white p-6 border border-gray-200 shadow-sm w-full max-w-md">
        <p class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Status</p>
        <div class="flex items-center justify-center gap-2 text-yellow-600 font-bold uppercase">
          <span class="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
          Under Review
        </div>
        <div class="mt-4 pt-4 border-t border-gray-100">
          <p class="text-xs text-gray-400">Please check back later or contact the admin.</p>
        </div>
      </div>
    </div>

    <div v-else-if="vendorStatus === 'REJECTED'" class="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 bg-red-50 border border-red-100">
      <h1 class="text-4xl font-black text-red-700 uppercase tracking-tighter mb-4">Application Rejected</h1>
      <p class="text-red-900 max-w-lg">
        Unfortunately, your vendor application has been rejected. Please contact the administrator for more details.
      </p>
    </div>

    <div v-else>
      
      <div class="bg-gray-900 p-8 mb-8 text-white shadow-lg border-l-8 border-yellow-500">
        <h1 class="text-3xl font-black tracking-tight uppercase">Vendor Dashboard</h1>
        <p class="text-yellow-500 mt-1 uppercase tracking-widest text-xs font-bold">Welcome, {{ user?.ShopName }}</p>
      </div>

      <div class="flex gap-0 mb-8 border-b border-gray-200">
        <button @click="activeTab = 'analytics'" :class="activeTab === 'analytics' ? 'bg-yellow-500 text-black' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'" class="px-8 py-3 font-bold uppercase text-sm transition-colors">Analytics</button>
        <button @click="activeTab = 'products'" :class="activeTab === 'products' ? 'bg-yellow-500 text-black' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'" class="px-8 py-3 font-bold uppercase text-sm transition-colors">My Products</button>
        <button @click="activeTab = 'orders'" :class="activeTab === 'orders' ? 'bg-yellow-500 text-black' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'" class="px-8 py-3 font-bold uppercase text-sm transition-colors">Orders</button>
      </div>

      <div v-if="activeTab === 'analytics'">
        <div class="grid md:grid-cols-3 gap-6 mb-8">
          <div class="bg-white p-6 border border-gray-200 shadow-sm"><p class="text-xs font-bold text-gray-400 uppercase">Total Revenue</p><h2 class="text-4xl font-black text-gray-900 mt-2">{{ formatPrice(analytics.revenue) }}</h2></div>
          <div class="bg-white p-6 border border-gray-200 shadow-sm"><p class="text-xs font-bold text-gray-400 uppercase">Total Orders</p><h2 class="text-4xl font-black text-gray-900 mt-2">{{ analytics.totalOrders }}</h2></div>
          <div class="bg-white p-6 border border-gray-200 shadow-sm"><p class="text-xs font-bold text-gray-400 uppercase">Pending</p><h2 class="text-4xl font-black text-red-600 mt-2">{{ analytics.pending }}</h2></div>
        </div>
      </div>

      <div v-if="activeTab === 'products'" class="grid lg:grid-cols-3 gap-8">
        <div class="lg:col-span-1">
          <div class="bg-white p-6 border border-gray-300 shadow-sm sticky top-24">
            <div class="flex justify-between items-center mb-6">
              <h3 class="font-bold text-lg text-gray-900 uppercase">{{ isEditing ? 'Edit Product' : 'Add New' }}</h3>
              <button v-if="isEditing" @click="resetForm" class="text-xs text-red-600 underline">Cancel</button>
            </div>
            <form @submit.prevent="handleSubmit" class="space-y-4">
              <div><label class="text-xs font-bold text-gray-900 uppercase">Name</label><input v-model="newProduct.name" class="w-full p-2 border border-gray-300 focus:border-yellow-500 outline-none" required /></div>
              <div class="grid grid-cols-2 gap-4">
                <div><label class="text-xs font-bold text-gray-900 uppercase">Price</label><input v-model="newProduct.price" type="number" class="w-full p-2 border border-gray-300 focus:border-yellow-500 outline-none" required /></div>
                <div><label class="text-xs font-bold text-gray-900 uppercase">Stock</label><input v-model="newProduct.stockQuantity" type="number" class="w-full p-2 border border-gray-300 focus:border-yellow-500 outline-none" required /></div>
              </div>
              <div>
                <label class="text-xs font-bold text-gray-900 uppercase">Category</label>
                <select v-model="newProduct.category" class="w-full p-2 border border-gray-300 focus:border-yellow-500 outline-none"><option>Food</option><option>Beverage</option><option>Merch</option><option>Services</option></select>
              </div>
              <div>
                <label class="text-xs font-bold text-gray-900 uppercase">Image</label>
                <input id="fileInput" type="file" @change="handleFileUpload" accept="image/*" class="w-full p-2 border border-gray-300 text-xs" />
                <div v-if="imagePreview" class="mt-2"><img :src="imagePreview" class="h-20 w-20 object-cover border" /></div>
              </div>
              <div><label class="text-xs font-bold text-gray-900 uppercase">Description</label><textarea v-model="newProduct.description" class="w-full p-2 border border-gray-300 focus:border-yellow-500 outline-none"></textarea></div>
              <button type="submit" :disabled="isSubmitting" class="w-full bg-black text-yellow-500 py-3 font-bold uppercase hover:bg-gray-800 transition">{{ isSubmitting ? 'Saving...' : (isEditing ? 'Update' : 'Save Product') }}</button>
            </form>
          </div>
        </div>
        <div class="lg:col-span-2 grid sm:grid-cols-2 gap-6 content-start">
          <div v-for="prod in products" :key="prod.productId" class="bg-white border border-gray-200 p-4 flex gap-4 hover:border-yellow-500 transition group relative">
            <img :src="prod.imageUrl || 'https://via.placeholder.com/80'" class="w-24 h-24 object-cover bg-gray-100" />
            <div class="flex-1">
              <h4 class="font-bold text-gray-900">{{ prod.name }}</h4>
              <p class="text-yellow-600 font-bold">{{ formatPrice(prod.price) }}</p>
              <p class="text-xs text-gray-500 mt-1">{{ prod.description }}</p>
              <p class="text-xs text-gray-400 mt-1">Stock: {{ prod.stockQuantity }}</p>
            </div>
            <div class="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition">
               <button @click="startEdit(prod)" class="text-blue-600 text-xs underline font-bold">Edit</button>
               <button @click="deleteProduct(prod.productId)" class="text-red-600 text-xs underline font-bold">Delete</button>
            </div>
          </div>
          <div v-if="products.length === 0" class="col-span-full text-center py-10 text-gray-400">No products added yet.</div>
        </div>
      </div>

      <div v-if="activeTab === 'orders'">
        <div v-if="orders.length === 0" class="text-center py-10 text-gray-400">No orders yet.</div>
        <div v-for="order in orders" :key="order.orderId" class="bg-white p-6 border border-gray-200 mb-4 hover:shadow-md transition">
             <div class="flex justify-between items-start mb-4">
               <div>
                 <h3 class="font-bold text-lg">Order #{{ order.orderId }}</h3>
                 <p class="text-xs text-gray-500 font-bold uppercase mt-1">Buyer: {{ order.customer?.fullName }}</p>
                 <p class="text-xs text-gray-500 font-bold uppercase">Loc: {{ order.deliveryLocation }}</p>
               </div>
               <div class="text-right">
                 <p class="text-xl font-black text-yellow-600">{{ formatPrice(order.totalAmount) }}</p>
                 <span :class="statusColor(order.status)" class="px-2 py-0.5 text-[10px] font-bold uppercase border">{{ order.status === 'READY_FOR_PICKUP' ? 'READY' : order.status }}</span>
               </div>
             </div>

             <div class="bg-gray-50 p-3 mb-4 text-sm border-t border-gray-100">
                <p class="text-xs font-bold text-gray-400 uppercase mb-2">Items Ordered:</p>
                <ul class="space-y-1">
                  <li v-for="(item, index) in order.items" :key="index" class="flex justify-between font-medium">
                    <span>{{ item.quantity }}x {{ item.name }}</span>
                  </li>
                </ul>
             </div>

             <div class="flex gap-2 border-t border-gray-100 pt-4" v-if="order.status !== 'COMPLETED'">
                <button 
                  v-if="order.status === 'PENDING'"
                  @click="updateStatus(order.orderId, 'PREPARING')" 
                  class="px-4 py-2 bg-blue-600 text-white text-xs font-bold uppercase hover:bg-blue-700 w-full"
                >
                  Accept & Prepare
                </button>

                <button 
                  v-if="order.status === 'PREPARING'"
                  @click="updateStatus(order.orderId, 'READY_FOR_PICKUP')" 
                  class="px-4 py-2 bg-purple-600 text-white text-xs font-bold uppercase hover:bg-purple-700 w-full"
                >
                  Mark Ready for Pickup
                </button>

                <div v-if="order.status === 'READY_FOR_PICKUP'" class="w-full text-center py-2 bg-gray-50 text-gray-500 text-xs font-bold uppercase border border-dashed border-gray-300">
                  Waiting for Buyer to Confirm Receipt...
                </div>
             </div>
        </div>
      </div>

    </div>
  </div>
</template>