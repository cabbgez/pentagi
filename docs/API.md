# PentAGI 接口文档

面向第三方系统对接与自动化调用。基于 `backend/pkg/server` 源码与本机运行实例实测整理。

---

## 1. 快速开始

```bash
# 1) 确认服务可用 + 拿到 provider 名字
curl -s http://<host>:8081/api/v1/providers/ -H "Authorization: Bearer $TOKEN"

# 2) 发起一个任务流
curl -s -X POST http://<host>:8081/api/v1/flows/ \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"input":"扫描 example.com 的开放端口","provider":"deepseek"}'

# 3) 轮询状态直到 finished / failed / waiting
curl -s http://<host>:8081/api/v1/flows/1 -H "Authorization: Bearer $TOKEN"

# 4) 取容器内实际执行的命令
curl -s "http://<host>:8081/api/v1/flows/1/termlogs/?page=1&type=page" -H "Authorization: Bearer $TOKEN"
```

| 项目 | 值 |
|---|---|
| Base URL | `http://<host>:8081/api/v1` |
| 在线调试（Swagger UI） | `GET /api/v1/swagger/index.html` |
| GraphQL Playground | `GET /api/v1/graphql/playground` |
| 请求体格式 | `application/json`（文件上传除外） |
| 请求超时 | **30 秒**（超时返回 504，见 §4.3） |

---

## 2. 调用前必须知道的 3 个坑

### 2.1 集合接口必须带尾斜杠

路由注册为 `/flows/`，访问 `/flows` 会返回 **307 重定向**：

```
POST /api/v1/flows          →  HTTP 307, Location: /api/v1/flows/
POST /api/v1/flows/         →  HTTP 201
```

很多 HTTP 客户端（curl 不带 `-L`、Java HttpClient、部分 Go 客户端）不会对 307 重放 body，会表现为「请求莫名其妙失败」。**统一带上尾斜杠。**

### 2.2 列表接口 `page` 和 `type` 是必填

```bash
GET /api/v1/flows/                       → 400 {"code":"Flows.InvalidRequest"}
GET /api/v1/flows/?page=1&type=page      → 200
```

不带参数不会返回「默认第一页」，而是直接报错。

### 2.3 认证分层：API Token 不能调账号管理接口

详见 §3.2。

---

## 3. 鉴权

### 3.1 三个层级

| 层级 | 中间件 | 接受的身份 | 覆盖范围 |
|---|---|---|---|
| 公开 | `tryAuth` | 匿名可用（有凭证则识别） | `/info`、`/auth/*`、`/swagger/*`、`/graphql/playground` |
| **token 层** | `authTokenRequired` | **API Token** 或 **Cookie 会话** | 绝大多数业务接口（flows/tasks/logs/graphql/...） |
| **user 层** | `authUserRequired` | **仅 Cookie 会话** | `/users/*`、`/roles/*`、`/tokens/*`、`PUT /user/password|email|name` |

> **设计意图**：账号与凭证管理接口刻意不放在 token 层——否则一个 API Token 就能给自己创建管理员账号，越权不可控。所以「用 Token 调 `/tokens`」必然 403，这是预期行为。

### 3.2 用 API Token 对接（第三方推荐）

**前置条件**：`COOKIE_SIGNING_SALT` 不能为空或默认值 `salt`，否则 Token 的创建与校验都会被禁用：

```
POST /tokens/  →  400 {"code":"Token.CreationDisabled"}
```

**申请步骤**：

```bash
# ① 用 Cookie 会话登录（只有 Cookie 能调 /tokens）
curl -s -c cookie.txt -X POST http://<host>:8081/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"mail":"admin@example.com","password":"<password>"}'

# ② 创建 Token（ttl 单位：秒，60 ~ 94608000，即 1 分钟 ~ 3 年）
curl -s -b cookie.txt -X POST http://<host>:8081/api/v1/tokens/ \
  -H 'Content-Type: application/json' \
  -d '{"name":"ci-pipeline","ttl":2592000}'
```

响应（**`token` 字段只在创建时返回一次，之后任何接口都查不到，必须立即保存**）：

