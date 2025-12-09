<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from "vue-toastification";
import { supabase } from '../supabase';

const router = useRouter();
const toast = useToast();

const isLogin = ref(true);
const loading = ref(false);

const email = ref('');
const fullName = ref('');
const password = ref('');
const role = ref('BUYER');
const shopName = ref('');
const idCardFile = ref(null);

const toggleMode = () => {
  isLogin.value = !isLogin.value;
  // Clear fields
  email.value = '';
  password.value = '';
  fullName.value = '';
  shopName.value = '';
  idCardFile.value = null;
};

const handleFileUpload = (event) => {
  idCardFile.value = event.target.files[0];
};

const handleSubmit = async () => {
  loading.value = true;
  try {
    const normalizedEmail = email.value.trim().toLowerCase();

    if (!normalizedEmail || !password.value) {
      throw new Error('Email and password are required.');
    }

    if (isLogin.value) {
      // --- LOGIN WITH EMAIL ---
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: password.value,
      });
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Login succeeded but no user returned from auth.');

      // Fetch User Profile (ensure RLS allows this select)
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select(`*, vendors(*)`)
        .eq('id', authData.user.id)
        .single();

      if (profileError) throw profileError;
      if (!profile) throw new Error("Profile not found. Please contact support.");

      const sessionUser = {
        userId: profile.id,
        fullName: profile.full_name,
        role: profile.role,
        studentNumber: profile.student_number,
        VendorId: profile.vendors?.[0]?.vendor_id || null,
        ShopName: profile.vendors?.[0]?.shop_name || null,
        VendorStatus: profile.vendors?.[0]?.verification_status || null,
      };

      localStorage.setItem('user', JSON.stringify(sessionUser));
      toast.success(`Welcome back, ${profile.full_name}!`);

      if (sessionUser.role === 'VENDOR') router.push('/vendor');
      else if (sessionUser.role === 'ADMIN') router.push('/admin');
      else router.push('/');
    } else {
      // --- REGISTER WITH EMAIL ---
      if (role.value === 'BUYER' && !idCardFile.value) {
        toast.warning("Buyers must upload a School ID.");
        return;
      }

      // 1. Create Auth User
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: password.value,
      });
      if (authError) throw authError;
      if (!authData?.user) throw new Error('Registration succeeded but no auth user returned.');

      // 2. Upload ID Image (If Buyer)
      let idCardUrl = null;
      if (idCardFile.value) {
        const fileName = `${Date.now()}_${idCardFile.value.name}`;
        const { error: imgError } = await supabase.storage
          .from('images')
          .upload(fileName, idCardFile.value, { cacheControl: '3600', upsert: false });
        if (imgError) throw imgError;

        const { data: publicUrl, error: urlError } = supabase.storage.from('images').getPublicUrl(fileName);
        if (urlError) throw urlError;
        idCardUrl = publicUrl.publicUrl;
      }

      // 3. Save User Data
      const { error: dbError } = await supabase.from('users').insert({
        id: authData.user.id,
        full_name: role.value === 'VENDOR' ? shopName.value : fullName.value,
        student_number: normalizedEmail,
        role: role.value,
        id_card_image: idCardUrl,
      });
      if (dbError) throw dbError;

      // 4. Create Vendor Profile
      if (role.value === 'VENDOR') {
        const { error: vendorError } = await supabase.from('vendors').insert({
          user_id: authData.user.id,
          shop_name: shopName.value,
          course_section: 'N/A',
          is_open: false,
          verification_status: 'PENDING',
        });
        if (vendorError) throw vendorError;
      }

      toast.success('Registration successful! Please check your email and login.');
      isLogin.value = true;
      // Clear form
      toggleMode();
      isLogin.value = true;
    }
  } catch (error) {
    console.error(error);
    toast.error(error.message || "An error occurred. Check console for details.");
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="relative w-full overflow-x-hidden font-sans text-gray-900">
    
    <div class="fixed inset-0 z-0">
      <div class="absolute inset-0 bg-cover bg-center bg-no-repeat" 
           style="background-image: url('/qcu.jpg');"></div>
      <div class="absolute inset-0 bg-gradient-to-r from-gray-900/95 via-gray-900/80 to-yellow-900/30"></div>
    </div>

    <div class="relative z-10 flex flex-col min-h-screen">
      
      <div class="min-h-screen container mx-auto px-6 flex flex-col lg:flex-row items-center justify-center lg:justify-between py-20">
        
        <div class="w-full lg:w-1/2 text-white space-y-8 animate-slide-right mb-12 lg:mb-0">
          <div class="inline-flex items-center gap-3 bg-yellow-500 px-4 py-2 border-l-4 border-white shadow-lg">
            <span class="text-black text-xs font-black uppercase tracking-widest">Official Platform</span>
          </div>
          
          <h1 class="text-6xl lg:text-7xl font-black leading-none tracking-tighter uppercase">
            QCU <br/>
            <span class="text-yellow-400">Food Hub</span>
          </h1>
          
          <p class="text-lg lg:text-xl text-gray-300 max-w-lg leading-relaxed font-light border-l-4 border-yellow-500 pl-6">
            The exclusive digital marketplace for Quezon City University. Support student entrepreneurs and discover amazing local products.
          </p>

          <div class="flex items-center gap-6 pt-4">
            <button @click="$refs.aboutSection.scrollIntoView({ behavior: 'smooth' })" class="px-8 py-4 border-2 border-white hover:bg-white hover:text-black transition text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              Learn More
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
            </button>
          </div>
        </div>

        <div class="w-full lg:w-[450px] animate-fade-in-up">
          <div class="bg-white p-10 shadow-2xl border-t-8 border-yellow-500">
            <div class="mb-8">
              <h2 class="text-3xl font-black text-gray-900 uppercase tracking-tighter">
                {{ isLogin ? 'Welcome Back' : 'Get Started' }}
              </h2>
              <p class="text-gray-500 text-xs font-bold uppercase tracking-wide mt-1">
                {{ isLogin ? 'Access your account' : 'Join the QCU community' }}
              </p>
            </div>

            <form @submit.prevent="handleSubmit" class="space-y-5">
              
              <div v-if="!isLogin" class="grid grid-cols-2 gap-0 border border-gray-200 mb-6">
                <button type="button" @click="role = 'BUYER'" :class="role === 'BUYER' ? 'bg-black text-yellow-500' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'" class="py-3 text-xs font-black uppercase tracking-widest transition-colors">Buyer</button>
                <button type="button" @click="role = 'VENDOR'" :class="role === 'VENDOR' ? 'bg-black text-yellow-500' : 'bg-gray-100 text-gray-500 hover:bg-gray-100'" class="py-3 text-xs font-black uppercase tracking-widest transition-colors">Vendor</button>
              </div>

              <div class="space-y-5">
                
                <div v-if="!isLogin && role === 'VENDOR'">
                  <div>
                    <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1 block">Enterprise Name</label>
                    <input v-model="shopName" required class="w-full p-4 bg-gray-50 border border-gray-300 focus:border-black focus:bg-white focus:ring-0 outline-none transition font-bold text-gray-900 placeholder:text-gray-400" placeholder="BLOCK 5 SNACKS" />
                  </div>
                  <div class="mt-4">
                    <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1 block">Email Address</label>
                    <input v-model="email" type="email" required class="w-full p-4 bg-gray-50 border border-gray-300 focus:border-black focus:bg-white focus:ring-0 outline-none transition font-bold text-gray-900 placeholder:text-gray-400" placeholder="vendor@gmail.com" />
                  </div>
                </div>

                <div v-if="!isLogin && role === 'BUYER'" class="space-y-5">
                  <div>
                    <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1 block">Full Name</label>
                    <input v-model="fullName" required class="w-full p-4 bg-gray-50 border border-gray-300 focus:border-black focus:bg-white focus:ring-0 outline-none transition font-bold" placeholder="JUAN DELA CRUZ" />
                  </div>
                  <div>
                    <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1 block">Email Address</label>
                    <input v-model="email" type="email" required class="w-full p-4 bg-gray-50 border border-gray-300 focus:border-black focus:bg-white focus:ring-0 outline-none transition font-bold text-gray-900 placeholder:text-gray-400" placeholder="student@gmail.com" />
                  </div>
                  <div>
                    <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1 block">School ID Photo</label>
                    <input type="file" required @change="handleFileUpload" accept="image/*" class="w-full p-2 border border-gray-300 bg-gray-50 text-xs font-bold cursor-pointer hover:bg-gray-100" />
                  </div>
                </div>

                <div v-if="isLogin">
                  <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1 block">Email Address</label>
                  <input v-model="email" type="email" required class="w-full p-4 bg-gray-50 border border-gray-300 focus:border-black focus:bg-white focus:ring-0 outline-none transition font-bold text-gray-900" placeholder="ENTER EMAIL" />
                </div>

                <div>
                  <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1 block">Password</label>
                  <input v-model="password" required type="password" class="w-full p-4 bg-gray-50 border border-gray-300 focus:border-black focus:bg-white focus:ring-0 outline-none transition font-bold" placeholder="••••••" />
                </div>
              </div>

              <button type="submit" :disabled="loading" class="w-full bg-yellow-500 text-black py-4 font-black uppercase tracking-widest hover:bg-yellow-400 transition shadow-lg active:translate-y-0.5 disabled:opacity-70 mt-6 border-b-4 border-yellow-600 active:border-b-0 active:mt-7">
                {{ loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account') }}
              </button>

              <div class="mt-8 text-center border-t border-gray-200 pt-6">
                <p class="text-xs text-gray-500 uppercase tracking-wide font-bold">
                  {{ isLogin ? "New here?" : "Already a member?" }}
                  <button @click="toggleMode" class="text-black hover:text-yellow-600 underline ml-1 transition-colors">
                    {{ isLogin ? 'Register Here' : 'Login Here' }}
                  </button>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div ref="aboutSection" class="bg-white relative z-20 py-24 border-t border-gray-200">
        <div class="container mx-auto px-6">
          <div class="text-center max-w-3xl mx-auto mb-16">
            <h2 class="text-xs font-black text-yellow-600 uppercase tracking-widest border-b-2 border-yellow-500 inline-block pb-1 mb-4">About The Platform</h2>
            <h3 class="text-4xl font-black text-gray-900 mb-6 uppercase tracking-tight">Empowering Student Innovation</h3>
            <p class="text-gray-600 text-lg leading-relaxed font-medium">
              QCU Food Hub is a dedicated digital space designed to bridge the gap between student entrepreneurs and the campus community. We provide a safe, regulated, and convenient way to buy and sell products within the university.
            </p>
          </div>
          <div class="grid md:grid-cols-3 gap-12">
            <div class="text-center space-y-4 p-8 border border-gray-200 hover:border-black transition duration-300">
              <div class="w-16 h-16 bg-black flex items-center justify-center mx-auto text-yellow-500">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h4 class="text-xl font-black text-gray-900 uppercase">Verified Vendors</h4>
              <p class="text-sm text-gray-500 font-medium">Every seller is a verified student, ensuring legitimacy and quality.</p>
            </div>
            <div class="text-center space-y-4 p-8 border border-gray-200 hover:border-black transition duration-300">
              <div class="w-16 h-16 bg-black flex items-center justify-center mx-auto text-yellow-500">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <h4 class="text-xl font-black text-gray-900 uppercase">Campus Delivery</h4>
              <p class="text-sm text-gray-500 font-medium">Convenient meet-ups or room-to-room delivery within Quezon City University campus.</p>
            </div>
            <div class="text-center space-y-4 p-8 border border-gray-200 hover:border-black transition duration-300">
              <div class="w-16 h-16 bg-black flex items-center justify-center mx-auto text-yellow-500">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              </div>
              <h4 class="text-xl font-black text-gray-900 uppercase">Support Local</h4>
              <p class="text-sm text-gray-500 font-medium">Directly support your fellow students' small businesses and capstone projects.</p>
            </div>
          </div>
        </div>
      </div>

      <footer class="bg-black text-white relative z-20 py-16 border-t-4 border-yellow-500">
        <div class="container mx-auto px-6 text-center">
          <div class="mb-8">
            <h2 class="text-2xl font-black tracking-tight uppercase">QCU Food Hub</h2>
            <p class="text-gray-400 text-xs mt-2 uppercase tracking-widest">Quezon City University, San Bartolome, Novaliches</p>
          </div>
          <div class="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-gray-500 uppercase tracking-wide font-bold">
            <p>&copy; 2025 QCU Food Hub. All rights reserved.</p>
            <div class="flex gap-6 mt-4 md:mt-0">
              <a href="#" class="hover:text-yellow-500 transition">Privacy Policy</a>
              <a href="#" class="hover:text-yellow-500 transition">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  </div>
</template>

<style scoped>
.animate-slide-right { animation: slideRight 1s ease-out; }
.animate-fade-in-up { animation: fadeInUp 0.8s ease-out; }

@keyframes slideRight {
  from { opacity: 0; transform: translateX(-50px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(40px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>