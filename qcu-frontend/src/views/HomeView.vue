<script setup>
import { ref, onMounted, computed } from 'vue';
import api from '../axios';
import ProductCard from '../components/ProductCard.vue';

const products = ref([]);
const loading = ref(true);
const error = ref(null);
const activeCategory = ref('All');
const searchQuery = ref('');
const categories = ['All', 'Food', 'Beverage', 'Merch', 'Services'];

const fetchProducts = async () => {
  try {
    const response = await api.get('/products');
    products.value = response.data;
  } catch (err) {
    console.error(err);
    error.value = "Unable to connect to the marketplace. Please try again later.";
  } finally {
    loading.value = false;
  }
};

const filteredProducts = computed(() => {
  return products.value.filter(product => {
    const matchesCategory = activeCategory.value === 'All' || product.category === activeCategory.value;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.value.toLowerCase());
    return matchesCategory && matchesSearch;
  });
});

onMounted(() => {
  fetchProducts();
});
</script>

<template>
  <div class="min-h-screen font-sans relative">
    
    <div class="fixed inset-0 z-0">
      <div class="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-10" 
           style="background-image: url('/qcu.jpg');"></div>
      <div class="absolute inset-0 bg-white/90"></div>
    </div>

    <div class="relative z-10">
      
      <div class="bg-white/80 backdrop-blur-sm border-b border-gray-200 mb-8">
        <div class="container mx-auto px-6 py-12">
          <div class="flex flex-col md:flex-row justify-between items-end gap-6">
            <div class="space-y-2">
              <h2 class="text-xs font-bold text-yellow-600 uppercase tracking-widest bg-yellow-100 px-2 py-1 inline-block">QCU Official Marketplace</h2>
              <h1 class="text-4xl font-black text-gray-900 tracking-tight uppercase">Student Entrep Hub</h1>
              <p class="text-gray-500 max-w-lg text-sm font-medium">
                Discover verified products from BS Entrepreneurship students. Support local, buy safe.
              </p>
            </div>
            
            <div class="w-full md:w-auto relative group">
              <input 
                v-model="searchQuery"
                type="text" 
                placeholder="SEARCH PRODUCTS..." 
                class="w-full md:w-80 pl-4 pr-10 py-3 bg-white border border-gray-300 focus:border-yellow-500 focus:ring-0 outline-none transition text-sm font-bold placeholder:text-gray-400 shadow-sm"
              />
              <div class="absolute right-3 top-3 text-gray-400 group-focus-within:text-yellow-500 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
              </div>
            </div>
          </div>

          <div class="flex gap-8 mt-10 border-b-2 border-gray-100 overflow-x-auto">
            <button 
              v-for="cat in categories" 
              :key="cat"
              @click="activeCategory = cat"
              class="pb-3 text-sm font-bold uppercase tracking-wide transition relative whitespace-nowrap"
              :class="activeCategory === cat ? 'text-black' : 'text-gray-400 hover:text-gray-600'"
            >
              {{ cat }}
              <span v-if="activeCategory === cat" class="absolute bottom-0 left-0 w-full h-1 bg-yellow-500"></span>
            </button>
          </div>
        </div>
      </div>

      <div class="container mx-auto px-6 pb-20">
        
        <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          <div v-for="n in 8" :key="n" class="bg-white border border-gray-200 h-80 animate-pulse shadow-sm">
            <div class="bg-gray-200 h-48 w-full"></div>
            <div class="p-4 space-y-3">
              <div class="h-4 bg-gray-200 w-3/4"></div>
              <div class="h-3 bg-gray-200 w-1/2"></div>
              <div class="h-8 bg-gray-200 w-full mt-4"></div>
            </div>
          </div>
        </div>

        <div v-else-if="error" class="text-center py-20 bg-white/80 border border-gray-200 backdrop-blur-sm">
          <div class="text-gray-400 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h3 class="text-lg font-bold text-gray-800 uppercase">System Error</h3>
          <p class="text-gray-500 text-sm mb-4">{{ error }}</p>
          <button @click="fetchProducts" class="text-xs font-bold uppercase underline hover:text-yellow-600 transition-colors">Try Again</button>
        </div>

        <div v-else-if="filteredProducts.length === 0" class="text-center py-24 border border-dashed border-gray-300 bg-white/50 backdrop-blur-sm">
          <p class="text-lg font-medium text-gray-400 uppercase">No products found.</p>
          <button @click="activeCategory = 'All'; searchQuery = ''" class="mt-2 text-yellow-600 font-bold hover:underline text-sm uppercase transition-colors">Clear Filters</button>
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          <ProductCard 
            v-for="item in filteredProducts" 
            :key="item.productId" 
            :product="item" 
          />
        </div>

      </div>

      <footer class="bg-gray-900 text-gray-400 py-12 border-t-4 border-yellow-500">
        <div class="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-xs uppercase tracking-widest font-bold">
          <p>&copy; 2025 QCU Entrep Hub</p>
          <div class="flex gap-6 mt-4 md:mt-0 text-white">
            <a href="#" class="hover:text-yellow-500 transition">Vendor Guidelines</a>
            <a href="#" class="hover:text-yellow-500 transition">Support</a>
            <a href="#" class="hover:text-yellow-500 transition">Privacy</a>
          </div>
        </div>
      </footer>

    </div>
  </div>
</template>