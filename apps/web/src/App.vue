<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { LayoutDashboard, UsersRound, Clock3, CalendarDays, FileText, ShieldCheck, Settings2, ScanFace, LogOut, Menu, X, ArrowUpRight, LoaderCircle } from 'lucide-vue-next';
import { api, send, user } from './api';
const route = useRoute(), router = useRouter();
const ready = ref(false), busy = ref(false), error = ref(''), email = ref(''), password = ref(''), navOpen = ref(false);
const links = [ { path: '/', name: 'Overview', icon: LayoutDashboard }, { path: '/employees', name: 'Employees', icon: UsersRound }, { path: '/attendance', name: 'Attendance', icon: Clock3 }, { path: '/shifts', name: 'Schedules', icon: CalendarDays }, { path: '/reports', name: 'Time records', icon: FileText }, { path: '/audit', name: 'Audit trail', icon: ShieldCheck } ];
const dateLabel = computed(() => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date()));
onMounted(async () => { try { user.value = await api('/auth/me'); } catch {} finally { ready.value = true; } });
async function login() { busy.value = true; error.value = ''; try { user.value = await api('/auth/login', send('POST', { email: email.value, password: password.value })); password.value = ''; } catch (e) { error.value = (e as Error).message; } finally { busy.value = false; } }
async function logout() { try { await api('/auth/logout', send('POST')); user.value = null; await router.push('/'); } catch (e) { error.value = (e as Error).message; } }
</script>
<template>
  <div v-if="!ready" class="loading-screen"><LoaderCircle class="spin" /> Loading e-RAMS…</div>
  <RouterView v-else-if="route.path === '/kiosk'" />
  <main v-else-if="!user" class="login-layout">
    <section class="login-story"><div class="brand light"><div class="brand-mark"><ScanFace :size="28" /></div><div><strong>e-RAMS<span>2.0</span></strong><small>LGU SAN JUAN</small></div></div><div><span class="eyebrow">SAN JUAN, SOUTHERN LEYTE</span><h1>A better start<br>to every workday.</h1><p>One place for your people, their attendance,<br>and the records that keep work moving.</p></div><div class="login-foot"><ShieldCheck :size="18" /> Municipal attendance management</div></section>
    <section class="login-form-wrap"><form class="login-form" @submit.prevent="login"><span class="eyebrow">WELCOME TO e-RAMS</span><h2>Sign in to your workspace</h2><p class="muted">Use the account provided by your administrator.</p><p v-if="error" class="alert error" role="alert">{{ error }}</p><label>Email address<input v-model="email" type="email" autocomplete="username" required placeholder="you@sanjuan.gov.ph" /></label><label>Password<input v-model="password" type="password" autocomplete="current-password" required /></label><button class="button primary full" :disabled="busy"><LoaderCircle v-if="busy" class="spin" :size="17" />{{ busy ? 'Signing in…' : 'Sign in' }}</button><RouterLink class="kiosk-link" to="/kiosk">Open attendance kiosk <ArrowUpRight :size="16" /></RouterLink><p class="login-note">Employee attendance is recorded at an authorized kiosk. Contact HR if you need help accessing your records.</p></form></section>
  </main>
  <div v-else class="app-shell">
    <a class="skip-link" href="#main-content">Skip to content</a>
    <button v-if="navOpen" class="nav-backdrop" aria-label="Close navigation" @click="navOpen = false" />
    <aside :class="['sidebar', { 'is-open': navOpen }]">
      <RouterLink class="brand" to="/"><div class="brand-mark"><ScanFace :size="27" /></div><div><strong>e-RAMS<span>2.0</span></strong><small>ATTENDANCE MANAGEMENT</small></div></RouterLink>
      <div class="municipality"><div class="municipality-seal">SJ</div><div><strong>Municipality of San Juan</strong><small>Southern Leyte, Philippines</small></div></div>
      <div class="nav-label">WORKSPACE</div>
      <nav aria-label="Main navigation"><RouterLink v-for="link in links" :key="link.path" :to="link.path" :class="['nav-link', { active: route.path === link.path }]" @click="navOpen = false"><component :is="link.icon" :size="19" /><span>{{ link.name }}</span><span v-if="route.path === link.path" class="active-dot" /></RouterLink></nav>
      <div class="sidebar-bottom"><RouterLink v-if="user.role === 'ADMIN'" class="nav-link" to="/settings" @click="navOpen = false"><Settings2 :size="19" /> Administration</RouterLink><RouterLink class="kiosk-card" to="/kiosk"><ScanFace :size="23" /><div><strong>Attendance kiosk</strong><small>Open face capture</small></div><ArrowUpRight :size="17" /></RouterLink><div class="profile"><div class="avatar">{{ user.name.split(' ').map(n => n[0]).slice(0, 2).join('') }}</div><div><strong>{{ user.name }}</strong><small>{{ user.role === 'ADMIN' ? 'Administrator' : user.role === 'HR' ? 'HR officer' : 'Auditor' }}</small></div><button class="icon-button" aria-label="Sign out" @click="logout"><LogOut :size="17" /></button></div></div>
    </aside>
    <div class="main-shell"><header class="topbar"><div class="topbar-context"><button class="icon-button mobile-menu" aria-label="Open navigation" @click="navOpen = true"><Menu :size="22" /></button><span>Municipal workspace</span><span class="topbar-divider">/</span><strong>{{ route.meta.title }}</strong></div><div class="topbar-date"><CalendarDays :size="16" />{{ dateLabel }} <span class="timezone">PHT</span></div></header><main id="main-content" class="main-content"><div class="page-heading"><div><p class="eyebrow">{{ route.meta.eyebrow }}</p><h1>{{ route.meta.title }}</h1></div><span class="workspace-tag"><span /> SAN JUAN LGU</span></div><p v-if="error" class="alert error" role="alert">{{ error }} <button class="text-button" @click="error = ''">Dismiss</button></p><RouterView /></main><footer class="app-footer"><span>e-RAMS · Local Government Unit of San Juan</span><span>All times in Philippine Standard Time (UTC+8)</span></footer></div>
  </div>
</template>
