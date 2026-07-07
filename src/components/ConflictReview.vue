<script setup>
import { computed, ref, watch } from 'vue'
import ResolutionTag from './ResolutionTag.vue'

const props = defineProps({
  plan: { type: Object, required: true },
  entryType: { type: String, default: 'RULE' },
})
const folderMap = defineModel('folders', { type: Object, required: true })
const renameMap = defineModel('renames', { type: Object, required: true })
const abandonMap = defineModel('abandons', { type: Object, required: true })

const activeSections = ref(['lineage'])
const activeSummaryTab = ref('TERMINATE')
const lineageKeyword = ref('')
const lineageAction = ref('')
const confirmChoice = ref({})

const showRuleFolders = computed(() => props.entryType === 'RULE')
const conflictsByCode = computed(() => new Map((props.plan.conflicts || []).map((item) => [item.resourceCode, item])))
const summaryRows = computed(() => (props.plan.lineageTrees || []).map((root) => {
  const directConflict = conflictsByCode.value.get(root.resourceCode)
  const dependencyConflicts = collectDependencyConflicts(root)
  const status = root.action === 'TERMINATE' ? 'TERMINATE' : root.action === 'RENAME' ? 'CONFIRM' : 'SUCCESS'
  const conflictMessages = []

  if (directConflict) conflictMessages.push(formatConflict(directConflict))
  dependencyConflicts.forEach((item) => conflictMessages.push(formatConflict(item)))
  if (!conflictMessages.length && root.action === 'TERMINATE') conflictMessages.push(root.reason || '后端判定该目标无法继续拷贝')
  if (!conflictMessages.length && root.action === 'RENAME') conflictMessages.push(directConflict?.reason || '目标侧存在同编码资源，需要确认重命名或放弃拷贝')

  return {
    resourceId: root.resourceId,
    resourceCode: root.resourceCode,
    resourceName: root.resourceName,
    resourceType: root.resourceType,
    action: root.action || 'COPY',
    status,
    reason: root.reason,
    suggestedCode: directConflict?.suggestedCode || `${root.resourceCode}_COPY`,
    conflictMessages,
  }
}))
const terminateRows = computed(() => summaryRows.value.filter((row) => row.status === 'TERMINATE'))
const confirmRows = computed(() => summaryRows.value.filter((row) => row.status === 'CONFIRM'))
const successRows = computed(() => summaryRows.value.filter((row) => row.status === 'SUCCESS'))
const summaryGroups = computed(() => [
  { name: 'TERMINATE', label: '冲突', count: terminateRows.value.length, rows: terminateRows.value, empty: '暂无冲突资源' },
  { name: 'CONFIRM', label: '待确认', count: confirmRows.value.length, rows: confirmRows.value, empty: '暂无待确认资源' },
  { name: 'SUCCESS', label: '顺利', count: successRows.value.length, rows: successRows.value, empty: '暂无顺利拷贝资源' },
])
const folderRows = computed(() => summaryRows.value.filter((row) => showRuleFolders.value && row.resourceType === 'RULE' && row.status !== 'TERMINATE' && confirmChoice.value[row.resourceId] !== 'ABANDON'))
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

watch(confirmRows, (rows) => {
  rows.forEach((row) => {
    if (!confirmChoice.value[row.resourceId]) confirmChoice.value[row.resourceId] = 'RENAME'
    if (!renameMap.value[row.resourceId]) renameMap.value[row.resourceId] = row.suggestedCode
  })
}, { immediate: true })

watch(folderRows, (rows) => {
  rows.forEach((row) => {
    if (!folderMap.value[row.resourceId]) folderMap.value[row.resourceId] = props.plan.targetFolders?.[0]?.folderId || ''
  })
}, { immediate: true })

function collectDependencyConflicts(root) {
  const result = []
  const visit = (nodes = []) => {
    nodes.forEach((node) => {
      const conflict = conflictsByCode.value.get(node.resourceCode)
      if (conflict && node.resourceCode !== root.resourceCode) result.push(conflict)
      visit(node.children || [])
    })
  }
  visit(root.children || [])
  return Array.from(new Map(result.map((item) => [item.resourceCode, item])).values())
}

function formatConflict(item) {
  const type = item.resourceTypeDesc || typeLabel(item.resourceType)
  return `${type} ${item.resourceName}（${item.resourceCode}）：${item.reason}`
}

function rowConflictText(row) {
  return row.conflictMessages.length ? row.conflictMessages.join('；') : '无冲突'
}

