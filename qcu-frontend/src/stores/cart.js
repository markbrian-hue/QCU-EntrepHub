import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useCartStore = defineStore('cart', () => {
  // Default to a guest key
  const storageKey = ref('qcu_cart_guest');
  const items = ref([]);

  // --- GETTERS ---
  // FIX: Count array length for unique items, or sum quantity for total units
  const totalItems = computed(() => items.value.length); 
  const totalPrice = computed(() => items.value.reduce((sum, item) => sum + (item.price * item.quantity), 0));

  // --- STORAGE HELPERS ---
  const saveCart = () => {
    localStorage.setItem(storageKey.value, JSON.stringify(items.value));
  };

  // Call this when App starts or User logs in
  const loadUserCart = (userId) => {
    if (userId) {
      storageKey.value = `qcu_cart_user_${userId}`; // Unique key per user
    } else {
      storageKey.value = 'qcu_cart_guest';
    }

    // Load data for this specific key
    const stored = localStorage.getItem(storageKey.value);
    items.value = stored ? JSON.parse(stored) : [];
  };

  // Call this on Logout (Clears UI but keeps data in storage)
  const resetSession = () => {
    items.value = [];
    storageKey.value = 'qcu_cart_guest';
  };

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

  // Used after checkout to actually delete items
  const clearCart = () => {
    items.value = [];
    saveCart();
  };

  return { 
    items, 
    totalItems, 
    totalPrice, 
    loadUserCart,  // New
    resetSession,  // New
    addToCart, 
    increaseItemQty, 
    decreaseItemQty, 
    removeFromCart, 
    clearCart 
  };
});