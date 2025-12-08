import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import CartView from '../views/CartView.vue' // <--- Add Import
import CheckoutView from '../views/CheckoutView.vue' // <--- Add Import
import VendorDashboard from '../views/VendorDashboard.vue' // Import
import ProfileView from '../views/ProfileView.vue'
import AdminDashboard from '@/views/AdminDashboard.vue'


const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/login',
      name: 'login',
      // Lazy load the login view (we will create this file next)
      component: () => import('../views/LoginView.vue')
    },
    {
      path: '/cart',
      name: 'cart',
      component: CartView
    },
    {
      path: '/checkout',
      name: 'checkout',
      component: CheckoutView
    },
    {
  path: '/vendor',
  name: 'vendor',
  component: VendorDashboard
},
{
  path: '/profile',
  name: 'profile',
  component: ProfileView
},
{
  path: '/admin',
  name: 'admin',
  component: AdminDashboard
}
  ]
})

export default router