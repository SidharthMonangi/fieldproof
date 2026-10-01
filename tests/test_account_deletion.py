"""Exercise the actual deletion eligibility SQL against SQLite with foreign keys."""
import re
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QUERY = re.search(r'const eligible = `([^`]+)`', (ROOT / 'app/api/account/route.ts').read_text()).group(1)

class AccountDeletionTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.execute('PRAGMA foreign_keys=ON')
        for migration in sorted((ROOT / 'drizzle').glob('*.sql')):
            self.db.executescript(migration.read_text())
        self.db.execute("INSERT INTO workspaces VALUES ('personal','Personal','now')")
        self.db.execute("INSERT INTO members VALUES ('owner','personal','owner@example.test','Owner','admin')")
    def tearDown(self):
        self.db.close()
    def eligible(self, user='owner', workspace='personal'):
        return bool(self.db.execute(QUERY, (workspace,user)).fetchone())
    def test_empty_personal_workspace(self):
        self.assertTrue(self.eligible())
    def test_another_user_cannot_delete(self):
        self.assertFalse(self.eligible('outsider'))
    def test_non_admin_cannot_delete(self):
        self.db.execute("UPDATE members SET role='officer'")
        self.assertFalse(self.eligible())
    def test_team_workspace_cannot_delete(self):
        self.db.execute("INSERT INTO members VALUES ('teammate','personal','team@example.test','Team','officer')")
        self.assertFalse(self.eligible())
    def test_unfinished_file_cleanup_cannot_delete(self):
        self.db.execute("INSERT INTO file_cleanup VALUES ('job','personal','[]','now')")
        self.assertFalse(self.eligible())
    def test_even_archived_cases_block_deletion(self):
        self.db.execute("INSERT INTO cases VALUES ('case','personal','FP-1','{}','archived',1,'owner','owner','now','now','',NULL)")
        self.assertFalse(self.eligible())
    def test_cross_workspace_cannot_delete(self):
        self.db.execute("INSERT INTO workspaces VALUES ('other','Other','now')")
        self.db.execute("INSERT INTO members VALUES ('other-owner','other','other@example.test','Other','admin')")
        self.assertFalse(self.eligible(workspace='other'))

if __name__ == '__main__':
    unittest.main()
