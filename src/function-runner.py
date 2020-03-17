#!/usr/bin/env python3

import sys
import struct
import json
import traceback
import importlib.util
import os.path
import re
import inspect

from function_runner_base import encodeObj, decodeObj, encodeException

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
    obj = decodeObj(payloadBytes)
    _print(f'{COLOR.BLUE}PY:  read {COLOR.ENDC}{obj}')
    return obj

def writeBytes(b):
    while len(b) > 0:
        written = output.write(b)
        b = b[written:]

def writeObj(obj):
    payloadBytes = encodeObj(obj)
    writeBytes(struct.pack('<I', len(payloadBytes)))
    writeBytes(payloadBytes)
    _print(f'{COLOR.YELLOW}PY: wrote {COLOR.ENDC}{obj}')

with open(sys.argv[1], 'r', encoding='utf-8') as f:
    source_lines = f.readlines()

def writeException(e):
    writeObj(encodeException(e))

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

    if obj['op'] == 'validateFunction':
        functionName = obj['functionName']
        parameterNames = obj['parameterNames']

        errors = []
        func = getattr(functions_module, functionName, None)
        if func is None:
            errors.append(f'Expected implementation of decomposition function "{functionName}" not found.')
        else:
            sig = inspect.signature(func)
            actualParamNames = [name for name in sig.parameters.keys()]
            if parameterNames != actualParamNames:
                errors.append(f'''Implementation of decomposition function "{functionName}" does not have expected parameters "{', '.join(parameterNames)}"''')
            # TODO could check parameter type (keyword, *, **)
        writeObj(errors)
