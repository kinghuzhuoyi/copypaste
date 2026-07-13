import axios from 'axios'

const sleep = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms))

const env = import.meta.env || {}
const API_BASE_URL = env.VITE_RESOURCE_COPY_API_BASE_URL || ''
const USE_MOCK_API = env.VITE_USE_MOCK_API !== 'false'
const projectNameById = new Map()
const flowNameByKey = new Map()
const versionProcessKeyByVersion = new Map()

const apiClient = axios.create({
  baseURL: API_BASE_URL || window.location.origin,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

async function request(path, { method = 'GET', query, body, mockBody } = {}) {
  if (USE_MOCK_API) return mockRequest(path, { method, query, body: mockBody || body })

  try {
    const response = await apiClient.request({
      url: path,
      method,
      params: query,
      data: body,
    })
    return response.data
  } catch (error) {
    const status = error.response?.status
    const message = error.response?.data?.message || error.message || 'unknown error'
    throw new Error(status ? `接口请求失败：${status} ${message}` : `接口请求失败：${message}`)
  }
}

const targetContext = {
  target: {
    projectId: 'P_TARGET',
    projectName: '零售信贷项目',
    flowId: 'F_TARGET',
    flowCode: 'credit_main',
    flowName: '信贷决策流',
    versionId: 'V_TARGET',
    versionNo: 'v3',
    versionStatus: 'EFFECTIVE',
    versionStatusName: '生效',
    sceneId: 'S3',
    sceneName: '生产场景',
  },
}

function getLocalCopyContext() {
  return {
    target: {
      ...targetContext.target,
      projectName: env.VITE_TARGET_PROJECT_NAME || targetContext.target.projectName,
      flowCode: env.VITE_TARGET_PROCESS_KEY || targetContext.target.flowCode,
      flowName: env.VITE_TARGET_PROCESS_NAME || targetContext.target.flowName,
      versionNo: env.VITE_TARGET_PROCESS_VERSION || targetContext.target.versionNo,
      sceneName: env.VITE_TARGET_SCENE_NAME || targetContext.target.sceneName,
    },
  }
}

const projects = [
  { projectId: 'P1', projectName: '零售信贷项目' },
  { projectId: 'P2', projectName: '小微经营贷项目' },
]

const flows = [
  { flowId: 'F1', projectId: 'P1', flowCode: 'credit_apply', flowName: '授信申请决策流' },
  { flowId: 'F2', projectId: 'P1', flowCode: 'anti_fraud', flowName: '反欺诈决策流' },
  { flowId: 'F3', projectId: 'P2', flowCode: 'biz_amount', flowName: '经营贷额度决策流' },
]

const versions = [
  { versionId: 'V1', flowId: 'F1', versionNo: 'v5', versionStatus: 'EFFECTIVE', versionStatusName: '生效', resourcePreset: 'full' },
  { versionId: 'V2', flowId: 'F1', versionNo: 'v6', versionStatus: 'GRAY', versionStatusName: '灰度', resourcePreset: 'full' },
  { versionId: 'V_STRESS', flowId: 'F1', versionNo: 'vStress', versionStatus: 'GRAY', versionStatusName: '灰度', resourcePreset: 'stress' },
  { versionId: 'V3', flowId: 'F2', versionNo: 'v2', versionStatus: 'DRAFT', versionStatusName: '草稿', resourcePreset: 'fraud' },
  { versionId: 'V4', flowId: 'F3', versionNo: 'v1', versionStatus: 'OFFLINE', versionStatusName: '下线', resourcePreset: 'empty' },
]

const resources = {
  R001: { resourceId: 'R001', resourceCode: 'R001', resourceName: '信用评分规则', resourceType: 'RULE', refs: ['IP01', 'TG01', 'FC01', 'VAR01', 'C001'] },
  R002: { resourceId: 'R002', resourceCode: 'R002', resourceName: '风险等级规则', resourceType: 'RULE', refs: ['IP02', 'TG01', 'C002'] },
  R003: { resourceId: 'R003', resourceCode: 'R003', resourceName: '额度计算规则', resourceType: 'RULE', refs: ['IP01', 'IP06', 'FC03', 'C002'] },
  R004: { resourceId: 'R004', resourceCode: 'R004', resourceName: '设备指纹规则', resourceType: 'RULE', refs: ['IP07', 'TG03', 'C005'] },
  R005: { resourceId: 'R005', resourceCode: 'R005', resourceName: '黑名单规则', resourceType: 'RULE', refs: ['IP08', 'TG01'] },
  C001: { resourceId: 'C001', resourceCode: 'C001', resourceName: '评分卡组件', resourceType: 'COMPONENT', componentType: 'CODE_COMPONENT', refs: ['IP03', 'TG02', 'FC01', 'C003'] },
  C002: { resourceId: 'C002', resourceCode: 'C002', resourceName: '客户分层决策表', resourceType: 'COMPONENT', componentType: 'DECISION_TABLE', refs: ['IP04', 'FC02'] },
  C003: { resourceId: 'C003', resourceCode: 'C003', resourceName: '子模型组件', resourceType: 'COMPONENT', componentType: 'CODE_COMPONENT', refs: ['IP05', 'C004', 'FC01'] },
  C004: { resourceId: 'C004', resourceCode: 'C004', resourceName: '底层算子组件', resourceType: 'COMPONENT', componentType: 'CODE_COMPONENT', refs: [] },
  C005: { resourceId: 'C005', resourceCode: 'C005', resourceName: '特征工程组件', resourceType: 'COMPONENT', componentType: 'CODE_COMPONENT', refs: ['IP09', 'FC03'] },
  C006: { resourceId: 'C006', resourceCode: 'C006', resourceName: '额度矩阵交叉表', resourceType: 'COMPONENT', componentType: 'CROSS_DECISION_TABLE', refs: ['IP01', 'IP02'] },
  IP01: { resourceId: 'IP01', resourceCode: 'IP01', resourceName: '申请金额', resourceType: 'INPUT_PARAM', paramType: 'number' },
  IP02: { resourceId: 'IP02', resourceCode: 'IP02', resourceName: '客户等级', resourceType: 'INPUT_PARAM', paramType: 'string' },
  IP03: { resourceId: 'IP03', resourceCode: 'IP03', resourceName: '评分输入', resourceType: 'INPUT_PARAM', paramType: 'number' },
  IP04: { resourceId: 'IP04', resourceCode: 'IP04', resourceName: '特征向量', resourceType: 'INPUT_PARAM', paramType: 'array' },
  IP05: { resourceId: 'IP05', resourceCode: 'IP05', resourceName: '模型入参', resourceType: 'INPUT_PARAM', paramType: 'number' },
  IP06: { resourceId: 'IP06', resourceCode: 'IP06', resourceName: '申请期限', resourceType: 'INPUT_PARAM', paramType: 'number' },
  IP07: { resourceId: 'IP07', resourceCode: 'IP07', resourceName: '设备ID', resourceType: 'INPUT_PARAM', paramType: 'string' },
  IP08: { resourceId: 'IP08', resourceCode: 'IP08', resourceName: '证件号', resourceType: 'INPUT_PARAM', paramType: 'string' },
  IP09: { resourceId: 'IP09', resourceCode: 'IP09', resourceName: '原始特征', resourceType: 'INPUT_PARAM', paramType: 'array' },
  TG01: { resourceId: 'TG01', resourceCode: 'TG01', resourceName: '标签-是否逾期', resourceType: 'RULE_TAG', paramType: 'bool', desc: '是否逾期', defaultValue: 'false' },
  TG02: { resourceId: 'TG02', resourceCode: 'TG02', resourceName: '标签-风险分', resourceType: 'RULE_TAG', paramType: 'number', desc: '风险评分', defaultValue: '0' },
  TG03: { resourceId: 'TG03', resourceCode: 'TG03', resourceName: '标签-设备风险', resourceType: 'RULE_TAG', paramType: 'number', desc: '设备风险等级', defaultValue: '0' },
  FC01: { resourceId: 'FC01', resourceCode: 'FC01', resourceName: '缓存-评分中间值', resourceType: 'FLOW_CACHE', paramType: 'number', defaultValue: '0' },
  FC02: { resourceId: 'FC02', resourceCode: 'FC02', resourceName: '缓存-决策路径', resourceType: 'FLOW_CACHE', paramType: 'string', defaultValue: '' },
  FC03: { resourceId: 'FC03', resourceCode: 'FC03', resourceName: '缓存-特征值', resourceType: 'FLOW_CACHE', paramType: 'number', defaultValue: '0' },
  VAR01: { resourceId: 'VAR01', resourceCode: 'VAR01', resourceName: '变量-基准利率', resourceType: 'VARIABLE' },
}

const packages = [
  { groupId: 'PKG1', groupName: '信贷审批规则包', rules: ['R001', 'R002', 'R003'] },
  { groupId: 'PKG2', groupName: '反欺诈规则包', rules: ['R004', 'R005'] },
]

const presetMap = {
  full: { packages: ['PKG1', 'PKG2'], components: ['C001', 'C002', 'C003', 'C004', 'C005', 'C006'] },
  fraud: { packages: ['PKG2'], components: ['C005'] },
  empty: { packages: [], components: [] },
  stress: { packages: ['PKG_STRESS'], components: [] },
}

const targetExisting = {
  R001: { resourceCode: 'R001', resourceName: '信用评分规则V2', resourceType: 'RULE' },
  R002: { resourceCode: 'R002', resourceName: '风险等级规则V2', resourceType: 'RULE' },
  IP01: { resourceCode: 'IP01', resourceName: '申请金额', resourceType: 'INPUT_PARAM', paramType: 'number' },
  IP03: { resourceCode: 'IP03', resourceName: '评分输入', resourceType: 'INPUT_PARAM', paramType: 'string' },
  TG01: { resourceCode: 'TG01', resourceName: '标签-是否逾期', resourceType: 'RULE_TAG', paramType: 'bool', desc: '是否逾期', defaultValue: 'false' },
  FC01: { resourceCode: 'FC01', resourceName: '缓存-评分中间值', resourceType: 'FLOW_CACHE', paramType: 'number', defaultValue: '100' },
  C001: { resourceCode: 'C001', resourceName: '评分卡组件-旧', resourceType: 'COMPONENT' },
  C002: { resourceCode: 'C002', resourceName: '客户分层决策表-旧', resourceType: 'COMPONENT' },
}

const targetFolders = [
  { folderId: 'FOLDER_DEFAULT', folderName: '默认文件夹' },
  { folderId: 'FOLDER_CREDIT', folderName: '信贷类' },
  { folderId: 'FOLDER_RISK', folderName: '风控类' },
]


const backendModuleMap = {
  RULE: 'RULE',
  COMPONENT: 'CODE',
  INPUT_PARAM: 'INPUT',
  RULE_TAG: 'LABEL',
  FLOW_CACHE: 'INNER',
  VARIABLE: 'VAR',
  MODEL: 'MODEL',
}

const frontendResourceTypeMap = {
  RULE: 'RULE',
  RULE_NODE: 'RULE',
  CODE: 'COMPONENT',
  TBL: 'COMPONENT',
  SCRIPT_TBL: 'COMPONENT',
  CANVAS: 'COMPONENT',
  INPUT: 'INPUT_PARAM',
  LABEL: 'RULE_TAG',
  INNER: 'FLOW_CACHE',
  VAR: 'VARIABLE',
  MODEL: 'MODEL',
}

const backendTypeTagMap = {
  COPY: 'COPY',
  REUSE: 'REUSE',
  RENAME: 'RENAME',
  DIRECT_REF: 'DIRECT',
  TERMINATE: 'CONFLICT',
}

const frontendActionMap = {
  COPY: 'COPY',
  REUSE: 'REUSE',
  RENAME: 'RENAME',
  DIRECT: 'DIRECT_REF',
  CONFLICT: 'TERMINATE',
}

const saveResults = new Map()

function generateStressData() {
  if (resources.SR001) return
  const stressRules = []
  for (let r = 1; r <= 6; r += 1) {
    const ruleId = `SR${String(r).padStart(3, '0')}`
    stressRules.push(ruleId)
    const primaryComponents = []
    for (let c = 1; c <= 12; c += 1) {
      const primaryId = `SC${String(r).padStart(2, '0')}_${String(c).padStart(2, '0')}`
      primaryComponents.push(primaryId)
      const secondaryComponents = []
      const params = []
      const variables = []
      const models = []

      for (let i = 1; i <= 5; i += 1) {
        const secondaryId = `${primaryId}_SUB${i}`
        secondaryComponents.push(secondaryId)
        const subRefs = []
        for (let v = 1; v <= 3; v += 1) {
          const id = `${secondaryId}_VAR${v}`
          subRefs.push(id)
          resources[id] = { resourceId: id, resourceCode: id, resourceName: `子组件变量 ${r}-${c}-${i}-${v}`, resourceType: 'VARIABLE' }
        }
        for (let p = 1; p <= 2; p += 1) {
          const id = `${secondaryId}_P${p}`
          subRefs.push(id)
          resources[id] = { resourceId: id, resourceCode: id, resourceName: `子组件参数 ${r}-${c}-${i}-${p}`, resourceType: 'INPUT_PARAM', paramType: p % 2 ? 'number' : 'string' }
        }
        resources[secondaryId] = {
          resourceId: secondaryId,
          resourceCode: secondaryId,
          resourceName: `下游代码组件 ${r}-${c}-${i}`,
          resourceType: 'COMPONENT',
          componentType: 'CODE_COMPONENT',
          refs: subRefs,
        }
      }

      for (let i = 1; i <= 10; i += 1) {
        const id = `${primaryId}_VAR${i}`
        variables.push(id)
        resources[id] = { resourceId: id, resourceCode: id, resourceName: `实时变量 ${r}-${c}-${i}`, resourceType: 'VARIABLE' }
      }
      for (let i = 1; i <= 5; i += 1) {
        const id = `${primaryId}_MODEL${i}`
        models.push(id)
        resources[id] = { resourceId: id, resourceCode: id, resourceName: `评分模型 ${r}-${c}-${i}`, resourceType: 'MODEL' }
      }
      for (let i = 1; i <= 5; i += 1) {
        const id = `${primaryId}_PARAM${i}`
        params.push(id)
        resources[id] = { resourceId: id, resourceCode: id, resourceName: `输入参数 ${r}-${c}-${i}`, resourceType: 'INPUT_PARAM', paramType: i % 2 ? 'number' : 'string' }
      }

      resources[primaryId] = {
        resourceId: primaryId,
        resourceCode: primaryId,
        resourceName: `一级策略组件 ${r}-${c}`,
        resourceType: 'COMPONENT',
        componentType: c % 3 === 0 ? 'DECISION_TABLE' : 'CODE_COMPONENT',
        refs: [...secondaryComponents, ...variables, ...models, ...params],
      }
    }
    resources[ruleId] = {
      resourceId: ruleId,
      resourceCode: ruleId,
      resourceName: `大依赖授信规则 ${r}`,
      resourceType: 'RULE',
      refs: primaryComponents,
    }
  }
  packages.push({ groupId: 'PKG_STRESS', groupName: '大依赖规则包（压力测试）', rules: stressRules })
}

generateStressData()
function includesKeyword(text, keyword = '') {
  return !keyword || String(text).toLowerCase().includes(keyword.trim().toLowerCase())
}

function collectClosure(resourceId, seen = new Set()) {
  if (seen.has(resourceId)) return []
  seen.add(resourceId)
  const item = resources[resourceId]
  if (!item) return []
  return [resourceId, ...(item.refs || []).flatMap((id) => collectClosure(id, seen))]
}

function diff(field, fieldName, sourceValue, targetValue) {
  return { field, fieldName, sourceValue: sourceValue ?? '-', targetValue: targetValue ?? '-' }
}

function contentDiffs(source, target) {
  const diffs = []
  if (source.resourceName !== target.resourceName) diffs.push(diff('resourceName', '名称', source.resourceName, target.resourceName))
  if (source.paramType !== target.paramType) diffs.push(diff('paramType', '数值类型', source.paramType, target.paramType))
  if (source.desc !== target.desc) diffs.push(diff('desc', '描述', source.desc, target.desc))
  if (source.defaultValue !== target.defaultValue) diffs.push(diff('defaultValue', '默认值', source.defaultValue, target.defaultValue))
  return diffs
}

function judge(source) {
  if (source.resourceType === 'VARIABLE' || source.resourceType === 'MODEL') {
    return { action: 'DIRECT_REF', reason: '变量/模型是公共资源，不拷贝，直接引用调用', diffs: [] }
  }
  const target = targetExisting[source.resourceCode]
  if (!target) return { action: 'COPY', reason: '目标无同编码资源，复制到当前场景', diffs: [] }

  if (source.resourceType === 'RULE') {
    const diffs = contentDiffs(source, target)
    return diffs.length
      ? { action: 'RENAME', reason: '规则编码冲突，允许重命名后复制', diffs, suggestedCode: `${source.resourceCode}_COPY` }
      : { action: 'REUSE', reason: '目标已有同编码且内容一致的规则，复用', diffs: [] }
  }

  if (source.resourceType === 'COMPONENT') {
    const diffs = contentDiffs(source, target)
    if (!diffs.length) return { action: 'REUSE', reason: '目标已有同编码且内容一致的组件，复用', diffs: [] }
    if (source.componentType === 'DECISION_TABLE') {
      return { action: 'RENAME', reason: '决策表编码冲突，允许重命名后复制', diffs, suggestedCode: `${source.resourceCode}_COPY` }
    }
    return { action: 'TERMINATE', reason: '组件编码冲突且不支持重命名，终止引用它的拷贝', diffs }
  }

  if (source.resourceType === 'INPUT_PARAM') {
    return source.paramType === target.paramType
      ? { action: 'REUSE', reason: '输入参数类型一致，复用', diffs: [] }
      : { action: 'TERMINATE', reason: '输入参数类型不一致，终止引用它的拷贝', diffs: [diff('paramType', '数值类型', source.paramType, target.paramType)] }
  }

  if (source.resourceType === 'RULE_TAG') {
    const same = ['paramType', 'desc', 'defaultValue'].every((key) => source[key] === target[key])
    return same
      ? { action: 'REUSE', reason: '规则标签定义一致，复用', diffs: [] }
      : { action: 'TERMINATE', reason: '规则标签定义不一致，终止引用它的拷贝', diffs: contentDiffs(source, target) }
  }

  if (source.resourceType === 'FLOW_CACHE') {
    const same = ['paramType', 'defaultValue'].every((key) => source[key] === target[key])
    return same
      ? { action: 'REUSE', reason: '流程缓存定义一致，复用', diffs: [] }
      : { action: 'TERMINATE', reason: '流程缓存定义不一致，终止引用它的拷贝', diffs: contentDiffs(source, target) }
  }

  return { action: 'COPY', reason: '复制', diffs: [] }
}

function buildNode(resourceId, decisions, blockedRootIds, seen = new Set()) {
  const item = resources[resourceId]
  const decision = decisions[resourceId]
  if (!item) return null
  if (seen.has(resourceId)) {
    return { nodeId: `N_${resourceId}_CYCLE`, resourceId, resourceCode: resourceId, resourceName: `${resourceId}（循环引用）`, resourceType: 'CYCLE', action: 'REUSE', reason: '循环引用已截断', children: [] }
  }
  const nextSeen = new Set(seen)
  nextSeen.add(resourceId)
  const isBlockedRoot = blockedRootIds.has(resourceId)
  return {
    nodeId: `N_${resourceId}_${nextSeen.size}`,
    resourceId: item.resourceId,
    resourceType: item.resourceType,
    resourceCode: item.resourceCode,
    resourceName: item.resourceName,
    action: isBlockedRoot ? 'TERMINATE' : decision.action,
    reason: isBlockedRoot ? '分支含冲突，根资源跳过' : decision.reason,
    children: (item.refs || []).map((id) => buildNode(id, decisions, blockedRootIds, nextSeen)).filter(Boolean),
  }
}

function makePlan({ sourceVersionId, targetVersionId, selectedResources }) {
  const selectedIds = selectedResources.map((item) => item.resourceId)
  const allIds = Array.from(new Set(selectedIds.flatMap((id) => collectClosure(id))))
  const decisions = Object.fromEntries(allIds.map((id) => [id, judge(resources[id])]))
  const rootResults = selectedIds.map((id) => {
    const closure = collectClosure(id)
    const blockers = closure.filter((refId) => decisions[refId].action === 'TERMINATE')
    const root = resources[id]
    const copyable = blockers.length === 0
    return {
      resourceId: root.resourceId,
      resourceCode: root.resourceCode,
      resourceName: root.resourceName,
      resourceType: root.resourceType,
      copyable,
      action: copyable ? decisions[id].action : 'TERMINATE',
      reason: copyable ? decisions[id].reason : '分支含冲突，根资源跳过',
      blockerResourceIds: blockers,
    }
  })
  const blockedRootIds = new Set(rootResults.filter((item) => !item.copyable).map((item) => item.resourceId))
  const actionCounts = { COPY: 0, REUSE: 0, RENAME: 0, DIRECT_REF: 0, TERMINATE: 0 }
  allIds.forEach((id) => { actionCounts[decisions[id].action] += 1 })
  const conflicts = allIds
    .filter((id) => ['TERMINATE', 'RENAME'].includes(decisions[id].action))
    .map((id, index) => {
      const item = resources[id]
      const decision = decisions[id]
      const affected = rootResults.filter((root) => root.blockerResourceIds.includes(id))
      return {
        conflictId: `CF_${String(index + 1).padStart(3, '0')}`,
        resourceId: item.resourceId,
        resourceType: item.resourceType,
        resourceCode: item.resourceCode,
        resourceName: item.resourceName,
        action: decision.action,
        reason: decision.reason,
        suggestedCode: decision.suggestedCode,
        affectedRootIds: affected.map((root) => root.resourceId),
        affectedRootNames: affected.map((root) => root.resourceName),
        diffs: decision.diffs,
        availableResolutions: decision.action === 'RENAME' ? ['RENAME'] : ['SKIP_AFFECTED_COPY'],
      }
    })
  return {
    planId: `CP_${Date.now()}`,
    status: 'CHECKED',
    sourceVersionId,
    targetVersionId,
    summary: {
      selectedRootCount: rootResults.length,
      copyableRootCount: rootResults.filter((item) => item.copyable).length,
      blockedRootCount: rootResults.filter((item) => !item.copyable).length,
      achievementRate: rootResults.length ? Math.round((rootResults.filter((item) => item.copyable).length / rootResults.length) * 100) : 0,
      dependencyActionCounts: actionCounts,
    },
    rootResults,
    conflicts,
    lineageTrees: selectedIds.map((id) => buildNode(id, decisions, blockedRootIds)).filter(Boolean),
    targetFolders,
  }
}

function toBackendModule(resourceType) {
  return backendModuleMap[resourceType] || resourceType || ''
}

function toFrontendResourceType(module) {
  return frontendResourceTypeMap[module] || module || ''
}

function toBackendTypeTag(action) {
  return backendTypeTagMap[action] || action || 'COPY'
}

function toFrontendAction(typeTag) {
  return frontendActionMap[typeTag] || typeTag || 'COPY'
}

function toResourceCopySelectRequest(payload) {
  return {
    sourceIds: payload.selectedResources?.map((item) => item.resourceId || item.resourceCode || item.itemCode).filter(Boolean) || [],
    sourceProcessKey: payload.sourceProcessKey || '',
    sourceProcessVersion: payload.sourceProcessVersion || payload.sourceVersionId || '',
    targetProcessKey: payload.targetProcessKey || '',
    targetProcessVersion: payload.targetProcessVersion || payload.targetVersionId || '',
  }
}

function toBackendLineageTree(node) {
  return {
    children: (node.children || []).map(toBackendLineageTree),
    innerVarList: [],
    itemCode: node.resourceCode,
    itemName: node.resourceName,
    modelList: [],
    module: toBackendModule(node.resourceType),
    moduleDesc: node.resourceTypeDesc || '',
    moduleVarList: [],
    paramsList: [],
    pluginList: [],
    typeTag: toBackendTypeTag(node.action),
    typeTagDesc: node.actionDesc || '',
    varList: [],
  }
}

function toBackendSelectView(selectRequest) {
  const plan = makePlan({
    sourceVersionId: selectRequest.sourceProcessVersion,
    targetVersionId: selectRequest.targetProcessVersion,
    selectedResources: selectRequest.sourceIds.map((resourceId) => ({ resourceId })),
  })
  const counts = plan.summary.dependencyActionCounts
  return {
    conflictCount: plan.conflicts.length,
    conflictItems: plan.conflicts.map((item) => ({
      conflictMsg: item.reason,
      itemCode: item.resourceCode,
      itemName: item.resourceName,
      itemNewCode: item.suggestedCode || '',
      module: toBackendModule(item.resourceType),
      pkgId: '',
      pkgName: '',
    })),
    copyCount: counts.COPY || 0,
    copyModuleLineageTrees: plan.lineageTrees.map(toBackendLineageTree),
    copyTotal: plan.summary.selectedRootCount,
    copyableItems: plan.rootResults.filter((item) => item.copyable).map((item) => ({
      itemCode: item.resourceCode,
      itemName: item.resourceName,
      module: toBackendModule(item.resourceType),
      pkgId: targetFolders[0]?.folderId || '',
      pkgName: targetFolders[0]?.folderName || '',
    })),
    copyableRate: plan.summary.achievementRate,
    copyableTotal: plan.summary.copyableRootCount,
    directCount: counts.DIRECT_REF || 0,
    reuseCount: counts.REUSE || 0,
    skipTotal: plan.summary.blockedRootCount,
  }
}

function createListNodes(list = [], resourceType, action, reason, parentKey) {
  return list.map((value, index) => ({
    nodeId: `${parentKey}_${resourceType}_${index}`,
    resourceId: value,
    resourceType,
    resourceCode: value,
    resourceName: value,
    action,
    reason,
    children: [],
  }))
}

function toFrontendLineageTree(node, path = 'N') {
  const action = toFrontendAction(node.typeTag)
  const resourceType = toFrontendResourceType(node.module)
  const nodeId = `${path}_${node.itemCode || node.itemName || 'NODE'}`
  const listChildren = [
    ...createListNodes(node.varList, 'VARIABLE', 'DIRECT_REF', '变量为公共资源，直接调用', `${nodeId}_VAR`),
    ...createListNodes(node.modelList, 'MODEL', 'DIRECT_REF', '模型为公共资源，直接调用', `${nodeId}_MODEL`),
    ...createListNodes(node.paramsList, 'INPUT_PARAM', action, '节点引用入参', `${nodeId}_PARAM`),
    ...createListNodes(node.innerVarList, 'FLOW_CACHE', action, '节点引用过程变量', `${nodeId}_INNER`),
    ...createListNodes(node.moduleVarList, 'VARIABLE', 'DIRECT_REF', '节点引用组件变量', `${nodeId}_MODULE_VAR`),
    ...createListNodes(node.pluginList, 'COMPONENT', action, '节点引用插件', `${nodeId}_PLUGIN`),
  ]
  return {
    nodeId,
    resourceId: node.itemCode,
    resourceType,
    resourceCode: node.itemCode,
    resourceTypeDesc: node.moduleDesc || '',
    resourceName: node.itemName,
    action,
    actionDesc: node.typeTagDesc || '',
    reason: node.typeTagDesc || (action === 'TERMINATE' ? '冲突终止' : action === 'DIRECT_REF' ? '公共资源直接调用' : '按后端预检方案处理'),
    children: [
      ...(node.children || []).map((child, index) => toFrontendLineageTree(child, `${nodeId}_${index}`)),
      ...listChildren,
    ],
  }
}

function countLineageActions(nodes = [], counts = { COPY: 0, REUSE: 0, RENAME: 0, DIRECT_REF: 0, TERMINATE: 0 }) {
  nodes.forEach((node) => {
    counts[node.action] = (counts[node.action] || 0) + 1
    countLineageActions(node.children || [], counts)
  })
  return counts
}

function toFrontendPlan(selectView, selectRequest, folders = targetFolders) {
  const lineageTrees = (selectView.copyModuleLineageTrees || []).map((node, index) => toFrontendLineageTree(node, `N_${index}`))
  const dependencyActionCounts = countLineageActions(lineageTrees)
  const copyableItems = selectView.copyableItems || []
  const conflictItems = selectView.conflictItems || []
  return {
    planId: `RESOURCE_COPY_${Date.now()}`,
    status: 'CHECKED',
    sourceVersionId: selectRequest.sourceProcessVersion,
    targetVersionId: selectRequest.targetProcessVersion,
    selectRequest,
    rawSelectView: selectView,
    summary: {
      selectedRootCount: selectView.copyTotal || copyableItems.length + (selectView.skipTotal || 0),
      copyableRootCount: selectView.copyableTotal ?? copyableItems.length,
      blockedRootCount: selectView.skipTotal || 0,
      achievementRate: Math.round(selectView.copyableRate || 0),
      dependencyActionCounts: {
        ...dependencyActionCounts,
        COPY: selectView.copyCount ?? dependencyActionCounts.COPY,
        REUSE: selectView.reuseCount ?? dependencyActionCounts.REUSE,
        DIRECT_REF: selectView.directCount ?? dependencyActionCounts.DIRECT_REF,
        TERMINATE: selectView.conflictCount ?? dependencyActionCounts.TERMINATE,
      },
    },
    rootResults: [
      ...copyableItems.map((item) => ({
        resourceId: item.itemCode,
        resourceCode: item.itemCode,
        resourceName: item.itemName,
        resourceType: toFrontendResourceType(item.module),
        resourceTypeDesc: item.moduleDesc || '',
        copyable: true,
        action: 'COPY',
        reason: '后端预检为可复制资源',
      })),
      ...conflictItems.map((item) => ({
        resourceId: item.itemCode,
        resourceCode: item.itemCode,
        resourceName: item.itemName,
        resourceType: toFrontendResourceType(item.module),
        resourceTypeDesc: item.moduleDesc || '',
        copyable: false,
        action: item.itemNewCode ? 'RENAME' : 'TERMINATE',
        reason: item.conflictMsg,
      })),
    ],
    conflicts: conflictItems.map((item, index) => ({
      conflictId: `CF_${String(index + 1).padStart(3, '0')}`,
      resourceId: item.itemCode,
      resourceType: toFrontendResourceType(item.module),
      resourceTypeDesc: item.moduleDesc || '',
      resourceCode: item.itemCode,
      resourceName: item.itemName,
      action: item.itemNewCode ? 'RENAME' : 'TERMINATE',
      reason: item.conflictMsg,
      suggestedCode: item.itemNewCode,
      affectedRootIds: [],
      affectedRootNames: [],
      diffs: [],
      availableResolutions: item.itemNewCode ? ['RENAME'] : ['SKIP_AFFECTED_COPY'],
    })),
    lineageTrees,
    targetFolders: folders.length ? folders : targetFolders,
  }
}

function resolveFolder(folderValue, folders = [], temporaryFolders = []) {
  const matched = [...folders, ...temporaryFolders].find((folder) => folder.folderId === folderValue || folder.folderName === folderValue)
  if (!matched) return { folderId: '', folderName: folderValue || '' }
  return matched.temporary ? { folderId: '', folderName: matched.folderName } : matched
}

function toResourceCopySaveRequest(plan, resolution = {}) {
  const renameMap = resolution.renameMap || {}
  const folderMap = resolution.folderMap || {}
  const abandonMap = resolution.abandonMap || {}
  const temporaryFolders = resolution.temporaryFolders || []
  const raw = plan.rawSelectView || {}
  return {
    conflictItems: (raw.conflictItems || []).map((item) => ({
      ...item,
      itemNewCode: abandonMap[item.itemCode] ? '' : (renameMap[item.itemCode] ?? item.itemNewCode ?? ''),
    })),
    copyModuleLineageTrees: raw.copyModuleLineageTrees || [],
    copyableItems: (raw.copyableItems || []).filter((item) => !abandonMap[item.itemCode]).map((item) => {
      const isRule = item.module === 'RULE'
      const folder = isRule ? resolveFolder(folderMap[item.itemCode] || item.pkgId || item.pkgName, plan.targetFolders || [], temporaryFolders) : { folderId: item.pkgId || '', folderName: item.pkgName || '' }
      return {
        ...item,
        pkgId: folder.folderId,
        pkgName: folder.folderName,
      }
    }),
    sourceProcessKey: plan.selectRequest?.sourceProcessKey || '',
    sourceProcessVersion: plan.selectRequest?.sourceProcessVersion || '',
    targetProcessKey: plan.selectRequest?.targetProcessKey || '',
    targetProcessVersion: plan.selectRequest?.targetProcessVersion || '',
  }
}

function countBackendTypeTags(nodes = [], counts = { COPY: 0, REUSE: 0, DIRECT: 0, CONFLICT: 0 }) {
  nodes.forEach((node) => {
    const key = node.typeTag === 'RENAME' ? 'COPY' : node.typeTag
    if (counts[key] !== undefined) counts[key] += 1
    countBackendTypeTags(node.children || [], counts)
  })
  return counts
}

function toBackendSaveView(saveRequest) {
  const counts = countBackendTypeTags(saveRequest.copyModuleLineageTrees || [])
  return {
    conflictCount: saveRequest.conflictItems?.filter((item) => !item.itemNewCode).length || 0,
    copyCount: counts.COPY,
    directCount: counts.DIRECT,
    reuseCount: counts.REUSE,
    skipTotal: saveRequest.conflictItems?.filter((item) => !item.itemNewCode).length || 0,
  }
}

function normalizeProjectList(list = [], pageNo = 1, pageSize = 20) {
  const items = list.map((item) => {
    const projectId = item.id || item.projectId || item.name || item.projectName
    const projectName = item.name || item.projectName || item.id || item.projectId
    projectNameById.set(projectId, projectName)
    return { projectId, projectName }
  })
  return { items, pageNo, pageSize, total: items.length }
}

function normalizeFlowList(list = [], projectId, pageNo = 1, pageSize = 20) {
  const items = list.map((item) => {
    const flowId = item.processKey || item.flowId || item.flowCode
    const flowCode = item.processKey || item.flowCode || flowId
    const flowName = item.processName || item.flowName || flowCode
    flowNameByKey.set(flowId, flowName)
    return { flowId, projectId, flowCode, flowName }
  })
  return { items, pageNo, pageSize, total: items.length }
}

function normalizeVersionList(list = [], flowId) {
  return {
    items: list.map((item) => {
      const versionId = item.processVersion || item.versionId || item.versionNo
      const processKey = item.processKey || flowId
      versionProcessKeyByVersion.set(versionId, processKey)
      return {
        versionId,
        flowId: processKey,
        versionNo: item.processVersion || item.versionNo || item.versionId,
        versionStatus: item.processStatus || item.versionStatus || '',
        versionStatusName: item.processStatus || item.versionStatusName || item.versionStatus || '',
        processName: item.processName,
        processKey,
      }
    }),
  }
}

function normalizeSourceResources(list = [], sourceProcessVersion, fallbackResourceType = 'RULE') {
  return {
    sourceVersionId: sourceProcessVersion,
    groups: list.map((group) => ({
      groupType: group.groupType || (fallbackResourceType === 'COMPONENT' ? 'COMPONENT_TYPE' : 'RULE_PACKAGE'),
      groupId: group.pkgId || group.groupId || group.pkgName,
      groupName: group.pkgName || group.groupName || group.pkgId,
      items: (group.resourceDetails || group.items || []).map((item) => ({
        resourceId: item.id || item.resourceId || item.code,
        resourceType: item.module ? toFrontendResourceType(item.module) : (item.resourceType || fallbackResourceType),
        resourceCode: item.code || item.resourceCode || item.id,
        resourceName: item.name || item.resourceName || item.code,
        refCount: item.refCount || 0,
        selectable: item.selectable !== false,
      })),
    })).filter((group) => group.items.length),
  }
}

function normalizePkgList(list = []) {
  return list.map((item) => ({
    folderId: item.pkgId || item.folderId || item.pkgName,
    folderName: item.pkgName || item.folderName || item.pkgId,
    processKey: item.processKey,
    processVersion: item.processVersion,
    referenced: item.referenced,
  }))
}

async function mockRequest(path, { method = 'GET', query = {}, body } = {}) {
  await sleep(method === 'GET' ? 120 : 260)


  const projectMatch = path.match(/^\/copy\/projects\/(.*)$/)
  if (method === 'GET' && projectMatch) {
    const keyword = decodeURIComponent(projectMatch[1] || '')
    return projects
      .filter((item) => includesKeyword(item.projectName, keyword))
      .map((item) => ({ id: item.projectId, name: item.projectName }))
  }

  const flowMatch = path.match(/^\/copy\/process\/([^/]+)\/(.*)$/)
  if (method === 'GET' && flowMatch) {
    const projectName = decodeURIComponent(flowMatch[1])
    const keyword = decodeURIComponent(flowMatch[2] || '')
    const project = projects.find((item) => item.projectId === projectName || item.projectName === projectName)
    return flows
      .filter((item) => (!project || item.projectId === project.projectId) && (includesKeyword(item.flowName, keyword) || includesKeyword(item.flowCode, keyword)))
      .map((item) => ({ processKey: item.flowCode, processName: item.flowName }))
  }

  const versionMatch = path.match(/^\/copy\/version\/([^/]+)$/)
  if (method === 'GET' && versionMatch) {
    const processKey = decodeURIComponent(versionMatch[1])
    const flow = flows.find((item) => item.flowCode === processKey || item.flowId === processKey)
    return versions.filter((item) => item.flowId === flow?.flowId).map((item) => ({
      processKey,
      processName: flow?.flowName || processKey,
      processStatus: item.versionStatusName,
      processVersion: item.versionNo,
    }))
  }

  const pkgMatch = path.match(/^\/copy\/pkg\/([^/]+)\/([^/]+)$/)
  if (method === 'GET' && pkgMatch) {
    const processKey = decodeURIComponent(pkgMatch[1])
    const processVersion = decodeURIComponent(pkgMatch[2])
    return targetFolders.map((folder) => ({
      pkgId: folder.folderId,
      pkgName: folder.folderName,
      processKey,
      processVersion,
      referenced: false,
    }))
  }

  if (method === 'POST' && path === '/copy/resources') {
    const version = versions.find((item) => item.versionNo === body?.sourceProcessVersion || item.versionId === body?.sourceProcessVersion)
    const preset = presetMap[version?.resourcePreset] || presetMap.empty
    const match = (item) => includesKeyword(item.resourceName, body?.name) || includesKeyword(item.resourceCode, body?.name)
    if (body?.resourceType === 'COMPONENT') {
      const componentItems = Object.values(resources).filter((item) => item.resourceType === 'COMPONENT' && preset.components.includes(item.resourceId)).filter(match)
      const componentTypeNames = {
        CODE_COMPONENT: '代码组件',
        DECISION_TABLE: '决策表',
        CROSS_DECISION_TABLE: '交叉决策表',
      }
      const groupedComponents = componentItems.reduce((acc, item) => {
        const type = item.componentType || 'CODE_COMPONENT'
        if (!acc[type]) acc[type] = []
        acc[type].push(item)
        return acc
      }, {})
      return Object.entries(groupedComponents).map(([type, items]) => ({
        groupType: 'COMPONENT_TYPE',
        groupId: type,
        groupName: componentTypeNames[type] || type,
        resourceDetails: items.map((item) => ({
          id: item.resourceId,
          code: item.resourceCode,
          name: item.resourceName,
          module: 'CODE',
        })),
      })).filter((group) => group.resourceDetails.length)
    }
    return packages
      .filter((item) => preset.packages.includes(item.groupId))
      .map((pkg) => ({
        groupType: 'RULE_PACKAGE',
        pkgId: pkg.groupId,
        pkgName: pkg.groupName,
        resourceDetails: pkg.rules.map((id) => resources[id]).filter(Boolean).filter(match).map((item) => ({
          id: item.resourceId,
          code: item.resourceCode,
          name: item.resourceName,
          module: 'RULE',
        })),
      }))
      .filter((group) => group.resourceDetails.length)
  }

  if (method === 'POST' && path === '/copy/copyValidated') return toBackendSelectView(body || {})
  if (method === 'POST' && path === '/copy/copySave') return toBackendSaveView(body || {})

  throw new Error(`Mock ??????${method} ${path}`)
}

export async function getCopyContext() {
  return getLocalCopyContext()
}

export async function listProjects({ keyword = '', pageNo = 1, pageSize = 20 } = {}) {
  const list = await request(`/copy/projects/${encodeURIComponent(keyword || '')}`)
  return normalizeProjectList(list, pageNo, pageSize)
}

export async function listDecisionFlows(projectId, { keyword = '', pageNo = 1, pageSize = 20 } = {}) {
  const projectName = projectNameById.get(projectId) || projectId || ''
  const list = await request(`/copy/process/${encodeURIComponent(projectName)}/${encodeURIComponent(keyword || '')}`)
  return normalizeFlowList(list, projectId, pageNo, pageSize)
}

export async function listFlowVersions(flowId) {
  const list = await request(`/copy/version/${encodeURIComponent(flowId)}`)
  return normalizeVersionList(list, flowId)
}

export async function getSourceResources({ sourceVersionId, sourceProcessKey, keyword = '', resourceType = 'RULE' }) {
  const processKey = sourceProcessKey || versionProcessKeyByVersion.get(sourceVersionId) || ''
  const list = await request('/copy/resources', {
    method: 'POST',
    body: {
      name: keyword,
      sourceProcessKey: processKey,
      sourceProcessVersion: sourceVersionId,
    },
    mockBody: {
      name: keyword,
      sourceProcessKey: processKey,
      sourceProcessVersion: sourceVersionId,
      resourceType,
    },
  })
  return normalizeSourceResources(list, sourceVersionId, resourceType)
}

function toSelectableResource(item) {
  return {
    resourceId: item.resourceId,
    resourceType: item.resourceType,
    componentType: item.componentType,
    resourceCode: item.resourceCode,
    resourceName: item.resourceName,
    refCount: item.refs?.length || 0,
    selectable: true,
  }
}

export async function createCopyPlan(payload) {
  const selectRequest = toResourceCopySelectRequest(payload)
  const selectView = await request('/copy/copyValidated', { method: 'POST', body: selectRequest })
  const folders = await listTargetPackages(selectRequest.targetProcessKey, selectRequest.targetProcessVersion)
  return toFrontendPlan(selectView, selectRequest, folders)
}

async function listTargetPackages(processKey, processVersion) {
  if (!processKey || !processVersion) return targetFolders
  const list = await request(`/copy/pkg/${encodeURIComponent(processKey)}/${encodeURIComponent(processVersion)}`)
  return normalizePkgList(list)
}

export async function saveCopyResources(plan, resolution) {
  const saveRequest = toResourceCopySaveRequest(plan, resolution)
  const result = await request('/copy/copySave', { method: 'POST', body: saveRequest })
  const saveId = `SAVE_${Date.now()}`
  saveResults.set(saveId, { saveRequest, result })
  return {
    saveId,
    status: 'SUCCESS',
    progress: 100,
    message: '拷贝完成',
    result,
  }
}
