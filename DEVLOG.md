# 开发记录 - 2026-01-03

## v1.3.0 - 添加 X.com (Twitter) 视频速度控制

### 新功能
为 X.com (twitter.com) 添加视频播放速度控制支持，使用与 YouTube/Bilibili/Weibo 相同的快捷键逻辑。

### 快捷键
- `+` / `=` / `]` - 增加速度 (0.25x 步进)
- `-` / `[` - 减少速度 (0.25x 步进)  
- `Shift+1/2/3/4` - 预设速度 (1x/1.5x/2x/3x)

### 实现要点（基于历史经验）
1. **获取实际播放速度**：在调速前从 `video.playbackRate` 获取实际速度
2. **多视频处理**：X.com 可能预加载多个视频，选择最大可见视频作为目标
3. **键盘事件捕获**：在 window 和 document 上都注册 capture phase 事件，防止被网站拦截
4. **内联样式指示器**：使用 inline CSS 确保速度指示器样式不被覆盖
5. **SPA 导航支持**：监听 URL 变化重新应用速度
6. **防御性错误处理**：所有 Chrome API 调用都有 try-catch 包裹

### Bug 修复：最大化视频指示器不显示
**问题**：小窗模式播放时速度指示器正常显示，但最大化视频后指示器不显示（速度可调节）

**原因**：X.com 最大化视频使用了不同的 DOM 结构：
- 最大化视图 URL 变为 `/status/.../video/1` 格式
- 使用 `#layers` 容器作为模态框覆盖
- 浏览器原生全屏使用 `document.fullscreenElement`

**解决方案**：
1. 检测 `/video/` URL 路径，使用 `#layers` 或 `[data-testid="videoPlayer"]` 作为容器
2. 检测 `document.fullscreenElement`，将指示器附加到全屏元素
3. 监听 `fullscreenchange` 事件，在全屏切换时重置指示器

### 影响的文件
- `content/twitter.js` (新增)

---

# 开发记录 - 2024-12-31

## v1.2.1 - YouTube Shorts 速度控制修复

### 问题
快捷键调节速度在 YouTube Shorts 上不起作用。按下快捷键后，视频上显示相应的速度指示器，但播放速度没有实际改变。

### 根本原因
YouTube Shorts 使用不同的播放器结构：
- 使用 `ytd-reel-video-renderer` 而非 `.html5-video-player`
- 预加载多个视频元素用于平滑滚动切换
- 当前激活的视频通过 `[is-active]` 属性标识

原来的 `getVideoElement()` 只是简单地选择第一个视频元素，而不是当前正在播放的 Shorts 视频。

### 解决方案
1. **更新 `getVideoElement()`**：检测 Shorts 页面并查找带有 `[is-active]` 属性的渲染器中的视频
2. **新增 `shortsObserver`**：监听 `is-active` 属性变化，在用户滚动到下一个 Short 时重新应用速度
3. **更新 `createIndicator()`**：支持在 Shorts 容器中正确放置速度指示器

### 影响的文件
- `content/content.js`

---

# 开发记录 - 2024-12-30

## 本次修改内容

### 1. 核心功能修复 ✅
**问题**：通过网站菜单调整速度后，按 +/- 快捷键不会基于当前实际速度调整，而是基于扩展内部记录的速度。

**解决方案**：修改 `incrementSpeed()` 和 `decrementSpeed()` 函数，在调整前先从 `video.playbackRate` 获取实际播放速度：
```javascript
const video = getVideoElement();
const actualSpeed = video ? video.playbackRate : currentSpeed;
```

### 2. 防御性错误处理 ✅
添加了全面的错误处理机制，避免扩展上下文失效时在控制台产生错误：
- 用 try-catch 包裹 `init()` 和 `setSpeed()` 函数体
- 给所有 `setSpeed()` 调用添加 `.catch(() => {})`
- 给 `init()` 调用添加 `.catch(() => {})`
- 用 try-catch 包裹事件监听器

---

## 走的弯路 ⚠️

### 问题：无法消除的 "Extension context invalidated" 错误
在调试过程中，一直尝试通过代码修改来消除控制台中的 "Extension context invalidated" 错误。

### 尝试的方法（都没有效果）：
1. 在 `chrome.storage.sync.set()` 周围添加 try-catch
2. 在函数开头添加 `chrome.runtime?.id` 检查
3. 在整个函数体外层包裹 try-catch
4. 给所有 Promise 调用添加 `.catch()`

### 最终发现的真正原因：
错误来自**之前打开但没有关闭的旧标签页**上运行的旧版本脚本。当扩展重新加载后：
- 新标签页会加载新脚本
- 旧标签页上的旧脚本仍然继续运行
- 旧脚本尝试调用 Chrome API 时会失败

### 正确的解决方法：
1. 重新加载扩展
2. **关闭所有相关网站的标签页**
3. 打开新标签页测试

---

## 经验教训 📝

1. **调试 Chrome 扩展时**：确认错误来自当前运行的代码还是旧的缓存脚本
2. **查看 Stack Trace**：如果显示 "Nothing to see here, move along." 或行号对不上，可能是旧脚本
3. **检查 URL**：确认报错的 URL 是否真的打开着
4. **防御性编程虽好**：但要理解问题的根本原因，不要盲目添加错误处理
5. **浏览器缓存问题**：扩展开发中，旧脚本实例是常见的混淆来源

---

## 最终代码变更

### 影响的文件：
- `content/content.js`
- `content/bilibili.js`
- `content/weibo.js`

### 变更类型：
- 功能修复：速度调整逻辑
- 代码质量：防御性错误处理
