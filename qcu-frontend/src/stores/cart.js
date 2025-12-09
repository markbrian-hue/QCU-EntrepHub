import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useCartStore = defineStore('cart', () => {
  // Default to guest key initially
  const storageKey = ref('qcu_cart_guest');
  const items = ref([]);

  // Load cart based on the User ID provided
  const loadUserCart = (userId) => {
    if (userId) {
      storageKey.value = `qcu_cart_user_${userId}`; // Unique Key per User
    } else {
      storageKey.value = 'qcu_cart_guest';
    }
    
    // Load data from LocalStorage using the specific key
    const stored = localStorage.getItem(storageKey.value);
    items.value = stored ? JSON.parse(stored) : [];
  };

  // Helper to save to the current key
  const saveCart = () => {
    localStorage.setItem(storageKey.value, JSON.stringify(items.value));
  };

  // Call this on Logout (Clears UI, but KEEPS the data in storage)
  const resetSession = () => {
    items.value = [];
    storageKey.value = 'qcu_cart_guest';
  };

  // --- GETTERS ---
  const totalItems = computed(() => items.value.length); 
  const totalPrice = computed(() => items.value.reduce((sum, item) => sum + (item.price * item.quantity), 0));

  // --- ACTIONS ---
  const addToCart = (product, qty = 1) => {
    const existingItem = items.value.find(item => item.productId === product.productId);

    if (existingItem) {
      if (existingItem.quantity + qty <= existingItem.stockQuantity) {
        existingItem.quantity += qty;
      } else {
        existingItem.quantity = existingItem.stockQuantity; 
      }
    } else {
      items.value.push({
        productId: product.productId,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        vendorId: product.vendorId, 
        vendorName: product.vendor?.shopName || 'Student Seller', 
        stockQuantity: product.stockQuantity,
        quantity: qty
      });
    }
    saveCart();
  };

  const increaseItemQty = (productId) => {
    const item = items.value.find(i => i.productId === productId);
    if (item && item.quantity < item.stockQuantity) {
      item.quantity++;
      saveCart();
      return true;
    }
    return false;
  };

  const decreaseItemQty = (productId) => {
    const item = items.value.find(i => i.productId === productId);
    if (item && item.quantity > 1) {
      item.quantity--;
      saveCart();
    }
  };

  const removeFromCart = (productId) => {
    items.value = items.value.filter(item => item.productId !== productId);
    saveCart();
  };

  const clearCart = () => {
    items.value = [];
    saveCart();
  };

  return { 
    items, 
    totalItems, 
    totalPrice, 
    loadUserCart, 
    resetSession, 
    addToCart, 
    increaseItemQty, 
    decreaseItemQty, 
    removeFromCart, 
    clearCart 
  };
});