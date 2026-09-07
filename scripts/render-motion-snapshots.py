"""Inspect snapshots of actual website posed world-space geometry offline.

The scene owner exports evaluated skinned vertex positions/normals, triangles,
UVs and runtime material color. This script reads those poses without simulating
animation again. Embedded VRM textures are looked up by material name. Added
cloth/accessory meshes without a VRM texture are rendered with runtime colors.

Expected JSON: {"frames": [{"character": "male", "pose": "walk", "sourceVrm":
"traveler-male-web.vrm", "meshes": [{"positions": [...], "normals": [...],
"uv": [...], "indices": [...], "materialName": "...", "color": [r,g,b],
"hasTexture": true, "opacity": 1, "alphaTest": .5, "doubleSided": true}]}]}
RGB colors are linear, as emitted by Three.Color.toArray(). Arrays may be flat
or nested. SourceVRM textures are read-only. No browser or site files are changed.
"""
from __future__ import annotations

import argparse
import copy
import importlib.util
import io
import json
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

spec = importlib.util.spec_from_file_location('avatar_render', Path(__file__).with_name('render-avatar-comparison.py'))
renderer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)


def first(record, *keys, default=None):
    return next((record[key] for key in keys if key in record), default)


def source_materials(path):
    doc, binary, _ = renderer.builder.read_glb(path)
    images = {}
    materials = {}
    for mat in doc['materials']:
        pbr = mat.get('pbrMetallicRoughness', {})
        texture_id = pbr.get('baseColorTexture', {}).get('index')
        if texture_id is not None:
            image_id = doc['textures'][texture_id]['source']
            if image_id not in images:
                view = doc['images'][image_id]['bufferView']
                image = Image.open(io.BytesIO(renderer.builder.view_bytes(doc, binary, view))).convert('RGBA')
                images[image_id] = np.asarray(image, dtype=np.float32) / 255
            texture = images[image_id]
        else:
            texture = np.ones((1, 1, 4), dtype=np.float32)
        materials[mat.get('name', '')] = (copy.deepcopy(mat), texture)
    return materials


def normals_from_faces(points, triangles):
    a, b, c = points[triangles[:, 0]], points[triangles[:, 1]], points[triangles[:, 2]]
    face = np.cross(b-a, c-a)
    normals = np.zeros_like(points)
    for column in range(3):
        np.add.at(normals, triangles[:, column], face)
    return normals / np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-7)


