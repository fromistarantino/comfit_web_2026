import os, re, sys, glob, shutil, json
SRC, AF, OUT = sys.argv[1:4]
EXCLUDE = {'Launch'}
DESC = 'COMFIT(컴핏): 내 PC를 무료로 검진하고 부품별 상태를 결과표로 확인하세요.'
names = [os.path.basename(f)[:-8] for f in sorted(glob.glob(os.path.join(SRC, '*.dc.html')))]
def out_name(n): return 'index.html' if n == 'Main' else n.lower() + '.html'
assets = {}
for f in os.listdir(AF):
    m = re.match(r'^([0-9a-f]{32})\.(\w+)$', f)
    if m: assets[m.group(1)] = f
shutil.rmtree(OUT, ignore_errors=True); os.makedirs(os.path.join(OUT, 'assets'))
used = set()
def fix(s):
    def blob(m):
        used.add(m.group(1)); return 'assets/' + assets[m.group(1)]
    s = re.sub(r'/_blob/([0-9a-f]{32})', blob, s)
    def link(m):
        n = m.group(1)
        return ('index.html' if n in EXCLUDE else out_name(n))
    return re.sub(r'\b([A-Z][A-Za-z]*)\.dc\.html', link, s)
for n in names:
    if n in EXCLUDE: continue
    t = open(os.path.join(SRC, n + '.dc.html'), encoding='utf-8').read()
    title = re.search(r'<title>(.*?)</title>', t, re.S).group(1)
    css = re.search(r'<helmet>\s*<style>(.*?)</style>\s*</helmet>', t, re.S).group(1)
    body = re.search(r'</helmet>(.*)</x-dc>', t, re.S).group(1).strip()
    code = re.search(r'<script type="text/x-dc" data-dc-script[^>]*>(.*?)</script>', t, re.S).group(1)
    assert '</script' not in code and '</template' not in body, n
    html = f'''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{DESC}">
<meta name="robots" content="noindex">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{DESC}">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="preload" href="assets/{assets['ca7b12c2966f7a2a6f655d30bc6caae8']}" as="font" type="font/woff2" crossorigin>
<style>{fix(css)}</style>
</head>
<body>
<div id="app"><!--PRERENDER--></div>
<template id="dc">
{fix(body)}
</template>
<script type="text/plain" id="dc-code">{fix(code)}</script>
<script src="runtime.js"></script>
</body>
</html>
'''
    open(os.path.join(OUT, out_name(n)), 'w', encoding='utf-8').write(html)
for i in used: shutil.copy(os.path.join(AF, assets[i]), os.path.join(OUT, 'assets', assets[i]))
shutil.copy(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'runtime.js'), os.path.join(OUT, 'runtime.js'))
open(os.path.join(OUT, 'assets', 'favicon.svg'), 'w').write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#18181B"/><path d="M9 16.5l4.6 4.6L23 11.5" fill="none" stroke="#B6F24B" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>')
shutil.copy(os.path.join(OUT, 'error.html'), os.path.join(OUT, '404.html'))
open(os.path.join(OUT, '.nojekyll'), 'w').close()
print(len(os.listdir(OUT)), 'files;', len(used), 'assets')
