import { ref } from 'vue';
export interface User { id: string; name: string; role: 'ADMIN' | 'HR' | 'AUDITOR'; }
export const user = ref<User | null>(null);
export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, { credentials: 'include', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (response.status === 401 && !path.includes('login')) user.value = null;
    throw new Error(Array.isArray(error.message) ? error.message.join(', ') : error.message ?? 'Request failed. Please try again.');
  }
  return response.json();
}
export const send = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
export const canEdit = () => user.value?.role === 'ADMIN' || user.value?.role === 'HR';
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
export const time = (value: string | null) => value ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
export const fullDate = (value: string) => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(value));
export const labels: Record<string, string> = { AM_IN: 'Morning in', AM_OUT: 'Morning out', PM_IN: 'Afternoon in', PM_OUT: 'Afternoon out' };
export const minutes = (n: number) => `${Math.floor(n / 60)}h ${n % 60}m`;
export interface Shift { id: string; name: string; kind: string; startMinute: number; endMinute: number; breakMinutes: number; graceMinutes: number; flexMinutes: number; workDays: number[]; _count?: { employees: number }; }
export interface Employee { id: string; employeeNo: string; firstName: string; lastName: string; department: string; position: string; active: boolean; shiftId: string; shift: Shift; biometric: { id: string; createdAt: string } | null; }
