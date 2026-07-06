<script setup>
import { computed, ref, watch } from 'vue'
import { getSourceResources } from '../api/resourceCopyApi'

const props = defineProps({ source: { type: Object, required: true } })
const selected = defineModel({ type: Array, required: true })

const keyword = ref('')
const loading = ref(false)
const groups = ref([])
const resourceMap = ref({})

const treeData = computed(() => groups.value.map((group) => ({
  id: group.groupId,
  label: group.groupName,
  type: group.groupType,
  children: group.items.map((item) => ({ id: item.resourceId, label: item.resourceName, leaf: true })),
})))
const selectedResources = computed(() => selected.value.map((id) => resourceMap.value[id]).filter(Boolean))
const hasResources = computed(() => treeData.value.length > 0)

async function loadResources() {
  if (!props.source.versionId) {
    groups.value = []
    selected.value = []
    return
  }
  loading.value = true
  try {
    const res = await getSourceResources({ sourceProcessKey: props.source.flowId, sourceVersionId: props.source.versionId, keyword: keyword.value })
    groups.value = res.groups
    resourceMap.value = Object.fromEntries(res.groups.flatMap((group) => group.items.map((item) => [item.resourceId, item])))
    selected.value = selected.value.filter((id) => resourceMap.value[id])
  } finally {
    loading.value = false
  }
}

function onCheck(_, state) {
  selected.value = state.checkedKeys.filter((id) => resourceMap.value[id])
}

function remove(id) {
  selected.value = selected.value.filter((item) => item !== id)
}

watch(() => props.source.versionId, loadResources, { immediate: true })
watch(keyword, loadResources)
</script>

<template>
  <section class="picker">
    <div class="picker-left">
      <div class="toolbar">
        <div>
          <div class="panel-title">选择规则 / 组件</div>
          <div class="muted">规则按规则包展示，组件按组件类型展示</div>
        </div>
        <el-input v-model="keyword" clearable placeholder="按编码或名称检索" class="search-input" />
      </div>
      <div class="pick-scroll" v-loading="loading">
        <el-empty v-if="!loading && !hasResources" description="当前来源版本暂无可拷贝资源" :image-size="78" />
        <el-tree v-else :data="treeData" show-checkbox check-on-click-node node-key="id" default-expand-all :props="{ children: 'children', label: 'label' }" @check="onCheck">
          <template #default="{ data }">
            <span class="tree-row">
              <span>{{ data.label }}</span>
              <span v-if="resourceMap[data.id]" class="tree-code">{{ resourceMap[data.id].resourceCode }}</span>
              <span v-if="resourceMap[data.id]" class="tree-refs">引用 {{ resourceMap[data.id].refCount }}</span>
            </span>
          </template>
        </el-tree>
      </div>
    </div>

    <aside class="picker-right">
      <div class="panel-title">已选 {{ selectedResources.length }} 项</div>
      <div class="selected-list">
        <el-empty v-if="!selectedResources.length" description="尚未选择" :image-size="70" />
        <div v-for="res in selectedResources" :key="res.resourceId" class="selected-chip">
          <el-tag size="small" :type="res.resourceType === 'RULE' ? 'primary' : 'success'">{{ res.resourceType === 'RULE' ? '规则' : '组件' }}</el-tag>
          <div class="selected-name">
            <b>{{ res.resourceName }}</b>
            <span>{{ res.resourceCode }}</span>
          </div>
          <el-button link type="danger" @click="remove(res.resourceId)">移除</el-button>
        </div>
      </div>
    </aside>
  </section>
</template>
