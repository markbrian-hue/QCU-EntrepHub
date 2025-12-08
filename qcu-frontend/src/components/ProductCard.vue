<script setup>
import { computed } from 'vue';
import { useCartStore } from '../stores/cart';
import { useToast } from "vue-toastification";

const props = defineProps({ product: Object });
const cartStore = useCartStore();
const toast = useToast();

const isVendor = computed(() => {
  const userData = localStorage.getItem('user');
  if (!userData) return false;
  const user = JSON.parse(userData);
  return (user.role === 'VENDOR' || user.Role === 'VENDOR');
});

// Calculate how many of this specific item are already in the cart
const quantityInCart = computed(() => {
  const item = cartStore.items.find(i => i.productId === props.product.productId);
  return item ? item.quantity : 0;
});

// Check if we hit the limit
const isMaxReached = computed(() => {
  return quantityInCart.value >= props.product.stockQuantity;
});

const isSoldOut = computed(() => {
  return props.product.stockQuantity <= 0;
});

const formatPrice = (price) => {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(price);
}

const handleAddToCart = () => {
  if (isMaxReached.value) {
    toast.warning("You have reached the maximum stock limit for this item.");
    return;
  }
  cartStore.addToCart(props.product);
  toast.success(`${props.product.name} added to cart!`);
}
</script>

<template>
  <div class="group bg-white border border-gray-200 hover:border-yellow-500 transition-all duration-300 flex flex-col h-full shadow-sm hover:shadow-md">
    
    <div class="h-64 w-full relative overflow-hidden bg-gray-100">
      <img 
        :src="product.imageUrl || 'https://via.placeholder.com/300?text=No+Image'" 
        alt="Product" 
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        :class="{ 'grayscale': isSoldOut }"
      />
      
      <span class="absolute top-0 left-0 bg-yellow-500 text-black text-xs font-bold px-3 py-1 uppercase tracking-wider">
        {{ product.category }}
      </span>

      <div v-if="isSoldOut" class="absolute inset-0 bg-black/50 flex items-center justify-center">
        <span class="bg-red-600 text-white px-4 py-1 font-black uppercase tracking-widest text-sm transform -rotate-12 border-2 border-white">
          Sold Out
        </span>
      </div>
    </div>

    <div class="p-5 flex flex-col flex-grow">
      
      <h3 class="font-bold text-lg text-gray-900 leading-tight mb-1 group-hover:text-yellow-600 transition-colors">
        {{ product.name }}
      </h3>
      
      <p class="text-xs text-gray-500 uppercase tracking-wide mb-2">
        {{ product.vendor?.shopName || 'Student Seller' }}
      </p>

      <div class="mb-4">
        <span class="text-[10px] font-bold uppercase tracking-wide" 
              :class="product.stockQuantity < 5 ? 'text-red-600' : 'text-green-600'">
          {{ product.stockQuantity }} Items Left
        </span>
      </div>
      
      <div class="flex justify-between items-center mt-auto pt-4 border-t border-gray-100">
        <span class="text-xl font-black text-gray-900">{{ formatPrice(product.price) }}</span>
        
        <div v-if="!isVendor">
          <button 
            @click="handleAddToCart"
            :disabled="isMaxReached || isSoldOut"
            class="px-5 py-2 text-xs font-bold uppercase tracking-widest transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            :class="isMaxReached || isSoldOut ? 'bg-gray-300 text-gray-500' : 'bg-black text-white hover:bg-yellow-500 hover:text-black'"
          >
            {{ isSoldOut ? 'Sold Out' : (isMaxReached ? 'Max Added' : 'Add') }}
          </button>
        </div>
        
        <span v-else class="text-xs text-gray-400 font-medium italic border border-gray-200 px-2 py-1">
          Seller View
        </span>
      </div>
    </div>
  </div>
</template>