import fcntl
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
import time
from urllib.request import urlopen

from check_site import ROOT, public_files


def switch(site, target):
    link = site / '.current-next'
    link.unlink(missing_ok=True)
    link.symlink_to(target)
    os.replace(link, site / 'current')


def deploy(revision, source=ROOT, site=Path('/srv/simonov-tech'),
           health_url='http://127.0.0.1:8098', attempts=10):
    if not re.fullmatch(r'[0-9a-f]{40}', revision):
        raise ValueError('Версия должна быть полным SHA коммита')
    files = public_files(source)
    releases = site / 'releases'
    releases.mkdir(parents=True, exist_ok=True)
    with (site / '.deploy.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        current = site / 'current'
        previous = os.readlink(current) if current.is_symlink() else None
        release = Path(tempfile.mkdtemp(prefix=revision + '-', dir=releases))
        release.chmod(0o755)
        try:
            for path in files:
                target = release / path.relative_to(source)
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(path, target)
                target.chmod(0o644)
            (release / 'version.txt').write_text(revision + '\n')
            switch(site, release.relative_to(site))
            for attempt in range(attempts):
                try:
                    with urlopen(health_url + '/version.txt', timeout=5) as response:
                        if response.read().decode().strip() != revision:
                            raise RuntimeError('HTTP отвечает другой версией')
                    with urlopen(health_url + '/', timeout=5) as response:
                        if b'Simonov Tech' not in response.read():
                            raise RuntimeError('HTTP отвечает другим сайтом')
                    break
                except Exception:
                    if attempt + 1 == attempts:
                        raise
                    time.sleep(1)
        except BaseException:
            if previous is not None:
                switch(site, previous)
            else:
                current.unlink(missing_ok=True)
            shutil.rmtree(release)
            raise
        keep = {release.resolve()}
        if previous is not None:
            keep.add((site / previous).resolve())
        for old in sorted(releases.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)[:5]:
            keep.add(old.resolve())
        for old in releases.iterdir():
            if old.resolve() not in keep and old.is_dir():
                shutil.rmtree(old)
        print(f'Опубликована и проверена версия {revision}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('Использование: python3 scripts/deploy.py <commit-sha>')
    deploy(sys.argv[1])
