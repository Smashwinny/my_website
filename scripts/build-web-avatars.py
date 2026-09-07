"""Build detail-preserving VRM web assets with Pillow + NumPy only.

Usage: python scripts/build-web-avatars.py --source-dir public/models --output-dir public/models
No network, model downloads, mesh decimation, codec runtime, or rig replacement.
The authoritative source VRMs are not modified. Rebuilds are deterministic with
the same Python/Pillow/NumPy versions. Output reports verify triangle coverage,
vertex streams, humanoid/spring/constraint metadata, skins and morph preservation.
"""
from __future__ import annotations

import argparse
import copy
import gzip
import hashlib
import io
import json
import struct
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image

DTYPES = {5120: np.int8, 5121: np.uint8, 5122: np.dtype('<i2'),
          5123: np.dtype('<u2'), 5125: np.dtype('<u4'), 5126: np.dtype('<f4')}
COUNTS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def read_glb(path):
    raw = Path(path).read_bytes()
    magic, version, length = struct.unpack_from('<III', raw)
    assert magic == 0x46546C67 and version == 2 and length == len(raw)
    cursor, doc, binary = 12, None, None
    while cursor < length:
        size, kind = struct.unpack_from('<II', raw, cursor)
        payload = raw[cursor + 8:cursor + 8 + size]
        if kind == 0x4E4F534A:
            doc = json.loads(payload)
        elif kind == 0x004E4942:
            binary = payload
        cursor += 8 + size
    assert doc is not None and binary is not None and len(doc['buffers']) == 1
    return doc, binary, raw


def view_bytes(doc, binary, index):
    view = doc['bufferViews'][index]
    start = view.get('byteOffset', 0)
    return binary[start:start + view['byteLength']]


def array(doc, binary, index):
    accessor = doc['accessors'][index]
    dtype = np.dtype(DTYPES[accessor['componentType']])
    width = COUNTS[accessor['type']]
    if 'bufferView' in accessor:
        view = doc['bufferViews'][accessor['bufferView']]
        stride = view.get('byteStride', dtype.itemsize * width)
        start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
        result = np.ndarray((accessor['count'], width), dtype=dtype,
                            buffer=binary, offset=start, strides=(stride, dtype.itemsize)).copy()
    else:
        result = np.zeros((accessor['count'], width), dtype=dtype)
    if 'sparse' in accessor:
        sparse = accessor['sparse']
        ids, values = sparse['indices'], sparse['values']
        indices = np.frombuffer(view_bytes(doc, binary, ids['bufferView']),
                                dtype=DTYPES[ids['componentType']], count=sparse['count'],
                                offset=ids.get('byteOffset', 0))
        replacements = np.frombuffer(view_bytes(doc, binary, values['bufferView']),
                                     dtype=dtype, count=sparse['count'] * width,
                                     offset=values.get('byteOffset', 0)).reshape(-1, width)
        result[indices] = replacements
    return result


def primitive_key(primitive):
    return json.dumps({key: value for key, value in primitive.items() if key != 'indices'},
                      sort_keys=True, separators=(',', ':'))


def geometry_signature(doc, binary):
    """Cover all vertex channels, morph deltas, material/triangle associations."""
    groups = defaultdict(list)
    streams = {}
    for mesh_index, mesh in enumerate(doc['meshes']):
        for primitive in mesh['primitives']:
            key = (mesh_index, primitive_key(primitive))
            indices = array(doc, binary, primitive['indices']).flatten()
            groups[key].append(indices.astype('<u4').tobytes())
            for accessor_index in primitive['attributes'].values():
                streams[accessor_index] = hashlib.sha256(array(doc, binary, accessor_index).tobytes()).hexdigest()
            for target in primitive.get('targets', []):
                for accessor_index in target.values():
                    streams[accessor_index] = hashlib.sha256(array(doc, binary, accessor_index).tobytes()).hexdigest()
    return ({key: hashlib.sha256(b''.join(value)).hexdigest() for key, value in groups.items()}, streams)


