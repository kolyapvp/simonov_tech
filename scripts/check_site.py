from html.parser import HTMLParser
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ('index.html', 'css', 'js', 'assets')


def public_files(root):
    files = []
    for name in PUBLIC:
        path = root / name
        if not path.exists():
            raise ValueError(f'Отсутствует {name}')
        entries = [path, *path.rglob('*')] if path.is_dir() else [path]
        for entry in entries:
            if entry.is_symlink():
                raise ValueError(f'Символическая ссылка запрещена: {entry}')
            if any(part.startswith('.') for part in entry.relative_to(root).parts):
                raise ValueError(f'Скрытый файл запрещён: {entry}')
            if entry.is_file():
                files.append(entry)
    return files


class References(HTMLParser):
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key not in ('src', 'href') or not value:
                continue
            url = urlsplit(value)
            if url.scheme or url.netloc or not url.path:
                continue
            target = (ROOT / unquote(url.path).lstrip('/')).resolve()
            if not target.is_relative_to(ROOT) or not target.is_file():
                raise ValueError(f'Отсутствует локальный ресурс: {value}')


def main():
    files = public_files(ROOT)
    References().feed((ROOT / 'index.html').read_text())
    for path in files:
        if path.suffix == '.js':
            subprocess.run(['node', '--check', str(path)], check=True)
        elif path.suffix == '.svg':
            ET.parse(path)
    print(f'Проверены HTML-ресурсы, JavaScript и SVG; файлов: {len(files)}')


if __name__ == '__main__':
    main()
