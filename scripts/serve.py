from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import shutil
import tempfile

from check_site import ROOT, public_files


class PublicHandler(SimpleHTTPRequestHandler):
    def list_directory(self, path):
        self.send_error(403, 'Directory listing disabled')
        return None


def copy_public(source, destination):
    files = public_files(source)
    for path in files:
        target = destination / path.relative_to(source)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)


def main():
    with tempfile.TemporaryDirectory(prefix='simonov-tech-preview-') as directory:
        copy_public(ROOT, Path(directory))
        handler = partial(PublicHandler, directory=directory)
        with ThreadingHTTPServer(('127.0.0.1', 8137), handler) as server:
            print('Сайт: http://127.0.0.1:8137 (Ctrl+C для остановки)', flush=True)
            try:
                server.serve_forever()
            except KeyboardInterrupt:
                pass


if __name__ == '__main__':
    main()
