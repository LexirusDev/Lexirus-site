#!/usr/bin/env python3
"""Single shared page shell; --check fails on generated HTML drift."""
from pathlib import Path
import argparse, html
ROOT=Path(__file__).resolve().parent.parent
pages={'home':('index.html','Lexirus · 离线俄汉词典','离线查词、词形、重音与例句，以及自愿提交的崩溃反馈。'), 'support':('support/index.html','Lexirus · 技术支持 / Support','Lexirus 技术支持、问题反馈与第三方资料说明。'), 'crash':('support/crash/index.html','Lexirus · 崩溃日志与反馈','导出 Lexirus 崩溃日志，在本机提取技术字段，预览下载后通过邮件自愿发送诊断记录。'), 'privacy':('privacy/index.html','Lexirus · 隐私政策 / Privacy','Lexirus 本地个人记录、语音和自愿反馈的隐私说明。')}
NAV='''<a class="skip" href="#main">跳到正文</a><header class="site-nav"><a class="brand" href="/"><img src="/assets/favicon-32.png" alt="" width="32" height="32">Lexirus</a><nav class="nav-links" aria-label="网站导航"><a href="/support/">技术支持</a><a href="/support/crash/">崩溃反馈</a><a href="/privacy/">隐私政策</a></nav></header>'''
FOOT='''<footer class="site-footer"><span>© 2026 Lexirus · 肖泽文</span><span><a href="mailto:xzwdev@163.com">联系开发者</a> · <a href="/privacy/">隐私政策</a> · <a href="/support/">技术支持</a></span></footer>'''
check=argparse.ArgumentParser();check.add_argument('--check',action='store_true');args=check.parse_args();bad=[]
for name,(out,title,desc) in pages.items():
 path='/' if name=='home' else '/'+out.removesuffix('index.html')
 body=(ROOT/'templates'/f'{name}.html').read_text()
 script='<script type="module" src="/assets/crash-email.js"></script>' if name=='crash' else ''
 result=f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{html.escape(title)}</title><meta name="description" content="{html.escape(desc)}"><meta name="generator" content="Kami"><meta name="author" content="肖泽文"><meta name="keywords" content="Lexirus,俄汉词典,离线词典,崩溃反馈"><meta name="referrer" content="strict-origin-when-cross-origin"><link rel="canonical" href="https://lexirus.cn{path}"><meta property="og:title" content="{html.escape(title)}"><meta property="og:description" content="{html.escape(desc)}"><meta property="og:image" content="https://lexirus.cn/assets/app-icon.png"><meta property="og:type" content="website"><link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png"><link rel="apple-touch-icon" sizes="180x180" href="/assets/apple-touch-icon.png"><style>{(ROOT/"assets/site.css").read_text()}</style></head><body>{NAV}<main class="page{' prose' if name!='home' else ''}" id="main">{body}</main>{FOOT}{script}</body></html>
'''
 target=ROOT/out
 if args.check:
  if not target.exists() or target.read_text()!=result: bad.append(out)
 else: target.parent.mkdir(parents=True,exist_ok=True);target.write_text(result)
if bad: raise SystemExit('Generated HTML drift: '+', '.join(bad))
print('Site check passed' if args.check else 'Generated 4 pages')
