# PR 操作手册

> 本文档记录了处理外部贡献者 Pull Request 的完整流程。
> 以 PR #1「增加目录切换」为实际案例。

---

## 前置条件

- 本地仓库路径：`/root/lyl/wechat_agent_bridge_skills`
- 测试环境路径：`/root/lyl/fact_check/wechat-cursor_agent_bridge-skill`
- tmux 会话名：`wechat-cursor`
- 远程仓库：`git@github.com:kaixindelele/wechat_agent_bridge_skills.git`

---

## 一、查看新 PR

### 方式 1：GitHub 网页

直接访问 https://github.com/kaixindelele/wechat_agent_bridge_skills/pulls

### 方式 2：命令行（GitHub API）

```bash
curl -s "https://api.github.com/repos/kaixindelele/wechat_agent_bridge_skills/pulls?state=open" | python3 -c "
import json,sys
prs = json.load(sys.stdin)
if not prs:
    print('没有打开的PR')
else:
    for pr in prs:
        print(f'PR #{pr[\"number\"]}: {pr[\"title\"]}')
        print(f'  作者: {pr[\"user\"][\"login\"]}')
        print(f'  分支: {pr[\"head\"][\"ref\"]} -> {pr[\"base\"][\"ref\"]}')
        print(f'  URL: {pr[\"html_url\"]}')
        print()
"
```

### 方式 3：gh CLI（需先登录）

```bash
cd /root/lyl/wechat_agent_bridge_skills
gh pr list --state open
```

---

## 二、拉取 PR 到本地

```bash
cd /root/lyl/wechat_agent_bridge_skills

# 将 PR #N 拉到本地的 pr-N 分支（N 替换为实际 PR 编号）
git fetch origin pull/1/head:pr-1
```

---

## 三、查看 PR 变更

```bash
# 查看 PR 详细信息
curl -s "https://api.github.com/repos/kaixindelele/wechat_agent_bridge_skills/pulls/1" | python3 -c "
import json,sys
pr = json.load(sys.stdin)
print(f'标题: {pr[\"title\"]}')
print(f'描述: {pr.get(\"body\", \"无\")}')
print(f'变更文件数: {pr[\"changed_files\"]}')
print(f'增加: +{pr[\"additions\"]}  删除: -{pr[\"deletions\"]}')
"

# 查看具体代码差异
git diff main..pr-1
```

---

## 四、在测试环境验证

### 4.1 生成补丁并应用到测试环境

```bash
# 生成补丁
cd /root/lyl/wechat_agent_bridge_skills
git diff main..pr-1 > /tmp/pr1.patch

# 应用到测试环境
cd /root/lyl/fact_check
git apply /tmp/pr1.patch
```

### 4.2 重启桥接服务

```bash
# 停止当前服务
tmux send-keys -t wechat-cursor C-c

# 等待 2 秒后确认已停止
sleep 2
tmux capture-pane -t wechat-cursor -p | tail -5

# 重启服务
tmux send-keys -t wechat-cursor 'npm start' Enter

# 等待 5 秒后确认启动成功
sleep 5
tmux capture-pane -t wechat-cursor -p | tail -10
```

### 4.3 功能测试

通过微信发送相关命令验证新功能，确保：
- 新命令能正常响应
- 旧功能不受影响
- 服务日志无异常报错

---

## 五、合并 PR

### 方式 A：命令行合并（推荐）

```bash
cd /root/lyl/wechat_agent_bridge_skills

# 确保 main 是最新的
git checkout main
git pull origin main

# 合并 PR 分支（--no-ff 保留合并记录）
git merge pr-1 --no-ff -m "Merge pull request #1 from purpleroc/patch-2

增加目录切换"

# 推送到远程
git push origin main
```

### 方式 B：GitHub 网页合并

直接在 PR 页面点绿色的 **「Merge pull request」** 按钮。

### 方式 C：gh CLI 合并

```bash
gh pr merge 1 --merge
```

---

## 六、确认合并结果

```bash
# 确认 PR 已关闭
curl -s "https://api.github.com/repos/kaixindelele/wechat_agent_bridge_skills/pulls/1" | python3 -c "
import json,sys
pr = json.load(sys.stdin)
print(f'状态: {pr[\"state\"]}')
print(f'已合并: {pr[\"merged\"]}')
"
```

---

## 七、清理

```bash
# 删除本地 PR 分支
git branch -d pr-1

# 如果测试环境需要回滚补丁
cd /root/lyl/fact_check
git checkout -- .
```

---

## 实际案例记录

### PR #1：增加目录切换（/cwd 命令）

| 项目 | 内容 |
|------|------|
| PR 编号 | #1 |
| 标题 | 增加目录切换 |
| 作者 | purpleroc |
| 分支 | purpleroc/patch-2 → main |
| 变更 | `bridge.ts` +67 行 |
| 功能 | 新增 `/cwd` 和 `/cwd <路径>` 命令 |
| 合并时间 | 2026-04-28 |

**变更内容：**
1. 新增 `persistConfigCwd()` 函数，将 cwd 持久化到 `bridge.config.json`
2. 在 `/help` 帮助文本中添加 `/cwd` 命令说明
3. 实现 `/cwd` 命令处理逻辑：查看/切换工作目录，支持绝对和相对路径

**代码审查要点：**
- 风格与现有 `/model` 命令一致 ✅
- 路径验证（存在性 + 是否为目录） ✅
- 错误处理（配置写入失败时提示） ✅
- 忙碌状态提示 ✅

---

## 附：如果你要向别人的仓库提 PR

1. **Fork** 对方仓库到你的 GitHub 账号
2. **Clone** 你的 fork：`git clone git@github.com:你的用户名/仓库名.git`
3. **创建分支**：`git checkout -b my-feature`
4. **修改代码** 并 commit：`git add . && git commit -m "feat: 描述"`
5. **Push** 到你的 fork：`git push origin my-feature`
6. 在 GitHub 上点 **「New pull request」**，选择 `你的fork/my-feature` → `原仓库/main`
7. 填写标题和描述，提交 PR