function onChoiceChange(row) {
  if (confirmChoice.value[row.resourceId] === 'ABANDON') {
    abandonMap.value[row.resourceId] = true
    renameMap.value[row.resourceId] = ''
    return
  }
  delete abandonMap.value[row.resourceId]
  if (!renameMap.value[row.resourceId]) renameMap.value[row.resourceId] = row.suggestedCode
}

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
    <section class="copy-summary">
      <div class="summary-head">
        <div>
          <b>拷贝摘要</b>
        </div>
        <div class="summary-counts">
          <span>冲突 {{ terminateRows.length }}</span>
          <span>待确认 {{ confirmRows.length }}</span>
          <span>顺利 {{ successRows.length }}</span>
        </div>
      </div>

      <el-tabs v-model="activeSummaryTab" class="summary-tabs">
        <el-tab-pane v-for="group in summaryGroups" :key="group.name" :name="group.name">
          <template #label>
            <span class="summary-tab-label">{{ group.label }}<b>{{ group.count }}</b></span>
          </template>

          <div class="summary-table">
            <div class="summary-table-head" :class="`is-${group.name.toLowerCase()}`">
              <span>拷贝目标</span>
              <span>编码</span>
              <span v-if="group.name !== 'SUCCESS'">冲突信息</span>
              <span v-if="group.name !== 'TERMINATE'">操作 / 目标文件夹</span>
            </div>

            <el-empty v-if="!group.rows.length" :description="group.empty" :image-size="60" />
            <div v-for="row in group.rows" :key="row.resourceId" class="summary-row" :class="`is-${row.status.toLowerCase()}`">
              <div class="summary-target" :title="`${row.resourceName} / ${row.resourceTypeDesc || typeLabel(row.resourceType)}`">
                <b>{{ row.resourceName }}</b>
                <span>{{ row.resourceTypeDesc || typeLabel(row.resourceType) }}</span>
              </div>
              <code :title="row.resourceCode">{{ row.resourceCode }}</code>
              <div v-if="row.status !== 'SUCCESS'" class="summary-conflict" :title="rowConflictText(row)">
                {{ rowConflictText(row) }}
              </div>
              <div v-if="row.status !== 'TERMINATE'" class="summary-action">
                <template v-if="row.status === 'CONFIRM'">
                  <el-select v-model="confirmChoice[row.resourceId]" class="choice-select" placeholder="处理方式" @change="onChoiceChange(row)">
                    <el-option label="重命名" value="RENAME" />
                    <el-option label="放弃拷贝" value="ABANDON" />
                  </el-select>
                  <div v-if="confirmChoice[row.resourceId] === 'RENAME'" class="action-fields">
                    <el-input v-model="renameMap[row.resourceId]" placeholder="新编码" />
                    <el-select
                      v-if="showRuleFolders && row.resourceType === 'RULE'"
                      v-model="folderMap[row.resourceId]"
                      filterable
                      allow-create
                      default-first-option
                      placeholder="目标文件夹"
                    >
                      <el-option v-for="folder in plan.targetFolders" :key="folder.folderId" :label="folder.folderName" :value="folder.folderId" />
                    </el-select>
                  </div>
                </template>
                <template v-else>
                  <el-select
                    v-if="showRuleFolders && row.resourceType === 'RULE'"
                    v-model="folderMap[row.resourceId]"
                    filterable
                    allow-create
                    default-first-option
                    placeholder="目标文件夹"
                  >
                    <el-option v-for="folder in plan.targetFolders" :key="folder.folderId" :label="folder.folderName" :value="folder.folderId" />
                  </el-select>
                  <span v-else class="action-muted">无需用户处理</span>
                </template>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-collapse v-model="activeSections" class="lineage-collapse lineage-panel">
      <el-collapse-item name="lineage">
        <template #title>
          <div class="lineage-title">
            <div>
              <b>拷贝血缘完整展示</b>
            </div>
            <em>{{ plan.lineageTrees?.length || 0 }} 个根节点 · {{ totalLineageNodeCount }} 个依赖节点</em>
          </div>
        </template>
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
                <span class="lineage-type">{{ data.resourceTypeDesc || typeLabel(data.resourceType) }}</span>
                <code class="lineage-code" :title="data.resourceCode">{{ data.resourceCode }}</code>
                <b class="lineage-name" :title="data.resourceName">{{ data.resourceName }}</b>
                <em class="lineage-reason" :title="data.reason">{{ data.reason }}</em>
              </div>
            </template>
          </el-tree>
        </div>
      </el-collapse-item>
    </el-collapse>
  </section>
</template>