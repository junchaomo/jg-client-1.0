"""SHP / File Geodatabase bridge.

The product runtime keeps GDAL out of the Node process. This small bridge uses
pyogrio (GDAL) to inspect SHP / GDB / GeoJSON and to write real SHP sidecar
files or a File Geodatabase. Node passes a JSON manifest so a folder with many
shapefiles can be handled in one call.
"""
import json
import math
import os
import re
import sys
import zipfile
from pathlib import Path

import numpy as np
import pyogrio
import pyogrio.raw
from shapely import wkb
from shapely.geometry import mapping

MAX_CONVERT_FEATURES = 200000
INPUT_SUFFIXES = ('.shp', '.gdb', '.geojson', '.json')


def scalar(value):
    if value is None:
        return None
    if isinstance(value, np.bool_):
        return bool(value)
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.floating):
        value = float(value)
        return value if math.isfinite(value) else None
    if isinstance(value, np.datetime64):
        return str(value)
    if isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def kind_of(path):
    lower = str(path).lower()
    if lower.endswith('.gdb'):
        return 'gdb'
    if lower.endswith('.shp'):
        return 'shapefile'
    if lower.endswith('.geojson') or lower.endswith('.json'):
        return 'geojson'
    return 'dataset'


def label_of(path):
    kind = kind_of(path)
    if kind == 'gdb':
        return 'File Geodatabase (GDB)'
    if kind == 'shapefile':
        return 'Shapefile (SHP)'
    if kind == 'geojson':
        return 'GeoJSON'
    return '空间数据'


def safe_name(value, fallback='数据'):
    text = re.sub(r'[\\/:*?"<>|]+', '_', str(value or '')).strip()
    text = text.strip('. ')
    return text or fallback


def read_dataset(path, max_features):
    layers = pyogrio.list_layers(path)
    features = []
    total_features = 0
    layer_rows = []
    crs = ''
    fields = []
    geometry_types = set()
    bounds = None
    for layer_name, layer_geometry_type in layers:
        info = pyogrio.read_info(path, layer=layer_name)
        count = int(info.get('features') or 0)
        if count == 0:
            continue
        total_bound = info.get('total_bounds')
        if total_bound and len(total_bound) == 4:
            if bounds is None:
                bounds = [float(x) for x in total_bound]
            else:
                bounds[0] = min(bounds[0], float(total_bound[0]))
                bounds[1] = min(bounds[1], float(total_bound[1]))
                bounds[2] = max(bounds[2], float(total_bound[2]))
                bounds[3] = max(bounds[3], float(total_bound[3]))
        if not crs:
            crs = str(info.get('crs') or '')
        raw_fields = info.get('fields')
        for field in ([] if raw_fields is None else raw_fields):
            if str(field) not in fields:
                fields.append(str(field))
        total_features += count
        layer_rows.append({
            'name': str(layer_name),
            'geometryType': str(layer_geometry_type or info.get('geometry_type') or '未知'),
            'features': count,
            'crs': str(info.get('crs') or ''),
        })
        meta, fids, geometry, field_data = pyogrio.raw.read(
            path,
            layer=layer_name,
            max_features=max_features,
            force_2d=True,
            return_fids=True,
            datetime_as_string=True,
        )
        raw_names = meta.get('fields')
        field_names = [str(name) for name in (raw_names if raw_names is not None else [])]
        for index, raw_geometry in enumerate(geometry):
            if raw_geometry is None:
                continue
            try:
                geom = wkb.loads(bytes(raw_geometry))
            except Exception:
                continue
            if geom.is_empty:
                continue
            geometry_types.add(geom.geom_type)
            properties = {'layer': str(layer_name), 'fid': int(fids[index])}
            for column, values in zip(field_names, field_data):
                if column in properties:
                    continue
                properties[column] = scalar(values[index])
            features.append({
                'type': 'Feature',
                'properties': properties,
                'geometry': mapping(geom),
            })
    if not features:
        raise RuntimeError(f'数据集 {Path(path).name} 中没有可读取的二维几何对象')
    info0 = pyogrio.read_info(path, layer=layers[0][0])
    return {
        'format': 'gis',
        'formatLabel': label_of(path),
        'kind': kind_of(path),
        'driver': str(info0.get('driver') or ''),
        'name': Path(path).name,
        'datasetLabel': Path(path).stem,
        'layers': layer_rows,
        'fields': fields,
        'crs': crs or '未声明',
        'bbox': [round(float(value), 6) for value in bounds] if bounds else None,
        'totalFeatures': total_features,
        'geometryTypes': sorted(geometry_types),
        'geojson': {
            'type': 'FeatureCollection',
            'features': features,
        },
    }


