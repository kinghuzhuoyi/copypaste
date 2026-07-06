<script setup>
import { onMounted, ref, watch } from 'vue'
import { listDecisionFlows, listFlowVersions, listProjects } from '../api/resourceCopyApi'

const model = defineModel({ type: Object, required: true })

const projects = ref([])
const flows = ref([])
const versions = ref([])
const loading = ref(false)

const statusType = {
  EFFECTIVE: 'success',
  GRAY: 'warning',
  DRAFT: 'info',
  OFFLINE: 'danger',
}

async function loadProjects() {
  loading.value = true
  try {
    const res = await listProjects()
    projects.value = res.items
    if (!model.value.projectId && projects.value[0]) {
      model.value = { ...model.value, projectId: projects.value[0].projectId }
    }
  } finally {
    loading.value = false
  }
}

async function loadFlows(projectId) {
  if (!projectId) return
  const res = await listDecisionFlows(projectId)
  flows.value = res.items
  if (!flows.value.some((item) => item.flowId === model.value.flowId)) {
    model.value = { ...model.value, flowId: flows.value[0]?.flowId || '', versionId: '' }
  }
}

async function loadVersions(flowId) {
  if (!flowId) return
  const res = await listFlowVersions(flowId)
  versions.value = res.items
  if (!versions.value.some((item) => item.versionId === model.value.versionId)) {
    model.value = { ...model.value, versionId: versions.value[0]?.versionId || '' }
  }
}

watch(() => model.value.projectId, loadFlows, { immediate: true })
watch(() => model.value.flowId, loadVersions, { immediate: true })

onMounted(loadProjects)
</script>

<template>
  <section class="source-panel" v-loading="loading">
    <div class="panel-title">来源决策流</div>
    <div class="source-grid">
      <el-select v-model="model.projectId" filterable placeholder="项目名称">
        <el-option v-for="project in projects" :key="project.projectId" :label="project.projectName" :value="project.projectId" />
      </el-select>
      <el-select v-model="model.flowId" filterable placeholder="决策流编码 / 名称">
        <el-option v-for="flow in flows" :key="flow.flowId" :label="`${flow.flowCode} · ${flow.flowName}`" :value="flow.flowId" />
      </el-select>
      <el-select v-model="model.versionId" filterable placeholder="版本号">
        <el-option v-for="version in versions" :key="version.versionId" :label="`${version.versionNo} · ${version.versionStatusName}`" :value="version.versionId">
          <span>{{ version.versionNo }}</span>
          <el-tag class="version-tag" size="small" :type="statusType[version.versionStatus] || 'info'">
            {{ version.versionStatusName }}
          </el-tag>
        </el-option>
      </el-select>
    </div>
  </section>
</template>
