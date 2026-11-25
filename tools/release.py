"""GitHub Releases의 최신 릴리스 정보를 배포 폴더의 config.js에 채운다.

  python3 tools/release.py dist

배포(deploy.py) 다음, 미리 그리기(prerender.js) 전에 실행한다.
web/config.js 의 autoRelease 가 true일 때만 동작한다.

읽는 것: 이 저장소의 최신 릴리스 (초안·사전 공개(pre-release)는 제외)
채우는 값: downloadUrl, programVersion, programDate, programSize, programSha256, releaseNotesUrl

환경 변수
  GITHUB_REPOSITORY  릴리스를 읽을 저장소 (기본: fromistarantino/comfit_web_2026)
  GITHUB_TOKEN       있으면 API 요청에 사용 (Actions에서는 자동으로 있음)

릴리스가 없거나 GitHub에 연결하지 못하면 config.js를 바꾸지 않고 경고만 남긴다.
(사이트 배포는 계속되고, config.js에 직접 적은 값이 그대로 쓰인다.)
"""
import datetime, hashlib, json, os, re, sys, urllib.error, urllib.request

DEFAULT_REPO = 'fromistarantino/comfit_web_2026'
MARKER = '/* ============ 아래는 고치지 마세요'
# 설치 파일로 인정하는 확장자 (앞에 있을수록 우선)
EXTS = ('.exe', '.msi', '.msix', '.zip')
KST = datetime.timezone(datetime.timedelta(hours=9))


def warn(msg):
    # GitHub Actions 화면에 노란 경고로 보인다
    print('::warning::' + msg if os.environ.get('GITHUB_ACTIONS') else '경고: ' + msg)


def request(url, accept='application/vnd.github+json'):
    req = urllib.request.Request(url, headers={'Accept': accept, 'User-Agent': 'comfit-site-deploy',
                                               'X-GitHub-Api-Version': '2022-11-28'})
    token = os.environ.get('GITHUB_TOKEN')
    if token and url.startswith('https://api.github.com/'):
        req.add_header('Authorization', 'Bearer ' + token)
    return urllib.request.urlopen(req, timeout=60)


def pick_asset(assets, pattern):
    files = [a for a in assets if a.get('state', 'uploaded') == 'uploaded']
    if pattern:
        rx = re.compile(pattern, re.I)
        files = [a for a in files if rx.search(a['name'])]
    for ext in EXTS:
        for a in files:
            if a['name'].lower().endswith(ext):
                return a
    return None


def sha256_of(asset):
    digest = str(asset.get('digest') or '')
    if digest.startswith('sha256:') and re.fullmatch(r'[0-9a-f]{64}', digest[7:]):
        return digest[7:]
    # 예전에 올린 파일은 GitHub가 값을 주지 않으므로 받아서 직접 계산
    h = hashlib.sha256()
    with request(asset['url'], accept='application/octet-stream') as r:
        for chunk in iter(lambda: r.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def size_text(n):
    mb = n / (1024 * 1024)
    if mb < 1:
        return '%d KB' % max(1, round(n / 1024))
    return ('%.1f MB' % mb) if mb < 10 else ('%d MB' % round(mb))


def date_text(iso):
    d = datetime.datetime.fromisoformat(iso.replace('Z', '+00:00')).astimezone(KST)
    return '%d. %d. %d.' % (d.year, d.month, d.day)


def read_setting(js, key):
    m = re.search(r'^\s*%s:\s*(true|false|\'((?:[^\'\\]|\\.)*)\')' % key, js, re.M)
    if not m:
        return None
    return (m.group(1) == 'true') if m.group(2) is None else m.group(2)


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else 'dist'
    path = os.path.join(out, 'config.js')
    with open(path, encoding='utf-8') as f:
        js = f.read()
    if read_setting(js, 'autoRelease') is not True:
        print('autoRelease가 꺼져 있어 config.js에 적은 다운로드 값을 그대로 씁니다.')
        return
    if MARKER not in js:
        sys.exit('config.js에서 "아래는 고치지 마세요" 줄을 찾지 못했습니다.')
    repo = os.environ.get('GITHUB_REPOSITORY') or DEFAULT_REPO
    try:
        with request('https://api.github.com/repos/%s/releases/latest' % repo) as r:
            rel = json.load(r)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            warn('%s 에 공개된 릴리스가 없습니다. 다운로드 버튼은 config.js 값대로 표시됩니다.' % repo)
        else:
            warn('GitHub 릴리스 정보를 읽지 못했습니다 (HTTP %d). config.js 값대로 배포합니다.' % e.code)
        return
    except (urllib.error.URLError, TimeoutError) as e:
        warn('GitHub에 연결하지 못했습니다 (%s). config.js 값대로 배포합니다.' % e)
        return

    asset = pick_asset(rel.get('assets') or [], read_setting(js, 'releaseAsset') or '')
    if not asset:
        warn('최신 릴리스 %s 에 설치 파일(%s)이 없습니다. config.js 값대로 배포합니다.'
             % (rel.get('tag_name'), ', '.join(EXTS)))
        return
    try:
        sha = sha256_of(asset)
    except (urllib.error.URLError, TimeoutError) as e:
        warn('설치 파일의 SHA-256을 계산하지 못했습니다 (%s). 확인 값 없이 배포합니다.' % e)
        sha = ''
    values = {
        'downloadUrl': asset['browser_download_url'],
        'programVersion': rel.get('tag_name') or '',
        'programDate': date_text(rel.get('published_at') or rel['created_at']),
        'programSize': size_text(asset['size']),
        'programSha256': sha,
        'releaseNotesUrl': rel.get('html_url') or '',
    }
    block = ('/* ---------- 배포할 때 GitHub 최신 릴리스(%s)에서 자동으로 채운 값 (tools/release.py) ---------- */\n'
             'Object.assign(window.COMFIT, %s);\n\n' % (values['programVersion'], json.dumps(values, ensure_ascii=False, indent=2)))
    js = js.replace(MARKER, block + MARKER, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(js)
    print('최신 릴리스 %s: %s (%s, %s)' % (values['programVersion'], asset['name'], values['programSize'], values['programDate']))


if __name__ == '__main__':
    main()
