<script setup>
import { computed, ref, watch } from 'vue'
import ResolutionTag from './ResolutionTag.vue'

const props = defineProps({ plan: { type: Object, required: true } })
const folderMap = defineModel('folders', { type: Object, required: true })
const renameMap = defineModel('renames', { type: Object, required: true })

const activeSections = ref(['lineage'])
const lineageKeyword = ref('')
const lineageAction = ref('')

const actionCounts = computed(() => props.plan.summary?.dependencyActionCounts || {})
const rootResults = computed(() => props.plan.rootResults || [])
const copyableRoots = computed(() => rootResults.value.filter((item) => item.copyable))
const terminateConflicts = computed(() => (props.plan.conflicts || []).filter((item) => item.action === 'TERMINATE'))
const renameConflicts = computed(() => (props.plan.conflicts || []).filter((item) => item.action === 'RENAME'))
const conflictCount = computed(() => terminateConflicts.value.length + renameConflicts.value.length)
const totalLineageNodeCount = computed(() => countNodes(props.plan.lineageTrees || []))
const filteredLineageTrees = computed(() => {
  const keyword = lineageKeyword.value.trim().toLowerCase()
  const action = lineageAction.value
  if (!keyword && !action) return props.plan.lineageTrees || []
  return filterNodes(props.plan.lineageTrees || [], keyword, action)
})
const filteredLineageNodeCount = computed(() => countNodes(filteredLineageTrees.value))
const lineageTreeRenderKey = computed(() => `${lineageKeyword.value.trim()}|${lineageAction.value}`)
const lineageVisibleText = computed(() => {
  const total = totalLineageNodeCount.value
  const current = filteredLineageNodeCount.value
  return current === total ? `共 ${total} 个节点` : `已筛选 ${current} / ${total} 个节点`
})
const lineageStats = computed(() => [
  { label: '复制', value: actionCounts.value.COPY || 0, tone: 'copy' },
  { label: '复用', value: actionCounts.value.REUSE || 0, tone: 'reuse' },
  { label: '重命名', value: actionCounts.value.RENAME || 0, tone: 'rename' },
  { label: '直接调用', value: actionCounts.value.DIRECT_REF || 0, tone: 'direct' },
  { label: '冲突终止', value: actionCounts.value.TERMINATE || 0, tone: 'terminate' },
])

const typeNames = {
  RULE: '规则',
  COMPONENT: '组件',
  INPUT_PARAM: '输入参数',
  RULE_TAG: '规则标签',
  FLOW_CACHE: '流程缓存',
  VARIABLE: '变量',
  MODEL: '模型',
  CYCLE: '循环引用',
}

watch(copyableRoots, (roots) => {
  roots.forEach((root) => {
    if (!folderMap.value[root.resourceId]) folderMap.value[root.resourceId] = props.plan.targetFolders?.[0]?.folderId || ''
  })
}, { immediate: true })

watch(renameConflicts, (items) => {
  items.forEach((item) => {
    if (!renameMap.value[item.resourceId]) renameMap.value[item.resourceId] = item.suggestedCode || `${item.resourceCode}_COPY`
  })
}, { immediate: true })

function countNodes(nodes = []) {
  return nodes.reduce((sum, node) => sum + 1 + countNodes(node.children || []), 0)
}

function matchNode(node, keyword, action) {
  const actionOk = !action || node.action === action
  const keywordOk = !keyword || [node.resourceCode, node.resourceName, node.reason, node.resourceType]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(keyword))
  return actionOk && keywordOk
}

function filterNodes(nodes, keyword, action) {
  return nodes.map((node) => {
    const children = filterNodes(node.children || [], keyword, action)
    if (matchNode(node, keyword, action) || children.length) return { ...node, children }
    return null
  }).filter(Boolean)
}

function typeLabel(type) {
  return typeNames[type] || type
}

function nodeClass(data) {
  const actionClass = {
    COPY: 'is-copy',
    REUSE: 'is-reuse',
    RENAME: 'is-rename',
    TERMINATE: 'is-terminate',
    DIRECT_REF: 'is-direct',
  }[data.action || 'COPY']
  return ['lineage-node', actionClass, data.children?.length ? 'has-children' : ''].filter(Boolean).join(' ')
}
</script>

