import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useCartStore = defineStore('cart', () => {
  // 1. State: Load cart from localStorage so it persists on refresh
  const items = ref(JSON.parse(localStorage.getItem('qcu_cart')) || []);

  // 2. Getters: Calculate totals automatically
  const totalItems = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0));
  const totalPrice = computed(() => items.value.reduce((sum, item) => sum + (item.price * item.quantity), 0));

  // 3. Actions: Add/Remove logic
  const addToCart = (product) => {
    const existingItem = items.value.find(item => item.productId === product.productId);

    if (existingItem) {
      existingItem.quantity++;
    } else {
      items.value.push({
        productId: product.productId,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        vendorId: product.vendorId, // Important for separating orders later
        quantity: 1
      });
    }
    saveCart();
  };

  const removeFromCart = (productId) => {
    items.value = items.value.filter(item => item.productId !== productId);
    saveCart();
  };

  const clearCart = () => {
    items.value = [];
    saveCart();
  };

  // Helper to save to browser storage
  const saveCart = () => {
    localStorage.setItem('qcu_cart', JSON.stringify(items.value));
  };

  return { items, totalItems, totalPrice, addToCart, removeFromCart, clearCart };
});