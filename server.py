#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
星落之城 - 本地小说服务器
提供：静态文件服务 + API 数据读写 + 局域网分享
运行后，同一 WiFi 下的设备可通过 http://<本机IP>:8000 访问
"""

import json
import os
import signal
import socket
import subprocess
import sys
import webbrowser
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

BASE_DIR = Path(__file__).parent.resolve()
DATA_FILE = BASE_DIR / "data" / "novel.json"
PORT = 8000


def get_lan_ip():
    """获取本机局域网 IP（优先选择到公网出口的那块网卡）"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def get_all_ipv4():
    """枚举本机所有 IPv4 地址，用于提示用户手机可访问的候选 IP"""
    ips = []
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            ip = info[4][0]
            if ip not in ips and not ip.startswith("127."):
                ips.append(ip)
    except Exception:
        pass
    return ips


class NovelHandler(SimpleHTTPRequestHandler):
    # 使用 HTTP/1.1 保持连接，但通过超时与守护线程确保服务器可被 Ctrl+C 立即停止
    protocol_version = "HTTP/1.1"
    timeout = 5  # socket 读写超时（秒），防止保持连接导致线程无法退出

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def setup(self):
        super().setup()
        # 给底层 socket 设置超时，避免 handle_one_request 永久阻塞
        try:
            self.connection.settimeout(self.timeout)
        except Exception:
            pass

    def log_message(self, format, *args):
        """精简日志输出"""
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), format % args))

    def handle_one_request(self):
        """捕获连接重置/中止/超时错误，避免刷屏并保证线程可退出"""
        try:
            super().handle_one_request()
        except socket.timeout:
            # keep-alive 空闲超时，结束本连接线程
            self.close_connection = True
        except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError, OSError):
            # 连接被关闭或读写异常，关闭 keep-alive 让线程结束
            self.close_connection = True

    def _send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        try:
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError, OSError):
            pass

    def end_headers(self):
        # 禁止缓存，确保每次请求都读取最新文件内容
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        # 允许跨域（方便调试）
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # API: 获取小说数据
        if path == "/api/novel":
            self._send_json(self._load_novel())
            return

        # API: 获取服务器信息（IP/端口）
        if path == "/api/info":
            self._send_json({
                "ip": get_lan_ip(),
                "port": PORT,
                "reader_url": f"http://{get_lan_ip()}:{PORT}/reader.html",
                "editor_url": f"http://{get_lan_ip()}:{PORT}/index.html"
            })
            return

        # 短链 /read 重定向到阅读页
        if path == "/read" or path.startswith("/read/"):
            query = parsed.query
            target = "/reader.html" + ("?" + query if query else "")
            self.send_response(302)
            self.send_header("Location", target)
            self.end_headers()
            return

        # 默认静态文件
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # API: 保存小说数据（全量）
        if path == "/api/novel":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                data = json.loads(body)
                self._save_novel(data)
                self._send_json({"ok": True, "message": "保存成功"})
            except Exception as e:
                self._send_json({"ok": False, "error": str(e)}, status=500)
            return

        # API: 保存单个章节到 data/chapters/<id>.json
        if path == "/api/chapter":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                data = json.loads(body)
                ch_id = data.get("id", "")
                if not ch_id:
                    self._send_json({"ok": False, "error": "缺少章节 id"}, status=400)
                    return

                chapters_dir = BASE_DIR / "data" / "chapters"
                chapters_dir.mkdir(parents=True, exist_ok=True)
                ch_file = chapters_dir / f"{ch_id}.json"

                # 写入章节文件（无 BOM）
                with open(ch_file, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=4)

                self._send_json({"ok": True, "message": f"章节 {ch_id} 已保存"})
            except Exception as e:
                self._send_json({"ok": False, "error": str(e)}, status=500)
            return

        self._send_json({"error": "Not Found"}, status=404)

    def _load_novel(self):
        """从章节文件 + novel.js 的数据重建小说对象
        - 优先从 data/chapters/<id>.json 读取每章的完整数据（title/summary/content）
        - 使用 novel.js 中的 CHAPTER_MANIFEST 保证章节顺序
        - 兜底直接扫描 data/chapters/ 目录
        """
        chapters_dir = BASE_DIR / "data" / "chapters"
        novel_js_path = BASE_DIR / "data" / "novel.js"

        book = {"title": "星落之城", "author": "未命名"}
        chapters = []

        # 从 novel.js 提取书籍元信息 + 章节顺序清单
        manifest = None
        if novel_js_path.exists():
            js_content = novel_js_path.read_text("utf-8")
            import re
            book_match = re.search(r"var BOOK=(\{.+?\});", js_content, re.DOTALL)
            if book_match:
                try:
                    book = json.loads(book_match.group(1))
                except json.JSONDecodeError:
                    pass

            manifest_match = re.search(
                r"var CHAPTER_MANIFEST=\[(\{.+?\}.*?)\];",
                js_content, re.DOTALL
            )
            if manifest_match:
                try:
                    manifest = json.loads("[" + manifest_match.group(1) + "]")
                except json.JSONDecodeError:
                    pass

        if manifest:
            # 按 manifest 顺序读取每章的最新数据
            for m in manifest:
                ch_file = chapters_dir / f"{m['id']}.json"
                if ch_file.exists():
                    try:
                        ch_data = json.loads(ch_file.read_text("utf-8"))
                        chapters.append({
                            "id": ch_data.get("id", m["id"]),
                            "title": ch_data.get("title", m["title"]),
                            "summary": ch_data.get("summary", m.get("summary", "")),
                            "content": ch_data.get("content", "")
                        })
                    except Exception:
                        # 文件损坏时回退到 manifest 数据
                        chapters.append({
                            "id": m["id"],
                            "title": m["title"],
                            "summary": m.get("summary", ""),
                            "content": ""
                        })
                else:
                    # 章节文件不存在时使用 manifest 数据
                    chapters.append({
                        "id": m["id"],
                        "title": m["title"],
                        "summary": m.get("summary", ""),
                        "content": ""
                    })

        if not chapters:
            # 兜底：直接从章节文件目录读取（按文件名自然排序）
            if chapters_dir.exists():
                ch_files = sorted(chapters_dir.glob("ch_*.json"),
                                  key=lambda p: int(p.stem.split("_")[-1]))
                for f in ch_files:
                    try:
                        data = json.loads(f.read_text("utf-8"))
                        chapters.append(data)
                    except Exception:
                        pass

        return {"book": book, "chapters": chapters}

    def _save_novel(self, data):
        """保存小说数据
        - data/chapters/<id>.json：每章独立文件
        - data/novel.js：清单 + 异步加载器（供前端 script 加载）
        """
        chapters_dir = BASE_DIR / "data" / "chapters"
        chapters_dir.mkdir(parents=True, exist_ok=True)

        # 1. 保存独立章节文件到 data/chapters/
        chapters_dir = BASE_DIR / "data" / "chapters"
        chapters_dir.mkdir(parents=True, exist_ok=True)
        ch_map = {}
        for ch in data.get("chapters", []):
            # 每章单独存为 JSON
            ch_file = chapters_dir / f"{ch['id']}.json"
            ch_obj = {
                "id": ch["id"],
                "title": ch["title"],
                "summary": ch.get("summary", ""),
                "content": ch.get("content", "")
            }
            with open(ch_file, "w", encoding="utf-8") as f:
                json.dump(ch_obj, f, ensure_ascii=False, indent=4)
            # 收集清单信息（不含正文）
            ch_map[ch["id"]] = {
                "id": ch["id"],
                "title": ch["title"],
                "summary": ch.get("summary", "")
            }

        # 3. 更新 novel.js（清单 + 异步加载器，不含正文）
        book = data.get("book", {})
        manifest = list(ch_map.values())

        js_lines = []
        js_lines.append("/**")
        js_lines.append(" * 小说数据加载器（由 server.py 自动生成）")
        js_lines.append(" * - 书籍元信息 + 章节清单内联定义")
        js_lines.append(" * - 各章节正文存放在 data/chapters/<id>.json 中")
        js_lines.append(" */")
        js_lines.append("(function(){")
        js_lines.append("var BOOK=" + json.dumps(book, ensure_ascii=False) + ";")
        js_lines.append("var CHAPTER_MANIFEST=" + json.dumps(manifest, ensure_ascii=False) + ";")
        js_lines.append("window.__NOVEL_DATA__=null;")
        js_lines.append("window.__NOVEL_READY__=(function(){")
        js_lines.append("var base='data/chapters/';")
        js_lines.append("function load(m){")
        js_lines.append("return fetch(base+m.id+'.json?_t='+Date.now()).then(function(r){")
        js_lines.append("if(!r.ok)throw Error('HTTP '+r.status);")
        js_lines.append("return r.json();")
        js_lines.append("}).then(function(d){")
        js_lines.append("return{id:d.id||m.id,title:d.title||m.title,summary:d.summary||m.summary,content:d.content||''};")
        js_lines.append("}).catch(function(e){")
        js_lines.append("console.warn('[novel] 加载'+m.id+'失败:',e);")
        js_lines.append("return{id:m.id,title:m.title,summary:m.summary,content:''};")
        js_lines.append("});")
        js_lines.append("}")
        js_lines.append("return Promise.all(CHAPTER_MANIFEST.map(load)).then(function(chs){")
        js_lines.append("var d={book:BOOK,chapters:chs};")
        js_lines.append("window.__NOVEL_DATA__=d;")
        js_lines.append("return d;")
        js_lines.append("});")
        js_lines.append("})();")
        js_lines.append("})();")

        js_file = BASE_DIR / "data" / "novel.js"
        with open(js_file, "w", encoding="utf-8") as f:
            f.write("\n".join(js_lines) + "\n")



