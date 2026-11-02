import importlib.util,pathlib,tempfile,unittest
from html.parser import HTMLParser
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('builder',ROOT/'scripts/build-oauth-info.py');b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
class Test(unittest.TestCase):
 def test_only_allowlisted_information_published(self):
  with tempfile.TemporaryDirectory() as tmp:
   src=pathlib.Path(tmp)/'source';src.mkdir()
   for n in b.FILES:(src/n).write_text('<!doctype html><title>Public</title>')
   (src/'private-business.json').write_text('SYNTHETIC PRIVATE');(src/'nested').mkdir();(src/'nested'/'secret.json').write_text('SYNTHETIC PRIVATE')
   out=pathlib.Path(tmp)/'out';b.build(src,out);self.assertEqual(set(p.name for p in out.iterdir()),set(b.FILES));self.assertNotIn('SYNTHETIC PRIVATE',''.join(p.read_text() for p in out.iterdir()))
 def test_symlink_and_existing_output_rejected(self):
  with tempfile.TemporaryDirectory() as tmp:
   src=pathlib.Path(tmp)/'source';src.mkdir()
   for n in b.FILES:(src/n).write_text('<!doctype html><title>Public</title>')
   (src/'privacy.html').unlink();(src/'privacy.html').symlink_to(src/'index.html')
   with self.assertRaises(ValueError):b.build(src,pathlib.Path(tmp)/'out')
   (src/'privacy.html').unlink();(src/'privacy.html').write_text('<!doctype html>');out=pathlib.Path(tmp)/'out';out.mkdir();(out/'keep').write_text('preserve')
   with self.assertRaises(ValueError):b.build(src,out)
   self.assertEqual((out/'keep').read_text(),'preserve')
 def test_current_pages_relative_links(self):
  class Links(HTMLParser):
   def handle_starttag(self,tag,attrs):
    if tag=='script':raise AssertionError('Static information must not execute scripts')
    if tag=='a':
     href=dict(attrs).get('href','')
     if href and ':' not in href:assert href in b.FILES and (ROOT/'oauth-info'/href).is_file(),href
  for name in b.FILES:Links().feed((ROOT/'oauth-info'/name).read_text())
if __name__=='__main__':unittest.main()
