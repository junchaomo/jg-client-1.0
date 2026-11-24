#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build the font bundle used by the self-hosted OnlyOffice container.

The source fonts are Fandol (GPL, see COPYING).  OnlyOffice keys fonts by
family name, while DOCX files only store the family name.  Rebuilding the name
table gives the Chinese document families deterministic aliases instead of
silently falling back to WenQuanYi Zen Hei on one machine and a Windows font on
another.

This does NOT change glyph outlines or metrics.  The aliases are deliberately
approximate for the proprietary GB2312 families; replace the source OTF files
with licensed originals later if byte-exact GB/T 9704 typography is required.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Iterable

from fontTools.ttLib import TTFont


# (source file, [(family name, typographic subfamily, output stem), ...])
ALIASES: dict[str, list[tuple[str, str, str]]] = {
    "FandolFang-Regular.otf": [
        ("仿宋", "Regular", "FangSong"),
        ("仿宋_GB2312", "Regular", "FangSong_GB2312"),
        ("方正仿宋简体", "Regular", "FZ_FangSong"),
        ("方正仿宋_GBK", "Regular", "FZ_FangSong_GBK"),
        ("华文仿宋", "Regular", "ST_FangSong"),
    ],
    "FandolKai-Regular.otf": [
        ("楷体", "Regular", "KaiTi"),
        ("楷体_GB2312", "Regular", "KaiTi_GB2312"),
        ("方正楷体简体", "Regular", "FZ_KaiTi"),
        ("方正楷体_GBK", "Regular", "FZ_KaiTi_GBK"),
        ("华文楷体", "Regular", "ST_KaiTi"),
    ],
    "FandolHei-Regular.otf": [
        ("黑体", "Regular", "SimHei"),
        ("微软雅黑", "Regular", "Microsoft_YaHei"),
        ("微软雅黑 Light", "Light", "Microsoft_YaHei_Light"),
        ("等线", "Regular", "DengXian"),
        ("等线 Light", "Light", "DengXian_Light"),
        ("方正黑体简体", "Regular", "FZ_Hei"),
        ("方正黑体_GBK", "Regular", "FZ_Hei_GBK"),
        ("华文黑体", "Regular", "ST_Hei"),
        ("华文细黑", "Regular", "ST_XiHei"),
        ("幼圆", "Regular", "YouYuan"),
    ],
    "FandolSong-Regular.otf": [
        ("宋体", "Regular", "SimSun"),
        ("新宋体", "Regular", "NSimSun"),
        ("方正书宋简体", "Regular", "FZ_ShuSong"),
        ("方正书宋_GBK", "Regular", "FZ_ShuSong_GBK"),
        ("华文宋体", "Regular", "ST_Song"),
        ("华文中宋", "Regular", "ST_ZhongSong"),
    ],
    "FandolSong-Bold.otf": [
        ("方正小标宋简体", "Regular", "FZ_XiaoBiaoSong"),
        ("方正小标宋_GBK", "Regular", "FZ_XiaoBiaoSong_GBK"),
        ("小标宋", "Regular", "XiaoBiaoSong"),
    ],
    "FandolHei-Bold.otf": [
        ("微软雅黑 Bold", "Bold", "Microsoft_YaHei_Bold"),
        ("等线 Bold", "Bold", "DengXian_Bold"),
        ("黑体 Bold", "Bold", "SimHei_Bold"),
    ],
}


def _name_records(font: TTFont, name_ids: Iterable[int]) -> list:
    wanted = set(name_ids)
    return [r for r in font["name"].names if r.nameID in wanted]


def _set_family_names(font: TTFont, family: str, subfamily: str, ps_name: str) -> None:
    """Set Windows/Unicode family records and remove MacRoman records.

    Chinese family names cannot be represented in MacRoman.  OnlyOffice's
    allfontsgen resolves Windows UTF-16 records, so dropping the old MacRoman
    family records avoids two competing family names in the same file.
    """
    name = font["name"]
    for record in list(name.names):
        if record.nameID in (1, 2, 3, 4, 6, 16, 17):
            name.names.remove(record)

    # Windows Unicode BMP (English language id is fine for a family name).
    name.setName(family, 1, 3, 1, 0x409)
    name.setName(subfamily, 2, 3, 1, 0x409)
    name.setName(f"JG-Office-{ps_name}", 3, 3, 1, 0x409)
    name.setName(family, 4, 3, 1, 0x409)
    name.setName(ps_name, 6, 3, 1, 0x409)
    name.setName(family, 16, 3, 1, 0x409)
    name.setName(subfamily, 17, 3, 1, 0x409)

    # Unicode platform record as a fallback for non-Windows consumers.
    name.setName(family, 1, 0, 3, 0)
    name.setName(subfamily, 2, 0, 3, 0)
    name.setName(f"JG-Office-{ps_name}", 3, 0, 3, 0)
    name.setName(family, 4, 0, 3, 0)
    name.setName(ps_name, 6, 0, 3, 0)
    name.setName(family, 16, 0, 3, 0)
    name.setName(subfamily, 17, 0, 3, 0)


def _set_weight(font: TTFont, subfamily: str) -> None:
    weight = 700 if subfamily.lower() == "bold" else 400
    if "OS/2" in font:
        font["OS/2"].usWeightClass = weight
        if weight == 700:
            font["OS/2"].fsSelection |= 1 << 5
        else:
            font["OS/2"].fsSelection &= ~(1 << 5)
    if "head" in font:
        mac_style = int(font["head"].macStyle)
        if weight == 700:
            mac_style |= 1
        else:
            mac_style &= ~1
        font["head"].macStyle = mac_style


def build(source_dir: Path, output_dir: Path) -> list[dict]:
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest: list[dict] = []
    for source_name, entries in ALIASES.items():
        source = source_dir / source_name
        if not source.exists():
            raise FileNotFoundError(source)
        for family, subfamily, stem in entries:
            out_name = f"{stem}.otf"
            font = TTFont(source)
            _set_family_names(font, family, subfamily, f"{stem}-Regular")
            _set_weight(font, subfamily)
            font.save(output_dir / out_name)
            manifest.append(
                {
                    "family": family,
                    "subfamily": subfamily,
                    "file": out_name,
                    "source": source_name,
                }
            )
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=Path(__file__).parent / "source")
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "aliases")
    args = parser.parse_args()
    manifest = build(args.source, args.output)
    (args.output / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"generated {len(manifest)} font aliases in {args.output}")


if __name__ == "__main__":
    main()