<template>
  <section class="review">
    <div class="rate-card">
      <el-progress type="dashboard" :percentage="plan.summary.achievementRate" :stroke-width="10" />
      <div class="rate-detail">
        <div class="rate-title">计划拷贝目标达成率</div>
        <div class="rate-line"><b>{{ plan.summary.copyableRootCount }}/{{ plan.summary.selectedRootCount }}</b> 个第一步选择资源可继续拷贝</div>
        <div class="top-list">
          <span v-for="root in rootResults" :key="root.resourceId" class="top-chip" :class="root.copyable ? 'ok' : 'bad'">
            {{ root.resourceName }} · {{ root.copyable ? '可拷贝' : '无法拷贝' }}
          </span>
        </div>
      </div>
    </div>

    <div class="distribution"><b>依赖资源判定分布（含不可执行分支）</b>
      <span><i class="copy"></i>复制 {{ actionCounts.COPY || 0 }}</span>
      <span><i class="rename"></i>重命名 {{ actionCounts.RENAME || 0 }}</span>
      <span><i class="skip"></i>复用 {{ actionCounts.REUSE || 0 }}</span>
      <span><i class="direct"></i>直接调用 {{ actionCounts.DIRECT_REF || 0 }}</span>
      <span><i class="terminate"></i>冲突终止 {{ actionCounts.TERMINATE || 0 }}</span>
    </div>

    <div class="section-title">冲突信息 <span>{{ conflictCount }} 项</span></div>
    <el-empty v-if="!conflictCount" description="未发现冲突，所有资源均可按计划处理" :image-size="70" />

    <article v-for="item in terminateConflicts" :key="item.conflictId" class="conflict-card danger">
      <div class="conflict-head">
        <ResolutionTag cat="TERMINATE" />
        <b>{{ item.resourceName }}</b>
        <code>{{ item.resourceCode }}</code>
      </div>
      <p>{{ item.reason }}</p>
      <div v-if="item.diffs?.length" class="diff-list">
        <div class="diff-head"><span>字段</span><em>本次拷贝</em><strong>目标已存在</strong></div>
        <div v-for="diff in item.diffs" :key="diff.field" class="diff-row">
          <span>{{ diff.fieldName }}</span><em>{{ diff.sourceValue }}</em><strong>{{ diff.targetValue }}</strong>
        </div>
      </div>
      <div class="impact">影响拷贝目标：{{ item.affectedRootNames?.join('、') || '无' }}</div>
    </article>

    <article v-for="item in renameConflicts" :key="item.conflictId" class="conflict-card warning">
      <div class="conflict-head">
        <ResolutionTag cat="RENAME" />
        <b>{{ item.resourceName }}</b>
        <code>{{ item.resourceCode }}</code>
      </div>
      <p>{{ item.reason }}</p>
      <div v-if="item.diffs?.length" class="diff-list">
        <div class="diff-head"><span>字段</span><em>本次拷贝</em><strong>目标已存在</strong></div>
        <div v-for="diff in item.diffs" :key="diff.field" class="diff-row">
          <span>{{ diff.fieldName }}</span><em>{{ diff.sourceValue }}</em><strong>{{ diff.targetValue }}</strong>
        </div>
      </div>
      <div class="rename-line">
        <span>新规则编码</span>
        <el-input v-model="renameMap[item.resourceId]" class="rename-input" />
      </div>
    </article>

    <el-collapse v-model="activeSections" class="lineage-collapse lineage-panel">
      <el-collapse-item name="lineage">
        <template #title>
          <div class="lineage-title">
            <div>
              <b>拷贝血缘完整展示</b>
              <span>后端预检返回的完整依赖树和处理方式</span>
            </div>
            <em>{{ plan.lineageTrees?.length || 0 }} 个根节点 · {{ totalLineageNodeCount }} 个依赖节点</em>
          </div>
        </template>
        <div class="lineage-insight">
          <div class="lineage-metric">
            <span>根资源</span>
            <b>{{ plan.lineageTrees?.length || 0 }}</b>
          </div>
          <div class="lineage-metric">
            <span>依赖节点</span>
            <b>{{ totalLineageNodeCount }}</b>
          </div>
          <div v-for="item in lineageStats" :key="item.label" class="lineage-action-metric" :class="`is-${item.tone}`">
            <i></i>
            <span>{{ item.label }}</span>
            <b>{{ item.value }}</b>
          </div>
        </div>
        <div class="lineage-tools">
          <el-input v-model="lineageKeyword" clearable placeholder="按编码、名称或说明筛选血缘" />
          <el-select v-model="lineageAction" clearable placeholder="处理方式" style="width: 150px">
            <el-option label="复制" value="COPY" />
            <el-option label="复用" value="REUSE" />
            <el-option label="重命名" value="RENAME" />
            <el-option label="冲突终止" value="TERMINATE" />
            <el-option label="直接调用" value="DIRECT_REF" />
          </el-select>
          <span class="lineage-count">{{ lineageVisibleText }}</span>
        </div>
        <div class="lineage-body">
          <div class="lineage-table-head">
            <span>处理方式</span>
            <span>资源类型</span>
            <span>编码</span>
            <span>名称</span>
            <span>处理说明</span>
          </div>
          <el-tree class="lineage-tree" :key="lineageTreeRenderKey" :data="filteredLineageTrees" node-key="nodeId" :default-expand-all="!!lineageKeyword || !!lineageAction" :indent="24" :props="{ children: 'children', label: 'resourceName' }">
            <template #default="{ data }">
              <div :class="nodeClass(data)">
                <ResolutionTag :cat="data.action || 'COPY'" />
                <span class="lineage-type">{{ typeLabel(data.resourceType) }}</span>
                <code class="lineage-code" :title="data.resourceCode">{{ data.resourceCode }}</code>
                <b class="lineage-name" :title="data.resourceName">{{ data.resourceName }}</b>
                <em class="lineage-reason" :title="data.reason">{{ data.reason }}</em>
              </div>
            </template>
          </el-tree>
        </div>
      </el-collapse-item>
    </el-collapse>

    <div class="section-title">可拷贝规则归类</div>
    <div class="folder-box">
      <div v-for="root in copyableRoots" :key="root.resourceId" class="folder-row">
        <span>{{ root.resourceName }}</span>
        <code>{{ renameMap[root.resourceId] || root.resourceCode }}</code>
        <el-select v-model="folderMap[root.resourceId]" filterable allow-create default-first-option placeholder="目标规则包文件夹">
          <el-option v-for="folder in plan.targetFolders" :key="folder.folderId" :label="folder.folderName" :value="folder.folderId" />
        </el-select>
      </div>
    </div>
  </section>
</template>
