<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from "vue-toastification";
import { supabase } from '../supabase';

const router = useRouter();
const toast = useToast();
const user = ref(null);
const allUsers = ref([]);
const announcements = ref([]);
const activeTab = ref('approvals');

const newAnnouncement = ref({ title: '', message: '' });

const showConfirmModal = ref(false);
const confirmConfig = ref({ title: '', message: '', action: null, confirmBtnText: 'Confirm', confirmBtnColor: 'bg-black' });

onMounted(async () => {
  const userData = localStorage.getItem('user');
  if (!userData) { router.push('/login'); return; }
  user.value = JSON.parse(userData);

  if (user.value.role !== 'ADMIN') {
    toast.error("Access Denied. Admins only.");
    router.push('/');
    return;
  }

  await fetchData();
  await fetchAnnouncements();
});

const fetchData = async () => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(`*, vendors ( * )`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    allUsers.value = data.map(u => ({
      user_id: u.id,
      full_name: u.full_name,
      student_number: u.student_number,
      role: u.role,
      id_card_image: u.id_card_image,
      created_at: u.created_at,
      vendor_id: u.vendors?.[0]?.vendor_id,
      shop_name: u.vendors?.[0]?.shop_name,
      verification_status: u.vendors?.[0]?.verification_status
    }));
  } catch (err) {
    console.error("Fetch Error:", err);
    toast.error("Failed to load users.");
  }
};

const fetchAnnouncements = async () => {
  try {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    announcements.value = data;
  } catch (err) { console.error(err); }
};

const pendingVendors = computed(() => allUsers.value.filter(u => u.role === 'VENDOR' && u.verification_status === 'PENDING'));
const activeVendors = computed(() => allUsers.value.filter(u => u.role === 'VENDOR' && u.verification_status === 'APPROVED'));
const buyers = computed(() => allUsers.value.filter(u => u.role === 'BUYER'));

const postAnnouncement = async () => {
  if(!newAnnouncement.value.title || !newAnnouncement.value.message) {
    toast.warning("Please fill in all fields."); return;
  }
  try {
    const { error } = await supabase.from('announcements').insert([
      { title: newAnnouncement.value.title, message: newAnnouncement.value.message }
    ]);
    if (error) throw error;
    toast.success("Announcement Posted!");
    newAnnouncement.value = { title: '', message: '' };
    await fetchAnnouncements();
  } catch(e) { toast.error("Failed to post."); }
};

const deleteAnnouncement = async (id) => {
  if(!confirm("Delete this announcement?")) return;
  try {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) throw error;
    toast.info("Deleted.");
    await fetchAnnouncements();
  } catch(e) { toast.error("Failed to delete."); }
};

const triggerVerify = (vendorId, status) => {
  const isApprove = status === 'APPROVED';
  confirmConfig.value = {
    title: isApprove ? 'Approve Vendor?' : 'Reject Vendor?',
    message: isApprove ? 'Allow vendor to sell.' : 'Block vendor access.',
    confirmBtnText: isApprove ? 'Approve' : 'Reject',
    confirmBtnColor: isApprove ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700',
    action: async () => {
      try {
        const { error } = await supabase
          .from('vendors')
          .update({ verification_status: status })
          .eq('vendor_id', vendorId);
        if (error) throw error;
        toast.success(`Vendor ${status}`);
        await fetchData();
      } catch (err) { toast.error("Action failed"); }
    }
  };
  showConfirmModal.value = true;
};

const triggerDelete = (userId) => {
  confirmConfig.value = {
    title: 'Ban User?',
    message: 'Permanently delete this user?',
    confirmBtnText: 'Delete User',
    confirmBtnColor: 'bg-red-600 hover:bg-red-700',
    action: async () => {
      try {
        const { error } = await supabase.from('users').delete().eq('id', userId);
        if (error) throw error;
        toast.success("User deleted.");
        await fetchData();
      } catch (err) { 
        console.error(err);
        toast.error("Action failed. Check console."); 
      }
    }
  };
  showConfirmModal.value = true;
};

