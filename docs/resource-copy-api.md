# 跨场景资源拷贝接口设计

## 1. 设计目标

跨场景资源拷贝涉及规则、组件、参数、变量/模型等资源之间的递归依赖与冲突判断。前端只负责选择、展示和提交用户决策，不负责复杂业务判断。

后端负责：

- 来源资源查询与分组
- 递归依赖收集
- 资源冲突判断
- 复制/复用/重命名/终止/直接调用方案生成
- 达成率计算
- 血缘树构建
- 重命名唯一性校验
- 目标规则包文件夹校验/创建
- 拷贝任务执行与进度维护

前端负责：

- 来源项目、决策流、版本选择
- 规则/组件选择
- 展示后端返回的预检计划
- 收集重命名与规则包归类
- 调用执行接口并展示进度/结果

---

## 2. 通用枚举

### VersionStatus

| 值 | 名称 |
|---|---|
| `DRAFT` | 草稿 |
| `EFFECTIVE` | 生效 |
| `GRAY` | 灰度 |
| `OFFLINE` | 下线 |

### ResourceType

| 值 | 名称 |
|---|---|
| `RULE` | 规则 |
| `COMPONENT` | 计算组件 |
| `INPUT_PARAM` | 输入参数 |
| `RULE_TAG` | 规则标签 |
| `FLOW_CACHE` | 流程缓存 |
| `VARIABLE` | 变量 |
| `MODEL` | 模型 |

### ComponentType

| 值 | 名称 |
|---|---|
| `CROSS_DECISION_TABLE` | 交叉决策表 |
| `DECISION_TABLE` | 决策表 |
| `CODE_COMPONENT` | 代码组件 |

### CopyAction

| 值 | 名称 | 说明 |
|---|---|---|
| `COPY` | 复制 | 目标无同编码资源，复制到目标版本 |
| `REUSE` | 复用 | 目标已有同编码且定义一致的资源 |
| `RENAME` | 重命名 | 规则编码冲突，可改名后复制 |
| `TERMINATE` | 冲突终止 | 冲突无法自动解决，阻断相关根资源拷贝 |
| `DIRECT_REF` | 直接调用 | 变量/模型等公共资源不复制，仅引用 |

### PlanStatus

| 值 | 名称 |
|---|---|
| `CHECKING` | 校验中 |
| `CHECKED` | 已校验 |
| `EXPIRED` | 已过期 |
| `CANCELLED` | 已取消 |

### TaskStatus

| 值 | 名称 |
|---|---|
| `PENDING` | 待执行 |
| `RUNNING` | 执行中 |
| `SUCCESS` | 成功 |
| `FAILED` | 失败 |
| `CANCELLED` | 已取消 |

---

## 3. 接口列表

### 3.1 查询当前目标上下文

`GET /api/decision-copy/context`

用于弹窗顶部展示当前拷贝目标。此功能在目标场景内发起，前端不再选择目标场景。

Response:

```json
{
  "target": {
    "projectId": "P_TARGET",
    "projectName": "零售信贷项目",
    "flowId": "F_TARGET",
    "flowCode": "credit_main",
    "flowName": "信贷决策流",
    "versionId": "V_TARGET",
    "versionNo": "v3",
    "versionStatus": "EFFECTIVE",
    "versionStatusName": "生效",
    "sceneId": "S3",
    "sceneName": "生产场景"
  }
}
```

---

### 3.2 查询来源项目

`GET /api/projects`

Query:

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `keyword` | string | 否 | 按项目名称检索 |
| `pageNo` | number | 否 | 默认 1 |
| `pageSize` | number | 否 | 默认 20 |

Response:

```json
{
  "items": [
    { "projectId": "P1", "projectName": "零售信贷项目" }
  ],
  "pageNo": 1,
  "pageSize": 20,
  "total": 1
}
```

---

### 3.3 查询来源决策流

`GET /api/projects/{projectId}/decision-flows`

