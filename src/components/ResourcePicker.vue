<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { getSourceResources } from '../api/resourceCopyApi'

const props = defineProps({
  source: { type: Object, required: true },
  entryType: { type: String, default: 'RULE' },
})
const selected = defineModel({ type: Array, required: true })

const keyword = ref('')
const loading = ref(false)
const groups = ref([])
const treeRef = ref(null)
const visibleResourceMap = ref({})
const selectedResourceMap = ref({})
let loadSeq = 0

const labels = {
  component: '\u7ec4\u4ef6',
  rule: '\u89c4\u5219',
  select: '\u9009\u62e9',
  selected: '\u5df2\u9009',
  countUnit: '\u4e2a',
  searchPlaceholder: '\u6309\u7f16\u7801\u6216\u540d\u79f0\u68c0\u7d22',
  emptySelected: '\u5c1a\u672a\u9009\u62e9',
  remove: '\u79fb\u9664',
}

const entryLabel = computed(() => props.entryType === 'COMPONENT' ? labels.component : labels.rule)
const entryDescription = computed(() => props.entryType === 'COMPONENT'
  ? '\u4ec5\u5c55\u793a\u6765\u6e90\u7248\u672c\u4e2d\u7684\u7ec4\u4ef6\uff0c\u6309\u7ec4\u4ef6\u7c7b\u578b\u5206\u7ec4'
  : '\u4ec5\u5c55\u793a\u6765\u6e90\u7248\u672c\u4e2d\u7684\u89c4\u5219\uff0c\u6309\u89c4\u5219\u5305\u5206\u7ec4')
const emptyDescription = computed(() => `\u5f53\u524d\u6765\u6e90\u7248\u672c\u6682\u65e0\u53ef\u62f7\u8d1d${entryLabel.value}`)
const sourceKey = computed(() => [props.source.projectId, props.source.flowId, props.source.versionId, props.entryType].join('|'))
const filteredGroups = computed(() => groups.value
  .map((group) => ({
    ...group,
    items: group.items.filter((item) => item.resourceType === props.entryType),
  }))
  .filter((group) => group.items.length))
const treeData = computed(() => filteredGroups.value.map((group) => ({
  id: group.groupId,
  label: group.groupName,
  type: group.groupType,
  children: group.items.map((item) => ({ id: item.resourceId, label: item.resourceName, leaf: true })),
})))
const visibleResourceIds = computed(() => new Set(filteredGroups.value.flatMap((group) => group.items.map((item) => item.resourceId))))
const selectedResources = computed(() => selected.value.map((id) => selectedResourceMap.value[id]).filter(Boolean))
const hasResources = computed(() => treeData.value.length > 0)

function syncVisibleResources() {
  const nextVisibleMap = Object.fromEntries(filteredGroups.value.flatMap((group) => group.items.map((item) => [item.resourceId, item])))
  visibleResourceMap.value = nextVisibleMap
  selectedResourceMap.value = {
    ...selectedResourceMap.value,
    ...Object.fromEntries(selected.value.map((id) => [id, selectedResourceMap.value[id] || nextVisibleMap[id]]).filter(([, item]) => item)),
    ...Object.fromEntries(Object.entries(nextVisibleMap).filter(([id]) => selected.value.includes(id))),
  }
}

async function syncTreeChecked() {
  await nextTick()
  treeRef.value?.setCheckedKeys(selected.value.filter((id) => visibleResourceMap.value[id]))
}

function resetSelectionForSource() {
  selected.value = []
  groups.value = []
  visibleResourceMap.value = {}
  selectedResourceMap.value = {}
}

async function loadResources() {
  const seq = ++loadSeq
  if (!props.source.versionId) {
    groups.value = []
    visibleResourceMap.value = {}
    return
  }
  loading.value = true
  try {
    const res = await getSourceResources({ sourceProcessKey: props.source.flowId, sourceVersionId: props.source.versionId, keyword: keyword.value, resourceType: props.entryType })
    if (seq !== loadSeq) return
    groups.value = res.groups
    syncVisibleResources()
    await syncTreeChecked()
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

function onCheck(_, state) {
  const visibleIds = visibleResourceIds.value
  const hiddenSelectedIds = selected.value.filter((id) => !visibleIds.has(id))
  const checkedVisibleIds = state.checkedKeys.filter((id) => visibleResourceMap.value[id])
  selected.value = Array.from(new Set([...hiddenSelectedIds, ...checkedVisibleIds]))
  selectedResourceMap.value = {
    ...selectedResourceMap.value,
    ...Object.fromEntries(checkedVisibleIds.map((id) => [id, visibleResourceMap.value[id]])),
  }
  syncTreeChecked()
}

function remove(id) {
  selected.value = selected.value.filter((item) => item !== id)
  syncTreeChecked()
}

watch(sourceKey, async () => {
  resetSelectionForSource()
  if (keyword.value) {
    keyword.value = ''
    return
  }
  await loadResources()
}, { immediate: true })
watch(keyword, loadResources)
</script>

<template>
  <section class="picker">
    <div class="picker-left">
      <div class="toolbar">
        <div>
          <div class="panel-title">{{ labels.select }}{{ entryLabel }}</div>
          <div class="muted">{{ entryDescription }}</div>
        </div>
        <el-input v-model="keyword" clearable :placeholder="labels.searchPlaceholder" class="search-input" />
      </div>
      <div class="pick-scroll" v-loading="loading">
        <el-empty v-if="!loading && !hasResources" :description="emptyDescription" :image-size="78" />
        <el-tree v-else ref="treeRef" :data="treeData" show-checkbox check-on-click-node node-key="id" default-expand-all :props="{ children: 'children', label: 'label' }" @check="onCheck">
          <template #default="{ data }">
            <span class="tree-row">
              <span>{{ data.label }}</span>
              <span v-if="visibleResourceMap[data.id]" class="tree-code">{{ visibleResourceMap[data.id].resourceCode }}</span>
            </span>
          </template>
        </el-tree>
      </div>
    </div>

    <aside class="picker-right">
      <div class="panel-title">{{ labels.selected }} {{ selectedResources.length }} {{ labels.countUnit }}{{ entryLabel }}</div>
      <div class="selected-list">
        <el-empty v-if="!selectedResources.length" :description="labels.emptySelected" :image-size="70" />
        <div v-for="res in selectedResources" :key="res.resourceId" class="selected-chip">
          <el-tag size="small" :type="res.resourceType === 'RULE' ? 'primary' : 'success'">{{ entryLabel }}</el-tag>
          <div class="selected-name">
            <b>{{ res.resourceName }}</b>
            <span>{{ res.resourceCode }}</span>
          </div>
          <el-button link type="danger" @click="remove(res.resourceId)">{{ labels.remove }}</el-button>
        </div>
      </div>
    </aside>
  </section>
</template>
