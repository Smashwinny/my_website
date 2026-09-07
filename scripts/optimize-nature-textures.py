"""Build compact, glTF-core-compatible nature textures without changing meshes.

Requires Python 3.10+, Pillow, numpy. Example:
  python optimize-nature-textures.py --source public/models/nature --output build/nature

Source and output must be separate directories. No network, generated artwork,
new assets, or recompression of geometry is involved. JPEG is used only for
opaque COLOR textures. Tangent-space normal maps remain lossless PNG and are
filtered as numeric vectors (no sRGB conversion). All transparency stays PNG.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path

import numpy as np
import PIL
from PIL import Image, ImageDraw, ImageFont


MAX_EDGE = 1024
JPEG_QUALITY = 88
ALPHA_CUTOFF = 0.45  # Current environment.ts foliage alphaTest.


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def fit_size(size: tuple[int, int]) -> tuple[int, int]:
    scale = min(1.0, MAX_EDGE / max(size))
    return tuple(max(1, round(v * scale)) for v in size)


def float_resize(channel: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    return np.asarray(
        Image.fromarray(channel.astype(np.float32)).resize(size, Image.Resampling.LANCZOS)
    )


def resize_normal(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    # Numeric interpolation, not gamma-corrected COLOR interpolation. The
    # glTF normalTexture slot tells GLTFLoader to retain linear/NoColorSpace.
    xyz = np.asarray(image.convert("RGB"), dtype=np.float32) / 127.5 - 1.0
    xyz = np.stack([float_resize(xyz[:, :, i], size) for i in range(3)], axis=-1)
    length = np.linalg.norm(xyz, axis=-1, keepdims=True)
    xyz = xyz / np.maximum(length, 1e-8)
    return Image.fromarray(np.clip(np.rint((xyz + 1.0) * 127.5), 0, 255).astype(np.uint8))


def coverage(alpha: np.ndarray) -> float:
    return float(np.mean(alpha / 255.0 >= ALPHA_CUTOFF))


def resize_color(image: Image.Image, size: tuple[int, int], has_alpha: bool) -> Image.Image:
    if image.size == size:
        return image.convert("RGBA" if has_alpha else "RGB")
    # Premultiplied-alpha interpolation prevents the colors under fully
    # transparent pixels bleeding into visible leaf edges.
    rgba = np.asarray(image.convert("RGBA"), dtype=np.float32) / 255.0
    rgb, alpha = rgba[:, :, :3], rgba[:, :, 3]
    linear = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    out_alpha = np.clip(float_resize(alpha, size), 0, 1)
    channels = [float_resize(linear[:, :, i] * alpha, size) for i in range(3)]
    linear = np.stack(channels, axis=-1) / np.maximum(out_alpha[:, :, None], 1e-8)
    linear = np.clip(linear, 0, 1)
    rgb = np.where(linear <= 0.0031308, linear * 12.92, 1.055 * linear ** (1 / 2.4) - 0.055)
    if has_alpha:
        # Retain leaf silhouette coverage at the shader's actual alpha cutoff.
        target = coverage(rgba[:, :, 3] * 255)
        if abs(coverage(out_alpha * 255) - target) > 0.001:
            lo, hi = 0.25, 4.0
            for _ in range(20):
                scale = (lo + hi) / 2
                if coverage(np.clip(out_alpha * scale, 0, 1) * 255) < target:
                    lo = scale
                else:
                    hi = scale
            out_alpha = np.clip(out_alpha * ((lo + hi) / 2), 0, 1)
        return Image.fromarray(np.rint(np.dstack((rgb, out_alpha)) * 255).astype(np.uint8))
    return Image.fromarray(np.rint(rgb * 255).astype(np.uint8))


def preview_tile(path: Path, side: int = 320) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    image.thumbnail((side, side), Image.Resampling.LANCZOS)
    tile = Image.new("RGB", (side, side), "#ecebe7")
    draw = ImageDraw.Draw(tile)
    for y in range(0, side, 16):
        for x in range(0, side, 16):
            if (x // 16 + y // 16) % 2:
                draw.rectangle((x, y, x + 15, y + 15), fill="#c9cac6")
    tile.paste(image, ((side - image.width) // 2, (side - image.height) // 2), image)
    return tile


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    source, output = args.source.resolve(strict=True), args.output.resolve()
    if source == output or source in output.parents or output in source.parents:
        raise SystemExit("Source/output must be separate, non-nested directories.")
    output.mkdir(parents=True, exist_ok=True)
    report_path = output.parent / "texture-report.json"
    models = sorted(source.glob("*.gltf"))
    if not models:
        raise SystemExit("No source glTF files found.")
    documents = {p.name: json.loads(p.read_text(encoding="utf-8-sig")) for p in models}
    normal_images, image_uris = set(), set()
    for document in documents.values():
        for material in document.get("materials", []):
            if "normalTexture" in material:
                texture = document["textures"][material["normalTexture"]["index"]]
                normal_images.add(document["images"][texture["source"]]["uri"])
        image_uris.update(image["uri"] for image in document.get("images", []))
    if any(Path(uri).name != uri for uri in image_uris):
        raise SystemExit("Only sibling image URIs are supported.")

    records, mapping = [], {}
    for uri in sorted(image_uris):
        original = source / uri
        image = Image.open(original)
        image.load()
        size = fit_size(image.size)
        rgba = image.convert("RGBA")
        has_alpha = rgba.getchannel("A").getextrema()[0] < 255
        normal = uri in normal_images
        if normal and has_alpha:
            raise ValueError(f"Unexpected alpha in normal texture: {uri}")
        result = resize_normal(image, size) if normal else resize_color(image, size, has_alpha)
        suffix = ".png" if normal or has_alpha else ".jpg"
        destination = output / (original.stem + suffix)
        if suffix == ".png":
            result.save(destination, format="PNG", optimize=True, compress_level=9)
        else:
            result.convert("RGB").save(destination, format="JPEG", quality=JPEG_QUALITY, subsampling=0, optimize=True)
        mapping[uri] = destination.name
        decoded = Image.open(destination)
        entry = {
            "source": uri, "output": destination.name,
            "role": "normal-linear" if normal else "baseColor-sRGB",
            "source_size": list(image.size), "output_size": list(size),
            "source_bytes": original.stat().st_size, "output_bytes": destination.stat().st_size,
            "source_sha256": sha256(original), "output_sha256": sha256(destination),
            "has_transparency": has_alpha,
            "decoded_rgba8_bytes_before": image.width * image.height * 4,
            "decoded_rgba8_bytes_after": size[0] * size[1] * 4,
        }
        if has_alpha:
            before_alpha = np.asarray(rgba.getchannel("A"))
            after_alpha = np.asarray(decoded.convert("RGBA").getchannel("A"))
            entry.update({
                "alpha_coverage_before": coverage(before_alpha),
                "alpha_coverage_after": coverage(after_alpha),
                "alpha_exact_when_unscaled": bool(np.array_equal(before_alpha, after_alpha)) if image.size == size else None,
            })
            assert abs(entry["alpha_coverage_before"] - entry["alpha_coverage_after"]) < 0.01
            assert image.size != size or entry["alpha_exact_when_unscaled"]
        if normal:
            xyz = np.asarray(decoded.convert("RGB"), dtype=np.float32) / 127.5 - 1
            error = np.abs(np.linalg.norm(xyz, axis=-1) - 1)
            entry["normal_length_max_error"] = float(error.max())
            assert error.max() < 0.007
            assert "gamma" not in decoded.info and "icc_profile" not in decoded.info
        records.append(entry)

    binaries = {}
    for name, document in documents.items():
        for image in document.get("images", []):
            image["uri"] = mapping[image["uri"]]
            image["mimeType"] = "image/png" if image["uri"].endswith(".png") else "image/jpeg"
        for buffer in document.get("buffers", []):
            uri = buffer["uri"]
            if Path(uri).name != uri:
                raise ValueError(f"Unexpected non-sibling buffer: {uri}")
            shutil.copyfile(source / uri, output / uri)
            assert sha256(source / uri) == sha256(output / uri)
            binaries[uri] = {"bytes": (output / uri).stat().st_size, "sha256": sha256(output / uri)}
        (output / name).write_text(json.dumps(document, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    totals = {key: sum(record[key] for record in records) for key in (
        "source_bytes", "output_bytes", "decoded_rgba8_bytes_before", "decoded_rgba8_bytes_after"
    )}
    totals["transfer_reduction_percent"] = (1 - totals["output_bytes"] / totals["source_bytes"]) * 100
    totals["decoded_texel_reduction_percent"] = (1 - totals["decoded_rgba8_bytes_after"] / totals["decoded_rgba8_bytes_before"]) * 100
    totals["unmodified_geometry_bytes"] = sum(item["bytes"] for item in binaries.values())
    assert totals["transfer_reduction_percent"] >= 70
    report = {"tool_versions": {"Pillow": PIL.__version__, "numpy": np.__version__},
        "settings": {"max_edge": MAX_EDGE, "jpeg_quality": JPEG_QUALITY,
        "jpeg_chroma_subsampling": "4:4:4", "alpha_cutoff": ALPHA_CUTOFF,
        "notes": "GPU RGBA8 sizes are estimates before mipmaps; not measured load timings."},
        "totals": totals, "textures": records, "unchanged_binaries": binaries}
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    selected = [record for record in records if record["source"] in {
        "Bark_NormalTree.png", "Bark_NormalTree_Normal.png", "Bark_TwistedTree.png",
        "Bark_TwistedTree_Normal.png", "Leaves.png", "Leaves_NormalTree_C.png", "Flowers.png", "Rocks_Diffuse.png"
    }]
    sheet = Image.new("RGB", (680, 394 * len(selected) + 64), "#f7f6f1")
    draw = ImageDraw.Draw(sheet)
    font_path = Path("C:/Windows/Fonts/consola.ttf")
    font = ImageFont.truetype(str(font_path), 16) if font_path.is_file() else ImageFont.load_default()
    draw.text((16, 16), "SOURCE (left) / OPTIMIZED (right); matched display size", font=font, fill="#222b27")
    for index, record in enumerate(selected):
        y = 64 + index * 394
        draw.text((16, y), record["source"], font=font, fill="#222b27")
        draw.text((16, y + 24), f'{record["source_bytes"] / 1024:.0f} KB -> {record["output_bytes"] / 1024:.0f} KB   {record["source_size"]} -> {record["output_size"]}', font=font, fill="#44574d")
        sheet.paste(preview_tile(source / record["source"]), (16, y + 54))
        sheet.paste(preview_tile(output / record["output"]), (344, y + 54))
    sheet.save(output.parent / "texture-comparison.jpg", quality=92, subsampling=0)
    print(json.dumps(totals, indent=2))
    print(f"Validated {len(records)} textures, {len(documents)} glTF files, {len(binaries)} unchanged buffers.")
    print(f"Output: {output}")


if __name__ == "__main__":
    main()
