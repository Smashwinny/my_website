"""Produce self-contained mobile VRMs, preserving rig, mesh, alpha and licenses."""
import io,json,struct,gzip
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
for name in ['traveler','traveler-male']:
    source=root/'public/models'/f'{name}.vrm'
    raw=source.read_bytes(); size=struct.unpack_from('<I',raw,12)[0]
    doc=json.loads(raw[20:20+size]); binary=raw[28+size:]
    images={i['bufferView'] for i in doc.get('images',[]) if 'bufferView' in i}
    packed=bytearray()
    for index,view in enumerate(doc['bufferViews']):
        offset=view.get('byteOffset',0); chunk=binary[offset:offset+view['byteLength']]
        if index in images:
            im=Image.open(io.BytesIO(chunk));im.thumbnail((512,512),Image.LANCZOS)
            out=io.BytesIO();im.save(out,format='PNG',optimize=True);chunk=out.getvalue()
        packed.extend(b'\0'*((-len(packed))%4));view['byteOffset']=len(packed);view['byteLength']=len(chunk);packed.extend(chunk)
    for im in doc.get('images',[]):
        if 'bufferView' in im: im['mimeType']='image/png'
    doc['buffers'][0]['byteLength']=len(packed)
    encoded=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode();encoded+=b' '*((-len(encoded))%4);packed.extend(b'\0'*((-len(packed))%4))
    result=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(packed))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(packed),0x004e4942)+packed
    dest=source.with_name(name+'-mobile.vrm');dest.write_bytes(result)
    compressed=gzip.compress(result,compresslevel=9,mtime=0);dest.with_suffix('.vrm.bin').write_bytes(compressed)
    print(f'  transfer gzip: {len(compressed):,} bytes')
    print(f'{source.name}: {len(raw):,} -> {len(result):,} bytes ({100*(1-len(result)/len(raw)):.1f}% smaller)')