def read_datasets(paths, max_features, display_name=None):
    payloads = [read_dataset(path, max_features) for path in paths]
    multiple = len(payloads) > 1
    features = []
    layer_rows = []
    fields = []
    crs_values = []
    bounds = None
    total = 0
    geometry_types = set()
    kinds = set()
    for payload in payloads:
        kinds.add(payload['kind'])
        if payload['crs'] and payload['crs'] != '未声明' and payload['crs'] not in crs_values:
            crs_values.append(payload['crs'])
        total += payload['totalFeatures']
        for field in payload['fields']:
            if field not in fields:
                fields.append(field)
        for geom in payload['geometryTypes']:
            geometry_types.add(geom)
        if payload['bbox']:
            box = payload['bbox']
            bounds = list(box) if bounds is None else [
                min(bounds[0], box[0]), min(bounds[1], box[1]),
                max(bounds[2], box[2]), max(bounds[3], box[3]),
            ]
        for layer in payload['layers']:
            layer = dict(layer)
            layer['dataset'] = payload['name']
            if multiple and layer['name'] != (payload.get('datasetLabel') or ''):
                layer['name'] = f"{payload.get('datasetLabel') or payload['name']}/{layer['name']}"
            layer_rows.append(layer)
        for feature in payload['geojson']['features']:
            feature['properties']['dataset'] = payload['name']
            features.append(feature)
    if kinds == {'shapefile'}:
        kind = 'shapefile'
        format_label = f'Shapefile (SHP) × {len(payloads)}' if multiple else 'Shapefile (SHP)'
    elif kinds == {'gdb'}:
        kind = 'gdb'
        format_label = 'File Geodatabase (GDB)'
    elif kinds == {'geojson'}:
        kind = 'geojson'
        format_label = 'GeoJSON'
    else:
        kind = 'mixed'
        format_label = 'SHP + GDB'
    return {
        'format': 'gis',
        'formatLabel': format_label,
        'kind': kind,
        'driver': 'OpenFileGDB' if kind == 'gdb' else 'ESRI Shapefile',
        'name': display_name or payloads[0]['name'],
        'sourceFiles': [payload['name'] for payload in payloads],
        'layers': layer_rows,
        'fields': fields,
        'crs': crs_values[0] if len(crs_values) == 1 else ('混合: ' + ' / '.join(crs_values) if crs_values else '未声明'),
        'crsList': crs_values,
        'crsMixed': len(crs_values) > 1,
        'bbox': bounds,
        'totalFeatures': total,
        'geometryTypes': sorted(geometry_types),
        'geojson': {
            'type': 'FeatureCollection',
            'features': features,
        },
    }


def collect_layers(paths):
    layers_out = []
    total = 0
    for path in paths:
        base = safe_name(Path(path).stem if kind_of(path) != 'gdb' else Path(path).stem)
        for layer_name, layer_geometry_type in pyogrio.list_layers(path):
            info = pyogrio.read_info(path, layer=layer_name)
            count = int(info.get('features') or 0)
            if count == 0:
                continue
            total += count
            if total > MAX_CONVERT_FEATURES:
                raise RuntimeError(f'要素数量超过 {MAX_CONVERT_FEATURES}，请先拆分数据集后再转换')
            meta, fids, geometry, field_data = pyogrio.raw.read(
                path,
                layer=layer_name,
                force_2d=True,
                return_fids=True,
                datetime_as_string=True,
            )
            raw_fields = meta.get('fields')
            fields = [str(name) for name in (raw_fields if raw_fields is not None else [])]
            geom_type = str(info.get('geometry_type') or layer_geometry_type or 'Unknown')
            if kind_of(path) == 'shapefile':
                layer_label = base
            elif kind_of(path) == 'gdb':
                layer_label = str(layer_name)
            else:
                layer_label = base
            layers_out.append({
                'path': path,
                'layer': layer_label,
                'sourceLayer': str(layer_name),
                'geometryType': geom_type,
                'crs': str(info.get('crs') or ''),
                'fields': fields,
                'geometry': geometry,
                'fieldData': field_data,
                'features': count,
            })
    if not layers_out:
        raise RuntimeError('没有可转换的几何图层')
    return layers_out