```json
{
  "status": "success",
  "data": {
    "id": 1,
    "token_id": "a1b2c3d4e5",
    "user_id": 1,
    "role_id": 1,
    "name": "ci-pipeline",
    "ttl": 2592000,
    "status": "active",
    "created_at": "2026-10-16T09:31:14Z",
    "updated_at": "2026-10-16T09:31:14Z",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...."
  }
}
```

**使用方式**：

```
Authorization: Bearer <token>
```

**Token 关键行为**（务必了解失效条件）：

| 行为 | 说明 |
|---|---|
| 携带的权限 | 签发时快照用户的角色权限 `rid` + `uhash` |
| 改密码后 | **立即失效**（`uhash` 不匹配，返回 403 `Auth.TokenExpired`/`token is invalid`） |
| 数据库重建后 | **立即失效**（同上） |
| 用户被禁用/删除 | **立即失效** |
| 撤销 | `PUT /tokens/{tokenID}` body `{"status":"revoked"}` |
| 删除 | `DELETE /tokens/{tokenID}`（软删除） |
| 与浏览器会话的关系 | **互不影响**：Token 不是浏览器会话，踢下线不会让它失效 |
| 并发上限 | `max_ttl` 见 `ttl` 校验区间；同用户同名 Token 不允许重复创建 |

Token 载荷（JWT claims）：`tid`(10 位 Token ID)、`rid`(角色)、`uid`(用户)、`uhash`(用户哈希)、`exp`(过期时间)。

### 3.3 用 Cookie 会话

```bash
curl -s -c cookie.txt -X POST http://<host>:8081/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"mail":"admin@example.com","password":"<password>"}'
```

- 会话有效期 **4 小时**（`sessionTimeout`），后续请求带 `Set-Cookie`
- Cookie 名带前缀，由 `TENANT_ID` 决定（多实例同主机部署时用于隔离，因为 Cookie 按 host 而非 port 区分）
- **修改密码 / 邮箱必须用 Cookie**（token 层调不通）；修改显示名 `PUT /user/name` 也仅 Cookie

### 3.4 开发模式：`DISABLE_AUTH=true`

开启后所有鉴权守卫被替换为「自动放行」，请求会被**伪装成某个真实用户**（`AUTH_BYPASS_USER` 指定；未指定则回落到第一个管理员）并赋予其全部权限。

- 本机/内网调试用，**公网暴露等于完全无鉴权**
- 权限校验、数据归属（`user_id`）依然按该用户生效，行为与正常登录一致
- 本机当前实例即处于该模式（`DISABLE_AUTH=true`），因此前面示例中的 curl 未带凭证

---

## 4. 响应约定

### 4.1 成功

```json
{ "status": "success", "data": { ... } }
```

`data` 结构随接口而定；单条返回对象，列表返回 `{ "<资源名>": [...], "total": N }`。

### 4.2 失败

```json
{ "status": "error", "code": "Flows.NotFound", "msg": "flow not found" }
```

- `code` 是**稳定的机器可读标识**，请基于它做逻辑分支，不要匹配 `msg`
- HTTP 状态码同时具备语义（400/401/403/404/409/429/500/503/504）
- 开发模式（`version.IsDevelopMode()`）下会额外带 `error` 字段给出原始错误，生产环境无此字段

### 4.3 请求超时

所有 `/api/v1` 请求有 **30 秒** deadline。超时返回：

```json
{ "status": "error", "code": "RequestTimeout",
  "msg": "the server took too long to answer; the action may still be running" }
```

> **重要**：超时不代表操作没执行。Agent 任务本身是长时异步的，超时只终止了这一次 HTTP 等待。正确做法是**创建后轮询**，而不是靠单次请求等结果。

---

## 5. 列表查询（分页 / 过滤 / 排序）

所有列表接口统一使用同一套 query 参数（`rdb.TableQuery`）。

### 5.1 参数

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `page` | int | **是** | 1 | 页码，从 1 开始 |
| `pageSize` | int | 否 | 5 | 每页条数，最大 1000；`-1` 表示不限 |
| `type` | enum | **是** | `init` | `init` \| `page` \| `size` \| `sort` \| `filter` |
| `filters[i][field]` | string | 否 | - | 字段名（各接口白名单不同） |
| `filters[i][operator]` | enum | 否 | `like` | `<` `<=` `>=` `>` `=` `!=` `like` `not like` `in` |
| `filters[i][value]` | any | 否 | - | 值；`in` / `not like` 传数组 |
| `sort[i][prop]` | string | 否 | - | 排序字段 |
| `sort[i][order]` | enum | 否 | - | `ascending` \| `descending` |
| `group` | string | 否 | - | 分组字段 |

