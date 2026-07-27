# server.py 修复：Ctrl+C 无法退出 + 手机无法访问

**日期**: 2026-07-27

## 修改摘要

修复本地开发服务器 [`server.py`](server.py) 的两个顽疾：

1. **Ctrl+C 无法退出** — 根因：原使用单线程 `HTTPServer`，且未设置请求 socket 超时；HTTP/1.1 keep-alive 让浏览器持久连接挂在请求线程里，`server_close()` 默认 `block_on_close=True` 会等待所有请求线程结束，进程因此卡住。
2. **手机无法访问** — 最常见原因是 Windows 防火墙未放行 8000 端口；其次是手机/电脑不同网段或路由器 AP 隔离；此外当本机有多张网卡（VPN/虚拟机）时，[`get_lan_ip()`](server.py:25) 可能选错 IP。

## 涉及文件

- [`server.py`](server.py)

## 关键决策

| 决策 | 理由 |
|------|------|
| 改用 `ThreadingHTTPServer` 而非 `HTTPServer` | 多线程可同时处理多个 keep-alive 连接，避免单连接阻塞其他请求 |
| `daemon_threads = True` + `block_on_close = False` | 主线程退出时守护线程随之结束，`server_close()` 不再阻塞等待，保证 Ctrl+C 立即生效 |
| `protocol_version = "HTTP/1.1"` + `timeout = 5` 秒 socket 超时 | keep-alive 空闲 5 秒后抛 `socket.timeout` 让请求线程退出，既保留 keep-alive 性能，又避免线程僵死 |
| 异常捕获顺序：`socket.timeout` 在 `OSError` 之前 | `socket.timeout` 是 `OSError` 子类，写反则成为死代码 |
| 新增 [`ensure_firewall_rule()`](server.py:343) 自动添加防火墙规则 | 用 `netsh advfirewall` 先查后加，避免重复；权限不足时给出手动命令与 AP 隔离提示 |
| 新增 [`get_all_ipv4()`](server.py:37) 列出所有 IPv4 | 多网卡机器（VPN/VMware/Hyper-V）下，主 IP 不一定是手机所在网段，列出全部候选方便用户尝试 |
| `serve_forever(poll_interval=0.3)` | 缩短 selector 轮询周期，让 `KeyboardInterrupt` 更及时被响应 |

## 注意事项

- 后续若增加 WebSocket 或 SSE 长连接，需要重新评估 `timeout=5` 是否过短（长连接请求处理期间不应超时）。
- `netsh advfirewall` 添加规则需要管理员权限；非管理员运行时会降级为打印手动命令，属于预期行为。
- 若用户启用了「网络发现」但依然在「公用网络」配置文件中，防火墙规则可能需要额外指定 `profile=private` 才能生效。可在 [`ensure_firewall_rule()`](server.py:366) 中追加 `"profile=private"` 参数。
- HTTP/1.1 下所有响应必须携带正确的 `Content-Length`（或 `Connection: close`），否则浏览器会挂起等待。当前 `_send_json` 与父类 `send_head` 都已正确设置。

## 后续补丁（同日）

**问题**：首次修复后用户报告 `UnicodeDecodeError: 'gbk' codec can't decode byte 0xa7/0x87`，崩溃发生在 `subprocess.py` 内部 `_readerthread`。

**根因**：中文 Windows 上 `netsh` 输出使用 GBK，但包含无法映射到 GBK 的字节；`subprocess.run(..., text=True)` 默认按 ANSI(GBK) 解码在子线程中崩溃。

**修复**（[`server.py:347-363`](server.py:347)）：
- 新增 [`_run_cmd_gbk()`](server.py:347)：先 `capture_output=True` 读原始字节，再 `.decode("gbk", errors="replace")` 显式解码
- [`ensure_firewall_rule()`](server.py:366) 与 [`cleanup_port()`](server.py:292) 中的 `netsh` / `netstat` 调用全部改走 `_run_cmd_gbk` 或同样模式
- 验证：直接调用 `server._run_cmd_gbk(["netsh", ...])` 返回 `rc=1` 无异常；`ensure_firewall_rule()` 完整走完降级分支无异常

**注意事项**：
- 在 VS Code 终端用 `python -c "..."` 传中文参数时，PowerShell/cmd 会以 GBK 编码命令行，导致参数本身被替换为 U+FFFD——这是终端编码问题，不是脚本问题。需要测试时写成 `.py` 文件再执行。
- 若 netsh 错误信息含 UTF-8 字节序列，按 GBK 解码后会出现乱码字符（不影响逻辑判断，因为只检查 `rc` 与是否含规则名）。
