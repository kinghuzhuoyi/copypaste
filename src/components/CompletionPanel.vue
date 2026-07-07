<script setup>
defineProps({ task: { type: Object, required: true }, scene: { type: Object, required: true } })
</script>

<template>
  <section class="done-panel">
    <div class="done-icon"><el-icon><CircleCheckFilled /></el-icon></div>
    <h2>{{ task.status === 'SUCCESS' ? '拷贝完成' : '正在拷贝' }}</h2>
    <p>{{ task.status === 'SUCCESS' ? `已完成资源拷贝，目标版本：${scene.flowCode || scene.flowName} · ${scene.versionNo}` : (task.message || '正在提交拷贝任务') }}</p>
    <el-progress v-if="task.status !== 'SUCCESS'" :percentage="task.progress || 0" :stroke-width="12" />
    <div class="done-stats">
      <div><b>{{ task.result?.copyCount || 0 }}</b><span>复制资源</span></div>
      <div><b>{{ task.result?.reuseCount || 0 }}</b><span>复用资源</span></div>
      <div><b>{{ task.result?.directCount || 0 }}</b><span>直接调用</span></div>
      <div><b>{{ task.result?.conflictCount || 0 }}</b><span>冲突未复制</span></div>
      <div><b>{{ task.result?.skipTotal || 0 }}</b><span>跳过数量</span></div>
    </div>
  </section>
</template>