**默认行为**：排序默认按 `id DESC`；字符串比较自动转小写；`like` 会自动加 `%...%`；数字型字段（`id`、`*_id`、`*_at`）默认用 `=` 而非 `like`。

### 5.2 示例

```bash
# 第 1 页，每页 20 条
?page=1&type=page&pageSize=20

# 状态为 running 或 waiting
?page=1&type=page&filters[0][field]=status&filters[0][operator]=in&filters[0][value][]=running&filters[0][value][]=waiting

# 标题包含 "scan"，按创建时间倒序
?page=1&type=page&filters[0][field]=title&filters[0][operator]=like&filters[0][value]=scan&sort[0][prop]=created_at&sort[0][order]=descending
```

> curl 中 `[` `]` 需 URL 编码为 `%5B` `%5D`，否则可能被 shell 或中间层截断。

### 5.3 响应

```json
{ "status": "success", "data": { "flows": [ ... ], "total": 1 } }
```

`total` 是**过滤后**的总数，与 `pageSize` 无关。

---

## 6. 核心概念：Flow（任务流）

### 6.1 状态机

```
created ──► running ──► waiting ──► running ──► ...   (可多轮交互)
                │           │
                └───────────┴──► finished
                            └──► failed
```

| 状态 | 含义 |
|---|---|
| `created` | 已创建，等待调度（首次会拉取沙箱镜像，可能停留 1~2 分钟） |
| `running` | Agent 正在执行 |
| `waiting` | **任务已完成，流仍存活**，等待你投喂下一个指令或结束它 |
| `finished` | 正常结束 |
| `failed` | 执行失败 |

> `waiting` 不是「卡住」。它是 Flow 作为多轮容器的正常存活态。要收尾需显式调用 `finish`，否则沙箱容器会一直占用资源。

### 6.2 生命周期操作（`PUT /flows/{flowID}`）

| action | 说明 | 附加字段 |
|---|---|---|
| `stop` | 中断当前执行 | - |
| `finish` | 结束并归档流 | - |
| `input` | 追加用户输入，继续下一轮 | `input`（必填）, `provider`（可选，可中途换模型） |
| `rename` | 重命名 | `name`（必填） |
| `report` | 生成报告 | - |

`timeout` 可选，范围 30 ~ 7200 秒。

### 6.3 观测流的执行细节

一个 Flow 的完整轨迹分散在多个子资源，对接时按需读取：

| 端点 | 内容 |
|---|---|
| `GET /flows/{id}/status` | **状态 + 全部任务 + 全部子任务（含 `result`）**，对接轮询用这个 |
| `GET /flows/{id}/tasks/` | 任务拆解与状态 |
| `GET /flows/{id}/tasks/{taskID}/graph` | 任务-子任务图 |
| `GET /flows/{id}/subtasks/` | 子任务 |
| `GET /flows/{id}/termlogs/` | **沙箱容器内实际执行的命令与输出** |
| `GET /flows/{id}/msglogs/` | 模型对话/产出（含 report） |
| `GET /flows/{id}/agentlogs/` | Agent 思考日志 |
| `GET /flows/{id}/assistantlogs/` | 辅助 Agent 日志 |
| `GET /flows/{id}/screenshots/` | 浏览器截图（含 `/file` 取二进制） |
| `GET /flows/{id}/containers/` | 沙箱容器 |
| `GET /flows/{id}/toolcalls/` | 工具调用记录 |
| `GET /flows/{id}/searchlogs/` | 联网检索记录 |
| `GET /flows/{id}/vecstorelogs/` | 向量库操作记录 |
| `GET /flows/{id}/usage/` | 该流的 token 用量 |

### 6.4 一次取回结果：`GET /flows/{flowID}/status`

给第三方对接用的聚合接口：**一次返回流状态、全部任务、全部子任务**，不分页，也不返回模型配置与归属信息。

