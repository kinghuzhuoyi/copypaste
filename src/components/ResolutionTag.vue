<script setup>
defineProps({ cat: { type: String, required: true } })

const labels = {
  COPY: '复制',
  REUSE: '复用',
  RENAME: '重命名',
  TERMINATE: '冲突终止',
  DIRECT_REF: '直接调用',
}
const types = {
  COPY: 'primary',
  REUSE: 'info',
  RENAME: 'warning',
  TERMINATE: 'danger',
  DIRECT_REF: 'success',
}
</script>

<template>
  <el-tag :type="types[cat] || 'info'" size="small" effect="light">{{ labels[cat] || cat }}</el-tag>
</template>
