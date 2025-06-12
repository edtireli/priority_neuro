import os, sys, json, uuid
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))
from utils.pilot_data import persist_pilot_json


def test_persist_pilot_json(tmp_path):
    jid = uuid.uuid4()
    csv_bytes = b"x,y\n0,1\n0.5,2"
    path = persist_pilot_json(csv_bytes, jid, str(tmp_path))
    assert os.path.exists(path)
    data = json.loads(open(path).read())
    assert data == [{"x": "0", "y": "1"}, {"x": "0.5", "y": "2"}]


def test_persist_pilot_json_error(tmp_path):
    jid = uuid.uuid4()
    bad = b'x,y\n"bad'
    try:
        persist_pilot_json(bad, jid, str(tmp_path))
    except ValueError:
        pass
    else:
        assert False, "Expected ValueError"