```bash
curl -s http://<host>:8081/api/v1/flows/1/status -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": "success",
  "data": {
    "id": 1,
    "status": "waiting",
    "title": "扫描 example.com",
    "created_at": "2026-10-19T10:00:00Z",
    "updated_at": "2026-10-19T10:05:00Z",
    "tasks": [
      {
        "id": 10,
        "status": "finished",
        "title": "信息收集",
        "input": "扫描 example.com 的开放端口",
        "result": "开放端口：80, 443",
        "created_at": "2026-10-19T10:00:10Z",
        "updated_at": "2026-10-19T10:01:00Z",
        "subtasks": [
          {
            "id": 20,
            "status": "finished",
            "title": "端口扫描",
            "description": "nmap -sV example.com",
            "result": "80/tcp open http\n443/tcp open https",
            "created_at": "2026-10-19T10:00:20Z",
            "updated_at": "2026-10-19T10:00:40Z"
          }
        ]
      }
    ]
  }
}
```

约定：

| 项 | 说明 |
|---|---|
| 顺序 | `tasks` 与 `subtasks` 均按 `id` 升序（创建先后） |
| 空值 | 没有任务/子任务时返回 `[]`，不是 `null` |
| 权限 | 需 `flows.view` + `tasks.view` + `subtasks.view`；缺任一返回 **403**，不会静默返回空任务 |
| 跨用户 | `flows.admin` / `tasks.admin` / `subtasks.admin` 可读任意用户 |
| 不包含 | 模型配置、`user_id`、子任务 `context`（内部规划态） |
| 体积 | 全量返回；只需要状态时用 `GET /flows/{id}` |

> `result` 在任务/子任务 **finished 之后才有内容**，`running` 阶段可能是空字符串。判断整体是否结束看顶层 `status`：`waiting` / `finished` / `failed`。

---

## 7. 端到端示例

已在真实实例验证通过（`deepseek` provider，沙箱容器内正确处理并返回）。

```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="http://localhost:8081/api/v1"
AUTH="Authorization: Bearer $TOKEN"   # DISABLE_AUTH=true 时可省略

# ① 选 provider
curl -s "$BASE/providers/" -H "$AUTH"
# → {"data":{"providers":[{"name":"deepseek","type":"deepseek"}]}}

# ② 创建任务流
FLOW=$(curl -s -X POST "$BASE/flows/" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"input":"执行命令 echo hello 并返回输出，然后立即结束任务。","provider":"deepseek"}')
FLOW_ID=$(echo "$FLOW" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["id"])')
echo "flow_id=$FLOW_ID"

# ③ 轮询直到不再是 created/running（/status 同时带回任务与子任务结果）
while :; do
  ST=$(curl -s "$BASE/flows/$FLOW_ID/status" -H "$AUTH" \
       | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["status"])')
  echo "status=$ST"
  case "$ST" in waiting|finished|failed) break;; esac
  sleep 5
done

# ④ 取容器内执行记录
curl -s "$BASE/flows/$FLOW_ID/termlogs/?page=1&type=page" -H "$AUTH"
# terminal: "/work $ echo hello; echo \"exit_code=$?\"\nhello\nexit_code=0"

# ⑤ 取最终报告
curl -s "$BASE/flows/$FLOW_ID/msglogs/?page=1&type=page&filters[0][field]=type&filters[0][operator]=in&filters[0][value][]=report" -H "$AUTH"

# ⑥ 收尾：结束并释放沙箱容器
curl -s -X PUT "$BASE/flows/$FLOW_ID" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"action":"finish"}'
```

---

## 8. 接口清单

> 标注 `[user]` 的接口**仅接受 Cookie 会话**，API Token 调用返回 403。
> 未标注的均在 token 层，API Token 可用。

### 8.1 系统与鉴权（公开）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/info` | 服务/版本/当前用户信息 |
| POST | `/auth/login` | 账号密码登录 |
| POST | `/auth/logout` | 登出 |
| GET | `/auth/authorize` | 发起 OAuth 授权 |
| GET | `/auth/login-callback` | OAuth 回调（GET） |
| POST | `/auth/login-callback` | OAuth 回调（POST） |
| POST | `/auth/logout-callback` | OAuth 登出回调 |
| GET | `/graphql/playground` | GraphQL 调试界面 |
| GET | `/swagger/*any` | Swagger UI |

