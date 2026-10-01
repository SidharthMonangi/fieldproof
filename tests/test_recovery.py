import base64
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('recovery', ROOT / 'scripts/restore-backup.py')
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)

def fixture():
    db = sqlite3.connect(':memory:')
    db.row_factory = sqlite3.Row
    db.executescript((ROOT / 'drizzle/0000_aromatic_unus.sql').read_text())
    db.execute("INSERT INTO workspaces VALUES ('workspace','Fictional recovery','2026-10-01')")
    db.execute("INSERT INTO members VALUES ('admin','workspace','admin@example.test','Fictional admin','admin')")
    db.execute("INSERT INTO cases VALUES ('case','workspace','FP-TEST','{}','draft',1,'admin','admin','2026-10-01','2026-10-01','',NULL)")
    data = b'%PDF-1.4 fictional recovery fixture'
    digest = hashlib.sha256(data).hexdigest()
    db.execute('INSERT INTO files VALUES (?,?,?,?,?,?,?,?,?,?)', ('file','case','admin','fictional.pdf','income','application/pdf',len(data),'workspace/case/file',digest,'2026-10-01'))
    records = {table: [dict(row) for row in db.execute(f'SELECT * FROM {table}')] for table in recovery.TABLES}
    db.close()
    return {'format':'fieldproof-workspace-export-v1','records':records,'attachments':[{'id':'file','sha256':digest,'base64':base64.b64encode(data).decode()}]}

class RecoveryTests(unittest.TestCase):
    def run_recovery(self, backup):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'backup.json'
            path.write_text(json.dumps(backup))
            target = Path(folder) / 'recovered'
            result = recovery.restore(path, target)
            db = sqlite3.connect(target / 'recovered.sqlite')
            self.assertEqual(db.execute('SELECT COUNT(*) FROM cases').fetchone()[0], 1)
            db.close()
            self.assertEqual((target / 'objects/workspace/case/file').read_bytes(), b'%PDF-1.4 fictional recovery fixture')
            return result

    def test_record_and_attachment_round_trip(self):
        self.assertEqual(self.run_recovery(fixture()), (1, 1))

    def test_tampering_rejected(self):
        backup = fixture(); backup['attachments'][0]['base64'] = base64.b64encode(b'tampered').decode()
        with self.assertRaises(ValueError): self.run_recovery(backup)

    def test_path_traversal_rejected(self):
        backup = fixture(); backup['records']['files'][0]['objectKey'] = '../outside/file'
        with self.assertRaises(ValueError): self.run_recovery(backup)

    def test_cross_workspace_rejected(self):
        backup = fixture(); backup['records']['cases'][0]['workspaceId'] = 'someone-else'
        with self.assertRaises(ValueError): self.run_recovery(backup)

    def test_duplicate_attachment_rejected(self):
        backup = fixture(); backup['attachments'].append(copy.deepcopy(backup['attachments'][0]))
        with self.assertRaises(ValueError): self.run_recovery(backup)

    def test_existing_destination_preserved(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(ValueError): recovery.restore(Path(folder)/'unused.json', folder)

if __name__ == '__main__': unittest.main()
