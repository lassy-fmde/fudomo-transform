import sys
import json

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

def decodeObj(bs):
    if isinstance(bs, bytes):
        s = bs.decode('utf-8')
    elif isinstance(bs, str):
        s = bs
    return json.loads(s, object_hook=object_model_json_hook)

def encodeObj(obj):
    return json.dumps(obj, cls=ObjectModelJSONEncoder).encode('utf-8')

def encodeException(e):
    t, v, tb = sys.exc_info()
    e_str = traceback.format_exception_only(t, v)[0].strip()
    stack = traceback.extract_tb(tb)
    if t == SyntaxError:
        e_str = 'SyntaxError: ' + e_str

    processed_stack = []
    for entry in stack:
        if entry.filename != __file__:

            orig_line = entry.line
            if not orig_line:
                try:
                    orig_line = source_lines[entry.lineno - 1]
                except IndexError:
                    orig_line = None

            if orig_line:
                start_col = len(re.match(r'^(\s*)[^\s]', orig_line).group(1)) + 1
            else:
                start_col = 0
            e = { 'filename': entry.filename, 'startLine': entry.lineno, 'endLine': entry.lineno, 'startCol': start_col, 'endCol': start_col + len(entry.line) }
            processed_stack.append(e)

    exc_obj = { 'message': e_str, 'stack': processed_stack }
    return { 'exception': exc_obj }
