import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.logic import classify_interaction
from backend.store import connect, initialize


class RuleTests(unittest.TestCase):
    def test_two_minute_call_does_not_count(self):
        self.assertEqual(classify_interaction({'kind':'call','connected':True,'duration_seconds':120,'direction':'outbound'})[:2],(False,False))

    def test_call_over_two_minutes_counts(self):
        self.assertEqual(classify_interaction({'kind':'call','connected':True,'duration_seconds':121,'direction':'outbound'})[:2],(True,True))

    def test_missed_call_does_not_count(self):
        self.assertEqual(classify_interaction({'kind':'call','connected':False,'duration_seconds':300,'direction':'outbound'})[:2],(False,False))

    def test_meaningful_outreach_not_necessarily_engagement(self):
        self.assertEqual(classify_interaction({'kind':'email','meaningful':True,'direction':'outbound'})[:2],(True,False))

    def test_two_way_reply_updates_engagement(self):
        self.assertEqual(classify_interaction({'kind':'email','meaningful':True,'direction':'inbound','two_way':True})[:2],(False,True))

    def test_small_acknowledgement_not_meaningful(self):
        self.assertEqual(classify_interaction({'kind':'email','meaningful':False,'direction':'outbound','two_way':True})[:2],(False,False))

    def test_calendar_inferred_attended(self):
        self.assertEqual(classify_interaction({'kind':'calendar','attendance':'inferred'})[:2],(False,True))

    def test_calendar_cancelled_not_attended(self):
        self.assertEqual(classify_interaction({'kind':'calendar','attendance':'canceled'})[:2],(False,False))

    def test_database_schema_initialization(self):
        with tempfile.TemporaryDirectory() as temp:
            database = Path(temp)/'temp.db'
            initialize(database)
            with connect(database) as db:
                tables = [r['name'] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")]
                self.assertIn('contacts',tables)
                self.assertIn('open_promises',tables)
                self.assertIn('workspaces',tables)
                self.assertEqual(db.execute('SELECT COUNT(*) FROM workspaces').fetchone()[0],2)

if __name__ == '__main__': unittest.main()
