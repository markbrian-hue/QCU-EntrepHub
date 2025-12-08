<script setup>
import { computed } from 'vue';
import { useCartStore } from '../stores/cart';
import { useToast } from "vue-toastification";

const props = defineProps({ product: Object });
const emit = defineEmits(['view']); // Signal to parent to open modal
const cartStore = useCartStore();
const toast = useToast();

const isVendor = computed(() => {
  const userData = localStorage.getItem('user');
  if (!userData) return false;
  const user = JSON.parse(userData);
  return (user.role === 'VENDOR' || user.Role === 'VENDOR');
});

const quantityInCart = computed(() => {
  const item = cartStore.items.find(i => i.productId === props.product.productId);
  return item ? item.quantity : 0;
});

const isSoldOut = computed(() => props.product.stockQuantity <= 0);

const formatPrice = (price) => {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(price);
}

// Quick Add (1 item)
const handleQuickAdd = () => {
  if (quantityInCart.value >= props.product.stockQuantity) {
    toast.warning("Max stock reached.");
    return;
  }
  cartStore.addToCart(props.product, 1);
  toast.success(`${props.product.name} added!`);
}
</script>

<template>
  <div class="group bg-white border border-gray-200 hover:border-yellow-500 transition-all duration-300 flex flex-col h-full shadow-sm hover:shadow-md relative">
    
    <div @click="emit('view', product)" class="h-64 w-full relative overflow-hidden bg-gray-100 cursor-pointer">
      <img 
        :src="product.imageUrl || 'https://via.placeholder.com/300?text=No+Image'" 
        alt="Product" 
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        :class="{ 'grayscale': isSoldOut }"
      />
      
      <span class="absolute top-0 left-0 bg-yellow-500 text-black text-xs font-bold px-3 py-1 uppercase tracking-wider">
        {{ product.category }}
      </span>

      <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
        <span class="bg-white text-black px-4 py-2 font-bold text-xs uppercase tracking-widest shadow-lg">View Details</span>
      </div>

      <div v-if="isSoldOut" class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-100">
        <span class="bg-red-600 text-white px-4 py-1 font-black uppercase tracking-widest text-sm transform -rotate-12 border-2 border-white">
          Sold Out
        </span>
      </div>
    </div>

    <div class="p-5 flex flex-col flex-grow">
      
      <h3 @click="emit('view', product)" class="font-bold text-lg text-gray-900 leading-tight mb-1 group-hover:text-yellow-600 transition-colors cursor-pointer">
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
            @click.stop="handleQuickAdd"
            :disabled="isSoldOut"
            class="px-5 py-2 text-xs font-bold uppercase tracking-widest transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed bg-black text-white hover:bg-yellow-500 hover:text-black"
          >
            Add +
          </button>
        </div>
      </div>
    </div>
  </div>
</template>