Query:

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `keyword` | string | 否 | 按决策流编码或名称检索 |
| `pageNo` | number | 否 | 默认 1 |
| `pageSize` | number | 否 | 默认 20 |

Response:

```json
{
  "items": [
    {
      "flowId": "F1",
      "flowCode": "credit_apply",
      "flowName": "授信申请决策流"
    }
  ],
  "total": 1
}
```

---

### 3.4 查询来源版本

`GET /api/decision-flows/{flowId}/versions`

Response:

```json
{
  "items": [
    {
      "versionId": "V1",
      "versionNo": "v5",
      "versionStatus": "EFFECTIVE",
      "versionStatusName": "生效",
      "createdAt": "2026-07-01 10:00:00"
    }
  ]
}
```

---

### 3.5 查询来源可选资源树

`GET /api/decision-copy/source-resources`

Query:

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `sourceVersionId` | string | 是 | 来源版本 ID |
| `keyword` | string | 否 | 按编码或名称检索 |
| `resourceTypes` | string | 否 | 默认 `RULE,COMPONENT` |

Response:

```json
{
  "sourceVersionId": "V1",
  "groups": [
    {
      "groupType": "RULE_PACKAGE",
      "groupId": "PKG1",
      "groupName": "信贷审批规则包",
      "items": [
        {
          "resourceId": "R001",
          "resourceType": "RULE",
          "resourceCode": "R001",
          "resourceName": "信用评分规则",
          "refCount": 5,
          "selectable": true
        }
      ]
    }
  ]
}
```

前端只展示该资源树，不展开和判断完整依赖。

---

### 3.6 创建拷贝预检计划

`POST /api/decision-copy/plans`

后端在此接口内完成所有复杂判断。

Request:

```json
{
  "sourceVersionId": "V1",
  "targetVersionId": "V_TARGET",
  "selectedResources": [
    { "resourceId": "R001", "resourceType": "RULE" },
    { "resourceId": "R002", "resourceType": "RULE" }
  ]
}
```

Response:

```json
{
  "planId": "CP_20260703_0001",
  "status": "CHECKED",
  "summary": {
    "selectedRootCount": 5,
    "copyableRootCount": 4,
    "blockedRootCount": 1,
    "achievementRate": 80,
    "dependencyActionCounts": {
      "COPY": 18,
      "REUSE": 2,
      "RENAME": 2,
      "DIRECT_REF": 1,
      "TERMINATE": 3
    }
  },
  "rootResults": [
    {
      "resourceId": "R001",
      "resourceCode": "R001",
      "resourceName": "信用评分规则",
      "resourceType": "RULE",
      "copyable": false,
      "action": "TERMINATE",
      "reason": "分支含冲突，根资源跳过",
      "blockerResourceIds": ["FC01", "C001"]
    }
  ],
  "conflicts": [
    {
      "conflictId": "CF_001",
      "resourceId": "FC01",
      "resourceType": "FLOW_CACHE",
      "resourceCode": "FC01",
      "resourceName": "缓存-评分中间值",
      "action": "TERMINATE",
      "reason": "流程缓存定义不一致，终止引用它的拷贝",
      "affectedRootIds": ["R001"],
      "affectedRootNames": ["信用评分规则"],
      "diffs": [
        {
          "field": "defaultValue",
          "fieldName": "默认值",
          "sourceValue": "0",
          "targetValue": "100"
        }
      ],
      "availableResolutions": ["SKIP_AFFECTED_COPY"]
    }
  ],
  "lineageTrees": [
    {
      "nodeId": "N_R001",
      "resourceId": "R001",
      "resourceType": "RULE",
      "resourceCode": "R001",
      "resourceName": "信用评分规则",
      "action": "TERMINATE",
      "reason": "分支含冲突，根资源跳过",
      "children": []
    }
  ],
  "targetFolders": [
    { "folderId": "FOLDER_DEFAULT", "folderName": "默认文件夹" },
    { "folderId": "FOLDER_RISK", "folderName": "风控类" }
  ]
}
```