def load_frame(frame, source_dir, material_cache, default_source=None):
    source_name = first(frame, 'sourceVrm', 'sourceVRM', 'source', default=default_source)
    if source_name is None:
        source_name = 'traveler-web.vrm' if 'female' in str(frame.get('character', '')).lower() else 'traveler-male-web.vrm'
    source_path = Path(source_name)
    if not source_path.is_file():
        source_path = source_dir / source_path.name
    cache_key = str(source_path.resolve())
    if cache_key not in material_cache:
        material_cache[cache_key] = source_materials(source_path)
    material_lookup = material_cache[cache_key]
    streams, report = [], []
    expanded_meshes = []
    for mesh in frame['meshes']:
        if 'materials' not in mesh:
            expanded_meshes.append(mesh)
            continue
        materials = mesh['materials']
        original_indices = mesh.get('indices')
        if original_indices is None:
            original_indices = np.arange(np.array(mesh['positions']).size // 3).tolist()
        else:
            original_indices = np.array(original_indices).flatten().tolist()
        # Three.js ignores geometry groups for a single Material (e.g. BoxGeometry).
        groups = mesh.get('groups') if len(materials) > 1 else None
        groups = groups or [{'start': 0, 'count': len(original_indices), 'materialIndex': 0}]
        for group in groups:
            start, count = group['start'], group['count']
            material = materials[group.get('materialIndex', 0)]
            expanded_meshes.append({**mesh, **material,
                                    'indices': original_indices[start:start+count],
                                    'materialName': material.get('name', ''),
                                    'hasTexture': material.get('map') is not None})
    for mesh in expanded_meshes:
        points = np.array(first(mesh, 'positions', 'position', 'worldPositions'), dtype=float).reshape(-1, 3)
        indices = first(mesh, 'indices', 'index')
        triangles = np.array(indices if indices is not None else np.arange(len(points)), dtype=int).reshape(-1, 3)
        assert np.isfinite(points).all(), 'Non-finite posed vertices'
        assert triangles.size > 0 and triangles.min() >= 0 and triangles.max() < len(points), 'Invalid triangle indices'
        normal_values = first(mesh, 'normals', 'normal', 'worldNormals')
        normals = np.array(normal_values, dtype=float).reshape(-1, 3) if normal_values is not None else normals_from_faces(points, triangles)
        assert normals.shape == points.shape and np.isfinite(normals).all(), 'Invalid normal stream'
        uv_values = first(mesh, 'uv', 'uvs', 'texcoords')
        uv = np.array(uv_values, dtype=float).reshape(-1, 2) if uv_values is not None else np.zeros((len(points), 2))
        assert len(uv) == len(points), 'UV count differs from vertex count'
        material = mesh.get('material', {})
        if not isinstance(material, dict):
            material = {'name': str(material)}
        properties = {**material, **mesh}
        name = first(properties, 'materialName', 'name', default='')
        matched = material_lookup.get(name)
        if matched is None:
            matched = next((value for key, value in material_lookup.items()
                            if key and name.startswith(key) and 'outline' not in name.lower()), None)
        if matched is not None:
            mat, texture = copy.deepcopy(matched[0]), matched[1]
        else:
            mat, texture = {}, np.ones((1, 1, 4), dtype=np.float32)
        if not properties.get('hasTexture', True) or uv_values is None:
            texture = np.ones((1, 1, 4), dtype=np.float32)
        color = first(properties, 'color', 'baseColorFactor', default=mat.get('pbrMetallicRoughness', {}).get('baseColorFactor', [1, 1, 1]))
        if isinstance(color, dict):
            color = [color.get(channel, 1) for channel in 'rgb']
        if isinstance(color, str):
            hex_color = color.removeprefix('#')
            color = renderer.srgb_to_linear(np.array([int(hex_color[i:i+2], 16)/255 for i in (0, 2, 4)]))
        factor = np.ones(4, dtype=float)
        factor[:min(4, len(color))] = color[:4]
        factor[3] = properties.get('opacity', factor[3])
        alpha_test = properties.get('alphaTest')
        if alpha_test is not None and alpha_test > 0:
            mat['alphaMode'], mat['alphaCutoff'] = 'MASK', alpha_test
        elif properties.get('transparent') is True or factor[3] < 1:
            mat['alphaMode'] = 'BLEND'
        elif properties.get('transparent') is False or properties.get('hasTexture') is False:
            mat['alphaMode'] = 'OPAQUE'
        mat['doubleSided'] = properties.get('doubleSided', properties.get('side') == 2 or mat.get('doubleSided', False))
        streams.append((points, normals, uv, triangles, texture, factor, mat))
        report.append({'name': name, 'vertices': len(points), 'triangles': len(triangles),
                       'texture_matched': matched is not None and texture.shape[:2] != (1, 1),
                       'alpha_mode': mat.get('alphaMode', 'OPAQUE')})
    return streams, report


def safe_name(value):
    return re.sub(r'[^A-Za-z0-9_-]+', '-', str(value)).strip('-') or 'frame'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', type=Path, required=True)
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--size', type=int, default=640)
    parser.add_argument('--states', help='Comma-separated snapshot state names to render')
    args = parser.parse_args()
    data = json.loads(args.snapshot.read_text(encoding='utf-8-sig'))
    frames = data if isinstance(data, list) else data.get('frames', data.get('poses', []))
    if args.states:
        states = set(args.states.split(','))
        frames = [frame for frame in frames if first(frame, 'pose', 'state', 'label', 'id') in states]
    assert frames, 'Snapshot contains no frames'
    default_source = data.get('sourceVrm') if isinstance(data, dict) else None
    args.output_dir.mkdir(parents=True, exist_ok=True)
    material_cache, loaded = {}, []
    for i, frame in enumerate(frames):
        streams, meshes = load_frame(frame, args.source_dir, material_cache, default_source)
        loaded.append((frame, streams, meshes))
    # One stable world-space scale per character across idle, walking and jumping.
    groups = {}
    for frame, streams, meshes in loaded:
        character = first(frame, 'character', 'model', 'name', default='avatar')
        groups.setdefault(character, []).append((frame, streams, meshes))
    reports = []
    for character, group in groups.items():
        all_points = np.concatenate([stream[0] for _, streams, _ in group for stream in streams])
        low, high = all_points.min(axis=0), all_points.max(axis=0)
        height = high[1]-low[1]
        center = np.array([(low[0]+high[0])*.5, low[1], (low[2]+high[2])*.5])
        for frame, streams, meshes in group:
            for stream in streams:
                stream[0][:] = (stream[0]-center)/height
        normalized = (all_points-center)/height
        horizontal_span = max(np.ptp(normalized[:, 0]), np.ptp(normalized[:, 2]), 1)
        framing = {'cx': 0, 'cy': .5, 'scale': .90/horizontal_span}
        for i, (frame, streams, meshes) in enumerate(group):
            pose = first(frame, 'pose', 'state', 'label', 'id', default=f'frame-{i}')
            views = [('FRONT / 0 DEG', 0), ('THREE QUARTER / 35 DEG', 35), ('SIDE / 90 DEG', 90)]
            panels = [(label, renderer.render(streams, yaw=yaw, size=args.size, framing=framing)) for label, yaw in views]
            width, image_height = panels[0][1].size
            sheet = Image.new('RGB', (width*3, image_height+110), '#0d1422')
            draw = ImageDraw.Draw(sheet)
            for j, (label, image) in enumerate(panels):
                sheet.paste(image, (j*width, 56))
                draw.text((j*width+16, 18), label, font=renderer.label_font(19), fill='#dce7fa')
            draw.text((16, image_height+73), f'{character} / {pose} | Actual exported world-space pose; neutral offline lighting. Not a browser screenshot.',
                      font=renderer.label_font(15), fill='#a5b8d4')
            target = args.output_dir / f'{safe_name(character)}-{safe_name(pose)}.png'
            sheet.save(target, optimize=True)
            reports.append({'character': character, 'pose': pose, 'image': target.name,
                            'world_bounds': [low.tolist(), high.tolist()], 'meshes': meshes})
            print(target.name, flush=True)
    (args.output_dir / 'snapshot-render-report.json').write_text(json.dumps(reports, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
