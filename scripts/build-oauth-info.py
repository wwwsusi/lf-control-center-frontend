#!/usr/bin/env python3
"""Build only three public OAuth information pages; never invokes application build."""
import pathlib,shutil,argparse
FILES=('index.html','privacy.html','terms.html')
def build(source,target):
 source=pathlib.Path(source).resolve();target=pathlib.Path(target).resolve()
 if target.exists():raise ValueError('Output already exists; preserve it')
 contents={}
 for name in FILES:
  p=source/name
  if p.is_symlink() or not p.is_file():raise ValueError('Missing or symlinked public page')
  text=p.read_text(encoding='utf-8')
  if '<!doctype html>' not in text.lower():raise ValueError('Invalid public page')
  contents[name]=text
 target.mkdir(parents=True)
 for name,text in contents.items():(target/name).write_text(text,encoding='utf-8')
 if set(p.name for p in target.iterdir())!=set(FILES):raise ValueError('Unexpected artifact contents')
 return tuple(sorted(contents))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',default='oauth-info');p.add_argument('--output',required=True);a=p.parse_args();build(a.source,a.output);print('PASS: artifact contains only index.html, privacy.html, terms.html')