### 8.2 当前用户

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/user/` | 获取当前用户 |
| PUT | `/user/password` **[user]** | 改密码（仅本地用户） |
| PUT | `/user/email` **[user]** | 改邮箱（仅本地用户） |
| PUT | `/user/name` **[user]** | 改显示名 |

### 8.3 用户与角色 **[user]**

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/users/` | 用户列表 |
| POST | `/users/` | 创建用户 |
| GET | `/users/{hash}` | 用户详情 |
| PUT | `/users/{hash}` | 修改用户 |
| DELETE | `/users/{hash}` | 删除用户 |
| GET | `/roles/` | 角色列表 |
| GET | `/roles/{roleID}` | 角色详情 |

### 8.4 API Token **[user]**

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/tokens/` | 创建 Token（返回密文，仅此一次） |
| GET | `/tokens/` | Token 列表（普通用户仅见自己的） |
| GET | `/tokens/{tokenID}` | Token 详情 |
| PUT | `/tokens/{tokenID}` | 改名 / 撤销（`status`） |
| DELETE | `/tokens/{tokenID}` | 删除 |

### 8.5 Provider 与设置

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/providers/` | **可用 provider 列表**（`name` 即创建流时要传的值） |
| GET | `/settings/` | 平台设置 |

### 8.6 Flow

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/flows/` | 创建任务流 |
| GET | `/flows/` | 任务流列表 |
| GET | `/flows/{flowID}` | 详情 |
| GET | `/flows/{flowID}/status` | **状态 + 全部任务 + 全部子任务（对接轮询推荐）** |
| GET | `/flows/{flowID}/graph` | 流-任务-子任务全景图 |
| PUT | `/flows/{flowID}` | stop / finish / input / rename / report |
| DELETE | `/flows/{flowID}` | 删除 |

**`POST /flows/` 请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `input` | string | 是 | 首个任务的用户输入 |
| `provider` | string | 是 | provider 名，取自 `GET /providers/` |
| `functions` | object | 否 | 功能开关 |
| `resource_ids` | int[] | 否 | 预挂载的资源库文件 |

### 8.7 Flow 文件与资源

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/flows/{flowID}/files/` | 流的文件列表 |
| GET | `/flows/{flowID}/files/container` | **容器内**文件列表 |
| POST | `/flows/{flowID}/files/` | 上传文件到流 |
| DELETE | `/flows/{flowID}/files/` | 删除流内文件 |
| GET | `/flows/{flowID}/files/download` | 下载流内文件 |
| POST | `/flows/{flowID}/files/pull` | 从容器拉取文件 |
| POST | `/flows/{flowID}/files/resources` | 把资源挂到流 |
| POST | `/flows/{flowID}/files/to-resources` | 把流内文件存为资源 |
| GET | `/resources/` | 资源库列表 |
| POST | `/resources/` | 上传资源 |
| POST | `/resources/mkdir` | 建目录 |
| PUT | `/resources/move` | 移动/重命名 |
| POST | `/resources/copy` | 复制 |
| DELETE | `/resources/` | 删除 |
| GET | `/resources/download` | 下载 |

### 8.8 任务与子任务

| 方法 | 路径 |
|---|---|
| GET | `/flows/{flowID}/tasks/` |
| GET | `/flows/{flowID}/tasks/{taskID}` |
| GET | `/flows/{flowID}/tasks/{taskID}/graph` |
| GET | `/flows/{flowID}/subtasks/` |
| GET | `/flows/{flowID}/tasks/{taskID}/subtasks/` |
| GET | `/flows/{flowID}/tasks/{taskID}/subtasks/{subtaskID}` |

> 轮询取结果优先用 §6.4 的 `GET /flows/{flowID}/status`，一次拿到状态 + 全部任务 + 子任务，不必逐个任务翻页。

### 8.9 执行观测

| 方法 | 全局 | 按流 |
|---|---|---|
| GET | `/msglogs/` | `/flows/{flowID}/msglogs/` |
| GET | `/termlogs/` | `/flows/{flowID}/termlogs/` |
| GET | `/agentlogs/` | `/flows/{flowID}/agentlogs/` |
| GET | `/assistantlogs/` | `/flows/{flowID}/assistantlogs/` |
| GET | `/searchlogs/` | `/flows/{flowID}/searchlogs/` |
| GET | `/vecstorelogs/` | `/flows/{flowID}/vecstorelogs/` |
| GET | `/screenshots/` | `/flows/{flowID}/screenshots/` |
| GET | `/containers/` | `/flows/{flowID}/containers/` |
| GET | `/toolcalls/` | `/flows/{flowID}/toolcalls/` |

