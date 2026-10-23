<script setup lang="ts">
import Dialog from 'primevue/dialog';
defineProps<{ title: string; wide?: boolean }>();
const emit = defineEmits<{ close: [] }>();
</script>
<template><Dialog :visible="true" modal :header="title" :dismissable-mask="false" :block-scroll="true" :pt="{ mask: { class: 'modal-mask' }, root: { class: ['modal', wide ? 'modal-wide' : ''] }, header: { class: 'modal-header' }, title: { class: 'modal-title' }, headerActions: { class: 'modal-header-actions' }, pcCloseButton: { root: { class: 'icon-button', 'aria-label': 'Close dialog' } }, content: { class: 'modal-content' } }" @update:visible="emit('close')"><slot /></Dialog></template>
