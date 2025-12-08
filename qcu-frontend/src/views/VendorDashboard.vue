<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from "vue-toastification";
import api from '../axios';

const router = useRouter();
const toast = useToast();
const user = ref(null);
const activeTab = ref('products'); // Default to products for easier testing
const isSubmitting = ref(false);

// State for Edit/Delete
const isEditing = ref(false);
const editingProductId = ref(null);

// Data
const orders = ref([]);
const products = ref([]);
const selectedFile = ref(null);
const imagePreview = ref(null);

const newProduct = ref({
  name: '',
  description: '',
  price: '',
  stockQuantity: '20',
  category: 'Food',
});

// Load Data
onMounted(async () => {
  const userData = localStorage.getItem('user');
  if (!userData) { router.push('/login'); return; }
  user.value = JSON.parse(userData);

  const role = user.value.role || user.value.Role;
  if (!role || role.toUpperCase() !== 'VENDOR') {
    alert("Access Denied. Vendors only."); router.push('/'); return;
  }

  await loadOrders();
  await loadProducts();
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
  if (file) {
    imagePreview.value = URL.createObjectURL(file);
  }
};

// --- CRUD OPERATIONS ---

const handleSubmit = async () => {
  const vId = getVendorId();
  if (!vId) { alert("Error: Vendor ID not found."); return; }
  if (!newProduct.value.price) { alert("Please enter a price."); return; }

  try {
    isSubmitting.value = true;
    const formData = new FormData();
    formData.append('VendorId', vId);
    formData.append('Name', newProduct.value.name);
    formData.append('Description', newProduct.value.description || '');
    formData.append('Price', newProduct.value.price);
    formData.append('StockQuantity', newProduct.value.stockQuantity);
    formData.append('Category', newProduct.value.category);
    if (selectedFile.value) {
      formData.append('ImageFile', selectedFile.value);
    }

    if (isEditing.value) {
      // UPDATE
      await api.put(`/products/${editingProductId.value}`, formData);
      alert("Product updated successfully!");
    } else {
      // CREATE
      await api.post('/products', formData);
      alert("Product added successfully!");
    }
    
    resetForm();
    await loadProducts();

  } catch (err) {
    console.error("Backend Error:", err);
    alert("Operation failed");
  } finally {
    isSubmitting.value = false;
  }
};

const startEdit = (product) => {
  isEditing.value = true;
  editingProductId.value = product.productId;
  
  // Fill form
  newProduct.value = {
    name: product.name,
    description: product.description,
    price: product.price,
    stockQuantity: product.stockQuantity,
    category: product.category || 'Food'
  };
  
  imagePreview.value = product.imageUrl;
  selectedFile.value = null; // Clear file unless user selects new one
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const deleteProduct = async (id) => {
  if (!confirm("Are you sure you want to delete this product?")) return;
  try {
    await api.delete(`/products/${id}`);
    alert("Product deleted.");
    await loadProducts();
  } catch (err) {
    alert("Failed to delete.");
  }
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
    await api.put(`/orders/${orderId}/status`, { status });
    await loadOrders();
  } catch (err) { alert("Failed to update status"); }
};

const statusColor = (status) => {
  if(status === 'PENDING') return 'bg-yellow-100 text-yellow-800';
  if(status === 'PREPARING') return 'bg-blue-100 text-blue-800';
  if(status === 'READY') return 'bg-purple-100 text-purple-800';
  if(status === 'COMPLETED') return 'bg-green-100 text-green-800';
  return 'bg-gray-100 text-gray-800';
}
</script>

<template>
  <div class="max-w-7xl mx-auto p-4 font-sans">
    <div class="bg-gray-900 p-8 mb-8 text-white shadow-lg border-l-8 border-yellow-500">
      <h1 class="text-3xl font-black tracking-tight uppercase">Vendor Dashboard</h1>
      <p class="text-yellow-500 mt-1 uppercase tracking-widest text-xs font-bold">Welcome, {{ user?.ShopName }}</p>
    </div>

    <div class="flex gap-0 mb-8 border-b border-gray-200">
      <button @click="activeTab = 'products'" :class="activeTab === 'products' ? 'bg-yellow-500 text-black' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'" class="px-8 py-3 font-bold uppercase text-sm transition-colors">My Products</button>
      <button @click="activeTab = 'orders'" :class="activeTab === 'orders' ? 'bg-yellow-500 text-black' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'" class="px-8 py-3 font-bold uppercase text-sm transition-colors">Orders</button>
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
              <input type="file" @change="handleFileUpload" accept="image/*" class="w-full p-2 border border-gray-300 text-xs" />
            </div>
            <div><label class="text-xs font-bold text-gray-900 uppercase">Description</label><textarea v-model="newProduct.description" class="w-full p-2 border border-gray-300 focus:border-yellow-500 outline-none"></textarea></div>
            <button type="submit" :disabled="isSubmitting" class="w-full bg-black text-yellow-500 py-3 font-bold uppercase hover:bg-gray-800 transition">{{ isSubmitting ? 'Saving...' : 'Save Product' }}</button>
          </form>
        </div>
      </div>

      <div class="lg:col-span-2 grid sm:grid-cols-2 gap-6 content-start">
        <div v-for="prod in products" :key="prod.productId" class="bg-white border border-gray-200 p-4 flex gap-4 hover:border-yellow-500 transition group relative">
          <img :src="prod.imageUrl || 'https://via.placeholder.com/80'" class="w-24 h-24 object-cover bg-gray-100" />
          <div class="flex-1">
            <h4 class="font-bold text-gray-900">{{ prod.name }}</h4>
            <p class="text-yellow-600 font-bold">{{ prod.price }}</p>
            <p class="text-xs text-gray-500 mt-1">{{ prod.description }}</p>
          </div>
          <div class="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition">
             <button @click="startEdit(prod)" class="text-blue-600 text-xs underline">Edit</button>
             <button @click="deleteProduct(prod.productId)" class="text-red-600 text-xs underline">Delete</button>
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="activeTab === 'orders'">
        <div v-if="orders.length === 0" class="text-center py-10 text-gray-400">No orders yet.</div>
        <div v-for="order in orders" :key="order.orderId" class="bg-white p-6 border border-gray-200 mb-4">
             <h3 class="font-bold">Order #{{ order.orderId }} - {{ order.totalAmount }}</h3>
             <p class="text-sm text-gray-500">{{ order.status }}</p>
             <div class="flex gap-2 mt-4">
                <button @click="updateStatus(order.orderId, 'PREPARING')" class="px-4 py-1 bg-gray-100 text-xs font-bold uppercase hover:bg-yellow-200">Prepare</button>
                <button @click="updateStatus(order.orderId, 'READY')" class="px-4 py-1 bg-gray-100 text-xs font-bold uppercase hover:bg-yellow-200">Ready</button>
                <button @click="updateStatus(order.orderId, 'COMPLETED')" class="px-4 py-1 bg-gray-100 text-xs font-bold uppercase hover:bg-green-200">Complete</button>
             </div>
        </div>
    </div>
  </div>
</template>