补充：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/flows/{flowID}/containers/{containerID}` | 容器详情 |
| GET | `/flows/{flowID}/toolcalls/{toolcallID}` | 工具调用详情 |
| GET | `/flows/{flowID}/screenshots/{screenshotID}` | 截图元数据 |
| GET | `/flows/{flowID}/screenshots/{screenshotID}/file` | 截图二进制（`Content-Length` 已设置，可直链下载） |

### 8.10 辅助 Agent

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/flows/{flowID}/assistants/` | 列表 |
| GET | `/flows/{flowID}/assistants/{assistantID}` | 详情 |
| POST | `/flows/{flowID}/assistants/` | 创建（`flowID=0` 时连带创建新流） |
| PUT | `/flows/{flowID}/assistants/{assistantID}` | 修改 |
| DELETE | `/flows/{flowID}/assistants/{assistantID}` | 删除 |

### 8.11 提示词 / 知识库 / 其他

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/prompts/` | 提示词列表 |
| GET | `/prompts/{promptType}` | 提示词详情 |
| PUT | `/prompts/{promptType}` | 修改 |
| POST | `/prompts/{promptType}/default` | 重置为默认 |
| DELETE | `/prompts/{promptType}` | 删除 |
| GET | `/knowledge/` | 知识库文档列表 |
| GET | `/knowledge/{id}` | 文档详情 |
| POST | `/knowledge/` | 新建文档 |
| POST | `/knowledge/search` | 语义检索 |
| PUT | `/knowledge/{id}` | 更新 |
| DELETE | `/knowledge/{id}` | 删除 |
| POST | `/anonymize/text` | 文本脱敏 |
| GET | `/usage/` | 系统用量 |
| GET | `/usage/{period}` | 按周期用量 |
| GET | `/flows/{flowID}/usage/` | 单流用量 |

> **知识库依赖 Embedding provider**。未配置时，列表读取正常，但 `POST /knowledge/search` 与写入返回
> `503 Knowledge.StoreUnavailable`（`{"code":"Knowledge.StoreUnavailable","msg":"knowledge store (embedding provider) is not configured"}`）。
> 这是预期降级，不是接口故障。`POST /anonymize/text` 在未配脱敏器时才返回 `503 Anonymize.Unavailable`。

---

## 9. GraphQL

除 REST 外，平台提供等价的 GraphQL 入口，适合一次性拉取嵌套数据（流 + 任务 + 日志）。

| 项目 | 值 |
|---|---|
| Endpoint | `POST /api/v1/graphql`（`Any` 方法均可） |
| Playground | `GET /api/v1/graphql/playground` |
| 鉴权 | 与 REST 共用 token 层 |
| 实时推送 | Subscription over WebSocket |

```bash
curl -s -X POST http://localhost:8081/api/v1/graphql \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ providers { name type } }"}'
```

> 注意 GraphQL 的错误**不走** §4.2 的包裹格式，而是标准 GraphQL `errors[]`。混用时需分别处理。

---

## 10. 附录

### A. 常用错误码

| code | HTTP | 含义与处理 |
|---|---|---|
| `AuthRequired` | 403 | 未提供凭证 |
| `Auth.InvalidCredentials` | 401 | 账号或密码错误 |
| `Auth.TooManyAttempts` | 429 | 登录尝试过多，需退避 |
| `Auth.InactiveUser` | 403 | 用户被禁用 |
| `Auth.InvalidLoginRequest` | 400 | 登录参数不合法 |
| `Auth.TokenExpired` | 403 | Token 过期/失效，重新签发 |
| `NotPermitted` | 403 | 无权限 |
| `PrivilegesRequired` | 403 | 缺少所需权限点 |
| `AdminRequired` / `SuperRequired` | 403 | 需要管理员权限 |
| `Token.CreationDisabled` | 400 | `COOKIE_SIGNING_SALT` 为默认值，无法签发 Token |
| `Token.NotFound` | 404 | Token 不存在 |
| `Flows.NotFound` | 404 | 流不存在 |
| `Flows.InvalidRequest` | 400 | 参数不合法（**含漏传 `page`/`type`**） |
| `Flows.InputNotAccepted` | 503 | 流忙未接收输入，**且未启动，可安全重发** |
| `RequestTimeout` | 504 | 超时，动作可能仍在后台执行 |
| `Knowledge.StoreUnavailable` | 503 | 未配置 Embedding provider |
| `Anonymize.Unavailable` | 503 | 未配置脱敏器 |
| `Internal` | 500 | 服务内部错误 |

> `Flows.InputNotAccepted` 是唯一「重试无副作用」的失败：它意味着输入根本没进 worker，不会产生重复任务。

### B. 权限点清单

Token / 角色最终能做什么由权限点决定，命名规则为 `<资源>.<动作>`，`admin` 后缀通常表示「可跨用户操作」。

```
# Flow / 任务
flows.view  flows.create  flows.edit  flows.delete  flows.admin  flows.subscribe
tasks.view  tasks.admin  tasks.subscribe
subtasks.view  subtasks.admin
assistants.view  assistants.create  assistants.edit  assistants.delete  assistants.admin  assistants.subscribe
flow_files.view  flow_files.upload  flow_files.download  flow_files.edit  flow_files.delete  flow_files.admin  flow_files.subscribe