---

### 3.7 校验用户解决方案

`POST /api/decision-copy/plans/{planId}/validate-resolution`

Request:

```json
{
  "renames": [
    {
      "resourceId": "R002",
      "newResourceCode": "R002_COPY",
      "newResourceName": "风险等级规则_复制"
    }
  ],
  "folderAssignments": [
    {
      "rootResourceId": "R002",
      "folderId": "FOLDER_DEFAULT"
    },
    {
      "rootResourceId": "R003",
      "folderName": "新建规则包",
      "createIfAbsent": true
    }
  ]
}
```

Response:

```json
{
  "valid": true,
  "errors": [],
  "updatedSummary": {
    "copyableRootCount": 4,
    "blockedRootCount": 1,
    "achievementRate": 80
  }
}
```

校验失败：

```json
{
  "valid": false,
  "errors": [
    {
      "field": "renames[0].newResourceCode",
      "resourceId": "R002",
      "errorCode": "DUPLICATE_CODE",
      "message": "目标版本中已存在编码 R002_COPY"
    }
  ]
}
```

---

### 3.8 执行拷贝

`POST /api/decision-copy/plans/{planId}/execute`

Request:

```json
{
  "renames": [
    {
      "resourceId": "R002",
      "newResourceCode": "R002_COPY",
      "newResourceName": "风险等级规则_复制"
    }
  ],
  "folderAssignments": [
    {
      "rootResourceId": "R002",
      "folderId": "FOLDER_DEFAULT"
    }
  ],
  "idempotencyKey": "uuid-from-frontend"
}
```

Response:

```json
{
  "taskId": "TASK_20260703_0001",
  "status": "RUNNING"
}
```

如果目标版本资源已经变化：

```json
{
  "errorCode": "PLAN_EXPIRED",
  "message": "目标版本资源已变化，请重新校验后再拷贝"
}
```

---

### 3.9 查询拷贝任务进度

`GET /api/decision-copy/tasks/{taskId}`

Response:

```json
{
  "taskId": "TASK_20260703_0001",
  "status": "SUCCESS",
  "progress": 100,
  "currentStage": "DONE",
  "message": "拷贝完成",
  "result": {
    "copiedCount": 14,
    "renamedCopiedCount": 1,
    "reusedCount": 2,
    "directRefCount": 1,
    "skippedRootCount": 1,
    "copiedResources": [
      {
        "sourceResourceId": "R002",
        "targetResourceId": "R002_NEW",
        "targetResourceCode": "R002_COPY",
        "resourceType": "RULE"
      }
    ]
  }
}
```

---

### 3.10 取消预检计划

`DELETE /api/decision-copy/plans/{planId}`

Response:

```json
{ "success": true }
```

---

## 4. 前端改造边界

前端保留：

- 必填校验
- 控件状态控制
- 搜索关键字传递
- 接口 loading/error 状态
- 根据 `action` 展示标签与颜色

前端移除：

- 递归依赖收集
- 冲突判断
- 字段 diff 判断
- 根资源阻断传播
- 达成率计算
- 血缘树生成
- 拷贝完成数量计算
- 重命名唯一性判断

---

## 5. 接口错误码建议

| 错误码 | 场景 |
|---|---|
| `SOURCE_VERSION_NOT_FOUND` | 来源版本不存在 |
| `TARGET_VERSION_NOT_FOUND` | 目标版本不存在 |
| `RESOURCE_NOT_FOUND` | 选择的资源不存在 |
| `PLAN_NOT_FOUND` | 预检计划不存在 |
| `PLAN_EXPIRED` | 预检计划已过期，需要重新校验 |
| `DUPLICATE_CODE` | 新编码重复 |
| `INVALID_RESOURCE_STATE` | 资源状态不允许拷贝 |
| `COPY_TASK_FAILED` | 拷贝任务失败 |
