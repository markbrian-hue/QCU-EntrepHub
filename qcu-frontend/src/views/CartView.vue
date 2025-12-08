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

// Security: Prevent Vendors from accessing the cart
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
</script>

<template>
  <div class="max-w-6xl mx-auto font-sans">
    <h1 class="text-3xl font-black text-gray-900 mb-8 uppercase tracking-tighter">Your Cart</h1>

    <div v-if="cart.items.length === 0" class="text-center py-24 border border-dashed border-gray-300 bg-gray-50">
      <div class="mb-6 w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center mx-auto text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      </div>
      <h2 class="text-xl font-bold text-gray-800 mb-2 uppercase">Your cart is empty</h2>
      <p class="text-gray-500 mb-8 text-sm">Looks like you haven't made your choice yet.</p>
      <router-link to="/" class="px-8 py-3 bg-black text-yellow-500 font-bold uppercase tracking-widest hover:bg-gray-800 transition shadow-sm active:translate-y-0.5">
        Start Shopping
      </router-link>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      <div class="lg:col-span-2 space-y-4">
        <transition-group name="list" tag="div" class="space-y-0">
          <div v-for="item in cart.items" :key="item.productId" class="flex items-center gap-6 bg-white p-6 border border-gray-200 hover:border-yellow-500 transition group relative">
            
            <div class="w-24 h-24 flex-shrink-0 bg-gray-100 overflow-hidden border border-gray-100">
              <img :src="item.imageUrl || 'https://via.placeholder.com/150'" class="w-full h-full object-cover grayscale group-hover:grayscale-0 transition duration-500" />
            </div>
            
            <div class="flex-1 min-w-0">
              <h3 class="font-bold text-gray-900 text-lg truncate uppercase tracking-tight">{{ item.name }}</h3>
              <p class="text-xs text-gray-500 mb-2 uppercase tracking-wide">Sold by Vendor #{{ item.vendorId }}</p>
              <p class="text-yellow-600 font-black text-lg">{{ formatPrice(item.price) }}</p>
            </div>

            <div class="flex flex-col items-end gap-3">
              <span class="text-xs font-bold text-black uppercase tracking-wide bg-yellow-500 px-3 py-1">
                Qty: {{ item.quantity }}
              </span>
              
              <button @click="removeItem(item.productId, item.name)" class="text-xs text-gray-400 hover:text-red-600 underline uppercase tracking-wider font-bold transition" title="Remove Item">
                Remove
              </button>
            </div>
          </div>
        </transition-group>
      </div>

      <div class="lg:col-span-1">
        <div class="bg-gray-50 p-8 border border-gray-200 sticky top-24">
          <h2 class="font-bold text-lg mb-6 text-gray-900 uppercase tracking-widest border-b border-gray-300 pb-4">Summary</h2>
          
          <div class="space-y-4 mb-6 text-sm font-medium">
            <div class="flex justify-between text-gray-600">
              <span>Subtotal ({{ cart.totalItems }} items)</span>
              <span class="text-gray-900">{{ formatPrice(cart.totalPrice) }}</span>
            </div>
            <div class="flex justify-between text-gray-600">
              <span>Delivery</span>
              <span class="text-green-700 uppercase font-bold text-xs">Free (Campus)</span>
            </div>
          </div>

          <div class="flex justify-between items-center border-t border-gray-300 pt-6 mb-8">
            <span class="text-lg font-bold text-gray-900 uppercase">Total</span>
            <span class="text-3xl font-black text-yellow-600 tracking-tight">{{ formatPrice(cart.totalPrice) }}</span>
          </div>

          <button @click="checkout" class="w-full bg-black text-white py-4 font-bold uppercase tracking-widest hover:bg-yellow-500 hover:text-black transition-all shadow-md active:translate-y-0.5 flex justify-center items-center gap-3">
            Proceed to Checkout
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
          
          <p class="text-[10px] text-gray-400 text-center mt-6 uppercase tracking-wide">
            Secure Transaction • Meet-ups Only
          </p>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* List Transitions for adding/removing items */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>