def cleanup_port(port):
    """启动前清理占用指定端口的残留进程（跨平台）"""
    import platform
    system = platform.system()
    killed = []

    try:
        if system == "Windows":
            # Windows：使用 netstat 查找占用端口的 PID
            # netstat 输出纯 ASCII，但中文系统下默认 ANSI(GBK) 解码更安全；
            # 这里读原始字节再按 GBK 解码并容错，避免极端情况下崩溃。
            proc = subprocess.run(
                ["netstat", "-ano"],
                capture_output=True,
                creationflags=subprocess.CREATE_NO_WINDOW
            )
            stdout = proc.stdout.decode("gbk", errors="replace") if proc.stdout else ""
            for line in stdout.splitlines():
                if f":{port} " in line and "LISTENING" in line:
                    parts = line.strip().split()
                    pid = parts[-1]
                    try:
                        os.kill(int(pid), signal.SIGTERM)
                        killed.append(pid)
                    except (OSError, ValueError):
                        pass
        else:
            # macOS / Linux：使用 lsof 查找
            result = subprocess.run(
                ["lsof", "-ti", f":{port}"],
                capture_output=True, text=True
            )
            for pid in result.stdout.strip().splitlines():
                if pid:
                    try:
                        os.kill(int(pid), signal.SIGKILL)
                        killed.append(pid)
                    except (OSError, ValueError):
                        pass
    except Exception:
        pass

    if killed:
        print(f"  已清理 {len(killed)} 个占用端口 {port} 的残留进程")
        import time
        time.sleep(0.5)  # 等待进程完全退出