const handleConfirm = async () => {
  showConfirmModal.value = false;
  if (confirmConfig.value.action) await confirmConfig.value.action();
};

const openIdCard = (url) => {
  if(url) window.open(url, '_blank');
  else toast.warning("No ID card uploaded");
};
</script>

<template>
  <div class="max-w-7xl mx-auto p-4 sm:p-6 font-sans space-y-6">
    <div class="bg-gray-900 p-6 sm:p-8 mb-4 sm:mb-6 text-white shadow-xl border-l-8 border-yellow-500 rounded">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl sm:text-3xl font-black tracking-tight uppercase">Admin Console</h1>
          <p class="text-yellow-500 mt-1 uppercase tracking-widest text-[11px] sm:text-xs font-bold">QCU Entrep Hub Management</p>
        </div>
        <div class="text-left sm:text-right">
          <p class="text-2xl sm:text-3xl font-black">{{ allUsers.length }}</p>
          <p class="text-[11px] sm:text-xs text-gray-400 uppercase tracking-wide font-bold">Total Users</p>
        </div>
      </div>
    </div>

    <div class="flex gap-1 sm:gap-0 mb-4 sm:mb-6 border-b border-gray-200 bg-white shadow-sm overflow-x-auto rounded">
      <button @click="activeTab = 'approvals'" :class="activeTab === 'approvals' ? 'bg-yellow-500 text-black' : 'text-gray-500 hover:bg-gray-50'" class="px-4 sm:px-8 py-3 font-bold uppercase text-[11px] sm:text-xs tracking-widest flex gap-2 whitespace-nowrap">
        Approvals
        <span v-if="pendingVendors.length > 0" class="bg-red-600 text-white px-1.5 py-0.5 text-[10px] rounded">{{ pendingVendors.length }}</span>
      </button>
      <button @click="activeTab = 'vendors'" :class="activeTab === 'vendors' ? 'bg-yellow-500 text-black' : 'text-gray-500 hover:bg-gray-50'" class="px-4 sm:px-8 py-3 font-bold uppercase text-[11px] sm:text-xs tracking-widest whitespace-nowrap">Active Vendors</button>
      <button @click="activeTab = 'buyers'" :class="activeTab === 'buyers' ? 'bg-yellow-500 text-black' : 'text-gray-500 hover:bg-gray-50'" class="px-4 sm:px-8 py-3 font-bold uppercase text-[11px] sm:text-xs tracking-widest whitespace-nowrap">Students</button>
      <button @click="activeTab = 'announcements'" :class="activeTab === 'announcements' ? 'bg-yellow-500 text-black' : 'text-gray-500 hover:bg-gray-50'" class="px-4 sm:px-8 py-3 font-bold uppercase text-[11px] sm:text-xs tracking-widest whitespace-nowrap">Announcements</button>
    </div>

    <!-- Approvals -->
    <div v-if="activeTab === 'approvals'">
      <div v-if="pendingVendors.length === 0" class="text-center py-16 sm:py-20 border-2 border-dashed border-gray-300 bg-gray-50 rounded">
        <p class="text-gray-400 font-bold uppercase text-sm">No pending applications</p>
      </div>
      <div v-else class="grid gap-4">
        <div v-for="user in pendingVendors" :key="user.user_id" class="bg-white p-5 sm:p-6 border-l-4 border-yellow-500 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 rounded">
          <div class="flex-1 w-full">
            <h3 class="font-black text-lg sm:text-xl text-gray-900 uppercase">{{ user.shop_name }}</h3>
            <p class="text-[11px] sm:text-xs font-bold text-gray-500 uppercase mt-1">Applicant: {{ user.full_name }}</p>
          </div>
          <div class="flex gap-2 w-full md:w-auto">
            <button @click="triggerVerify(user.vendor_id, 'APPROVED')" class="flex-1 md:flex-none px-5 py-3 bg-green-600 text-white font-bold uppercase text-xs hover:bg-green-700 rounded">Approve</button>
            <button @click="triggerVerify(user.vendor_id, 'REJECTED')" class="flex-1 md:flex-none px-5 py-3 bg-red-600 text-white font-bold uppercase text-xs hover:bg-red-700 rounded">Reject</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Vendors -->
    <div v-if="activeTab === 'vendors'" class="space-y-3">
      <!-- Card view on mobile -->
      <div class="grid gap-3 sm:hidden">
        <div v-for="user in activeVendors" :key="user.user_id" class="bg-white p-4 border border-gray-200 rounded shadow-sm space-y-2">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-xs text-gray-500 uppercase font-bold">Shop</p>
              <p class="font-black text-gray-900">{{ user.shop_name }}</p>
            </div>
            <button @click="triggerDelete(user.user_id)" class="text-red-600 text-xs font-bold uppercase">Ban</button>
          </div>
          <p class="text-[11px] text-gray-500 uppercase font-bold">Owner: <span class="text-gray-900">{{ user.full_name }}</span></p>
          <p class="text-[11px] text-gray-500 uppercase font-bold">Email: <span class="text-gray-900">{{ user.student_number }}</span></p>
        </div>
      </div>
      <!-- Table on md+ -->
      <div class="hidden sm:block bg-white border border-gray-200 shadow-sm overflow-x-auto rounded">
        <table class="w-full text-left border-collapse min-w-[640px]">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200 text-[10px] font-black text-gray-500 uppercase tracking-widest">
              <th class="p-4">Shop</th>
              <th class="p-4">Owner</th>
              <th class="p-4">Email</th>
              <th class="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="text-sm font-bold text-gray-700">
            <tr v-for="user in activeVendors" :key="user.user_id" class="border-b border-gray-100 hover:bg-yellow-50/50">
              <td class="p-4 text-gray-900 uppercase">{{ user.shop_name }}</td>
              <td class="p-4">{{ user.full_name }}</td>
              <td class="p-4">{{ user.student_number }}</td>
              <td class="p-4 text-right">
                <button @click="triggerDelete(user.user_id)" class="text-red-600 hover:underline text-xs font-bold uppercase">Ban</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Buyers -->
    <div v-if="activeTab === 'buyers'" class="space-y-3">
      <div class="grid gap-3 sm:hidden">
        <div v-for="user in buyers" :key="user.user_id" class="bg-white p-4 border border-gray-200 rounded shadow-sm space-y-2">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-xs text-gray-500 uppercase font-bold">Name</p>
              <p class="font-black text-gray-900 uppercase">{{ user.full_name }}</p>
            </div>
            <button @click="triggerDelete(user.user_id)" class="text-red-600 text-xs font-bold uppercase">Remove</button>
          </div>
          <p class="text-[11px] text-gray-500 uppercase font-bold">Email: <span class="text-gray-900">{{ user.student_number }}</span></p>
          <button v-if="user.id_card_image" @click="openIdCard(user.id_card_image)" class="text-blue-600 text-xs font-bold uppercase underline">View ID</button>
        </div>
      </div>
      <div class="hidden sm:block bg-white border border-gray-200 shadow-sm overflow-x-auto rounded">
        <table class="w-full text-left border-collapse min-w-[640px]">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200 text-[10px] font-black text-gray-500 uppercase tracking-widest">
              <th class="p-4">Name</th>
              <th class="p-4">Email</th>
              <th class="p-4">Photo</th>
              <th class="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="text-sm font-bold text-gray-700">
            <tr v-for="user in buyers" :key="user.user_id" class="border-b border-gray-100 hover:bg-yellow-50/50">
              <td class="p-4 text-gray-900 uppercase">{{ user.full_name }}</td>
              <td class="p-4">{{ user.student_number }}</td>
              <td class="p-4">
                <button v-if="user.id_card_image" @click="openIdCard(user.id_card_image)" class="text-blue-600 hover:underline text-xs font-bold uppercase">View ID</button>
              </td>
              <td class="p-4 text-right">
                <button @click="triggerDelete(user.user_id)" class="text-red-600 hover:underline text-xs font-bold uppercase">Remove</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Announcements -->
    <div v-if="activeTab === 'announcements'" class="grid lg:grid-cols-3 gap-6 lg:gap-8">
      <div class="lg:col-span-1">
        <div class="bg-white p-5 sm:p-6 border border-gray-300 shadow-sm sticky top-4 rounded">
          <h3 class="font-bold text-lg text-gray-900 uppercase mb-4">Post Announcement</h3>
          <form @submit.prevent="postAnnouncement" class="space-y-4">
            <div>
              <label class="text-[11px] sm:text-xs font-bold text-gray-900 uppercase">Title</label>
              <input v-model="newAnnouncement.title" class="w-full p-3 border border-gray-300 focus:border-yellow-500 outline-none font-bold rounded" placeholder="e.g. System Maintenance" required />
            </div>
            <div>
              <label class="text-[11px] sm:text-xs font-bold text-gray-900 uppercase">Message</label>
              <textarea v-model="newAnnouncement.message" rows="4" class="w-full p-3 border border-gray-300 focus:border-yellow-500 outline-none rounded" placeholder="Details..." required></textarea>
            </div>
            <button type="submit" class="w-full bg-black text-yellow-500 py-3 font-bold uppercase hover:bg-gray-800 transition rounded">Broadcast</button>
          </form>
        </div>
      </div>

      <div class="lg:col-span-2 space-y-4">
        <div v-for="item in announcements" :key="item.id" class="bg-white p-5 sm:p-6 border-l-4 border-yellow-500 shadow-sm relative group rounded">
          <h4 class="font-black text-lg text-gray-900 uppercase">{{ item.title }}</h4>
          <p class="text-gray-600 mt-2 text-sm leading-relaxed">{{ item.message }}</p>
          <p class="text-[10px] text-gray-400 mt-4 uppercase font-bold">{{ new Date(item.created_at).toLocaleString() }}</p>
          <button @click="deleteAnnouncement(item.id)" class="absolute top-4 right-4 text-red-400 hover:text-red-600 font-bold text-xs uppercase opacity-0 group-hover:opacity-100 transition">Delete</button>
        </div>
        <div v-if="announcements.length === 0" class="text-center py-10 text-gray-400 bg-white border border-dashed border-gray-200 rounded">No announcements yet.</div>
      </div>
    </div>

    <div v-if="showConfirmModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/60" @click="showConfirmModal=false"></div>
      <div class="bg-white w-full max-w-md relative z-10 shadow-2xl p-8 border-t-8 rounded"
           :class="confirmConfig.title.includes('Reject') || confirmConfig.title.includes('Ban') ? 'border-red-600' : 'border-green-600'">
        <h3 class="text-xl sm:text-2xl font-black text-gray-900 uppercase mb-2">{{ confirmConfig.title }}</h3>
        <p class="text-gray-600 text-sm mb-8 font-medium">{{ confirmConfig.message }}</p>
        <div class="flex flex-col sm:flex-row gap-3">
          <button @click="showConfirmModal=false" class="flex-1 py-3 sm:py-4 bg-gray-100 text-gray-500 font-bold uppercase text-xs hover:bg-gray-200 rounded">Cancel</button>
          <button @click="handleConfirm" class="flex-1 py-3 sm:py-4 text-white font-bold uppercase text-xs shadow-lg rounded" :class="confirmConfig.confirmBtnColor">{{ confirmConfig.confirmBtnText }}</button>
        </div>
      </div>
    </div>
  </div>
</template>