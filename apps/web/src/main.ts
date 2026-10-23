import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import App from './App.vue';
import { router } from './router';
import './style.css';
createApp(App).use(PrimeVue, { unstyled: true }).use(router).mount('#app');
if (import.meta.env.PROD && 'serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => {});