# 观测日志
msglogs.view  msglogs.admin  msglogs.subscribe
termlogs.view  termlogs.admin  termlogs.subscribe
agentlogs.view  agentlogs.admin  agentlogs.subscribe
assistantlogs.view  assistantlogs.admin  assistantlogs.subscribe
searchlogs.view  searchlogs.admin  searchlogs.subscribe
vecstorelogs.view  vecstorelogs.admin  vecstorelogs.subscribe
screenshots.view  screenshots.download  screenshots.admin  screenshots.subscribe
toolcalls.view  toolcalls.admin
containers.view  containers.admin

# 资源 / 知识库
resources.view  resources.upload  resources.download  resources.edit  resources.delete  resources.admin  resources.subscribe
knowledge.view  knowledge.create  knowledge.edit  knowledge.delete  knowledge.search  knowledge.admin  knowledge.subscribe
templates.view  templates.create  templates.edit  templates.delete  templates.admin  templates.subscribe

# 平台设置
settings.view  settings.admin
settings.tokens.view|create|edit|delete|admin|subscribe
settings.providers.view|edit|admin|subscribe
settings.prompts.view|edit|admin
settings.user.view|edit|admin|subscribe

# 用户 / 角色 / 其他
users.view  users.create  users.edit  users.delete
roles.view
providers.view  prompts.view  prompts.edit
usage.view  usage.admin
anonymize.call
pentagi.automation
```

### C. 部署侧前置条件

| 环境变量 | 影响 |
|---|---|
| `COOKIE_SIGNING_SALT` | **必须改动默认值**，否则 API Token 全链路禁用、Bearer 校验被跳过 |
| `DISABLE_AUTH` | `true` = 无鉴权放行（仅限可信内网） |
| `AUTH_BYPASS_USER` | `DISABLE_AUTH` 下的伪装用户邮箱 |
| `TENANT_ID` | 参与 Cookie/会话密钥派生与 Cookie 命名，多实例需区分 |
| `CORS_ORIGINS` | 跨域白名单；浏览器直连必配 |
| Embedding 相关变量 | 未配置时知识库/语义检索降级为 503 |

### D. 对接建议清单

1. **始终带尾斜杠**，避免 307 丢 body。
2. **列表接口固定带 `page=1&type=page`**。
3. **创建流后轮询**，不要把 30s 超时当成任务结果。
4. **`waiting` 要主动收尾**（`finish`），否则沙箱容器长期占用。
5. **Token 只显示一次**，创建后立即落库加密保存。
6. **分支判断用 `code`**，不要匹配 `msg` 文本。
7. **改密码/账号管理走 Cookie**，Token 层调不通属设计如此。
8. **生产环境务必替换 `COOKIE_SIGNING_SALT`、关闭 `DISABLE_AUTH`**。
