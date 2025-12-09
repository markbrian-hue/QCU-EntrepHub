<script setup>
import { ref, onMounted, computed } from 'vue';
import { useCartStore } from '../stores/cart';
import { useToast } from "vue-toastification";
import ProductCard from '../components/ProductCard.vue';
import { supabase } from '../supabase';

const products = ref([]);
const loading = ref(true);
const error = ref(null);
const activeCategory = ref('All');
const searchQuery = ref('');
const categories = ['All', 'Food', 'Beverage', 'Merch', 'Services'];

const showModal = ref(false);
const selectedProduct = ref(null);
const qty = ref(1);

const cartStore = useCartStore();
const toast = useToast();

const fetchProducts = async () => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`*, vendors ( shop_name )`);
    if (error) throw error;

    products.value = data.map(p => ({
      productId: p.product_id,
      name: p.name,
      price: p.price,
      stockQuantity: p.stock_quantity,
      category: p.category,
      imageUrl: p.image_url,
      description: p.description,
      vendor: { shopName: p.vendors?.shop_name },
      vendorId: p.vendor_id
    }));
  } catch (err) {
    console.error(err);
    error.value = "Unable to load products.";
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

const openProductModal = (product) => {
  selectedProduct.value = product;
  qty.value = 1;
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  selectedProduct.value = null;
};

const increaseQty = () => {
  if (selectedProduct.value && qty.value < selectedProduct.value.stockQuantity) {
    qty.value++;
  }
};

const decreaseQty = () => {
  if (qty.value > 1) qty.value--;
};

const addToCartFromModal = () => {
  if (!selectedProduct.value) return;

  const inCart = cartStore.items.find(i => i.productId === selectedProduct.value.productId)?.quantity || 0;
  if (inCart + qty.value > selectedProduct.value.stockQuantity) {
    toast.warning(`Stock limit reached. You already have ${inCart} in cart.`);
    return;
  }

  cartStore.addToCart(selectedProduct.value, qty.value);
  toast.success(`Added ${qty.value} x ${selectedProduct.value.name}`);
  closeModal();
};

const formatPrice = (price) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(price);

onMounted(() => {
  fetchProducts();
});
</script>

<template>
  <div class="min-h-screen font-sans relative">
    <div class="fixed inset-0 z-0">
      <div class="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-10" style="background-image: url('/qcu.jpg');"></div>
      <div class="absolute inset-0 bg-white/90"></div>
    </div>

    <div class="relative z-10">
      <div class="bg-white/80 backdrop-blur-sm border-b border-gray-200 mb-6 sm:mb-8">
        <div class="container mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
          <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div class="space-y-2">
              <h2 class="text-[11px] sm:text-xs font-bold text-yellow-600 uppercase tracking-widest bg-yellow-100 px-2 py-1 inline-block">QCU Official Marketplace</h2>
              <h1 class="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight uppercase">Student Food Hub</h1>
              <p class="text-gray-500 max-w-lg text-sm font-medium">Discover verified products from entrepreneurs students.</p>
            </div>
            <div class="w-full md:w-auto relative group">
              <input v-model="searchQuery" type="text" placeholder="SEARCH PRODUCTS..." class="w-full md:w-80 pl-4 pr-10 py-3 bg-white border border-gray-300 focus:border-yellow-500 focus:ring-0 outline-none transition text-sm font-bold shadow-sm rounded" />
            </div>
          </div>

          <div class="flex gap-4 sm:gap-6 md:gap-8 mt-4 sm:mt-6 border-b-2 border-gray-100 overflow-x-auto pb-2">
            <button v-for="cat in categories" :key="cat" @click="activeCategory = cat" class="pb-2 sm:pb-3 text-sm font-bold uppercase tracking-wide transition relative whitespace-nowrap"
              :class="activeCategory === cat ? 'text-black' : 'text-gray-400 hover:text-gray-600'">
              {{ cat }}
              <span v-if="activeCategory === cat" class="absolute bottom-0 left-0 w-full h-1 bg-yellow-500"></span>
            </button>
          </div>
        </div>
      </div>

      <div class="container mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          <div v-for="n in 8" :key="n" class="bg-white border border-gray-200 h-48 sm:h-64 animate-pulse shadow-sm rounded"></div>
        </div>

        <div v-else-if="error" class="text-center py-16 sm:py-20 bg-white/80 border border-gray-200 backdrop-blur-sm rounded">
          <h3 class="text-lg font-bold text-gray-800 uppercase">System Error</h3>
          <p class="text-gray-500 text-sm mb-4">{{ error }}</p>
          <button @click="fetchProducts" class="text-[11px] sm:text-xs font-bold uppercase underline hover:text-yellow-600 transition-colors">Try Again</button>
        </div>

        <div v-else-if="filteredProducts.length === 0" class="text-center py-16 sm:py-20 border border-dashed border-gray-300 bg-white/50 backdrop-blur-sm rounded">
          <p class="text-lg font-medium text-gray-400 uppercase">No products found.</p>
          <button @click="activeCategory = 'All'; searchQuery = ''" class="mt-2 text-yellow-600 font-bold hover:underline text-sm uppercase transition-colors">Clear Filters</button>
        </div>

        <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          <ProductCard 
            v-for="item in filteredProducts" 
            :key="item.productId" 
            :product="item"
            @view="openProductModal" 
          />
        </div>
      </div>

      <footer class="w-full bg-gray-900 text-gray-400 py-10 sm:py-12 border-t-4 border-yellow-500 mt-auto">
        <div class="container mx-auto px-4 sm:px-6 text-center text-[11px] sm:text-xs uppercase tracking-widest font-bold">
            <p>&copy; 2025 QCU Food Hub</p>
        </div>
      </footer>
    </div>

    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="closeModal"></div>
      
      <div class="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto relative z-10 flex flex-col md:flex-row shadow-2xl animate-fade-in-up rounded">
        <button @click="closeModal" class="absolute top-4 right-4 z-20 bg-white rounded-full p-2 hover:bg-gray-100 transition">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div class="w-full md:w-1/2 bg-gray-100 flex items-center justify-center">
          <img :src="selectedProduct.imageUrl || 'https://via.placeholder.com/300'" class="w-full h-full object-cover max-h-[420px] md:max-h-[500px]" />
        </div>

        <div class="w-full md:w-1/2 p-6 sm:p-8 flex flex-col space-y-4">
          <div class="flex-1">
            <span class="bg-yellow-500 text-black text-[11px] sm:text-xs font-black px-2 py-1 uppercase rounded">{{ selectedProduct.category }}</span>
            <h2 class="text-2xl sm:text-3xl font-black text-gray-900 mt-3 leading-tight uppercase">{{ selectedProduct.name }}</h2>
            <p class="text-[11px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest mt-1 mb-5">By {{ selectedProduct.vendor.shopName }}</p>
            <p class="text-gray-600 leading-relaxed mb-6 text-sm">{{ selectedProduct.description }}</p>
            <div class="flex items-center gap-4 mb-6">
              <span class="text-2xl sm:text-3xl font-black text-yellow-600">{{ formatPrice(selectedProduct.price) }}</span>
              <span class="text-[11px] sm:text-xs font-bold uppercase tracking-wide px-3 py-1 border rounded" :class="selectedProduct.stockQuantity > 0 ? 'text-green-600 border-green-200 bg-green-50' : 'text-red-600 border-red-200 bg-red-50'">
                {{ selectedProduct.stockQuantity > 0 ? `${selectedProduct.stockQuantity} In Stock` : 'Sold Out' }}
              </span>
            </div>
          </div>

          <div v-if="selectedProduct.stockQuantity > 0" class="border-t border-gray-200 pt-4 space-y-4">
            <div class="flex items-center gap-4">
              <span class="text-[11px] sm:text-xs font-bold uppercase text-gray-500">Quantity</span>
              <div class="flex items-center border border-gray-300 rounded">
                <button @click="decreaseQty" class="px-3 py-1 hover:bg-gray-100 font-bold">-</button>
                <span class="px-3 py-1 font-bold text-sm w-10 text-center">{{ qty }}</span>
                <button @click="increaseQty" class="px-3 py-1 hover:bg-gray-100 font-bold">+</button>
              </div>
            </div>
            <button @click="addToCartFromModal" class="w-full bg-black text-white py-4 font-black uppercase tracking-widest hover:bg-yellow-500 hover:text-black transition flex items-center justify-center gap-2 rounded">
              Add to Cart - {{ formatPrice(selectedProduct.price * qty) }}
            </button>
          </div>
          
          <div v-else class="border-t border-gray-200 pt-6">
             <button disabled class="w-full bg-gray-200 text-gray-400 py-4 font-black uppercase tracking-widest cursor-not-allowed rounded">
              Sold Out
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in-up { animation: fadeInUp 0.3s ease-out; }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
</style>