def unique_name(name, used):
    base = safe_name(name, 'layer')
    candidate = base
    index = 2
    while candidate.lower() in used:
        candidate = f'{base}_{index}'
        index += 1
    used.add(candidate.lower())
    return candidate


def convert_datasets(paths, out_dir, target, name='数据'):
    layers = collect_layers(paths)
    os.makedirs(out_dir, exist_ok=True)
    used = set()
    outputs = []
    layer_rows = []
    if target == 'gdb':
        gdb_name = safe_name(name, '数据')
        gdb_path = os.path.join(out_dir, gdb_name + '.gdb')
        for index, layer in enumerate(layers):
            layer_name = unique_name(layer['layer'], used)
            pyogrio.raw.write(
                gdb_path,
                layer['geometry'],
                layer['fieldData'],
                layer['fields'],
                layer=layer_name,
                driver='OpenFileGDB',
                geometry_type=layer['geometryType'],
                crs=layer['crs'] or None,
                append=index > 0,
                promote_to_multi=False,
                encoding='UTF-8',
            )
            layer_rows.append({
                'name': layer_name,
                'features': layer['features'],
                'geometryType': layer['geometryType'],
                'crs': layer['crs'],
            })
        zip_path = os.path.join(out_dir, gdb_name + '.gdb.zip')
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as archive:
            for root, _dirs, files in os.walk(gdb_path):
                for file_name in files:
                    full = os.path.join(root, file_name)
                    archive.write(full, os.path.relpath(full, out_dir))
        outputs.append({'name': os.path.basename(zip_path), 'path': zip_path, 'format': 'gdb'})
    elif target == 'shp':
        shp_dir = os.path.join(out_dir, 'shp')
        os.makedirs(shp_dir, exist_ok=True)
        for layer in layers:
            layer_name = unique_name(layer['layer'], used)
            shp_path = os.path.join(shp_dir, layer_name + '.shp')
            pyogrio.raw.write(
                shp_path,
                layer['geometry'],
                layer['fieldData'],
                layer['fields'],
                layer=layer_name,
                driver='ESRI Shapefile',
                geometry_type=layer['geometryType'],
                crs=layer['crs'] or None,
                promote_to_multi=False,
                encoding='UTF-8',
            )
            layer_rows.append({
                'name': layer_name,
                'features': layer['features'],
                'geometryType': layer['geometryType'],
                'crs': layer['crs'],
            })
        for file_name in sorted(os.listdir(shp_dir)):
            full = os.path.join(shp_dir, file_name)
            if os.path.isfile(full):
                outputs.append({'name': file_name, 'path': full, 'format': 'shp'})
    else:
        raise RuntimeError('输出目标只支持 shp 或 gdb')
    return {
        'ok': True,
        'target': target,
        'outputs': outputs,
        'layers': layer_rows,
        'features': sum(layer['features'] for layer in layers),
    }


def load_manifest(arg):
    if str(arg).startswith('@'):
        with open(str(arg)[1:], 'r', encoding='utf-8') as handle:
            return json.load(handle)
    return {'paths': [arg], 'maxFeatures': 2000}


def main():
    if len(sys.argv) < 3 or sys.argv[1] not in ('inspect', 'export', 'convert'):
        raise SystemExit('usage: gis-bridge.py inspect|export|convert @manifest.json')
    manifest = load_manifest(sys.argv[2])
    paths = [str(path) for path in (manifest.get('paths') or []) if str(path)]
    if not paths:
        raise SystemExit('manifest.paths 为空')
    command = sys.argv[1]
    if command == 'convert':
        result = convert_datasets(
            paths,
            str(manifest.get('outDir') or ''),
            str(manifest.get('target') or 'gdb'),
            str(manifest.get('name') or '数据'),
        )
        print(json.dumps(result, ensure_ascii=False, separators=(',', ':')))
        return
    max_features = manifest.get('maxFeatures')
    max_features = int(max_features) if max_features is not None else 2000
    result = read_datasets(paths, max_features if max_features > 0 else None, manifest.get('name'))
    if command == 'export':
        print(json.dumps(result['geojson'], ensure_ascii=False, separators=(',', ':')))
        return
    print(json.dumps(result, ensure_ascii=False, separators=(',', ':')))


if __name__ == '__main__':
    main()
