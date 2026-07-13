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
const entryType = ref('RULE')
const selected = ref([])
const folderMap = ref({})
const renameMap = ref({})
const abandonMap = ref({})
const temporaryFolders = ref([])
const target = ref(null)
const sourceMeta = reactive({ project: null, flow: null, version: null })
const plan = ref(null)
const task = ref({ status: 'PENDING', progress: 0, result: {} })
const conflictReviewRef = ref(null)

const canNext = computed(() => step.value === 0 ? selected.value.length > 0 && source.value.versionId : true)
const copyButtonText = computed(() => plan.value?.summary?.blockedRootCount ? '继续拷贝其余项' : '开始拷贝')
const entryConfig = computed(() => entryType.value === 'COMPONENT'
  ? {
      type: 'COMPONENT',
      title: '组件跨场景导入',
      button: '从组件列表导入',
      badge: '组件入口',
      noun: '组件',
      hint: '当前入口仅支持选择组件，依赖资源由后端校验后展示。',
    }
  : {
      type: 'RULE',
      title: '规则跨场景导入',
      button: '从规则列表导入',
      badge: '规则入口',
      noun: '规则',
      hint: '当前入口仅支持选择规则，拷贝前可为规则选择目标文件夹。',
    })

async function refreshSourceMeta() {
  const projects = await listProjects()
  sourceMeta.project = projects.items.find((item) => item.projectId === source.value.projectId)

  const flows = source.value.projectId ? await listDecisionFlows(source.value.projectId) : { items: [] }
  sourceMeta.flow = flows.items.find((item) => item.flowId === source.value.flowId)

  const versions = source.value.flowId ? await listFlowVersions(source.value.flowId) : { items: [] }
  sourceMeta.version = versions.items.find((item) => item.versionId === source.value.versionId)
}

async function openDialog(type = 'RULE') {
  entryType.value = type
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
  abandonMap.value = {}
  temporaryFolders.value = []
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
      entryType: entryType.value,
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
    abandonMap: abandonMap.value,
    temporaryFolders: temporaryFolders.value,
  }
}

async function finishCopy() {
  if (!plan.value) return
  if (!conflictReviewRef.value?.validateFoldersBeforeSubmit?.()) return
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
      <div class="launch-actions">
        <el-button type="primary" size="large" @click="openDialog('RULE')">从规则列表导入</el-button>
        <el-button size="large" @click="openDialog('COMPONENT')">从组件列表导入</el-button>
      </div>
    </section>

    <el-dialog v-model="visible" class="copy-dialog" width="1120px" :close-on-click-modal="false" @closed="resetDialog">
      <template #header>
        <div class="dialog-title">
          <div>
            <b>{{ entryConfig.title }}</b>
          </div>
          <el-tag size="small" effect="plain">{{ entryConfig.badge }}</el-tag>
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
              <span>拷贝目标</span>
              <b>{{ target.flowCode }} · {{ target.versionNo }}</b>
            </div>
            <el-tag type="success">{{ entryConfig.badge }}</el-tag>
            <em>冲突以目标版本已有资源为对比基准</em>
          </div>
          <SourceSelector v-model="source" />
          <ResourcePicker v-model="selected" :source="source" :entry-type="entryType" />
        </div>

        <div v-show="step === 1" class="step-pane scroll-pane">
          <div class="review-meta">
            <span>来源：{{ sourceMeta.project?.projectName }} / {{ sourceMeta.flow?.flowCode }} · {{ sourceMeta.flow?.flowName }} / {{ sourceMeta.version?.versionNo }}</span>
            <span>已选 {{ selected.length }} 个{{ entryConfig.noun }}</span>
          </div>
          <ConflictReview v-if="plan" ref="conflictReviewRef" v-model:folders="folderMap" v-model:renames="renameMap" v-model:abandons="abandonMap" v-model:temporary-folders="temporaryFolders" :plan="plan" :entry-type="entryType" />
        </div>

        <div v-show="step === 2" class="step-pane">
          <CompletionPanel v-if="target" :task="task" :scene="target" />
        </div>
      </div>

      <template #footer>
        <div class="wizard-footer">
          <span class="footer-hint">{{ step === 0 ? `请先选择来源版本和待拷贝${entryConfig.noun}` : step === 1 ? '确认重命名、放弃或规则文件夹后继续拷贝' : '本次拷贝流程已完成' }}</span>
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