def _run_cmd_gbk(argv):
    """以 GBK 编码执行外部命令并返回 (returncode, stdout)。
    中文 Windows 上 netsh / netstat 输出为 GBK，subprocess 默认按 ANSI 解码
    极易因 UTF-8 字节序列崩溃；这里读原始字节后显式按 GBK 解码并容错。
    """
    try:
        proc = subprocess.run(
            argv,
            capture_output=True,
            creationflags=subprocess.CREATE_NO_WINDOW
        )
        out = proc.stdout.decode("gbk", errors="replace") if proc.stdout else ""
        return proc.returncode, out
    except Exception:
        return -1, ""


def ensure_firewall_rule():
    """在 Windows 上自动尝试添加防火墙入站规则；失败则提示手动命令"""
    import platform
    if platform.system() != "Windows":
        return

    rule_name = "星落之城"
    # 先检查规则是否已存在
    rc, out = _run_cmd_gbk(
        ["netsh", "advfirewall", "firewall", "show", "rule", f"name={rule_name}"]
    )
    rule_exists = (rc == 0) and (rule_name in out)

    if rule_exists:
        print(f"  防火墙: 规则 “{rule_name}” 已存在 (端口 {PORT} 已放行)")
        return

    # 尝试添加规则（需要管理员权限）
    rc, _ = _run_cmd_gbk(
        [
            "netsh", "advfirewall", "firewall", "add", "rule",
            f"name={rule_name}",
            "dir=in", "action=allow", "protocol=TCP",
            f"localport={PORT}"
        ]
    )
    if rc == 0:
        print(f"  防火墙: 已自动添加规则 “{rule_name}” 放行端口 {PORT}")
        return

    # 添加失败（多半是权限不足），给出手动命令
    print("  提示: 若手机无法访问，多半是 Windows 防火墙拦截。")
    print("        请以【管理员身份】打开 PowerShell，执行以下命令放行端口:")
    print(f'        New-NetFirewallRule -DisplayName "{rule_name}" -Direction Inbound -Protocol TCP -LocalPort {PORT} -Action Allow')
    print()
    print("        另外请确认：手机与电脑连接同一 WiFi，且路由器未开启 AP/客户端隔离。")
    print()


