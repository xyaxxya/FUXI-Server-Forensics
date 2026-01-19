## 现象解释（为什么切换过来要重新取一遍）
- 目前前端的命令结果缓存是“全局一份”，按命令 id 存：`data: Record<commandId, CommandResult>`、`chartData: Record<commandId, Point[]>`。见 [CommandContext.tsx](file:///e:/fuxi/FUXI-Server-Forensics/src/store/CommandContext.tsx#L100-L120) 与 `runCommand` 的 `setData(prev => ({ ...prev, [id]: res }))`。
- 这套结构 **没有把 sessionId（服务器）作为维度**。因此如果你切换服务器但不清空，全局缓存会直接把“上一台服务器的结果”显示到“当前服务器”上，造成严重数据串台。
- 为了避免串台，代码在 `switchSession` 里调用了 `clearData()` / `clearChartData()`，这会把之前的结果全清掉，所以切换后必须重新拉一遍。见 [switchSession](file:///e:/fuxi/FUXI-Server-Forensics/src/store/CommandContext.tsx#L271-L311)。

结论：不是“没有保存”，而是“保存方式不支持多服务器”，所以切换时被强制清空。这确实是机制层面的缺陷（对多服务器场景不合理）。

## 目标（机制应有的样子）
- 每台服务器（session）都有自己的缓存：你切到服务器A看到A的上次结果；切到服务器B看到B的上次结果。
- 切换时不必清空全局数据，只需要把 UI 指向新的 sessionId。
- 数据要标记时间戳（Last Updated），让用户知道“这是缓存还是刚刷新”。

## 实施方案（最小侵入、保证不破 UI）
### 1) Store 层改造为“按 sessionId 分桶缓存”
在 [CommandContext.tsx](file:///e:/fuxi/FUXI-Server-Forensics/src/store/CommandContext.tsx) 做结构升级：
- `data` 变为：`dataBySession: Record<sessionId, Record<commandId, CommandResult & { ts: number }>>`
- `loading` 变为：`loadingBySession: Record<sessionId, Record<commandId, boolean>>`
- `chartData` 变为：`chartBySession: Record<sessionId, Record<commandId, ChartDataPoint[]>>`
- `getCommandData(id)` / `getChartData(id)` 保持原接口不变，但内部按 `currentSession?.id` 返回对应 session 的数据（这样 Dashboard 基本不用改）。

### 2) 修改清理逻辑为“只清理当前 session 或指定 session”
- `clearData()` / `clearChartData()` 改为默认只清理当前 session（或提供 `clearSessionData(sessionId)`）。
- `switchSession` 不再清空全局缓存，只做：切换 currentSession +（可选）对新 session 触发一次后台刷新。

### 3) 监控逻辑按 session 运行且不串台
- 监控定时器只针对当前 session 执行（或明确支持“多 session 同时监控”，但那是额外功能）。
- 切换 session 时：停止旧 session 的监控（或保留但必须按 session 分桶存储，不影响 UI）。

### 4) UI 展示“缓存/更新时间”，避免误解
在 [Dashboard.tsx](file:///e:/fuxi/FUXI-Server-Forensics/src/components/Dashboard.tsx) 的卡片区域增加：
- “Last Updated: xx:xx:xx”
- 如果是缓存：显示“Cached”标签；点击 Refresh 再拉最新。

## 验证用例（按测试员标准）
- 场景A：服务器A跑一遍数据 → 切到服务器B跑一遍 → 再切回A：A立刻显示上次结果（不重新取），且 Refresh 后更新。
- 场景B：开启监控在A → 切到B：A的数据不影响B，B显示自己的缓存/刷新。
- 场景C：断开某个 session：只清理该 session 的缓存，不影响其他 session。

确认后我会按以上步骤改造 store + UI，并用上述用例验证“切换不再全量重取、也不串台”。