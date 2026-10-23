import { createRouter, createWebHistory } from 'vue-router';
import Dashboard from './pages/Dashboard.vue';
import Employees from './pages/Employees.vue';
import Attendance from './pages/Attendance.vue';
import Shifts from './pages/Shifts.vue';
import Reports from './pages/Reports.vue';
import Audit from './pages/Audit.vue';
import Settings from './pages/Settings.vue';
import Kiosk from './pages/Kiosk.vue';
export const router = createRouter({ history: createWebHistory(), routes: [
  { path: '/', component: Dashboard, meta: { title: 'Attendance overview', eyebrow: 'Your municipality, at a glance' } },
  { path: '/employees', component: Employees, meta: { title: 'Employee directory', eyebrow: 'People & enrollment' } },
  { path: '/attendance', component: Attendance, meta: { title: 'Attendance records', eyebrow: 'Daily activity & corrections' } },
  { path: '/shifts', component: Shifts, meta: { title: 'Work schedules', eyebrow: 'Working hours, clearly defined' } },
  { path: '/reports', component: Reports, meta: { title: 'Daily time records', eyebrow: 'Reports & exports' } },
  { path: '/audit', component: Audit, meta: { title: 'Audit trail', eyebrow: 'Accountability in every action' } },
  { path: '/settings', component: Settings, meta: { title: 'Administration', eyebrow: 'Accounts & kiosk devices' } },
  { path: '/kiosk', component: Kiosk, meta: { title: 'Attendance kiosk' } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
] });
