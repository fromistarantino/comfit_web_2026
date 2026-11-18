"""배포용 폴더(dist/)를 만든다.

  python3 tools/deploy.py          deploy.json 설정대로
  python3 tools/deploy.py pc       PC 웹사이트만 (web/)
  python3 tools/deploy.py all      PC + 모바일 (web/ + mobile/)

pc: 모바일 스타일을 빼고, 휴대폰에서는 PC 화면이 축소되어 보이도록 한다.

deploy.json 의 "domain" 에 내 도메인(예: "comfit.kr")을 적으면 CNAME 파일을 만들고
404 화면의 기준 주소를 도메인 맨 앞(/)으로 맞춘다. 비워 두면 github.io/comfit_web_2026/ 기준.
"""
import json, os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOBILE_LINK = '<link rel="stylesheet" href="../mobile/mobile.css" data-part="mobile">'
VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1">'


def main():
    with open(os.path.join(ROOT, 'deploy.json'), encoding='utf-8') as f:
        conf = json.load(f)
    mode = sys.argv[1] if len(sys.argv) > 1 else ('all' if conf.get('mobile') else 'pc')
    domain = str(conf.get('domain') or '').strip().lower()
    domain = re.sub(r'^https?://', '', domain).strip('/')
    if domain and not re.fullmatch(r'[a-z0-9.-]+\.[a-z]{2,}', domain):
        sys.exit('deploy.json 의 domain 값을 확인하세요: ' + domain)
    if mode not in ('pc', 'all'):
        sys.exit('pc 또는 all 중 하나를 쓰세요.')
    out = os.path.join(ROOT, sys.argv[2] if len(sys.argv) > 2 else 'dist')
    shutil.rmtree(out, ignore_errors=True)
    shutil.copytree(os.path.join(ROOT, 'web'), out)
    if mode == 'all':
        shutil.copytree(os.path.join(ROOT, 'mobile'), os.path.join(out, 'mobile'))
    pages = [n for n in os.listdir(out) if n.endswith('.html')]
    for name in pages:
        path = os.path.join(out, name)
        with open(path, encoding='utf-8') as f:
            html = f.read()
        if MOBILE_LINK not in html or VIEWPORT not in html:
            sys.exit(name + ': 모바일 스타일 줄이나 viewport 줄을 찾지 못했습니다.')
        if mode == 'all':
            html = html.replace(MOBILE_LINK, MOBILE_LINK.replace('../mobile/', 'mobile/'))
        else:
            html = html.replace(MOBILE_LINK + '\n', '').replace(MOBILE_LINK, '')
            html = html.replace(VIEWPORT, '<meta name="viewport" content="width=1280">')
        html = re.sub(r'<base href="[^"]*">', '<base href="%s">' % ('/' if domain else '/comfit_web_2026/'), html)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(html)
    open(os.path.join(out, '.nojekyll'), 'w').close()
    if domain:
        with open(os.path.join(out, 'CNAME'), 'w') as f:
            f.write(domain + '\n')
    print('%s: %d개 페이지 -> %s (%s, %s)' % (mode, len(pages), out, 'PC + 모바일' if mode == 'all' else 'PC만',
                                          domain or 'github.io 주소'))


if __name__ == '__main__':
    main()
