<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import SourceSelector from './components/SourceSelector.vue'
import ResourcePicker from './components/ResourcePicker.vue'
import ConflictReview from './components/ConflictReview.vue'
import CompletionPanel from './components/CompletionPanel.vue'
import { createCopyPlan, getCopyContext, listDecisionFlows, listFlowVersions, listProjects, saveCopyResources } from './api/resourceCopyApi'

const visible = ref(false)
const step = ref(0)
const loading = ref(false)
const source = ref({ projectId: 'P1', flowId: 'F1', versionId: 'V1' })
const selected = ref([])
const folderMap = ref({})
const renameMap = ref({})
const target = ref(null)
const sourceMeta = reactive({ project: null, flow: null, version: null })
const plan = ref(null)
const task = ref({ status: 'PENDING', progress: 0, result: {} })

const canNext = computed(() => step.value === 0 ? selected.value.length > 0 && source.value.versionId : true)
const copyButtonText = computed(() => plan.value?.summary?.blockedRootCount ? '继续拷贝其余项' : '开始拷贝')

async function refreshSourceMeta() {
  const [projects, flows, versions] = await Promise.all([
    listProjects(),
    source.value.projectId ? listDecisionFlows(source.value.projectId) : Promise.resolve({ items: [] }),
    source.value.flowId ? listFlowVersions(source.value.flowId) : Promise.resolve({ items: [] }),
  ])
  sourceMeta.project = projects.items.find((item) => item.projectId === source.value.projectId)
  sourceMeta.flow = flows.items.find((item) => item.flowId === source.value.flowId)
  sourceMeta.version = versions.items.find((item) => item.versionId === source.value.versionId)
}

async function openDialog() {
  visible.value = true
  if (!target.value) {
    const context = await getCopyContext()
    target.value = context.target
  }
}

function resetDialog() {
  step.value = 0
  selected.value = []
  folderMap.value = {}
  renameMap.value = {}
  plan.value = null
  task.value = { status: 'PENDING', progress: 0, result: {} }
}

function prev() {
  if (step.value > 0) step.value -= 1
}

async function next() {
  if (step.value !== 0) return
  loading.value = true
  try {
    await refreshSourceMeta()
    plan.value = await createCopyPlan({
      sourceProcessKey: sourceMeta.flow?.flowCode || source.value.flowId,
      sourceProcessVersion: sourceMeta.version?.versionNo || source.value.versionId,
      targetProcessKey: target.value.flowCode,
      targetProcessVersion: target.value.versionNo,
      selectedResources: selected.value.map((resourceId) => ({ resourceId })),
    })
    step.value = 1
  } finally {
    loading.value = false
  }
}

function collectUserResolution() {
  return {
    renameMap: renameMap.value,
    folderMap: folderMap.value,
  }
}

async function finishCopy() {
  if (!plan.value) return
  loading.value = true
  try {
    const resolution = collectUserResolution()
    task.value = { status: 'RUNNING', progress: 35, result: {}, message: '正在提交拷贝' }
    step.value = 2
    task.value = await saveCopyResources(plan.value, resolution)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  const context = await getCopyContext()
  target.value = context.target
  await refreshSourceMeta()
})
</script>

<template>
  <main class="shell">
    <section class="launch-card">
      <div>
        <p class="eyebrow">Decision Engine</p>
        <h1>跨场景资源拷贝</h1>
        <p>前端仅负责选择、展示和提交用户决策；资源依赖、冲突校验、血缘树和拷贝结果均由后端接口返回。</p>
      </div>
      <el-button type="primary" size="large" @click="openDialog">打开拷贝弹窗</el-button>
    </section>

    <el-dialog v-model="visible" class="copy-dialog" width="1120px" :close-on-click-modal="false" @closed="resetDialog">
      <template #header>
        <div class="dialog-title">
          <div>
            <b>跨场景资源拷贝</b>
            <span>从来源版本选择规则/组件，导入当前场景</span>
          </div>
        </div>
      </template>

      <div class="wizard-steps">
        <el-steps :active="step" finish-status="success" simple>
          <el-step title="选择来源与资源" />
          <el-step title="冲突校验与解决" />
          <el-step title="完成拷贝" />
        </el-steps>
      </div>

      <div class="wizard-body" v-loading="loading">
        <div v-show="step === 0" class="step-pane">
          <div v-if="target" class="context-banner">
            <div>
              <span>拷贝目标 · 当前场景</span>
              <b>{{ target.sceneName }} / {{ target.flowName }} · {{ target.versionNo }}</b>
            </div>
            <el-tag type="success">{{ target.versionStatusName }}</el-tag>
            <em>冲突以当前场景已有资源为对比基准</em>
          </div>
          <SourceSelector v-model="source" />
          <ResourcePicker v-model="selected" :source="source" />
        </div>

        <div v-show="step === 1" class="step-pane scroll-pane">
          <div class="review-meta">
            <span>来源：{{ sourceMeta.project?.projectName }} / {{ sourceMeta.flow?.flowCode }} · {{ sourceMeta.flow?.flowName }} / {{ sourceMeta.version?.versionNo }}</span>
            <span>已选 {{ selected.length }} 项</span>
          </div>
          <ConflictReview v-if="plan" v-model:folders="folderMap" v-model:renames="renameMap" :plan="plan" />
        </div>

        <div v-show="step === 2" class="step-pane">
          <CompletionPanel v-if="target" :task="task" :scene="target" />
        </div>
      </div>

      <template #footer>
        <div class="wizard-footer">
          <span class="footer-hint">{{ step === 0 ? '请先选择来源版本和待拷贝资源' : step === 1 ? '无法解决的冲突将自动跳过，继续拷贝其余可执行项' : '本次拷贝流程已完成' }}</span>
          <div>
            <el-button v-if="step > 0 && step < 2" @click="prev">上一步</el-button>
            <el-button v-if="step === 0" type="primary" :disabled="!canNext" @click="next">下一步</el-button>
            <el-button v-if="step === 1" type="primary" @click="finishCopy">{{ copyButtonText }}</el-button>
            <el-button v-if="step === 2" type="primary" @click="visible = false">完成</el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </main>
</template>
