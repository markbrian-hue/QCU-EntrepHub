<script setup>
import { onMounted } from 'vue';
import { useCartStore } from '../stores/cart';
import { useRouter } from 'vue-router';
import { useToast } from "vue-toastification";

const cart = useCartStore();
const router = useRouter();
const toast = useToast();

const formatPrice = (price) => 
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(price);

onMounted(() => {
  const userData = localStorage.getItem('user');
  if (userData) {
    const user = JSON.parse(userData);
    if (user.role === 'VENDOR' || user.Role === 'VENDOR') {
      toast.error("Vendors cannot make purchases.");
      router.push('/vendor');
    }
  }
});

const checkout = () => {
  const user = localStorage.getItem('user');
  if (!user) {
    toast.info("Please login to checkout.");
    router.push('/login');
    return;
  }
  
  if (cart.items.length === 0) {
    toast.warning("Your cart is empty.");
    return;
  }

  router.push('/checkout');
};

const removeItem = (id, name) => {
  cart.removeFromCart(id);
  toast.success(`${name} removed from cart.`);
};

// FIX: Button Handlers
const increase = (item) => {
  const success = cart.increaseItemQty(item.productId);
  if (!success) {
    toast.warning(`Max stock (${item.stockQuantity}) reached.`);
  }
};

const decrease = (item) => {
  cart.decreaseItemQty(item.productId);
};
</script>

<template>
  <div class="max-w-6xl mx-auto font-sans">
    
    <div class="mb-8 border-b border-gray-200 pb-4 flex items-end justify-between">
        <h1 class="text-4xl font-black text-gray-900 uppercase tracking-tighter">Shopping Bag</h1>
        <p class="text-sm font-bold text-gray-500 uppercase tracking-widest">{{ cart.totalItems }} Items</p>
    </div>

    <div v-if="cart.items.length === 0" class="text-center py-24 border-2 border-dashed border-gray-300 bg-gray-50">
      <div class="mb-6 w-20 h-20 bg-gray-200 flex items-center justify-center mx-auto text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      </div>
      <h2 class="text-xl font-bold text-gray-800 mb-2 uppercase tracking-wide">Your cart is empty</h2>
      <router-link to="/" class="mt-4 inline-block px-8 py-4 bg-black text-white font-bold uppercase tracking-widest hover:bg-yellow-500 hover:text-black transition shadow-sm">
        Start Shopping
      </router-link>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-12">
      
      <div class="lg:col-span-2 space-y-0 border-t border-gray-200">
        <transition-group name="list" tag="div">
          <div v-for="item in cart.items" :key="item.productId" class="flex items-start gap-6 bg-white p-6 border-b border-gray-200 transition group relative">
            
            <div class="w-32 h-32 flex-shrink-0 bg-gray-100 border border-gray-300">
              <img :src="item.imageUrl || 'https://via.placeholder.com/150'" class="w-full h-full object-cover" />
            </div>
            
            <div class="flex-1 min-w-0 flex flex-col h-32 justify-between">
              <div>
                <div class="flex justify-between items-start">
                    <h3 class="font-black text-gray-900 text-lg uppercase tracking-tight leading-none">{{ item.name }}</h3>
                    <p class="text-yellow-600 font-black text-lg">{{ formatPrice(item.price * item.quantity) }}</p>
                </div>
                <p class="text-xs text-gray-500 mt-2 uppercase tracking-wide font-bold">
                  <span class="text-gray-900">{{ item.vendorName }}</span>
                </p>
              </div>

              <div class="flex justify-between items-end">
                
                <div class="flex items-center border border-gray-300 bg-white">
                  <button 
                    @click="decrease(item)" 
                    class="px-3 py-1 hover:bg-gray-100 active:bg-gray-200 text-gray-600 font-bold disabled:opacity-50"
                    :disabled="item.quantity <= 1"
                  >-</button>
                  <span class="px-3 py-1 font-black text-sm w-10 text-center border-l border-r border-gray-200 bg-gray-50">
                    {{ item.quantity }}
                  </span>
                  <button 
                    @click="increase(item)" 
                    class="px-3 py-1 hover:bg-gray-100 active:bg-gray-200 text-gray-600 font-bold"
                  >+</button>
                </div>
                
                <button @click="removeItem(item.productId, item.name)" class="text-xs text-gray-400 hover:text-red-600 underline uppercase tracking-wider font-bold transition">
                  Remove
                </button>
              </div>
            </div>
          </div>
        </transition-group>
      </div>

      <div class="lg:col-span-1">
        <div class="bg-gray-50 p-8 border border-gray-200 sticky top-24">
          <h2 class="font-black text-xl mb-6 text-gray-900 uppercase tracking-widest border-b-2 border-yellow-500 inline-block pb-1">Summary</h2>
          
          <div class="space-y-4 mb-8 text-sm font-bold uppercase tracking-wide">
            <div class="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span class="text-gray-900">{{ formatPrice(cart.totalPrice) }}</span>
            </div>
            <div class="flex justify-between text-gray-500">
              <span>Delivery</span>
              <span class="text-green-700">Free (Campus)</span>
            </div>
          </div>

          <div class="flex justify-between items-center border-t border-gray-300 pt-6 mb-8">
            <span class="text-lg font-black text-gray-900 uppercase">Total</span>
            <span class="text-3xl font-black text-yellow-600 tracking-tight">{{ formatPrice(cart.totalPrice) }}</span>
          </div>

          <button @click="checkout" class="w-full bg-black text-white py-4 font-bold uppercase tracking-widest hover:bg-yellow-500 hover:text-black transition-all shadow-md active:translate-y-0.5">
            Checkout
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.list-enter-active, .list-leave-active { transition: all 0.3s ease; }
.list-enter-from, .list-leave-to { opacity: 0; transform: translateX(20px); }
</style>