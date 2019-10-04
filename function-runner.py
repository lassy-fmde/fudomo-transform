#!/usr/bin/env python3

import sys
import struct
import json
import traceback
import importlib
import os.path
import re

DEBUG = False

# Open file descriptors 3 and 4 for input and output, respectively.
# These are inherited from the calling process.
input = open(3, 'rb', buffering=0)
output = open(4, 'wb', buffering=0)

def _print(*args, **kwargs):
    if DEBUG:
        print(*args, file=sys.stderr, **kwargs)
        sys.stderr.flush()

def readObj():
    lengthBytes = input.read(4)
    length = struct.unpack('<I', lengthBytes)[0]
    payloadBytes = input.read(length)
    obj = json.loads(payloadBytes.decode('utf-8'))
    _print(f'PY:  read {obj}')
    return obj

def writeObj(obj):
    payloadBytes = json.dumps(obj).encode('utf-8')
    output.write(struct.pack('<I', len(payloadBytes)))
    output.write(payloadBytes)
    output.flush()
    _print(f'PY: wrote {obj}')

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
