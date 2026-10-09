from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import tempfile
import threading
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from deploy import deploy


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class DeployTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.source = root / 'source'
        self.site = root / 'site'
        self.source.mkdir()
        self.site.mkdir()
        for name in ('css', 'js', 'assets'):
            (self.source / name).mkdir()
        (self.source / 'index.html').write_text('Simonov Tech')
        (self.source / '.secret').write_text('private')
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(
            QuietHandler, directory=str(self.site / 'current')))
        self.addCleanup(server.server_close)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(thread.join)
        self.addCleanup(server.shutdown)
        self.url = f'http://127.0.0.1:{server.server_port}'

    def publish(self, revision):
        deploy(revision, self.source, self.site, self.url, attempts=1)

    def test_publish_only_public_files(self):
        self.publish('a' * 40)
        self.assertEqual((self.site / 'current/version.txt').read_text().strip(), 'a' * 40)
        self.assertFalse((self.site / 'current/.secret').exists())
        self.assertEqual(len(list((self.site / 'releases').iterdir())), 1)

    def test_failed_health_restores_previous_release(self):
        self.publish('a' * 40)
        before = (self.site / 'current').resolve()
        (self.source / 'index.html').write_text('broken response')
        with self.assertRaisesRegex(RuntimeError, 'другим сайтом'):
            self.publish('b' * 40)
        self.assertEqual((self.site / 'current').resolve(), before)
        self.assertEqual(len(list((self.site / 'releases').iterdir())), 1)

    def test_symlink_is_rejected_before_switch(self):
        self.publish('a' * 40)
        before = (self.site / 'current').resolve()
        (self.source / 'assets/leak').symlink_to(self.source / '.secret')
        with self.assertRaisesRegex(ValueError, 'Символическая ссылка'):
            self.publish('b' * 40)
        self.assertEqual((self.site / 'current').resolve(), before)


if __name__ == '__main__':
    unittest.main()