class NovelServer(ThreadingHTTPServer):
    """支持多线程 + 立即关闭的 HTTP 服务器"""
    daemon_threads = True      # 请求线程设为守护线程，主线程退出时随之结束
    block_on_close = False     # server_close 不等待请求线程，确保 Ctrl+C 立即生效
    allow_reuse_address = True


def main():
    # 启动前清理残留进程
    cleanup_port(PORT)

    lan_ip = get_lan_ip()
    all_ips = get_all_ipv4()
    server = NovelServer(("0.0.0.0", PORT), NovelHandler)

    print("=" * 50)
    print("  星落之城 - 本地服务器已启动")
    print("=" * 50)
    print()
    print(f"  本机访问:")
    print(f"    编辑器: http://localhost:{PORT}/index.html")
    print(f"    阅读页: http://localhost:{PORT}/reader.html")
    print()
    print(f"  局域网分享（同一 WiFi 下的设备）:")
    print(f"    阅读页: http://{lan_ip}:{PORT}/reader.html")
    print(f"    编辑器: http://{lan_ip}:{PORT}/index.html")
    if len(all_ips) > 1:
        print()
        print("  本机其他网卡 IP（若上面 IP 手机不通，可尝试下面这些）:")
        for ip in all_ips:
            print(f"    http://{ip}:{PORT}/reader.html")
    print()
    print("  提示: 按 Ctrl+C 停止服务器")
    print("=" * 50)
    print()

    ensure_firewall_rule()

    # 自动打开浏览器
    try:
        webbrowser.open(f"http://localhost:{PORT}/index.html")
    except Exception:
        pass

    # 使用带超时的 serve_forever，让 KeyboardInterrupt 能被及时响应
    try:
        server.serve_forever(poll_interval=0.3)
    except KeyboardInterrupt:
        print("\n正在关闭服务器...")
    finally:
        # 立即关闭 listening socket，再等待极短时间让线程退出
        server.shutdown()
        server.server_close()
        print("服务器已停止")


if __name__ == "__main__":
    main()
