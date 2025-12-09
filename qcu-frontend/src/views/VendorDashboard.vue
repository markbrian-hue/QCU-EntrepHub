<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from "vue-toastification";
import { supabase } from '../supabase';

const router = useRouter();
const toast = useToast();
const user = ref(null);
const vendorStatus = ref('PENDING'); // Default to locked state
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

const formatPrice = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '₱0.00';
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
};

// Analytics
const analytics = computed(() => {
  const totalRevenue = orders.value
    .filter(o => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
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
  // Read the status we saved during login. Default to 'PENDING' if missing.
  vendorStatus.value = user.value.VendorStatus || 'PENDING';

  // Only fetch data if APPROVED
  if (vendorStatus.value === 'APPROVED') {
    await loadOrders();
    await loadProducts();
  }
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
    
    // Fetch items for each order
    const ordersWithItems = await Promise.all(data.map(async (order) => {
        const { data: items } = await supabase
            .from('order_items')
            .select(`quantity, price_at_order, products ( name )`)
            .eq('order_id', order.order_id);
            
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

  } catch (err) { console.error("Orders Error:", err); }
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
  if (file) imagePreview.value = URL.createObjectURL(file);
};

// --- CRUD OPERATIONS ---

const handleSubmit = async () => {
  const vId = getVendorId();
  if (!vId) { toast.error("Session invalid."); return; }
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
  if (!confirm("Are you sure? This will delete the product and its history.")) return;
  try { 
    // Force delete related items first
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
  document.getElementById('fileInput').value = "";
};

const updateStatus = async (orderId, status) => {
  try {
    const { error } = await supabase.from('orders').update({ status: status }).eq('order_id', orderId);
    if (error) throw error;
    await loadOrders();
    toast.info(`Order updated: ${status}`);
  } catch (err) { toast.error("Failed to update status"); }
};

const statusColor = (status) => {
  const map = { 'PENDING': 'bg-yellow-100 text-yellow-800', 'PREPARING': 'bg-blue-100 text-blue-800', 'READY': 'bg-purple-100 text-purple-800', 'COMPLETED': 'bg-green-100 text-green-800' };
  return map[status] || 'bg-gray-100';
}
</script>

<template>
  <div class="max-w-7xl mx-auto p-4 font-sans">
    
    <div v-if="vendorStatus === 'PENDING'" class="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 bg-white border-2 border-dashed border-gray-300">
      <div class="w-20 h-20 bg-yellow-100 flex items-center justify-center rounded-full mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 class="text-3xl font-black text-gray-900 uppercase tracking-tighter mb-4">Application Under Review</h1>
      <p class="text-gray-500 max-w-md mb-8">
        Your vendor account is waiting for admin approval. You cannot access the dashboard or sell products yet.
      </p>
      <div class="bg-gray-50 p-4 border border-gray-200 w-full max-w-sm">
        <p class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Current Status</p>
        <div class="flex items-center justify-center gap-2 text-yellow-600 font-bold uppercase text-sm">
          <span class="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
          Pending Verification
        </div>
      </div>
    </div>

    <div v-else-if="vendorStatus === 'REJECTED'" class="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 bg-red-50 border border-red-100">
      <h1 class="text-3xl font-black text-red-700 uppercase tracking-tighter mb-4">Application Rejected</h1>
      <p class="text-red-900 max-w-md">
        Your application was not approved. Please contact the Entrep Department for more details.
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
          <div v-for="prod in products" :key="prod.productId" class="bg-white border border-gray-200 p-0 flex flex-col hover:border-black transition group relative shadow-sm">
            <div class="h-48 w-full bg-gray-100 overflow-hidden relative">
               <img :src="prod.imageUrl || 'https://via.placeholder.com/150'" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
               <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition duration-300 bg-white p-1 shadow-md">
                   <button @click="startEdit(prod)" class="p-1.5 hover:bg-gray-100 text-blue-600"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                   <button @click="deleteProduct(prod.productId)" class="p-1.5 hover:bg-gray-100 text-red-600"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
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
          <div v-if="products.length === 0" class="col-span-full text-center py-10 text-gray-400">No products added yet.</div>
        </div>
      </div>

      <div v-if="activeTab === 'orders'">
        <div v-if="orders.length === 0" class="text-center py-10 text-gray-400">No orders yet.</div>
        <div v-for="order in orders" :key="order.orderId" class="bg-white border border-gray-200 mb-6 hover:border-black transition shadow-sm group">
             <div class="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
               <div><span class="font-black text-gray-900 uppercase tracking-tight text-lg">Order #{{ order.orderId }}</span></div>
               <span :class="statusColor(order.status)" class="px-3 py-1 text-[10px] font-black uppercase tracking-widest shadow-sm border">{{ order.status === 'READY_FOR_PICKUP' ? 'READY' : order.status }}</span>
             </div>
             
             <div class="p-6">
                 <div class="flex justify-between items-start mb-6">
                   <div>
                     <p class="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">Customer</p>
                     <p class="font-bold text-gray-800 uppercase">{{ order.customer?.fullName }}</p>
                     <p class="text-xs text-gray-500 mt-1 uppercase font-bold tracking-wide">Loc: {{ order.deliveryLocation }}</p>
                     <div class="mt-3">
                        <span class="inline-block bg-gray-100 text-gray-600 text-[10px] font-black px-2 py-1 uppercase tracking-wider border border-gray-300">
                          {{ order.paymentMethod?.replace('_', ' ') || 'CASH' }}
                        </span>
                     </div>
                   </div>
                   <div class="text-right">
                     <p class="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">Total Amount</p>
                     <p class="text-2xl font-black text-yellow-600">{{ formatPrice(order.totalAmount) }}</p>
                   </div>
                 </div>

                 <div class="bg-gray-50 p-4 mb-6 border border-gray-100">
                    <p class="text-[10px] font-bold text-gray-400 uppercase mb-3 tracking-widest">Items Ordered</p>
                    <ul class="space-y-2">
                      <li v-for="(item, index) in order.items" :key="index" class="flex justify-between font-bold text-sm text-gray-800 border-b border-gray-200 pb-2 last:border-0 last:pb-0">
                        <span>{{ item.quantity }}x {{ item.name }}</span>
                      </li>
                    </ul>
                 </div>

                 <div class="flex gap-3 pt-2" v-if="order.status !== 'COMPLETED'">
                    <button v-if="order.status === 'PENDING'" @click="updateStatus(order.orderId, 'PREPARING')" class="flex-1 py-3 bg-blue-600 text-white text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition shadow-md">Accept Order</button>
                    <button v-if="order.status === 'PREPARING'" @click="updateStatus(order.orderId, 'READY_FOR_PICKUP')" class="flex-1 py-3 bg-purple-600 text-white text-xs font-black uppercase tracking-widest hover:bg-purple-700 transition shadow-md">Mark Ready</button>
                    <div v-if="order.status === 'READY_FOR_PICKUP'" class="w-full text-center py-3 bg-gray-100 text-gray-400 text-xs font-bold uppercase tracking-widest border border-dashed border-gray-300">Waiting for Buyer Receipt...</div>
                 </div>
             </div>
        </div>
      </div>

    </div>
  </div>
</template>