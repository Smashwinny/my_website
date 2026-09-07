"""Offline CPU VRM visual check: actual meshes, skin bind pose, UVs and alpha.

Uses only NumPy/Pillow. This is a neutral-lit geometry/texture inspection render,
not a browser screenshot or a full MToon renderer: no MToon outline, normal maps,
postprocessing, cloth motion or spring bones are simulated. The same projection,
lighting and source pose are used for old-mobile, web and lite variants.
"""
from __future__ import annotations

import argparse
import importlib.util
import io
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

spec = importlib.util.spec_from_file_location('avatar_builder', Path(__file__).with_name('build-web-avatars.py'))
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def transform(node):
    if 'matrix' in node:
        return np.array(node['matrix'], dtype=float).reshape(4, 4).T
    x, y, z, w = node.get('rotation', [0, 0, 0, 1])
    matrix = np.eye(4)
    matrix[:3, :3] = [[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
                      [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
                      [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]]
    matrix[:3, :3] *= np.array(node.get('scale', [1, 1, 1]))[None, :]
    matrix[:3, 3] = node.get('translation', [0, 0, 0])
    return matrix


def srgb_to_linear(values):
    return np.where(values <= .04045, values / 12.92, ((values + .055) / 1.055) ** 2.4)


def linear_to_srgb(values):
    return np.where(values <= .0031308, values * 12.92, 1.055 * values ** (1/2.4) - .055)


def load_model(path):
    doc, binary, _ = builder.read_glb(path)
    parents = {child: i for i, node in enumerate(doc['nodes']) for child in node.get('children', [])}
    worlds = {}
    def world(i):
        if i not in worlds:
            worlds[i] = (world(parents[i]) if i in parents else np.eye(4)) @ transform(doc['nodes'][i])
        return worlds[i]
    textures = []
    for image in doc['images']:
        im = Image.open(io.BytesIO(builder.view_bytes(doc, binary, image['bufferView']))).convert('RGBA')
        textures.append(np.asarray(im, dtype=np.float32) / 255)
    streams = []
    for node_id, node in enumerate(doc['nodes']):
        if 'mesh' not in node:
            continue
        skin = doc['skins'][node['skin']] if 'skin' in node else None
        if skin:
            binds = builder.array(doc, binary, skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
            matrices = np.array([world(joint) @ bind for joint, bind in zip(skin['joints'], binds)])
        for primitive in doc['meshes'][node['mesh']]['primitives']:
            attr = primitive['attributes']
            points = builder.array(doc, binary, attr['POSITION']).astype(float)
            normals = builder.array(doc, binary, attr['NORMAL']).astype(float)
            points4 = np.column_stack([points, np.ones(len(points))])
            if skin:
                joints = builder.array(doc, binary, attr['JOINTS_0'])
                weights = builder.array(doc, binary, attr['WEIGHTS_0'])
                transformed = np.zeros_like(points4)
                transformed_normals = np.zeros_like(normals)
                for channel in range(4):
                    blend = weights[:, channel, None]
                    joint_matrices = matrices[joints[:, channel]]
                    transformed += np.einsum('nij,nj->ni', joint_matrices, points4) * blend
                    normal_matrices = np.linalg.inv(joint_matrices[:, :3, :3]).transpose(0, 2, 1)
                    transformed_normals += np.einsum('nij,nj->ni', normal_matrices, normals) * blend
                points = transformed[:, :3]
                normals = transformed_normals
            else:
                points = (points4 @ world(node_id).T)[:, :3]
                normals = normals @ np.linalg.inv(world(node_id)[:3, :3])
            # Match VRMUtils.rotateVRM0 in the website.
            if 'VRM' in doc.get('extensions', {}):
                points *= [-1, 1, -1]
                normals *= [-1, 1, -1]
            uv = builder.array(doc, binary, attr['TEXCOORD_0'])
            triangles = builder.array(doc, binary, primitive['indices']).reshape(-1, 3)
            mat = doc['materials'][primitive['material']]
            pbr = mat.get('pbrMetallicRoughness', {})
            tid = pbr.get('baseColorTexture', {}).get('index')
            texture = textures[doc['textures'][tid]['source']] if tid is not None else np.ones((1, 1, 4))
            factor = np.array(pbr.get('baseColorFactor', [1, 1, 1, 1]))
            streams.append((points, normals, uv, triangles, texture, factor, mat))
    all_points = np.concatenate([s[0] for s in streams])
    low, high = all_points.min(axis=0), all_points.max(axis=0)
    height = high[1] - low[1]
    for stream in streams:
        stream[0][:, 1] -= low[1]
        stream[0][:] /= height
    return streams


def sample_texture(texture, uv):
    # glTF UV origin is top left; use bilinear filtering with repeat wrap.
    u = np.mod(uv[:, 0], 1) * texture.shape[1] - .5
    v = np.mod(uv[:, 1], 1) * texture.shape[0] - .5
    x0, y0 = np.floor(u).astype(int), np.floor(v).astype(int)
    fx, fy = (u-x0)[:, None], (v-y0)[:, None]
    x1, y1 = (x0+1) % texture.shape[1], (y0+1) % texture.shape[0]
    x0, y0 = x0 % texture.shape[1], y0 % texture.shape[0]
    return ((texture[y0, x0]*(1-fx)+texture[y0, x1]*fx)*(1-fy) +
            (texture[y1, x0]*(1-fx)+texture[y1, x1]*fx)*fy)


def render(streams, yaw=0, close=False, size=640, framing=None):
    angle = math.radians(yaw)
    rotation = np.array([[math.cos(angle), 0, math.sin(angle)], [0, 1, 0],
                         [-math.sin(angle), 0, math.cos(angle)]])
    rotated = [(p @ rotation.T, n @ rotation.T, uv, tri, tex, factor, mat)
               for p, n, uv, tri, tex, factor, mat in streams]
    width, height = size, size if close else int(size * 1.15)
    if framing is not None:
        scale = min(width, height) * framing.get('scale', .85)
        cx, cy = framing.get('cx', 0), framing.get('cy', .5)
    elif close:
        scale, cx, cy = size / .285, 0, .875
    else:
        points = np.concatenate([r[0] for r in rotated])
        low, high = points.min(axis=0), points.max(axis=0)
        scale = min(width * .9 / (high[0]-low[0]), height * .9 / (high[1]-low[1]))
        cx, cy = (high[0]+low[0])*.5, .5
    background = np.array([.028, .039, .060])
    pixels = np.broadcast_to(background, (height, width, 3)).copy()
    depth = np.full((height, width), -np.inf)
    key_light = np.array([-.35, .5, 1]); key_light /= np.linalg.norm(key_light)
    fill_light = np.array([.7, .2, .7]); fill_light /= np.linalg.norm(fill_light)
    # Opaque first, then transparent. Z-test handles intersecting hair strips.
    rotated.sort(key=lambda s: s[-1].get('alphaMode') == 'BLEND')
    for points, normals, uv, triangles, texture, factor, mat in rotated:
        projected = np.column_stack([(points[:, 0]-cx)*scale+width/2,
                                     height/2-(points[:, 1]-cy)*scale])
        cutoff = mat.get('alphaCutoff', .5) if mat.get('alphaMode') == 'MASK' else .015
        if mat.get('alphaMode') == 'BLEND':
            triangles = triangles[np.argsort(points[triangles, 2].mean(axis=1))]
        for indices in triangles:
            xy = projected[indices]
            x0, y0 = np.maximum(np.floor(xy.min(axis=0)).astype(int), [0, 0])
            x1, y1 = np.minimum(np.ceil(xy.max(axis=0)).astype(int), [width-1, height-1])
            if x1 < x0 or y1 < y0:
                continue
            a, b, c = xy
            denom = (b[1]-c[1])*(a[0]-c[0]) + (c[0]-b[0])*(a[1]-c[1])
            if abs(denom) < 1e-7:
                continue
            yy, xx = np.mgrid[y0:y1+1, x0:x1+1]
            px, py = xx+.5, yy+.5
            wa = ((b[1]-c[1])*(px-c[0])+(c[0]-b[0])*(py-c[1]))/denom
            wb = ((c[1]-a[1])*(px-c[0])+(a[0]-c[0])*(py-c[1]))/denom
            wc = 1-wa-wb
            z = wa*points[indices[0], 2]+wb*points[indices[1], 2]+wc*points[indices[2], 2]
            mask = (wa >= -.0001) & (wb >= -.0001) & (wc >= -.0001) & (z > depth[yy, xx]+1e-8)
            if not mask.any():
                continue
            ys, xs = yy[mask], xx[mask]
            bary = np.column_stack([wa[mask], wb[mask], wc[mask]])
            sampled = sample_texture(texture, bary @ uv[indices])
            alpha = sampled[:, 3] * factor[3]
            if mat.get('alphaMode', 'OPAQUE') == 'OPAQUE':
                alpha[:] = 1
            keep = alpha >= cutoff
            if not keep.any():
                continue
            ys, xs = ys[keep], xs[keep]
            interp = bary[keep] @ normals[indices]
            interp /= np.maximum(np.linalg.norm(interp, axis=1, keepdims=True), 1e-7)
            if mat.get('doubleSided', False):
                interp *= np.where(interp[:, 2:3] < 0, -1, 1)
            illumination = .51+.36*np.clip(interp @ key_light, 0, 1)+.13*np.clip(interp @ fill_light, 0, 1)
            color = srgb_to_linear(sampled[keep, :3]) * factor[:3] * illumination[:, None]
            opacity = alpha[keep, None]
            pixels[ys, xs] = color*opacity + pixels[ys, xs]*(1-opacity)
            depth[ys, xs] = z[mask][keep]
    rgb = np.clip(linear_to_srgb(pixels)*255, 0, 255).astype(np.uint8)
    return Image.fromarray(rgb)


def label_font(size):
    try:
        return ImageFont.truetype('C:/Windows/Fonts/arial.ttf', size)
    except OSError:
        return ImageFont.load_default(size=size)


def make_comparison(source_dir, models_dir, output_dir, name, size):
    versions = [('OLD MOBILE / 512', source_dir / f'{name}-mobile.vrm'),
                ('WEB / 1024 FACE + HAIR', models_dir / f'{name}-web.vrm'),
                ('LITE / 1024 FACE', models_dir / f'{name}-lite.vrm')]
    models = [(label, load_model(path)) for label, path in versions]
    for view, yaw, close in [('full-front', 0, False), ('full-three-quarter', 35, False),
                             ('face-front', 0, True), ('face-side', 75, True)]:
        rendered = [(label, render(model, yaw, close, size)) for label, model in models]
        width, height = rendered[0][1].size
        sheet = Image.new('RGB', (width*3, height+110), '#0d1422')
        draw = ImageDraw.Draw(sheet)
        for i, (label, im) in enumerate(rendered):
            sheet.paste(im, (i*width, 56))
            draw.text((i*width+16, 18), label, font=label_font(19), fill='#dce7fa')
            draw.line((i*width, 56, i*width, height+56), fill='#465064')
        draw.text((16, height+72), f'{name} | {view} | Identical bind pose / camera / lighting; offline CPU render, not website screenshot.',
                  font=label_font(15), fill='#a5b8d4')
        target = output_dir / f'{name}-{view}.png'
        sheet.save(target, optimize=True)
        print(target.name, flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--models-dir', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--size', type=int, default=640)
    parser.add_argument('--model', choices=('traveler-male', 'traveler', 'all'), default='all')
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for name in ('traveler-male', 'traveler') if args.model == 'all' else (args.model,):
        make_comparison(args.source_dir, args.models_dir, args.output_dir, name, args.size)


if __name__ == '__main__':
    main()
