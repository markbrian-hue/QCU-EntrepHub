<script setup>
import { ref, onMounted } from 'vue';
import { useCartStore } from '../stores/cart';
import { useRouter } from 'vue-router';
import { useToast } from "vue-toastification";
import { supabase } from '../supabase';

const cart = useCartStore();
const router = useRouter();
const toast = useToast();
const user = ref(null);
const loading = ref(false);

const deliveryLocation = ref('');
const paymentMethod = ref('CASH_ON_PICKUP');

const formatPrice = (price) => 
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(price);

onMounted(() => {
  const userData = localStorage.getItem('user');
  if (!userData) {
    toast.info("Please login to checkout.");
    router.push('/login');
    return;
  }
  user.value = JSON.parse(userData);

  if (cart.items.length === 0) {
    router.push('/');
  }
});

const placeOrder = async () => {
  if (!deliveryLocation.value) {
    toast.warning("Please enter a delivery location.");
    return;
  }

  loading.value = true;
  try {
    const customerId = user.value.userId;
    const vendorId = cart.items[0].vendorId; 
    const totalAmount = cart.totalPrice;

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: customerId,
        vendor_id: vendorId,
        delivery_location: deliveryLocation.value,
        payment_method: paymentMethod.value,
        total_amount: totalAmount,
        status: 'PENDING'
      })
      .select()
      .single();

    if (orderError) throw orderError;

    const newOrderId = orderData.order_id;

    const orderItems = cart.items.map(item => ({
      order_id: newOrderId,
      product_id: item.productId,
      quantity: item.quantity,
      price_at_order: item.price
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) throw itemsError;

    toast.success(`Order #${newOrderId} placed successfully!`);
    cart.clearCart(); 
    router.push('/profile');
  } catch (error) {
    console.error(error);
    toast.error("Failed to place order. Please try again.");
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="max-w-3xl mx-auto py-10 sm:py-12 px-4 sm:px-6 font-sans space-y-8">
    <div class="mb-2 sm:mb-4 border-b-4 border-yellow-500 pb-3">
      <h1 class="text-3xl sm:text-4xl font-black text-gray-900 uppercase tracking-tighter">Checkout</h1>
      <p class="text-gray-500 mt-1 text-sm">Complete your purchase securely.</p>
    </div>

    <div class="grid md:grid-cols-3 gap-6 sm:gap-8">
      <div class="md:col-span-1 md:order-2">
        <div class="bg-gray-50 p-5 sm:p-6 border border-gray-200 rounded sticky top-20 space-y-3">
          <h3 class="font-bold text-lg text-gray-900 uppercase mb-2 tracking-wide border-b border-gray-300 pb-2">Summary</h3>
          <div class="space-y-3">
            <div v-for="item in cart.items" :key="item.productId" class="flex justify-between text-sm text-gray-600">
              <span><span class="font-bold text-gray-900">{{ item.quantity }}x</span> {{ item.name }}</span>
              <span>{{ formatPrice(item.price * item.quantity) }}</span>
            </div>
          </div>
          <div class="border-t border-gray-300 pt-3 flex justify-between items-center">
            <span class="font-bold text-gray-900 uppercase">Total</span>
            <span class="text-xl font-black text-yellow-600">{{ formatPrice(cart.totalPrice) }}</span>
          </div>
        </div>
      </div>

      <div class="md:col-span-2 md:order-1">
        <form @submit.prevent="placeOrder" class="space-y-6">
          <div>
            <label class="block text-[11px] sm:text-xs font-bold text-gray-900 uppercase mb-2">Delivery / Pickup Location</label>
            <input 
              v-model="deliveryLocation" 
              type="text" 
              placeholder="e.g. Room 305, TechVoc Lobby, or Near Guard House" 
              class="w-full p-4 bg-white border border-gray-300 focus:border-yellow-500 focus:ring-0 outline-none transition placeholder:text-gray-400 font-medium rounded"
              required
            />
            <p class="text-[11px] text-gray-400 mt-2 uppercase tracking-wide">Specify a clear meet-up point within QCU.</p>
          </div>

          <div>
            <label class="block text-[11px] sm:text-xs font-bold text-gray-900 uppercase mb-2">Payment Method</label>
            <div class="relative">
              <select v-model="paymentMethod" class="w-full p-4 bg-white border border-gray-300 focus:border-yellow-500 focus:ring-0 outline-none transition appearance-none cursor-pointer font-medium rounded">
                <option value="CASH_ON_DELIVERY">Cash on Delivery</option>
                <option value="GCASH">GCash on Delivery (Show proof upon meetup)</option>
              </select>
              <div class="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                <svg class="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            :disabled="loading"
            class="w-full bg-black text-white py-4 font-bold uppercase tracking-widest hover:bg-yellow-500 hover:text-black transition-all shadow-lg active:translate-y-0.5 disabled:opacity-70 rounded mt-2"
          >
            {{ loading ? 'Processing Order...' : 'Confirm Order' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>