def stats(doc, binary, raw):
    position_accessors = {p['attributes']['POSITION'] for m in doc['meshes'] for p in m['primitives']}
    pixels = 0
    for image in doc.get('images', []):
        im = Image.open(io.BytesIO(view_bytes(doc, binary, image['bufferView'])))
        pixels += im.width * im.height
    return {'file_bytes': len(raw), 'gzip_bytes': len(gzip.compress(raw, compresslevel=9, mtime=0)),
            'primitives': sum(len(m['primitives']) for m in doc['meshes']),
            'triangles': sum(doc['accessors'][p['indices']]['count'] // 3 for m in doc['meshes'] for p in m['primitives']),
            'unique_vertices': sum(doc['accessors'][a]['count'] for a in position_accessors),
            'nodes': len(doc['nodes']), 'skins': len(doc['skins']),
            'image_pixels': pixels, 'image_mip_rgba_bytes_estimate': round(pixels * 4 * 4 / 3)}


def image_policy(name, profile='web'):
    lower = name.lower()
    if 'thumbnail' in lower:
        return 128
    if '_out' in lower or 'matcap' in lower:
        return 256
    if profile == 'lite':
        # Spend the old mobile texture budget on the face, not metadata or torso.
        if lower.endswith('face_00'):
            return 1024
        if 'body' in lower:
            return 256
        return 512
    if any(token in lower for token in ('face', 'eye', 'hair')):
        return 1024
    return 512


def encode_texture(data, name, profile='web'):
    im = Image.open(io.BytesIO(data)).convert('RGBA')
    before = im.size
    limit = image_policy(name, profile)
    im.thumbnail((limit, limit), Image.Resampling.LANCZOS)
    normal = any(token in name.lower() for token in ('_nml', 'normal'))
    # Normal maps are vectors, not display colors. Re-normalize after downsampling.
    if normal and before != im.size:
        channels = np.asarray(im).copy()
        vectors = channels[:, :, :3].astype(np.float32) / 127.5 - 1
        lengths = np.linalg.norm(vectors, axis=2, keepdims=True)
        vectors = vectors / np.maximum(lengths, 1e-6)
        channels[:, :, :3] = np.clip(np.round((vectors + 1) * 127.5), 0, 255).astype(np.uint8)
        im = Image.fromarray(channels)
    alpha = im.getchannel('A').getextrema() != (255, 255)
    out = io.BytesIO()
    # Standard glTF codecs: no WebP extension or JS transcoder dependency.
    if alpha or normal or max(im.size) <= 32 or '_out' in name.lower():
        if not alpha:
            im = im.convert('RGB')
        im.save(out, format='PNG', optimize=True)
        mime = 'image/png'
    else:
        im = im.convert('RGB')
        im.save(out, format='JPEG', quality=91 if limit == 1024 else 86,
                subsampling=0, optimize=True, progressive=False)
        mime = 'image/jpeg'
    encoded = out.getvalue()
    # Quantify codec distortion against the resized reference (RGB only).
    decoded = Image.open(io.BytesIO(encoded)).convert('RGB')
    mse = float(np.mean((np.asarray(im.convert('RGB'), dtype=np.float32) -
                         np.asarray(decoded, dtype=np.float32)) ** 2))
    return encoded, mime, {'name': name, 'source_size': list(before), 'web_size': list(im.size),
                          'source_bytes': len(data), 'web_bytes': len(encoded), 'format': mime,
                          'alpha_preserved': alpha, 'codec_psnr_db': round(10*np.log10(255**2 / mse), 2) if mse else None}


def build(source, output, profile='web'):
    original, old_binary, old_raw = read_glb(source)
    doc = copy.deepcopy(original)
    signature = geometry_signature(original, old_binary)
    old_stats = stats(original, old_binary, old_raw)
    chunks = [view_bytes(doc, old_binary, i) for i in range(len(doc['bufferViews']))]
    texture_report = []
    for image in doc['images']:
        i = image['bufferView']
        chunks[i], image['mimeType'], entry = encode_texture(chunks[i], image.get('name', ''), profile)
        texture_report.append(entry)
    # Old export uses plain LINEAR minification. Mipmaps reduce distant shimmer.
    for sampler in doc.get('samplers', []):
        sampler['magFilter'] = 9729
        sampler['minFilter'] = 9987
    # Merge only identical pipelines, attributes, target arrays and material.
    # Mesh/node indices stay stable, including VRM0 blendShape and firstPerson refs.
    for mesh in doc['meshes']:
        grouped = {}
        for primitive in mesh['primitives']:
            grouped.setdefault(primitive_key(primitive), []).append(primitive)
        merged = []
        for primitives in grouped.values():
            primitive = copy.deepcopy(primitives[0])
            if len(primitives) > 1:
                indices = np.concatenate([array(original, old_binary, p['indices']).flatten() for p in primitives])
                component_type = 5123 if indices.max() < 65536 else 5125
                data = indices.astype(DTYPES[component_type]).tobytes()
                view_index = len(chunks)
                chunks.append(data)
                doc['bufferViews'].append({'buffer': 0, 'byteLength': len(data), 'target': 34963})
                primitive['indices'] = len(doc['accessors'])
                doc['accessors'].append({'bufferView': view_index, 'componentType': component_type,
                                         'count': len(indices), 'type': 'SCALAR',
                                         'min': [int(indices.min())], 'max': [int(indices.max())]})
            merged.append(primitive)
        mesh['primitives'] = merged
    # Retain accessor indices to preserve unknown extension references. Identical
    # payloads share offsets; this does not reorder geometry or alter its values.
    packed, known = bytearray(), {}
    for view, chunk in zip(doc['bufferViews'], chunks):
        key = (hashlib.sha256(chunk).digest(), len(chunk))
        if key not in known:
            packed.extend(b'\0' * (-len(packed) % 4))
            known[key] = len(packed)
            packed.extend(chunk)
        view['byteOffset'], view['byteLength'] = known[key], len(chunk)
    doc['buffers'][0]['byteLength'] = len(packed)
    encoded = json.dumps(doc, separators=(',', ':'), ensure_ascii=False).encode()
    encoded += b' ' * (-len(encoded) % 4)
    packed.extend(b'\0' * (-len(packed) % 4))
    raw = (struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(packed)) +
           struct.pack('<II', len(encoded), 0x4e4f534a) + encoded +
           struct.pack('<II', len(packed), 0x004e4942) + packed)
    output.write_bytes(raw)
    output.with_suffix('.vrm.bin').write_bytes(gzip.compress(raw, compresslevel=9, mtime=0))
    checked, checked_binary, checked_raw = read_glb(output)
    assert geometry_signature(checked, checked_binary) == signature, 'Geometry/morph alteration'
    for key in ('nodes', 'skins', 'extensions', 'extensionsUsed', 'extensionsRequired', 'animations'):
        assert original.get(key) == checked.get(key), f'{key} altered'
    for view in checked['bufferViews']:
        assert view['byteOffset'] % 4 == 0
        assert view['byteOffset'] + view['byteLength'] <= checked['buffers'][0]['byteLength']
    assert gzip.decompress(output.with_suffix('.vrm.bin').read_bytes()) == raw
    result = {'source_file': source.name, 'output': output.name, 'profile': profile,
              'source_sha256': hashlib.sha256(old_raw).hexdigest(),
              'web_sha256': hashlib.sha256(raw).hexdigest(),
              'source': old_stats, 'web': stats(checked, checked_binary, checked_raw),
              'verified': ['triangle coverage and material association', 'all vertex channels',
                           'all morph deltas', 'nodes and skins', 'humanoid/spring/constraint metadata',
                           'embedded licensing', '4-byte aligned bounded views', 'gzip roundtrip'],
              'textures': texture_report}
    baseline = source.with_name(source.stem + '-mobile.vrm')
    if baseline.exists():
        mobile_doc, mobile_binary, mobile_raw = read_glb(baseline)
        result['previous_mobile'] = stats(mobile_doc, mobile_binary, mobile_raw)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--profile', choices=('web', 'lite', 'all'), default='web')
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    results = []
    for profile in ('web', 'lite') if args.profile == 'all' else (args.profile,):
        for name in ('traveler-male', 'traveler'):
            result = build(args.source_dir / f'{name}.vrm', args.output_dir / f'{name}-{profile}.vrm', profile)
            results.append(result)
            print(json.dumps({k: v for k, v in result.items() if k not in ('textures', 'verified')}, indent=2))
    (args.output_dir / 'avatar-build-report.json').write_text(json.dumps(results, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
