<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue';
import { Camera, VideoOff } from 'lucide-vue-next';
const video = ref<HTMLVideoElement>();
const active = ref(false);
const error = ref('');
let stream: MediaStream | undefined;
async function start() {
  error.value = '';
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access needs HTTPS or localhost.');
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    if (video.value) { video.value.srcObject = stream; await video.value.play(); }
    active.value = true;
  } catch (e) { error.value = e instanceof Error ? e.message : 'Camera access was denied.'; stop(); }
}
function stop() { stream?.getTracks().forEach(t => t.stop()); stream = undefined; active.value = false; }
function capture() {
  if (!video.value || !active.value || !video.value.videoWidth) throw new Error('Enable the camera before capturing.');
  const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = Math.round(640 * video.value.videoHeight / video.value.videoWidth);
  canvas.getContext('2d')!.drawImage(video.value, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}
onBeforeUnmount(stop);
defineExpose({ capture, stop, active });
</script>
<template><div class="camera"><video ref="video" autoplay muted playsinline aria-label="Live camera preview" /><div v-if="!active" class="camera-placeholder"><VideoOff :size="32" /><p>Your camera is off</p><button type="button" class="button primary" @click="start"><Camera :size="17" /> Enable camera</button></div><div v-if="active" class="camera-guide" aria-hidden="true" /><span v-if="active" class="camera-indicator">Camera active</span></div><p v-if="error" class="alert error" role="alert">{{ error }}</p></template>
