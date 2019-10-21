#!/usr/bin/env python3

import sys
import struct
import json
import traceback
import importlib.util
import os.path
import re

class COLOR:
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'

DEBUG = os.environ.get('FUDOMO_DEBUG', None)

# Open file descriptors 3 and 4 for input and output, respectively.
# These are inherited from the calling process.
input = open(3, 'rb', buffering=0)
output = open(4, 'wb', buffering=0)

def _print(*args, **kwargs):
    if DEBUG:
        print(*args, file=sys.stderr, **kwargs)
        sys.stderr.flush()

class ObjectWrapper:
    def __init__(self, _type, _id):
        self.type = _type
        self.id = _id

    def __eq__(self, other):
        if isinstance(other, ObjectWrapper):
            return other.type == self.type and other.id == self.id
        return NotImplemented

    def __repr__(self):
        if hasattr(self, 'val'):
            return '<ObjectWrapper type="{}" id="{}" val="{}">'.format(self.type, self.id, self.val)
        return '<ObjectWrapper type="{}" id="{}">'.format(self.type, self.id)

class ObjectModelJSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectWrapper):
            return { 'type': o.type, 'id': o.id }
        return super().default(o)

def object_model_json_hook(obj):
    if 'type'in obj and 'id' in obj:
        res = ObjectWrapper(obj['type'], obj['id'])
        if 'val' in obj:
            res.val = obj['val']
        return res
    return obj

def readBytes(nr):
    res = b''
    to_read = nr
    while len(res) < nr:
        b = input.read(to_read)
        res += b
        to_read -= len(b)
    return res

def readObj():
    lengthBytes = readBytes(4)
    bytesToRead = struct.unpack('<I', lengthBytes)[0]
    payloadBytes = readBytes(bytesToRead)
    obj = json.loads(payloadBytes.decode('utf-8'), object_hook=object_model_json_hook)
    _print(f'{COLOR.BLUE}PY:  read {COLOR.ENDC}{obj}')
    return obj

def writeBytes(b):
    while len(b) > 0:
        written = output.write(b)
        b = b[written:]

def writeObj(obj):
    payloadBytes = json.dumps(obj, cls=ObjectModelJSONEncoder).encode('utf-8')
    writeBytes(struct.pack('<I', len(payloadBytes)))
    writeBytes(payloadBytes)
    _print(f'{COLOR.YELLOW}PY: wrote {COLOR.ENDC}{obj}')

with open(sys.argv[1], 'r', encoding='utf-8') as f:
    source_lines = f.readlines()

def writeException(e):
    t, v, tb = sys.exc_info()
    e_str = traceback.format_exception_only(t, v)[0].strip()
    stack = traceback.extract_tb(tb)
    if t == SyntaxError:
        e_str = 'SyntaxError: ' + e_str

    processed_stack = []
    for entry in stack:
        if entry.filename != __file__:
            orig_line = source_lines[entry.lineno - 1]
            start_col = len(re.match(r'^(\s*)[^\s]', orig_line).group(1)) + 1
            e = { 'filename': entry.filename, 'startLine': entry.lineno, 'endLine': entry.lineno, 'startCol': start_col, 'endCol': start_col + len(entry.line) }
            processed_stack.append(e)

    exc_obj = { 'message': e_str, 'stack': processed_stack }
    writeObj({ 'exception': exc_obj })

try:
    spec = importlib.util.spec_from_file_location(os.path.basename(sys.argv[1]), sys.argv[1])
    functions_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(functions_module)
    writeObj(True) # confirms that module was loaded without exception
except Exception as e:
    writeException(e)
    sys.exit(1)

while True:
    obj = readObj()

    if obj['op'] == 'exit':
        break

    if obj['op'] == 'hasFunction':
        name = obj['name']
        writeObj(hasattr(functions_module, name))

    if obj['op'] == 'callFunction':
        name = obj['name']
        args = obj['args']

        try:
            func = getattr(functions_module, name)
            result = func(*args) # TODO call function
            writeObj({ 'result': result })
        except Exception as e:
            writeException(e)
