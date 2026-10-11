from functools import partial
from html.parser import HTMLParser
from http.server import ThreadingHTTPServer
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from check_site import ROOT, References
from serve import PublicHandler, copy_public


class QuietHandler(PublicHandler):
    def log_message(self, *args):
        pass


class PreviewTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.source = root / 'source'
        self.public = root / 'public'
        self.source.mkdir()
        self.public.mkdir()
        for name in ('css', 'js', 'assets', '.git', 'scripts'):
            (self.source / name).mkdir()
        (self.source / 'index.html').write_text('Simonov Tech')
        (self.source / 'assets/image.svg').write_text('<svg/>')
        (self.source / '.git/HEAD').write_text('private')
        (self.source / 'scripts/deploy.py').write_text('private')
        (self.source / 'README.md').write_text('private')

    def test_only_public_files_are_served(self):
        copy_public(self.source, self.public)
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(
            QuietHandler, directory=str(self.public)))
        self.addCleanup(server.server_close)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(thread.join)
        self.addCleanup(server.shutdown)
        url = f'http://127.0.0.1:{server.server_port}'
        for path, content in (('/', b'Simonov Tech'), ('/assets/image.svg', b'<svg/>')):
            with self.subTest(path=path), urlopen(url + path) as response:
                self.assertEqual(response.read(), content)
        for path, status in (('/.git/HEAD', 404), ('/scripts/deploy.py', 404),
                             ('/README.md', 404), ('/assets/', 403),
                             ('/../source/.git/HEAD', 404)):
            with self.subTest(path=path), self.assertRaises(HTTPError) as error:
                urlopen(url + path)
            with error.exception:
                self.assertEqual(error.exception.code, status)

    def test_private_entries_are_rejected_before_copy(self):
        for name, symlink in (('leak.svg', True), ('.secret', False)):
            with self.subTest(name=name):
                entry = self.source / 'assets' / name
                if symlink:
                    entry.symlink_to(self.source / '.git/HEAD')
                else:
                    entry.write_text('private')
                with self.assertRaises(ValueError):
                    copy_public(self.source, self.public)
                self.assertEqual(list(self.public.iterdir()), [])
                entry.unlink()


class SecurityPolicyTest(unittest.TestCase):
    def test_inline_javascript_fails_site_check(self):
        for html in ('<script>alert(1)</script>', '<img onerror="alert(1)">',
                     '<a onclick="alert(1)">link</a>'):
            with self.subTest(html=html), self.assertRaises(ValueError):
                References().feed(html)

    def test_meta_policy_matches_nginx_and_blocks_scripts(self):
        policies = []

        class MetaPolicy(HTMLParser):
            def handle_starttag(self, tag, attrs):
                attrs = dict(attrs)
                if tag == 'meta' and attrs.get('http-equiv') == 'Content-Security-Policy':
                    policies.append(attrs['content'])

        MetaPolicy().feed((ROOT / 'index.html').read_text())
        self.assertEqual(len(policies), 1)
        directives = dict((part.strip().split(' ', 1)) for part in policies[0].split(';'))
        self.assertEqual(directives['default-src'], "'none'")
        self.assertEqual(directives['script-src'], "'self'")
        self.assertEqual(directives['base-uri'], "'none'")
        self.assertEqual(directives['form-action'], "'none'")
        nginx = (ROOT / 'deploy/nginx.conf').read_text()
        self.assertIn(f'"{policies[0]}; frame-ancestors \'none\'" always;', nginx)


if __name__ == '__main__':
    unittest.main()
