"""Validate a workspace export and restore it into a NEW, isolated recovery folder.
Never edits the running application. Usage: python scripts/restore-backup.py backup.json new-folder
"""
import base64
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import sys
import tempfile
import os

TABLES = ['workspaces', 'members', 'invitations', 'cases', 'visits', 'files', 'audit', 'knowledge']

def restore(source, destination):
    target = Path(destination).resolve()
    if target.exists():
        raise ValueError('Choose a new recovery folder; existing folders are never overwritten.')
    source = Path(source)
    if source.stat().st_size > 45 * 1024 * 1024:
        raise ValueError('Backup exceeds recovery size limit.')
    backup = json.loads(source.read_text(encoding='utf-8'))
    if backup.get('format') != 'fieldproof-workspace-export-v1':
        raise ValueError('Unsupported backup format.')
    records = backup['records']
    if set(records) != set(TABLES) or len(records['workspaces']) != 1:
        raise ValueError('Backup must contain exactly one workspace and the expected tables.')
    workspace = records['workspaces'][0]['id']
    for table in ['members', 'invitations', 'cases', 'knowledge']:
        if any(row['workspaceId'] != workspace for row in records[table]):
            raise ValueError('Backup contains a different workspace.')
    case_ids = {row['id'] for row in records['cases']}
    for table in ['visits', 'files', 'audit']:
        if any(row['caseId'] not in case_ids for row in records[table]):
            raise ValueError('Backup contains orphaned case details.')
    attachments = {entry['id']: entry for entry in backup['attachments']}
    if len(attachments) != len(backup['attachments']) or set(attachments) != {row['id'] for row in records['files']}:
        raise ValueError('Attachment set is incomplete or duplicated.')
    decoded = []
    total = 0
    for row in records['files']:
        key = row['objectKey']
        if not re.fullmatch(r'[a-zA-Z0-9-]+/[a-zA-Z0-9-]+/[a-zA-Z0-9-]+', key) or key.split('/')[:2] != [workspace, row['caseId']]:
            raise ValueError('Unsafe attachment object key.')
        entry = attachments[row['id']]
        data = base64.b64decode(entry['base64'], validate=True)
        total += len(data)
        if total > 25 * 1024 * 1024 or len(data) != row['size']:
            raise ValueError('Attachment size check failed.')
        digest = hashlib.sha256(data).hexdigest()
        if digest != row['sha256'] or digest != entry['sha256']:
            raise ValueError('Attachment integrity check failed.')
        decoded.append((key, data))
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='fieldproof-recovery-', dir=target.parent) as temporary:
        folder = Path(temporary)
        db = sqlite3.connect(folder / 'recovered.sqlite')
        try:
            db.execute('PRAGMA foreign_keys = ON')
            migration = Path(__file__).resolve().parents[1] / 'drizzle/0000_aromatic_unus.sql'
            db.executescript(migration.read_text(encoding='utf-8'))
            with db:
                for table in TABLES:
                    columns = [row[1] for row in db.execute(f'PRAGMA table_info("{table}")')]
                    for record in records[table]:
                        if set(record) != set(columns):
                            raise ValueError('Backup columns do not match the recovery schema.')
                        db.execute(f'INSERT INTO "{table}" ({",".join(columns)}) VALUES ({",".join("?" for _ in columns)})', [record[column] for column in columns])
            if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or db.execute('PRAGMA foreign_key_check').fetchall():
                raise ValueError('Recovered database failed its integrity checks.')
        finally:
            db.close()
        for key, data in decoded:
            file = folder / 'objects' / key
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(data)
        (folder / 'RECOVERY.txt').write_text('Validated isolated recovery. Contains private data. Not installed into the live app.\n')
        # Publish only after every database and attachment check succeeds.
        os.rename(folder, target)
    return len(records['cases']), len(decoded)

if __name__ == '__main__':
    try:
        cases, attachments = restore(sys.argv[1], sys.argv[2])
        print(f'Recovery verified: {cases} cases, {attachments} attachments. Live application unchanged.')
    except (ValueError, KeyError, IndexError, OSError, sqlite3.Error) as error:
        print('Recovery stopped:', str(error), file=sys.stderr)
        sys.exit(1)
