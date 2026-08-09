#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
web_book 后端配置（§4 配置驱动零硬编码）
server.py 从此处读取端口、防火墙规则名等，避免散落硬编码。
"""
import os
from pathlib import Path

# 端口
PORT = 8000

# Windows 防火墙入站规则名
FIREWALL_RULE_NAME = "星落之城"

# 数据文件路径（相对项目根）
BASE_DIR = Path(__file__).parent.resolve()
DATA_FILE = BASE_DIR / "data" / "novel.json"
