"""Build-time only, lossless gzip search. No website dependency is added.
Default: report only. --write replaces only the four named transport copies;
the authoritative VRM files and their decoded bytes never change.
"""
import argparse,gzip,hashlib,json,pathlib,time
import zopfli.gzip
ap=argparse.ArgumentParser();ap.add_argument('--write',action='store_true');args=ap.parse_args()
rows=[]
for stem in ['traveler-male-web','traveler-web','traveler-male-lite','traveler-lite']:
    path=pathlib.Path('public/models')/(stem+'.vrm')
    raw=path.read_bytes();old=path.with_suffix('.vrm.bin').read_bytes()
    assert gzip.decompress(old)==raw
    start=time.perf_counter()
    packed=zopfli.gzip.compress(raw,numiterations=15)
    assert gzip.decompress(packed)==raw,'Golden decoded model must be byte-identical'
    row={'model':stem,'raw_sha256':hashlib.sha256(raw).hexdigest(),'before':len(old),'after':len(packed),'reduction':1-len(packed)/len(old),'seconds':time.perf_counter()-start}
    rows.append(row);print(json.dumps(row),flush=True)
    if args.write and len(packed)<len(old):path.with_suffix('.vrm.bin').write_bytes(packed)
pathlib.Path('perf/bench/repack.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
