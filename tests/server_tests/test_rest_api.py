import json
from typing import Any

from fastapi.testclient import TestClient

from server.main import app

client = TestClient(app)


def _create_session() -> str:
    r = client.post('/api/session')
    assert r.status_code == 200, r.text
    data = r.json()
    assert 'client_id' in data
    return data['client_id']


def test_session_lifecycle():
    client_id = _create_session()

    # list files for fresh session
    r = client.get(f'/api/{client_id}/library/files')
    assert r.status_code == 200
    files = r.json()
    assert 'yaml_files' in files and 'csv_files' in files

    # end session
    r = client.delete(f'/api/session/{client_id}')
    assert r.status_code == 200
    assert r.json().get('status') == 'ended'

    # using ended id should 404
    r = client.get(f'/api/{client_id}/library/files')
    assert r.status_code == 404


def test_saved_libraries_listing():
    r = client.get('/api/saved')
    assert r.status_code == 200
    data = r.json()
    assert 'dirs' in data and isinstance(data['dirs'], list)


def test_file_crud_flow():
    client_id = _create_session()

    # add base.yaml
    payload = { 'file_path': 'project/config/base.yaml', 'content': { 'foo': 'bar' } }
    r = client.post(f'/api/{client_id}/library/file', json=payload)
    assert r.status_code == 200
    assert r.json().get('ok') is True

    # read logical (parsed)
    r = client.get(f'/api/{client_id}/library/file', params={'path':'project/config/base.yaml', 'raw':'false'})
    assert r.status_code == 200
    body = r.json()
    assert body.get('file') == 'project/config/base.yaml'
    assert isinstance(body.get('data'), (dict, list))

    # replace
    payload = { 'file_path': 'project/config/base.yaml', 'content': { 'foo': 'baz' } }
    r = client.put(f'/api/{client_id}/library/file', json=payload)
    assert r.status_code == 200
    assert r.json().get('ok') is True

    # delete
    r = client.delete(f'/api/{client_id}/library/file', params={'file_path': 'project/config/base.yaml'})
    assert r.status_code == 200
    assert r.json().get('ok') is True


def test_get_config_fallback_and_override():
    client_id = _create_session()

    # fallback when no config exists
    r = client.get(f'/api/{client_id}/config')
    assert r.status_code == 200
    fallback = r.json()
    assert isinstance(fallback, (dict, list))

    # add base.yaml and ensure override
    payload = { 'file_path': 'project/config/base.yaml', 'content': { 'hello': 'world' } }
    r = client.post(f'/api/{client_id}/library/file', json=payload)
    assert r.status_code == 200

    r = client.get(f'/api/{client_id}/config')
    assert r.status_code == 200
    cfg = r.json()
    assert isinstance(cfg, (dict, list))
    # our custom content should be present
    assert ('hello' in cfg and cfg['hello'] == 'world') or cfg == {'hello':'world'}


def test_run_simulation():
    client_id = _create_session()

    # run
    r = client.post(f'/api/{client_id}/simulate')
    assert r.status_code == 200
    data = r.json()
    assert data.get('status') == 'finished'
    assert 'results' in data
    assert 'files' in data

    # results file listing available
    r = client.get(f'/api/{client_id}/library/files')
    assert r.status_code == 200
    files = r.json()
    assert 'yaml_files' in files and 'csv_files' in files
